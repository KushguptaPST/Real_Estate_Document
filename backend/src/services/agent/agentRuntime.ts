// ─────────────────────────────────────────────────────────────────────────────
// Agent Runtime — Multi-Agent Bounded Execution Loop, Guardrails & Traceability
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';
import {
  type AgentSpecialist,
  type LeadLifecycleStage,
  type MessageChannel,
  type UserRole,
} from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { requireOrgId } from '../../utils/tenant.js';
import { getPlatformConfig } from '../platformConfig.service.js';
import { recordGeminiCost } from '../costTracker.service.js';
import {
  AGENT_FUNCTION_DECLARATIONS,
  executeAgentTool,
  type TrustedAgentContext,
} from './agentTools.js';
import {
  computeNextStage,
  isExplicitHumanRequest,
  isOptOutOrDnd,
  recordAgentRunTrace,
  routeToSpecialist,
  verifyAgentOutput,
} from './orchestrator.js';

export const MAX_AGENT_ROUNDS = 5;

export { isExplicitHumanRequest };

export interface RunSalesAgentParams {
  leadId: string;
  organizationId: string;
  threadId: string;
  userId?: string;
  callerRole?: UserRole;
  callerEmail?: string;
  customerMessage: string;
  recentMessages?: Array<{ senderType: string; content: string }>;
  aiClient?: any;
  customerName?: string;
  channel?: MessageChannel;
}

export interface ExecutedToolRecord {
  toolName: string;
  status: 'SUCCESS' | 'ERROR';
  durationMs: number;
}

export interface SalesAgentResult {
  response: string;
  suggestedFollowUps: string[];
  reasoning: string;
  executedTools: ExecutedToolRecord[];
  taskProposal?: unknown;
  requirementProposal?: unknown;
  qualificationResult?: unknown;
  siteVisitProposal?: unknown;
  siteVisitBooking?: unknown;
  escalation?: unknown;
  followUpProposal?: unknown;
  collateralSent?: unknown;
  matchedProperties?: Array<{
    id: string;
    title: string;
    city: string;
    price: number;
    bedrooms: number;
    brochureUrl?: string | null;
    mapsUrl?: string | null;
  }>;
  specialist?: AgentSpecialist;
  stage?: LeadLifecycleStage;
  guardrailFlags?: string[];
  exhaustedLimit: boolean;
  suppressed?: boolean;
  suppressedReason?: string;
}

const BASE_SYSTEM_INSTRUCTION = `You are a Senior Real Estate Advisory Partner representing a brokerage channel partner.
You speak warmly, concisely, and authentically like an experienced human property consultant.
NEVER invent properties, prices, RERA IDs, possession dates, or amenities that were not returned by a tool.

CORE OPERATING RULES:
1. QUALIFICATION FIRST:
   - Discover the buyer's preferred micro-market/location, budget ceiling, configuration (e.g., 2BHK/3BHK/villa), and move-in timeline.
   - Call "propose_buyer_requirements" whenever the buyer states preferences.
   - Call "evaluate_buyer_qualification" once preferences are known.
2. VERIFIED INVENTORY & ELASTIC MATCHING:
   - Always call "search_properties" before recommending any property.
   - Pitch at most 1 or 2 verified properties by exact title and price. If exact matches are empty, suggest the nearby/stretch options returned by "search_properties".
3. COLLATERAL & KNOWLEDGE:
   - If the buyer asks for a brochure, floor plan, or location pin, call "send_property_collateral" with the verified propertyId.
   - If the buyer asks about RERA, approvals, payment plans, or specs, call "query_project_knowledge".
4. SITE VISIT LOCK & ADVISOR HANDOFF:
   - Offer 2 specific slots using "check_site_visit_availability".
   - ONLY call "book_site_visit" after the buyer explicitly agrees to a date and time.
   - Call "escalate_to_human" when the buyer asks for a human advisor, requests binding price cuts/discounts, or raises legal/financing disputes.
5. NO BULLET ESSAYS:
   - Keep replies conversational, plain text, and end with strictly ONE clear follow-up question.`;

function formatCurrencyShort(amount: number, currency = 'INR'): string {
  if (currency === 'USD') {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2).replace(/\.00$/, '')}M`;
    if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
    return `$${amount.toLocaleString('en-US')}`;
  }
  if (amount >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1')} Cr`;
  }
  if (amount >= 100_000) {
    return `₹${(amount / 100_000).toFixed(2).replace(/\.00$/, '').replace(/(\.[0-9])0$/, '$1')} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Strictly DB-grounded fallback when the cloud LLM is unavailable or API key is unset.
 * Never invents hardcoded project names—only references verified properties in the org's DB.
 */
async function generateConsultativeFallback(params: {
  customerMessage: string;
  leadId: string;
  organizationId: string;
  executedTools: ExecutedToolRecord[];
  reason: string;
  customerName?: string;
  currency?: string;
}): Promise<SalesAgentResult> {
  const { customerMessage, organizationId, executedTools, reason, customerName, currency = 'INR' } = params;
  const lower = customerMessage.toLowerCase();
  const firstName = customerName ? customerName.split(' ')[0] : '';
  const greeting = firstName ? `Hey ${firstName},` : 'Hey!';

  const bedroomsMatch = customerMessage.match(/(\d+)\s*(?:bhk|bed|bedroom)/i);
  const requestedBedrooms = bedroomsMatch ? parseInt(bedroomsMatch[1]!, 10) : undefined;

  const matchedProps = await prisma.property.findMany({
    where: {
      organizationId,
      status: 'AVAILABLE',
      ...(requestedBedrooms ? { bedrooms: { gte: requestedBedrooms } } : {}),
    },
    take: 2,
    orderBy: { createdAt: 'desc' },
  });

  let response = '';
  const suggestedFollowUps: string[] = [];

  if (matchedProps.length > 0) {
    const summaryList = matchedProps
      .map((p) => `${p.title} in ${p.microMarket || p.city} at ${formatCurrencyShort(p.price, currency)}`)
      .join(' and ');
    const wantsBrochure = /\b(brochure|pdf|floor\s*plan|details)\b/i.test(lower);

    response = wantsBrochure
      ? `${greeting} we have ${summaryList} available right now. Could you confirm your target budget and preferred move-in timeline so I can share the right floor plan and schedule a visit?`
      : `${greeting} thanks for reaching out! From our active inventory we currently have ${summaryList}. Which micro-market and budget range are you targeting so I can narrow this down for you?`;

    for (const p of matchedProps) {
      suggestedFollowUps.push(`Send brochure for ${p.title}`);
    }
    suggestedFollowUps.push('Schedule a site visit');
  } else {
    response = `${greeting} thanks for reaching out! Could you share your preferred location, approximate budget, and configuration (like 2BHK or 3BHK) so our advisor can match the best options for you?`;
    suggestedFollowUps.push('Share budget & configuration');
    suggestedFollowUps.push('Request advisor callback');
  }

  return {
    response,
    suggestedFollowUps: suggestedFollowUps.slice(0, 3),
    reasoning: `DB-grounded fallback response: ${reason}`,
    executedTools,
    matchedProperties: matchedProps.map((p) => ({
      id: p.id,
      title: p.title,
      city: p.city,
      price: p.price,
      bedrooms: p.bedrooms,
      brochureUrl: p.brochureUrl,
      mapsUrl: p.mapsUrl,
    })),
    exhaustedLimit: false,
  };
}

/**
 * Executes the bounded multi-agent execution loop with specialist routing,
 * takeover & DND guards, verifiable tools, and persistent trace logging.
 */
export async function runSalesAgentLoop(params: RunSalesAgentParams): Promise<SalesAgentResult> {
  const startTime = Date.now();
  const { leadId, threadId, customerMessage, recentMessages = [] } = params;
  const orgId = requireOrgId(params.organizationId);

  const trustedContext: TrustedAgentContext = {
    organizationId: orgId,
    userId: params.userId,
    callerRole: params.callerRole,
    callerEmail: params.callerEmail,
    leadId,
    threadId,
  };

  // 1. Mandatory Thread & Lead Verification
  const [thread, leadRecord, orgChannel] = await Promise.all([
    prisma.conversationThread.findFirst({
      where: { id: threadId, organizationId: orgId },
    }),
    prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
      include: { requirements: true, _count: { select: { matches: true } } },
    }),
    prisma.organizationChannel.findUnique({
      where: { organizationId: orgId },
      select: { defaultCurrency: true },
    }),
  ]);

  if (!thread) {
    throw new Error(`Conversation thread ${threadId} not found in organization ${orgId}`);
  }
  if (!leadRecord) {
    throw new Error(`Lead ${leadId} not found in organization ${orgId}`);
  }

  const effectiveChannel: MessageChannel = params.channel ?? thread.channel;
  const stageBefore: LeadLifecycleStage = leadRecord.stage ?? 'NEW_INBOUND';
  const currency = orgChannel?.defaultCurrency ?? 'INR';

  if (
    thread.state === 'HUMAN_TAKEOVER' ||
    thread.isHumanTakeover ||
    thread.state === 'PAUSED' ||
    thread.state === 'CLOSED'
  ) {
    logger.info(`[Agent Runtime] Suppressed for thread ${threadId}: state is ${thread.state}`);
    return {
      response: '',
      suggestedFollowUps: [],
      reasoning: 'Suppressed due to active human takeover or paused state',
      executedTools: [],
      stage: stageBefore,
      exhaustedLimit: false,
      suppressed: true,
      suppressedReason: 'Human takeover is active. Automated agent execution is disabled.',
    };
  }

  // 1b. Deterministic DND / Opt-Out Safeguard
  if (isOptOutOrDnd(customerMessage)) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { doNotCall: true, stage: 'DISQUALIFIED', status: 'LOST' },
    });
    await prisma.conversationThread.update({
      where: { id: threadId },
      data: { state: 'CLOSED', autoReplyEnabled: false },
    });

    await recordAgentRunTrace({
      organizationId: orgId,
      leadId,
      threadId,
      channel: effectiveChannel,
      specialist: 'ESCALATION',
      intent: 'OPTOUT_DND',
      stageBefore,
      stageAfter: 'DISQUALIFIED',
      toolsExecuted: [],
      guardrailFlags: ['DND_OPT_OUT_ENFORCED'],
      latencyMs: Date.now() - startTime,
    });

    return {
      response: "Understood—I have marked your number as do-not-contact and won't message or call you further. Wishing you all the best!",
      suggestedFollowUps: [],
      reasoning: 'Deterministic opt-out / DND compliance safeguard triggered.',
      executedTools: [],
      specialist: 'ESCALATION',
      stage: 'DISQUALIFIED',
      guardrailFlags: ['DND_OPT_OUT_ENFORCED'],
      exhaustedLimit: false,
    };
  }

  // 1c. Fast-Path Deterministic Safeguard: Explicit request for a human advisor
  if (isExplicitHumanRequest(customerMessage)) {
    logger.info(`[Agent Runtime] Fast-path explicit human request detected for lead ${leadId}`);
    const escalationResult = await executeAgentTool(
      'escalate_to_human',
      {
        leadId,
        reason: 'BUYER_REQUESTED_HUMAN',
        explanation: `Buyer explicitly requested to speak with a human advisor: "${customerMessage.slice(0, 150)}"`,
        urgency: 'HIGH',
        recommendedAdvisorAction: 'Contact buyer directly to address their inquiry and take over communication.',
      },
      trustedContext,
    );

    const executed = [
      {
        toolName: 'escalate_to_human',
        status: escalationResult.status,
        durationMs: escalationResult.durationMs,
      },
    ];

    await recordAgentRunTrace({
      organizationId: orgId,
      leadId,
      threadId,
      channel: effectiveChannel,
      specialist: 'ESCALATION',
      intent: 'HUMAN_REQUEST',
      stageBefore,
      stageAfter: 'ADVISOR_HANDOFF',
      toolsExecuted: executed,
      guardrailFlags: ['FAST_PATH_HUMAN_HANDOFF'],
      latencyMs: Date.now() - startTime,
    });

    return {
      response:
        effectiveChannel === 'VOICE_CALL'
          ? 'Sure thing, let me connect you directly with our senior property advisor now.'
          : 'I understand and have alerted our senior advisor team with your details. A human advisor will reach out to you directly.',
      suggestedFollowUps: ['A dedicated advisor will follow up with you shortly.'],
      reasoning: 'Fast-path escalation: buyer explicitly requested a human advisor.',
      executedTools: executed,
      escalation: escalationResult.data,
      specialist: 'ESCALATION',
      stage: 'ADVISOR_HANDOFF',
      guardrailFlags: ['FAST_PATH_HUMAN_HANDOFF'],
      exhaustedLimit: false,
    };
  }

  // 2. Supervisor Routing to Specialist Role
  const directive = routeToSpecialist({
    organizationId: orgId,
    leadId,
    threadId,
    channel: effectiveChannel,
    currentStage: stageBefore,
    customerMessage,
    hasRequirements: Boolean(leadRecord.requirements),
    matchedCount: leadRecord._count.matches,
  });

  // 3. Verified Model Configuration & API Key Fallback Contract
  const apiKey = process.env['GEMINI_API_KEY'];
  const platformCfg = await getPlatformConfig().catch(() => null);
  const configuredModel = platformCfg?.primaryLlmModel || process.env['GEMINI_MODEL'] || 'gemini-2.5-flash';
  const ai = params.aiClient ?? (apiKey ? new GoogleGenAI({ apiKey }) : null);
  const clientFullName = params.customerName || leadRecord.fullName || '';
  const clientFirstName = clientFullName.split(' ')[0] || '';

  if (!ai) {
    logger.warn('[Agent Runtime] GEMINI_API_KEY not set. Using DB-grounded consultative fallback.');
    const fallback = await generateConsultativeFallback({
      customerMessage,
      leadId,
      organizationId: orgId,
      executedTools: [],
      reason: 'API key missing from environment',
      customerName: clientFullName,
      currency,
    });
    await recordAgentRunTrace({
      organizationId: orgId,
      leadId,
      threadId,
      channel: effectiveChannel,
      specialist: directive.specialist,
      intent: directive.intent,
      stageBefore,
      stageAfter: stageBefore,
      toolsExecuted: [],
      guardrailFlags: ['NO_API_KEY_DB_FALLBACK'],
      latencyMs: Date.now() - startTime,
      modelUsed: 'db-fallback',
    });
    return {
      ...fallback,
      specialist: directive.specialist,
      stage: stageBefore,
      guardrailFlags: ['NO_API_KEY_DB_FALLBACK'],
    };
  }

  // 4. Prepare Multi-turn Conversation Contents with Untrusted-Data Delimiters
  const historyContents: any[] = recentMessages.slice(-10).map((m) => ({
    role: m.senderType === 'CUSTOMER' ? 'user' : 'model',
    parts: [
      {
        text:
          m.senderType === 'CUSTOMER'
            ? `<UNTRUSTED_CONTENT source="customer_history">\n${m.content}\n</UNTRUSTED_CONTENT>`
            : m.content,
      },
    ],
  }));

  const contents: any[] = [
    ...historyContents,
    {
      role: 'user',
      parts: [
        {
          text: `<UNTRUSTED_CONTENT source="customer_message">\n${customerMessage}\n</UNTRUSTED_CONTENT>`,
        },
      ],
    },
  ];

  const executedTools: ExecutedToolRecord[] = [];
  let capturedTaskProposal: unknown = null;
  let capturedRequirementProposal: unknown = null;
  let capturedQualificationResult: unknown = null;
  let capturedSiteVisitProposal: unknown = null;
  let capturedSiteVisitBooking: unknown = null;
  let capturedEscalation: unknown = null;
  let capturedFollowUpProposal: unknown = null;
  let capturedCollateral: unknown = null;
  const verifiedPropertiesMap = new Map<
    string,
    { id: string; title: string; city: string; price: number; bedrooms: number; brochureUrl?: string | null; mapsUrl?: string | null }
  >();

  let finalResponseText = '';
  let exhaustedLimit = false;
  let modelUsed = configuredModel;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // 5. Bounded Agent Loop (hard maximum 5 rounds)
  for (let round = 1; round <= MAX_AGENT_ROUNDS; round++) {
    logger.info(`[Agent Runtime] [${directive.specialist}] Round ${round}/${MAX_AGENT_ROUNDS} for Lead ${leadId}`);

    // Re-verify takeover guard before every model invocation
    const currentThread = await prisma.conversationThread.findUnique({
      where: { id: threadId },
      select: { isHumanTakeover: true, state: true },
    });
    if (currentThread?.isHumanTakeover || currentThread?.state === 'HUMAN_TAKEOVER') {
      logger.info(`[Agent Runtime] Takeover activated mid-loop during round ${round}. Halting.`);
      return {
        response: '',
        suggestedFollowUps: [],
        reasoning: 'Human takeover engaged during execution',
        executedTools,
        specialist: directive.specialist,
        stage: stageBefore,
        exhaustedLimit: false,
        suppressed: true,
        suppressedReason: 'Human takeover activated mid-execution',
      };
    }

    const effectivePrimary =
      configuredModel === 'gemini-2.5-flash' ? 'gemini-3-flash-preview' : configuredModel;
    const candidateModels = Array.from(
      new Set([effectivePrimary, 'gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-2.5-flash-lite']),
    );

    const forceMatcherToolOnRound1 =
      round === 1 &&
      executedTools.length === 0 &&
      (directive.specialist === 'MATCHER' || directive.intent === 'COLLATERAL_REQUEST');

    let response: any;
    let lastModelErr: any = null;

    for (const modelCandidate of candidateModels) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after 20000ms on ${modelCandidate}`)), 20000),
          );
          response = await Promise.race([
            ai.models.generateContent({
              model: modelCandidate,
              contents,
              config: {
                systemInstruction: `${BASE_SYSTEM_INSTRUCTION}

${directive.systemAddendum}

ACTIVE CONVERSATION CONTEXT:
- Client Name: "${clientFirstName || 'Client'}"
- Current Date: "${new Date().toISOString().slice(0, 10)}"
- Lead Lifecycle Stage: "${stageBefore}"
- Currency: "${currency}"
- Authorized Lead ID: "${leadId}"`,
                tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS as any }],
                ...(forceMatcherToolOnRound1
                  ? {
                      toolConfig: {
                        functionCallingConfig: {
                          mode: 'ANY' as any,
                          allowedFunctionNames: [
                            'search_properties',
                            'send_property_collateral',
                            'propose_buyer_requirements',
                          ],
                        },
                      },
                    }
                  : {}),
                temperature: 0.3,
              },
            }),
            timeoutPromise,
          ]);
          if (response) {
            modelUsed = modelCandidate;
            lastModelErr = null;
            const usage = (response as any).usageMetadata;
            if (usage) {
              totalInputTokens += Number(usage.promptTokenCount || 0);
              totalOutputTokens += Number(usage.candidatesTokenCount || 0);
            }
            break;
          }
        } catch (candidateErr: any) {
          lastModelErr = candidateErr;
          const msg = candidateErr instanceof Error ? candidateErr.message : String(candidateErr);
          const isDemandSpike = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');
          if (isDemandSpike && attempt === 1) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          logger.warn(
            `[Agent Runtime] Candidate model ${modelCandidate} failed on round ${round} (attempt ${attempt}): ${msg.slice(0, 120)}`,
          );
          break;
        }
      }
      if (response && !lastModelErr) break;
    }

    if (!response || lastModelErr) {
      const errMessage = lastModelErr instanceof Error ? lastModelErr.message : String(lastModelErr);
      logger.error(`[Agent Runtime] All candidate models failed on round ${round}: ${errMessage}`);
      const fallback = await generateConsultativeFallback({
        customerMessage,
        leadId,
        organizationId: orgId,
        executedTools,
        reason: `Model cascade error: ${errMessage.slice(0, 100)}`,
        customerName: clientFullName,
        currency,
      });
      await recordAgentRunTrace({
        organizationId: orgId,
        leadId,
        threadId,
        channel: effectiveChannel,
        specialist: directive.specialist,
        intent: directive.intent,
        stageBefore,
        stageAfter: stageBefore,
        toolsExecuted: executedTools,
        guardrailFlags: ['MODEL_CASCADE_FALLBACK'],
        latencyMs: Date.now() - startTime,
        modelUsed: 'db-fallback',
      });
      return {
        ...fallback,
        specialist: directive.specialist,
        stage: stageBefore,
        guardrailFlags: ['MODEL_CASCADE_FALLBACK'],
      };
    }

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      logger.info(
        `[Agent Runtime] Model requested ${functionCalls.length} function call(s): ${functionCalls.map((f: any) => f.name).join(', ')}`,
      );

      const modelContent = response.candidates?.[0]?.content ?? {
        role: 'model',
        parts: functionCalls.map((f: any) => ({ functionCall: f })),
      };
      contents.push(modelContent);

      for (const call of functionCalls) {
        const normalizedArgs = typeof call.args === 'object' && call.args !== null ? { ...call.args } : {};
        if (!normalizedArgs.leadId || normalizedArgs.leadId === '123' || normalizedArgs.leadId === 'leadId' || normalizedArgs.leadId === 'current') {
          normalizedArgs.leadId = trustedContext.leadId;
        }
        const toolResult = await executeAgentTool(call.name, normalizedArgs, trustedContext);

        executedTools.push({
          toolName: call.name,
          status: toolResult.status,
          durationMs: toolResult.durationMs,
        });

        if (call.name === 'search_properties' && toolResult.status === 'SUCCESS') {
          const d = toolResult.data as any;
          for (const p of [...(d?.properties ?? []), ...(d?.nearbyOrStretchOptions ?? [])]) {
            if (p?.id && p?.title) {
              verifiedPropertiesMap.set(p.id, {
                id: p.id,
                title: p.title,
                city: p.city,
                price: p.price,
                bedrooms: p.bedrooms,
                brochureUrl: p.brochureUrl,
                mapsUrl: p.mapsUrl,
              });
            }
          }
        }
        if (call.name === 'propose_follow_up_task' && toolResult.status === 'SUCCESS') {
          capturedTaskProposal = (toolResult.data as any)?.proposal ?? toolResult.data;
        }
        if (call.name === 'propose_buyer_requirements' && toolResult.status === 'SUCCESS') {
          capturedRequirementProposal = toolResult.data;
        }
        if (call.name === 'evaluate_buyer_qualification' && toolResult.status === 'SUCCESS') {
          capturedQualificationResult = toolResult.data;
        }
        if (call.name === 'propose_site_visit' && toolResult.status === 'SUCCESS') {
          capturedSiteVisitProposal = toolResult.data;
        }
        if (call.name === 'book_site_visit' && toolResult.status === 'SUCCESS') {
          capturedSiteVisitBooking = toolResult.data;
        }
        if (call.name === 'plan_lead_follow_up' && toolResult.status === 'SUCCESS') {
          capturedFollowUpProposal = toolResult.data;
        }
        if (call.name === 'send_property_collateral' && toolResult.status === 'SUCCESS') {
          capturedCollateral = toolResult.data;
        }
        if (call.name === 'escalate_to_human') {
          capturedEscalation = toolResult.data;
          const nextStage = computeNextStage({ currentStage: stageBefore, executedTools, escalated: true });
          await recordAgentRunTrace({
            organizationId: orgId,
            leadId,
            threadId,
            channel: effectiveChannel,
            specialist: directive.specialist,
            intent: directive.intent,
            stageBefore,
            stageAfter: nextStage,
            toolsExecuted: executedTools,
            guardrailFlags: ['TOOL_ESCALATED_TO_HUMAN'],
            latencyMs: Date.now() - startTime,
            modelUsed,
          });
          return {
            response:
              effectiveChannel === 'VOICE_CALL'
                ? 'Let me connect you right away with our senior advisor who can help directly.'
                : 'I have shared your request with our senior advisor team along with your requirements. A dedicated advisor will follow up with you directly.',
            suggestedFollowUps: ['A dedicated advisor will follow up with you shortly.'],
            reasoning: `Escalated to human advisor: ${(toolResult.data as any)?.reason ?? 'Advisor handoff requested'}`,
            executedTools,
            taskProposal: capturedTaskProposal,
            requirementProposal: capturedRequirementProposal,
            qualificationResult: capturedQualificationResult,
            siteVisitProposal: capturedSiteVisitProposal,
            siteVisitBooking: capturedSiteVisitBooking,
            collateralSent: capturedCollateral,
            escalation: capturedEscalation,
            specialist: directive.specialist,
            stage: nextStage,
            guardrailFlags: ['TOOL_ESCALATED_TO_HUMAN'],
            exhaustedLimit: false,
          };
        }

        const errorCount = executedTools.filter((t) => t.status === 'ERROR').length;
        if (errorCount >= 2) {
          logger.warn(`[Agent Runtime] Triggering REPEATED_FAILURE escalation after ${errorCount} tool errors.`);
          const failureEscalation = await executeAgentTool(
            'escalate_to_human',
            {
              leadId,
              reason: 'REPEATED_FAILURE',
              explanation: `Encountered multiple (${errorCount}) tool execution failures during processing.`,
              urgency: 'MEDIUM',
              recommendedAdvisorAction: 'Review tool logs and follow up with buyer manually.',
            },
            trustedContext,
          );
          executedTools.push({
            toolName: 'escalate_to_human',
            status: failureEscalation.status,
            durationMs: failureEscalation.durationMs,
          });
          return {
            response:
              'Thank you for your patience! I am syncing with our senior advisor team to verify the exact details and have someone follow up with you shortly.',
            suggestedFollowUps: ['An advisor will verify the details and follow up with you.'],
            reasoning: 'Handoff triggered due to repeated tool execution errors.',
            executedTools,
            taskProposal: capturedTaskProposal,
            requirementProposal: capturedRequirementProposal,
            qualificationResult: capturedQualificationResult,
            siteVisitProposal: capturedSiteVisitProposal,
            siteVisitBooking: capturedSiteVisitBooking,
            collateralSent: capturedCollateral,
            escalation: failureEscalation.data,
            specialist: directive.specialist,
            stage: 'ADVISOR_HANDOFF',
            guardrailFlags: ['REPEATED_FAILURE_ESCALATION'],
            exhaustedLimit: false,
          };
        }

        try {
          await prisma.auditLog.create({
            data: {
              organizationId: orgId,
              action: 'ASSISTANT_QUERY',
              entityType: 'AgentRuntime',
              entityId: threadId,
              actor: 'ai_sales_agent',
              note: `Tool ${call.name} executed with status ${toolResult.status} in ${toolResult.durationMs}ms`,
              newValue: {
                toolName: call.name,
                status: toolResult.status,
                durationMs: toolResult.durationMs,
                leadId,
                specialist: directive.specialist,
              },
            },
          });
        } catch (auditErr) {
          logger.warn(`[Agent Runtime] Audit log failed for ${call.name}: ${(auditErr as Error).message}`);
        }

        const outputPayload =
          toolResult.status === 'SUCCESS'
            ? { output: toolResult.data }
            : { error: toolResult.error ?? 'Unknown error' };

        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: call.name,
                response: outputPayload,
              },
            },
          ],
        });
      }

      if (round === MAX_AGENT_ROUNDS) {
        exhaustedLimit = true;
        finalResponseText =
          response.text?.trim() ||
          'I have reviewed your requirements against our verified inventory. Would you like me to share the brochure or arrange a quick call with our advisor?';
        break;
      }

      continue;
    }

    if (response.text) {
      finalResponseText = response.text.trim();
      break;
    }

    finalResponseText =
      'Thank you for reaching out! Could you share your preferred location and approximate budget so I can match verified options for you?';
    break;
  }

  // 6. Post-LLM Guardrails & Verification
  const verifiedList = Array.from(verifiedPropertiesMap.values());
  const guardrailResult = verifyAgentOutput({
    draftText: finalResponseText,
    verifiedPropertyTitles: verifiedList.map((p) => p.title),
    hasCollateralToolSuccess: Boolean(capturedCollateral),
    channel: effectiveChannel,
  });
  finalResponseText = guardrailResult.finalText;

  // 7. Dynamic DB-Grounded Follow-Ups (zero hardcoded project names)
  const suggestedFollowUps: string[] = [];
  for (const prop of verifiedList.slice(0, 2)) {
    suggestedFollowUps.push(`Send brochure for ${prop.title}`);
  }
  if (verifiedList.length > 0) {
    suggestedFollowUps.push('Schedule a site visit');
  } else {
    suggestedFollowUps.push('Share preferred location & budget');
    suggestedFollowUps.push('Schedule a callback with an advisor');
  }

  // 8. Lifecycle Stage Progression & Observability Trace
  const stageAfter = computeNextStage({
    currentStage: stageBefore,
    executedTools,
    escalated: Boolean(capturedEscalation),
  });

  await recordAgentRunTrace({
    organizationId: orgId,
    leadId,
    threadId,
    channel: effectiveChannel,
    specialist: directive.specialist,
    intent: directive.intent,
    stageBefore,
    stageAfter,
    toolsExecuted: executedTools,
    guardrailFlags: guardrailResult.flags,
    latencyMs: Date.now() - startTime,
    modelUsed,
  });

  if (modelUsed !== 'db-fallback') {
    await recordGeminiCost({
      organizationId: orgId,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      model: modelUsed,
      leadId,
    });
  }

  return {
    response: finalResponseText,
    suggestedFollowUps: suggestedFollowUps.slice(0, 3),
    reasoning: `Specialist ${directive.specialist} (${directive.intent}) completed with ${executedTools.length} tool call(s).`,
    executedTools,
    taskProposal: capturedTaskProposal,
    requirementProposal: capturedRequirementProposal,
    qualificationResult: capturedQualificationResult,
    siteVisitProposal: capturedSiteVisitProposal,
    siteVisitBooking: capturedSiteVisitBooking,
    collateralSent: capturedCollateral,
    escalation: capturedEscalation,
    followUpProposal: capturedFollowUpProposal,
    matchedProperties: verifiedList,
    specialist: directive.specialist,
    stage: stageAfter,
    guardrailFlags: guardrailResult.flags,
    exhaustedLimit,
  };
}
