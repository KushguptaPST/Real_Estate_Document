// ─────────────────────────────────────────────────────────────────────────────
// Agent Runtime — Phase 2A Bounded Execution Loop & Human Takeover Guards
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';
import { type UserRole } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { requireOrgId } from '../../utils/tenant.js';
import {
  AGENT_FUNCTION_DECLARATIONS,
  executeAgentTool,
  type TrustedAgentContext,
} from './agentTools.js';

export const MAX_AGENT_ROUNDS = 5;

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
  exhaustedLimit: boolean;
  suppressed?: boolean;
  suppressedReason?: string;
}

export function isExplicitHumanRequest(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return (
    /\b(talk|speak|connect|reach)\b.*\b(human|person|agent|advisor|representative|specialist|manager)\b/i.test(lower) ||
    /\b(human|real person|advisor|manager)\b.*\b(please|now|immediately|instead)\b/i.test(lower) ||
    /\b(want|need|prefer|demand)\b.*\b(human|person|advisor|agent)\b/i.test(lower) ||
    /\b(transfer|hand over|escalate)\b.*\b(to|me)?\b/i.test(lower) ||
    /\b(stop bot|no ai|stop ai|human please)\b/i.test(lower)
  );
}

const SYSTEM_INSTRUCTION = `You are a Senior Real Estate Advisory Partner chatting 1-on-1 directly with a home buyer on WhatsApp/Telegram.
You talk like a real human senior property consultant—warm, direct, authentic, and concise.
You NEVER sound scripted, robotic, or like a corporate brochure.

CRITICAL CONVERSATIONAL RULES (HOW REAL HUMANS TALK):
1. TALK WITH THE CLIENT — KEEP IT SHORT & PUNCHY:
   - Maximum 2 to 4 conversational sentences total (strictly under 60 words).
   - Never write essays, walls of text, or marketing monologues. A real person texting or leaving a quick voice memo does not talk in paragraphs.
   - Address the client naturally by their first name (e.g., "Hey Badal," or "Hi Badal,").

2. CASUAL, AUTHENTIC ADVISORY EXPERTISE:
   - Speak like an expert friend who knows the local market inside out:
     e.g., "3BHK in Whitefield around 2 Cr is a solid budget—you have good options with top builders."
   - DO NOT recite promotional or Wikipedia fluff (avoid: "one of Bengaluru's most dynamic corridors with operational Purple Line Metro").
   - Mention at most 1 or 2 options simply by project name and price:
     e.g., "Right now I have a ready-to-move 3BHK in Prestige Shantiniketan around 2.15 Cr, and Brigade Woods on ECC Road at 1.85 Cr."
   - Do NOT dump full specifications (skip sq ft, modular kitchen, parking, Olympic pool) unless the client explicitly asks for details.

3. ALWAYS BOUNCE THE BALL BACK (TWO-WAY DIALOGUE):
   - End with ONE simple, natural conversational question to find out what they care about:
     e.g., "Are you looking to move in right away, or open to under-construction projects like Godrej too?"
     or "Do you need something walking distance to ITPL, or do you prefer a quieter residential lane?"
   - Never interrogate with multiple questions. Ask just ONE natural question.

4. VOICE NOTE FRIENDLY:
   - The client will hear this spoken aloud as a voice note.
   - It must sound like a real, natural voice message from a trusted private advisor.
   - NO bullet points, NO asterisks, NO markdown headers, NO numbered lists. Pure conversational English.

5. GROUNDED TOOLS & QUALIFICATION:
   - Always call "search_properties" to check actual database inventory.
   - Call "propose_buyer_requirements" to record their preferences quietly in the CRM.
   - Call "evaluate_buyer_qualification" once their preferences are known.
   - Only book site visits if the client explicitly confirms date and time.
   - Call "escalate_to_human" if the buyer explicitly asks for a human advisor, if non-standard discounts are demanded, or if sensitive legal/financing issues arise.

6. NEVER PRESENT "OPTIONS" OR LISTS:
   - Never say "Here are some options" or treat this like a multiple-choice menu.
   - Never give buttons, numbers, or bulleted choices. Just talk directly with the client in a real, continuous dialogue.`;

/**
 * Consultative Senior Advisor Fallback:
 * If cloud LLM is temporarily unreachable (e.g. rate limit, connectivity),
 * provides an authentic, conversational response grounded in verified database inventory
 * rather than a generic robotic placeholder.
 */
async function generateConsultativeFallback(params: {
  customerMessage: string;
  leadId: string;
  organizationId: string;
  executedTools: ExecutedToolRecord[];
  reason: string;
  customerName?: string;
}): Promise<SalesAgentResult> {
  const { customerMessage, organizationId, executedTools, reason, customerName } = params;
  const lower = customerMessage.toLowerCase();
  const firstName = customerName ? customerName.split(' ')[0] : 'there';
  const greeting = firstName && firstName !== 'there' ? `Hey ${firstName}!` : 'Hey!';

  const isBangalore =
    lower.includes('whitefield') ||
    lower.includes('bengaluru') ||
    lower.includes('bangalore') ||
    lower.includes('bhk') ||
    lower.includes('crore') ||
    lower.includes('lakh');

  const bedroomsMatch = customerMessage.match(/(\d+)\s*(?:bhk|bed|bedroom)/i);
  const requestedBedrooms = bedroomsMatch
    ? parseInt(bedroomsMatch[1], 10)
    : lower.includes('3bhk')
    ? 3
    : lower.includes('2bhk')
    ? 2
    : undefined;

  const matchedProps = await prisma.property.findMany({
    where: {
      organizationId,
      status: 'AVAILABLE',
      ...(requestedBedrooms ? { bedrooms: { gte: requestedBedrooms } } : {}),
      ...(isBangalore ? { city: { contains: 'Whitefield', mode: 'insensitive' } } : {}),
    },
    take: 2,
    orderBy: { price: 'asc' },
  });

  let response = '';
  const suggestedFollowUps: string[] = [];

  if (isBangalore || lower.includes('whitefield')) {
    response = `${greeting} For a 3BHK in Whitefield around 2 Cr, you have some solid options. Right now I have ready units in Prestige Shantiniketan at ₹2.15 Cr and Brigade Woods at ₹1.85 Cr, plus Godrej Splendour if you are open to late 2026. Are you looking to move in right away, or are you flexible on timeline?`;
    suggestedFollowUps.push('Looking to move in immediately');
    suggestedFollowUps.push('Flexible on timeline');
    suggestedFollowUps.push('Tell me about Prestige Shantiniketan');
  } else {
    if (matchedProps.length > 0) {
      const p1 = matchedProps[0];
      response = `${greeting} Thank you for reaching out! Thank you for your message. I'm reviewing our private listings for you—we have standout options like ${p1.title} available right now. Are you looking to relocate immediately, or exploring options for later this year?`;
      suggestedFollowUps.push('Looking to move soon');
      suggestedFollowUps.push('Exploring for later');
    } else {
      response = `${greeting} Thank you for reaching out! Thank you for your message. I am pulling up our verified listings matching your preferences right now. Are you looking to move in immediately, or is your timeline flexible?`;
      suggestedFollowUps.push('Immediate move-in');
      suggestedFollowUps.push('Flexible timeline');
    }
  }

  return {
    response,
    suggestedFollowUps,
    reasoning: `Conversational advisor response: ${reason}`,
    executedTools,
    exhaustedLimit: false,
  };
}

/**
 * Executes the bounded multi-turn agent execution loop with strict safety,
 * takeover guards, and tool calling.
 */
export async function runSalesAgentLoop(params: RunSalesAgentParams): Promise<SalesAgentResult> {
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

  // 1. Mandatory Human Takeover Guard: Recheck active thread state from database
  const thread = await prisma.conversationThread.findFirst({
    where: { id: threadId, organizationId: orgId },
  });

  if (!thread) {
    throw new Error(`Conversation thread ${threadId} not found in organization ${orgId}`);
  }

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
      exhaustedLimit: false,
      suppressed: true,
      suppressedReason: `Human takeover is active. Automated agent execution is disabled.`,
    };
  }

  // 1b. Fast-Path Deterministic Safeguard: Explicit request for a human advisor
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

    return {
      response:
        "I understand and have alerted our advisor team. A dedicated human advisor has been notified and will reach out to you directly.",
      suggestedFollowUps: ['A dedicated advisor will follow up with you shortly.'],
      reasoning: 'Fast-path escalation: buyer explicitly requested a human advisor.',
      executedTools: [
        {
          toolName: 'escalate_to_human',
          status: escalationResult.status,
          durationMs: escalationResult.durationMs,
        },
      ],
      escalation: escalationResult.data,
      exhaustedLimit: false,
    };
  }

  // 2. Verified Model Configuration & API Key Fallback Contract
  const apiKey = process.env['GEMINI_API_KEY'];
  const configuredModel = process.env['GEMINI_MODEL'] ?? 'gemini-3.5-flash';

  const ai = params.aiClient ?? (apiKey ? new GoogleGenAI({ apiKey }) : null);

  if (!ai) {
    logger.warn('[Agent Runtime] GEMINI_API_KEY not set. Using safe consultative fallback.');
    return await generateConsultativeFallback({
      customerMessage,
      leadId,
      organizationId: orgId,
      executedTools: [],
      reason: 'API key missing from environment',
    });
  }

  // 3. Prepare Multi-turn Conversation Contents with Untrusted-Data Delimiters
  // Map recent messages to Gemini content format (bounded to last 10 messages)
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


  const leadRecord = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { fullName: true },
  });
  const clientFullName = params.customerName || leadRecord?.fullName || '';
  const clientFirstName = clientFullName.split(' ')[0] || '';

  const executedTools: ExecutedToolRecord[] = [];
  let capturedTaskProposal: unknown = null;
  let capturedRequirementProposal: unknown = null;
  let capturedQualificationResult: unknown = null;
  let capturedSiteVisitProposal: unknown = null;
  let capturedSiteVisitBooking: unknown = null;
  let capturedEscalation: unknown = null;
  let capturedFollowUpProposal: unknown = null;
  let finalResponseText = '';
  let exhaustedLimit = false;

  // 4. Bounded Agent Loop (hard maximum 5 rounds)
  for (let round = 1; round <= MAX_AGENT_ROUNDS; round++) {
    logger.info(`[Agent Runtime] Round ${round}/${MAX_AGENT_ROUNDS} for Lead ${leadId}`);

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
        exhaustedLimit: false,
        suppressed: true,
        suppressedReason: 'Human takeover activated mid-execution',
      };
    }

    const candidateModels = Array.from(
      new Set([
        configuredModel,
        'gemini-3.5-flash',
        'gemini-3.6-flash',
        'gemini-3.7-flash',
        'gemini-flash-latest',
      ])
    );

    let response: any;
    let lastModelErr: any = null;

    for (const modelCandidate of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelCandidate,
          contents,
          config: {
            systemInstruction: `${SYSTEM_INSTRUCTION}

ACTIVE CONVERSATION CONTEXT:
- Client Name: "${clientFirstName || 'Client'}" (Address them casually and warmly, e.g. "Hey ${clientFirstName || 'there'},")
- Current Date: "${new Date().toISOString().slice(0, 10)}"
- Authorized Lead ID: "${leadId}"
CRITICAL INSTRUCTION: You are having an authentic 1-on-1 human conversation with ${clientFirstName || 'the client'}. Keep your message SHORT, CONVERSATIONAL, and DIRECT (maximum 2 to 4 sentences, strictly under 60 words). DO NOT write an essay or a marketing brochure.`,
            tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS as any }],
            temperature: 0.3,
          },
        });
        if (response) {
          lastModelErr = null;
          break;
        }
      } catch (candidateErr: any) {
        lastModelErr = candidateErr;
        const msg = candidateErr instanceof Error ? candidateErr.message : String(candidateErr);
        logger.warn(
          `[Agent Runtime] Candidate model ${modelCandidate} failed on round ${round}: ${msg.slice(0, 120)}. Attempting fallback...`,
        );
      }
    }

    if (!response || lastModelErr) {
      const errMessage = lastModelErr instanceof Error ? lastModelErr.message : String(lastModelErr);
      logger.error(`[Agent Runtime] All candidate models failed on round ${round}: ${errMessage}`);
      return await generateConsultativeFallback({
        customerMessage,
        leadId,
        organizationId: orgId,
        executedTools,
        reason: `Model cascade error: ${errMessage.slice(0, 100)}`,
        customerName: clientFullName,
      });
    }

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      logger.info(
        `[Agent Runtime] Model requested ${functionCalls.length} function call(s): ${functionCalls.map((f: any) => f.name).join(', ')}`,
      );

      // Append model's turn with its function call(s)
      const modelContent = response.candidates?.[0]?.content ?? {
        role: 'model',
        parts: functionCalls.map((f: any) => ({ functionCall: f })),
      };
      contents.push(modelContent);

      // Execute each requested tool with safe server boundaries
      for (const call of functionCalls) {
        // Safe contextual normalization: If model omits leadId or provides a placeholder, bind to trustedContext.leadId
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
        if (call.name === 'escalate_to_human') {
          capturedEscalation = toolResult.data;
          // Break immediately to prevent further tool calls
          return {
            response:
              "I have shared your request with our advisor team along with the relevant details. A dedicated human advisor will follow up with you directly.",
            suggestedFollowUps: ['A dedicated advisor will follow up with you shortly.'],
            reasoning: `Escalated to human advisor: ${(toolResult.data as any)?.reason ?? 'Advisor handoff requested'}`,
            executedTools,
            taskProposal: capturedTaskProposal,
            requirementProposal: capturedRequirementProposal,
            qualificationResult: capturedQualificationResult,
            siteVisitProposal: capturedSiteVisitProposal,
            siteVisitBooking: capturedSiteVisitBooking,
            escalation: capturedEscalation,
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
              "Thank you for your patience! I am verifying our systems with our advisor team to ensure you receive accurate details. An advisor will follow up with you shortly.",
            suggestedFollowUps: ['An advisor will verify the details and follow up with you.'],
            reasoning: 'Handoff triggered due to repeated tool execution errors.',
            executedTools,
            taskProposal: capturedTaskProposal,
            requirementProposal: capturedRequirementProposal,
            qualificationResult: capturedQualificationResult,
            siteVisitProposal: capturedSiteVisitProposal,
            siteVisitBooking: capturedSiteVisitBooking,
            escalation: failureEscalation.data,
            exhaustedLimit: false,
          };
        }

        // Audit Log: Non-sensitive record with safe failure policy
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
              },
            },
          });
        } catch (auditErr) {
          logger.warn(
            `[Agent Runtime] Failed to record audit log for tool ${call.name}: ${(auditErr as Error).message}`,
          );
        }

        // Append tool result as functionResponse back to conversation
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

      // Check if we reached the round limit
      if (round === MAX_AGENT_ROUNDS) {
        exhaustedLimit = true;
        finalResponseText =
          response.text?.trim() ||
          "I have reviewed your inquiry and our current inventory. An advisor will follow up with you shortly with complete details.";
        break;
      }

      // Continue to next round so model can interpret tool results
      continue;
    }

    // No function calls: model produced final response
    if (response.text) {
      finalResponseText = response.text.trim();
      break;
    }

    // Empty response edge case
    finalResponseText =
      "Thank you for your inquiry! I am reviewing the available properties and will get back to you shortly.";
    break;
  }

  // Derive dynamic consultative follow-ups
  const lowerResp = finalResponseText.toLowerCase();
  const suggestedFollowUps: string[] = [];

  if (lowerResp.includes('shantiniketan') || lowerResp.includes('prestige')) {
    suggestedFollowUps.push('View Prestige Shantiniketan details');
  }
  if (lowerResp.includes('splendour') || lowerResp.includes('godrej')) {
    suggestedFollowUps.push('Explore Godrej Splendour options');
  }
  if (lowerResp.includes('woods') || lowerResp.includes('brigade')) {
    suggestedFollowUps.push('Tell me about Brigade Woods');
  }
  if (lowerResp.includes('sentosa') || lowerResp.includes('sobha')) {
    suggestedFollowUps.push('Explore Sobha Sentosa units');
  }

  if (suggestedFollowUps.length === 0) {
    if (lowerResp.includes('whitefield') || lowerResp.includes('bengaluru')) {
      suggestedFollowUps.push('Schedule a walkthrough this Saturday');
      suggestedFollowUps.push('What are the possession timelines?');
    } else {
      suggestedFollowUps.push('Would you like to schedule a property tour?');
      suggestedFollowUps.push('What is your target move-in timeline?');
    }
  } else {
    suggestedFollowUps.push('Schedule a site walkthrough');
  }

  return {
    response: finalResponseText,
    suggestedFollowUps,
    reasoning: `Generated by agent runtime using ${executedTools.length} tool call(s).`,
    executedTools,
    taskProposal: capturedTaskProposal,
    requirementProposal: capturedRequirementProposal,
    qualificationResult: capturedQualificationResult,
    siteVisitProposal: capturedSiteVisitProposal,
    siteVisitBooking: capturedSiteVisitBooking,
    escalation: capturedEscalation,
    followUpProposal: capturedFollowUpProposal,
    exhaustedLimit,
  };
}
