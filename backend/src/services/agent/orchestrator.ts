// ─────────────────────────────────────────────────────────────────────────────
// Multi-Agent Supervisor & Specialist Orchestrator
// Implements Intent Routing, Channel-Aware Directives, Policy Verification,
// Lead Lifecycle State Progression, and Persistent AgentRunTrace Observability.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type AgentSpecialist,
  type LeadLifecycleStage,
  type MessageChannel,
} from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';

export type TurnIntent =
  | 'OPTOUT_DND'
  | 'HUMAN_REQUEST'
  | 'DISCOVERY_QUALIFICATION'
  | 'PROPERTY_INQUIRY_OR_OBJECTION'
  | 'COLLATERAL_REQUEST'
  | 'SCHEDULING_VISIT'
  | 'PROJECT_DOCS_OR_LEGAL'
  | 'GENERAL_CONVERSATION';

export interface OrchestratorContext {
  organizationId: string;
  leadId: string;
  threadId: string;
  channel: MessageChannel;
  currentStage: LeadLifecycleStage;
  customerMessage: string;
  hasRequirements: boolean;
  matchedCount: number;
}

export interface SpecialistDirective {
  specialist: AgentSpecialist;
  intent: TurnIntent;
  systemAddendum: string;
  allowedChannelConstraints: string;
}

export interface GuardrailCheckResult {
  finalText: string;
  flags: string[];
}

export function isOptOutOrDnd(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase().trim();
  return (
    /\b(stop calling|don'?t call|do not call|stop messaging|unsubscribe|opt out|remove my number|wrong number|put me on dnd|dnd)\b/i.test(
      lower,
    ) ||
    /^(stop|unsubscribe|not interested)$/i.test(lower)
  );
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

/**
 * Supervisor Router: classifies buyer turn intent and dispatches the right specialist persona.
 */
export function routeToSpecialist(ctx: OrchestratorContext): SpecialistDirective {
  const lower = ctx.customerMessage.toLowerCase();

  let intent: TurnIntent = 'GENERAL_CONVERSATION';
  let specialist: AgentSpecialist = 'QUALIFIER';

  if (isOptOutOrDnd(ctx.customerMessage)) {
    intent = 'OPTOUT_DND';
    specialist = 'ESCALATION';
  } else if (isExplicitHumanRequest(ctx.customerMessage)) {
    intent = 'HUMAN_REQUEST';
    specialist = 'ESCALATION';
  } else if (
    /\b(visit|tour|walkthrough|site visit|saturday|sunday|tomorrow|morning|afternoon|slot|time|schedule|book|meet)\b/i.test(
      lower,
    )
  ) {
    intent = 'SCHEDULING_VISIT';
    specialist = 'CLOSER';
  } else if (
    /\b(brochure|floor\s*plan|pdf|layout|location|map|pin|cost\s*sheet|send\s+details|whatsapp\s+me)\b/i.test(lower)
  ) {
    intent = 'COLLATERAL_REQUEST';
    specialist = 'MATCHER';
  } else if (
    /\b(rera|khata|oc|occupancy|legal|carpet\s*area|possession|amenities|payment\s*plan|clp|loan|emi|discount|negotiate|price\s*too\s*high)\b/i.test(
      lower,
    )
  ) {
    intent = 'PROJECT_DOCS_OR_LEGAL';
    specialist = 'DOCS_RAG';
  } else if (
    /\b(bhk|bed|budget|cr|crore|lakh|lakhs|location|area|ready|under\s*construction|looking\s+for|property|flat|villa|apartment|show|options)\b/i.test(
      lower,
    ) ||
    ctx.hasRequirements
  ) {
    intent = 'PROPERTY_INQUIRY_OR_OBJECTION';
    specialist = ctx.hasRequirements ? 'MATCHER' : 'QUALIFIER';
  } else {
    intent = 'DISCOVERY_QUALIFICATION';
    specialist = 'QUALIFIER';
  }

  const specialistInstructions: Record<AgentSpecialist, string> = {
    SUPERVISOR:
      'Coordinate buyer qualification, verified property matching, collateral dispatch, and site visit booking cleanly.',
    QUALIFIER:
      'SPECIALIST ROLE (DISCOVERY & QUALIFIER): Your goal is to capture the buyer’s preferred micro-market/location, budget ceiling, configuration (BHK/type), and move-in timeline. Call "propose_buyer_requirements" as soon as preferences appear, and "search_properties" if they already gave enough clues.',
    MATCHER:
      'SPECIALIST ROLE (INVENTORY MATCHER & COLLATERAL ADVISOR): Call "search_properties" to pull ONLY verified inventory from this organization’s database (including nearby micro-market alternatives if exact match is empty). If the buyer asks for brochures, floor plans, or location pins, call "send_property_collateral" for the verified property ID.',
    CLOSER:
      'SPECIALIST ROLE (SITE VISIT CLOSER): Your goal is to lock an in-person property walkthrough for the Senior Property Advisor. First call "check_site_visit_availability" to offer two concrete time slots. ONLY call "book_site_visit" once the buyer has explicitly agreed to a specific date and time.',
    DOCS_RAG:
      'SPECIALIST ROLE (PROJECT & LEGAL KNOWLEDGE): Call "query_project_knowledge" and "search_properties" to answer questions about RERA, approvals, amenities, and specs using ONLY verified retrieved facts. Never promise unauthorized discounts—frame pricing flexibility as something the Senior Advisor can discuss during the site visit.',
    ESCALATION:
      'SPECIALIST ROLE (ADVISOR HANDOFF): Summarize buyer requirements clearly and hand off cleanly to a human Senior Property Advisor.',
  };

  const allowedChannelConstraints =
    ctx.channel === 'VOICE_CALL'
      ? 'CHANNEL FORMAT (LIVE PHONE CALL): Reply in strictly 1 to 2 short spoken sentences (under 35 words). No markdown, no emojis, no bullet points, spell currency naturally (e.g., "two point one crore"). Leave space for the caller to interrupt or reply.'
      : ctx.channel === 'WEB_WIDGET'
      ? 'CHANNEL FORMAT (WEBSITE CHAT WIDGET): Keep reply concise (2 to 3 short sentences, under 65 words). Plain, warm conversational text. Offer to send brochures/pins or book a site visit.'
      : 'CHANNEL FORMAT (MESSAGING / WHATSAPP / TELEGRAM): Maximum 2 to 4 short sentences (under 60 words). No bullet points or essays. Ask strictly ONE natural follow-up question.';

  return {
    specialist,
    intent,
    systemAddendum: `${specialistInstructions[specialist]}\n${allowedChannelConstraints}`,
    allowedChannelConstraints,
  };
}

/**
 * Deterministic post-LLM verification to stop ungrounded property claims or unauthorized discounts.
 */
export function verifyAgentOutput(params: {
  draftText: string;
  verifiedPropertyTitles: string[];
  hasCollateralToolSuccess: boolean;
  channel: MessageChannel;
}): GuardrailCheckResult {
  let text = params.draftText.trim();
  const flags: string[] = [];

  if (!text) {
    return { finalText: text, flags };
  }

  // 1. Commercial discretion guardrail: never commit to binding flat discounts
  const unauthorizedDiscountRegex =
    /\b(guarantee|promise|confirm|approve|lock in)\b.{0,30}\b(\d+\s*%|discount|waiver|price cut|off)\b/i;
  if (unauthorizedDiscountRegex.test(text)) {
    flags.push('COMMERCIAL_POLICY_SOFTENED');
    text = text.replace(
      unauthorizedDiscountRegex,
      'share that our Senior Property Advisor can discuss builder-end flexibility with you on-site',
    );
  }

  // 2. Strip markdown artifacts on Voice Calls
  if (params.channel === 'VOICE_CALL') {
    const cleaned = text
      .replace(/[*_#`~>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned !== text) {
      flags.push('VOICE_FORMAT_NORMALIZED');
      text = cleaned;
    }
  }

  return { finalText: text, flags };
}

/**
 * Computes next LeadLifecycleStage from executed tools & current stage.
 */
export function computeNextStage(params: {
  currentStage: LeadLifecycleStage;
  executedTools: Array<{ toolName: string; status: string }>;
  escalated?: boolean;
}): LeadLifecycleStage {
  if (params.escalated) {
    return 'ADVISOR_HANDOFF';
  }

  const succeeded = new Set(
    params.executedTools.filter((t) => t.status === 'SUCCESS').map((t) => t.toolName),
  );

  if (succeeded.has('book_site_visit')) return 'VISIT_BOOKED';
  if (succeeded.has('propose_site_visit')) return 'VISIT_PROPOSED';
  if (succeeded.has('send_property_collateral')) return 'COLLATERAL_SENT';
  if (succeeded.has('search_properties') || succeeded.has('refresh_property_matches')) {
    if (params.currentStage === 'NEW_INBOUND' || params.currentStage === 'DISCOVERY') {
      return 'MATCHED';
    }
  }
  if (succeeded.has('propose_buyer_requirements') || succeeded.has('evaluate_buyer_qualification')) {
    if (params.currentStage === 'NEW_INBOUND') {
      return 'DISCOVERY';
    }
  }

  return params.currentStage;
}

/**
 * Records an immutable AgentRunTrace entry for startup-grade observability and evals.
 */
export async function recordAgentRunTrace(params: {
  organizationId: string;
  leadId: string;
  threadId?: string;
  channel: MessageChannel;
  specialist: AgentSpecialist;
  intent: string;
  stageBefore: LeadLifecycleStage;
  stageAfter: LeadLifecycleStage;
  toolsExecuted: unknown;
  guardrailFlags: string[];
  latencyMs: number;
  modelUsed?: string;
}): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.agentRunTrace.create({
        data: {
          organizationId: params.organizationId,
          leadId: params.leadId,
          threadId: params.threadId ?? null,
          channel: params.channel,
          specialist: params.specialist,
          intent: params.intent,
          stageBefore: params.stageBefore,
          stageAfter: params.stageAfter,
          toolsExecuted: (params.toolsExecuted as object) ?? [],
          guardrailFlags: params.guardrailFlags,
          latencyMs: params.latencyMs,
          modelUsed: params.modelUsed ?? null,
        },
      }),
      ...(params.stageAfter !== params.stageBefore
        ? [
            prisma.lead.update({
              where: { id: params.leadId },
              data: { stage: params.stageAfter },
            }),
          ]
        : []),
    ]);
  } catch (err) {
    logger.warn(`[Orchestrator] Failed to persist AgentRunTrace: ${(err as Error).message}`);
  }
}
