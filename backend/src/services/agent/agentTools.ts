// ─────────────────────────────────────────────────────────────────────────────
// Agent Tool Registry — Phase 2A Typed Tools & Execution Boundaries
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';
import { type UserRole } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { requireOrgId } from '../../utils/tenant.js';
import { getProperties, computeMatchesForLead } from '../propertyMatch.service.js';
import { getLeadDetails, updateLeadStatus } from '../lead.service.js';
import { checkAdvisorAvailability, scheduleSiteVisit } from '../siteVisit.service.js';
import {
  assembleBuyerMemory,
  evaluateFollowUpNeed,
  FOLLOW_UP_TRIGGERS,
  type FollowUpTrigger,
} from './buyerMemory.service.js';
import { isValidIanaTimezone, parseLocalDateTimeToUtc } from '../../utils/timezone.js';

export function isPastDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
  return targetDate.getTime() < today.getTime();
}

/**
 * Resolves the authoritative IANA timezone for a lead:
 * 1. Explicitly requested timezone (if valid IANA string)
 * 2. Associated Deal.timezone
 * 3. NotificationSetting.timezone
 * 4. Default: 'America/New_York'
 */
export async function resolveTimezoneForLead(
  leadId: string,
  organizationId: string,
  requestedTz?: string,
): Promise<string> {
  if (requestedTz && requestedTz.trim().length > 0) {
    const trimmed = requestedTz.trim();
    if (!isValidIanaTimezone(trimmed)) {
      throw new Error(`Invalid or unrecognized IANA timezone: "${requestedTz}"`);
    }
    return trimmed;
  }

  const deal = await prisma.deal.findFirst({
    where: { leadId, organizationId },
    select: { timezone: true },
  });
  if (deal?.timezone && isValidIanaTimezone(deal.timezone)) {
    return deal.timezone;
  }

  const notifSetting = await prisma.notificationSetting.findFirst({
    where: { organizationId },
    select: { timezone: true },
  });
  if (notifSetting?.timezone && isValidIanaTimezone(notifSetting.timezone)) {
    return notifSetting.timezone;
  }

  return 'America/New_York';
}


export interface TrustedAgentContext {
  organizationId: string;
  userId?: string;
  callerRole?: UserRole;
  callerEmail?: string;
  leadId: string;
  threadId?: string;
}

export interface ToolExecutionResult {
  toolName: string;
  status: 'SUCCESS' | 'ERROR';
  data?: unknown;
  error?: string;
  durationMs: number;
}

// ── 1. Search Properties ─────────────────────────────────────────────────────

export const SearchPropertiesArgsSchema = z.object({
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().positive().optional(),
  bedrooms: z.number().int().positive().optional(),
  city: z.string().trim().max(100).optional(),
  searchQuery: z.string().trim().max(150).optional(),
});

export type SearchPropertiesArgs = z.infer<typeof SearchPropertiesArgsSchema>;

// ── 2. Get Lead Context ──────────────────────────────────────────────────────

export const GetLeadContextArgsSchema = z.object({
  leadId: z.string().trim().min(1).max(64),
});

export type GetLeadContextArgs = z.infer<typeof GetLeadContextArgsSchema>;

// ── 3. Check Site Visit Availability ─────────────────────────────────────────

export const CheckSiteVisitAvailabilityArgsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  advisorId: z.string().trim().min(1).max(64).optional(),
  propertyId: z.string().trim().min(1).max(64).optional(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format').optional(),
  timezone: z.string().trim().optional(),
});


export type CheckSiteVisitAvailabilityArgs = z.infer<typeof CheckSiteVisitAvailabilityArgsSchema>;

// ── 4. Propose Follow-up Task ────────────────────────────────────────────────

export const ProposeFollowUpTaskArgsSchema = z.object({
  leadId: z.string().trim().min(1).max(64),
  title: z.string().trim().min(3).max(200),
  taskType: z.enum(['CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'PREPARE_DOCS', 'OTHER']),
  dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO 8601 string' }),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  description: z.string().trim().max(1000).optional(),
  reason: z.string().trim().min(3).max(500),
});

export type ProposeFollowUpTaskArgs = z.infer<typeof ProposeFollowUpTaskArgsSchema>;

// ── 5. Propose Buyer Requirements ──────────────────────────────────────────

export const ProposeBuyerRequirementsArgsSchema = z
  .object({
    leadId: z.string().trim().min(1).max(64),
    minBudget: z.number().nonnegative().optional(),
    maxBudget: z.number().positive().optional(),
    preferredLocations: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
    propertyType: z.string().trim().max(50).optional(),
    minBedrooms: z.number().int().positive().optional(),
    maxBedrooms: z.number().int().positive().optional(),
    possessionTimeline: z.string().trim().max(50).optional(),
    changeType: z.enum(['NEW_PREFERENCE', 'CORRECTION', 'ADDITION', 'REMOVAL']).default('NEW_PREFERENCE'),
    sourceEvidence: z.string().trim().min(3).max(500),
    reason: z.string().trim().min(3).max(500),
  })
  .refine(
    (data) => {
      if (data.minBudget !== undefined && data.maxBudget !== undefined) {
        return data.minBudget <= data.maxBudget;
      }
      return true;
    },
    { message: 'minBudget cannot exceed maxBudget', path: ['minBudget'] },
  )
  .refine(
    (data) => {
      if (data.minBedrooms !== undefined && data.maxBedrooms !== undefined) {
        return data.minBedrooms <= data.maxBedrooms;
      }
      return true;
    },
    { message: 'minBedrooms cannot exceed maxBedrooms', path: ['minBedrooms'] },
  );

export type ProposeBuyerRequirementsArgs = z.infer<typeof ProposeBuyerRequirementsArgsSchema>;

// ── 6. Evaluate Buyer Qualification ──────────────────────────────────────────

export const EvaluateBuyerQualificationArgsSchema = z.object({
  leadId: z.string().trim().min(1).max(64),
  hasExpressedIntent: z.boolean().default(true),
  notes: z.string().trim().max(500).optional(),
});

export type EvaluateBuyerQualificationArgs = z.infer<typeof EvaluateBuyerQualificationArgsSchema>;

// ── 7. Refresh Property Matches ──────────────────────────────────────────────

export const RefreshPropertyMatchesArgsSchema = z.object({
  leadId: z.string().trim().min(1).max(64),
  forceRefresh: z.boolean().default(true),
});

export type RefreshPropertyMatchesArgs = z.infer<typeof RefreshPropertyMatchesArgsSchema>;

// ── 8. Propose Site Visit ────────────────────────────────────────────────────

export const ProposeSiteVisitArgsSchema = z.object({
  leadId: z.string().trim().min(1).max(64),
  propertyId: z.string().trim().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  durationMinutes: z.number().int().positive().default(45),
  notes: z.string().trim().max(500).optional(),
  timezone: z.string().trim().optional(),
});

export type ProposeSiteVisitArgs = z.infer<typeof ProposeSiteVisitArgsSchema>;

// ── 9. Book Site Visit ───────────────────────────────────────────────────────

export const BookSiteVisitArgsSchema = z.object({
  leadId: z.string().trim().min(1).max(64),
  propertyId: z.string().trim().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  durationMinutes: z.number().int().positive().default(45),
  buyerConsentEvidence: z
    .string()
    .trim()
    .min(1, 'Explicit buyer consent evidence is required')
    .max(500),
  meetingLocation: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
  timezone: z.string().trim().optional(),
});

export type BookSiteVisitArgs = z.infer<typeof BookSiteVisitArgsSchema>;

export interface VerifyBuyerConsentParams {
  leadId: string;
  organizationId: string;
  threadId?: string;
  property: { id: string; title: string; address: string; city: string };
  targetDate: string; // YYYY-MM-DD
  targetTime: string; // HH:MM
  buyerConsentEvidence: string;
}

export interface VerifyBuyerConsentResult {
  valid: boolean;
  consentMessageId?: string;
  error?: string;
}

/**
 * Server-side verification of genuine buyer consent for site visit booking.
 * Verifies against authentic persisted customer messages (senderType === 'CUSTOMER').
 * Strictly rejects:
 * - Fabricated quotes or model hallucinations
 * - Advisor-authored or AI-authored messages
 * - Cross-tenant or foreign lead messages
 * - Messages older than 7 days (stale)
 * - Objections, cancellations, or ambiguous statements
 * - Property, date, or time mismatches
 */
export async function verifyBuyerVisitConsent(
  params: VerifyBuyerConsentParams,
): Promise<VerifyBuyerConsentResult> {
  const { leadId, organizationId, threadId, property, targetDate, targetTime, buyerConsentEvidence } = params;

  if (!buyerConsentEvidence || buyerConsentEvidence.trim().length === 0) {
    return {
      valid: false,
      error: 'Missing buyer consent evidence: explicit customer agreement is required to book a visit.',
    };
  }

  // 1. Query authentic persisted customer-authored messages in this conversation and tenant
  const customerMessages = await prisma.conversationMessage.findMany({
    where: {
      thread: {
        leadId,
        organizationId,
        ...(threadId ? { id: threadId } : {}),
      },
      senderType: 'CUSTOMER',
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (customerMessages.length === 0) {
    return {
      valid: false,
      error: 'No authentic customer-authored messages found in conversation to verify buyer consent evidence.',
    };
  }

  // 2. Locate authentic message matching the cited evidence (reject model hallucination / fabrication)
  const normEvidence = buyerConsentEvidence.toLowerCase().replace(/['"“”]/g, '').trim();
  const matchingMessage = customerMessages.find((m) => {
    const normContent = m.content.toLowerCase().replace(/['"“”]/g, '').trim();
    return normContent.includes(normEvidence) || normEvidence.includes(normContent);
  });

  if (!matchingMessage) {
    return {
      valid: false,
      error: 'Fabricated or unverified consent evidence: quoted text does not match any authentic customer-authored message in this conversation.',
    };
  }

  // 3. Stale confirmation check (older than 7 days)
  const messageAgeMs = Date.now() - new Date(matchingMessage.createdAt).getTime();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  if (messageAgeMs > SEVEN_DAYS_MS) {
    return {
      valid: false,
      error: 'Stale confirmation: customer agreement is older than 7 days and must be re-confirmed.',
    };
  }

  const lowerMsg = matchingMessage.content.toLowerCase();

  // 4. Reject negative tokens (cancellation, hesitation, disagreement, objection)
  const negativeTokens = [
    'cancel',
    'cannot',
    "can't",
    'cant',
    "won't",
    'wont',
    'unable',
    'not able',
    'no longer',
    'reschedule',
    "don't",
    'dont',
    'maybe later',
    'not sure',
    'doubt',
    'impossible',
    'decline',
    'stop',
    'wrong time',
    'no thanks',
  ];
  if (negativeTokens.some((tok) => lowerMsg.includes(tok))) {
    return {
      valid: false,
      error: 'Ambiguous or negative statement: customer message contains hesitation, refusal, or cancellation.',
    };
  }

  // 5. Require affirmative agreement tokens
  const affirmativeTokens = [
    'yes',
    'yeah',
    'yep',
    'sure',
    'confirm',
    'confirmed',
    'book',
    'booking',
    'works',
    'perfect',
    'sounds good',
    'great',
    'agreed',
    'please schedule',
    "let's do",
    'lets do',
    'see you',
    'schedule it',
    'tour',
    'visit',
    'interested',
    'ok',
    'okay',
    'fine',
    'good for me',
    'suits me',
  ];
  const hasAffirmation = affirmativeTokens.some((tok) => lowerMsg.includes(tok));
  if (!hasAffirmation) {
    return {
      valid: false,
      error: 'Insufficient agreement: customer message does not affirmatively confirm the visit appointment.',
    };
  }

  // 6. Preceding AI proposal in the same thread (must be immediate preceding message)
  const immediatelyPrecedingMsg = await prisma.conversationMessage.findFirst({
    where: {
      threadId: matchingMessage.threadId,
      createdAt: { lt: matchingMessage.createdAt },
    },
    orderBy: { createdAt: 'desc' },
  });
  const precedingAiProposal = immediatelyPrecedingMsg?.senderType === 'AI' ? immediatelyPrecedingMsg : null;

  // 7. Date confirmation check
  const targetD = new Date(targetDate + 'T00:00:00.000Z');
  const monthsShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthsFull = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const monthShort = monthsShort[targetD.getUTCMonth()];
  const monthFull = monthsFull[targetD.getUTCMonth()];
  const dayNum = targetD.getUTCDate();
  const dayOfWeek = daysOfWeek[targetD.getUTCDay()];

  // Reject explicit conflicting dates
  const isoDatesInMsg = lowerMsg.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  const hasConflictingIsoDate = isoDatesInMsg.some((d) => d !== targetDate);
  const otherDaysOfWeek = daysOfWeek.filter((d) => d !== dayOfWeek);
  const mentionsConflictingDay = otherDaysOfWeek.some((d) => lowerMsg.includes(d)) && !lowerMsg.includes(dayOfWeek);

  if (hasConflictingIsoDate || mentionsConflictingDay) {
    return {
      valid: false,
      error: `Consent date mismatch: customer message specifies a conflicting date instead of intended date ${targetDate}.`,
    };
  }

  const hasExplicitDate =
    lowerMsg.includes(targetDate) ||
    lowerMsg.includes(`${targetD.getUTCMonth() + 1}/${dayNum}`) ||
    lowerMsg.includes(`${monthShort} ${dayNum}`) ||
    lowerMsg.includes(`${monthFull} ${dayNum}`) ||
    lowerMsg.includes(`${dayNum}th`) ||
    lowerMsg.includes(`${dayNum}st`) ||
    lowerMsg.includes(`${dayNum}nd`) ||
    lowerMsg.includes(`${dayNum}rd`) ||
    lowerMsg.includes(dayOfWeek);

  const precedingProposedDate =
    precedingAiProposal?.content?.includes(targetDate) ||
    (precedingAiProposal?.suggestedAction as any)?.siteVisitProposal?.slot?.date === targetDate;

  const dateConfirmed =
    hasExplicitDate ||
    (precedingProposedDate &&
      (lowerMsg.includes('date') ||
        lowerMsg.includes('slot') ||
        lowerMsg.includes('that works') ||
        lowerMsg.includes('confirm') ||
        lowerMsg.includes('yes') ||
        lowerMsg.includes('sure') ||
        lowerMsg.includes('perfect')));

  if (!dateConfirmed) {
    return {
      valid: false,
      error: `Consent date mismatch: customer message does not confirm intended date ${targetDate}.`,
    };
  }

  // 8. Time confirmation check
  const [hStr, mStr] = targetTime.split(':');
  const hNum = Number(hStr);
  const h12 = hNum % 12 === 0 ? 12 : hNum % 12;
  const ampm = hNum >= 12 ? 'pm' : 'am';

  const timeTokens = [
    targetTime,
    `${h12}:${mStr}`,
    `${h12}${ampm}`,
    `${h12} ${ampm}`,
    `${h12}:${mStr}${ampm}`,
    `${h12}:${mStr} ${ampm}`,
    `${h12} o'clock`,
    `${h12} oclock`,
  ];
  const hasExplicitTime = timeTokens.some((t) => lowerMsg.includes(t));

  // Reject explicit conflicting times
  const timeMatches = lowerMsg.match(/\b\d{1,2}:\d{2}\b/g) || [];
  const hasConflictingTime = timeMatches.some((t) => t !== targetTime);
  if (hasConflictingTime && !hasExplicitTime) {
    return {
      valid: false,
      error: `Consent time mismatch: customer message specifies a conflicting time instead of intended time ${targetTime}.`,
    };
  }

  const precedingProposedTime =
    precedingAiProposal?.content?.includes(targetTime) ||
    (precedingAiProposal?.suggestedAction as any)?.siteVisitProposal?.slot?.time === targetTime;

  const timeConfirmed =
    hasExplicitTime ||
    (precedingProposedTime &&
      (lowerMsg.includes('time') ||
        lowerMsg.includes('slot') ||
        lowerMsg.includes('that works') ||
        lowerMsg.includes('confirm') ||
        lowerMsg.includes('yes') ||
        lowerMsg.includes('sure') ||
        lowerMsg.includes('perfect')));

  if (!timeConfirmed) {
    return {
      valid: false,
      error: `Consent time mismatch: customer message does not confirm intended time ${targetTime}.`,
    };
  }

  // 9. Property confirmation check
  const propTitle = property.title.toLowerCase();
  const propAddr = property.address.toLowerCase();
  const streetNum = propAddr.split(' ')[0];
  const propCity = property.city.toLowerCase();

  const hasExplicitProperty =
    lowerMsg.includes(propTitle) ||
    lowerMsg.includes(propAddr) ||
    (streetNum && streetNum.length >= 2 && lowerMsg.includes(streetNum)) ||
    (propCity && propCity.length >= 3 && lowerMsg.includes(propCity)) ||
    lowerMsg.includes('property') ||
    lowerMsg.includes('house') ||
    lowerMsg.includes('home') ||
    lowerMsg.includes('place') ||
    lowerMsg.includes('tour') ||
    lowerMsg.includes('visit') ||
    lowerMsg.includes('walkthrough');

  const precedingProposedProperty =
    (precedingAiProposal?.suggestedAction as any)?.siteVisitProposal?.property?.id === property.id ||
    precedingAiProposal?.content?.toLowerCase().includes(propTitle);

  const titleSignificantWords = propTitle.split(/\s+/).filter((w) => w.length >= 3 && !['org', 'the', 'and', 'for'].includes(w));
  const matchesSignificantTitleWords = titleSignificantWords.length >= 2 && titleSignificantWords.slice(0, 2).every((w) => lowerMsg.includes(w));

  const propertyConfirmed =
    lowerMsg.includes(propTitle) ||
    lowerMsg.includes(propAddr) ||
    matchesSignificantTitleWords ||
    (streetNum && streetNum.length >= 2 && lowerMsg.includes(streetNum)) ||
    (precedingProposedProperty && hasExplicitProperty);

  if (!propertyConfirmed) {
    return {
      valid: false,
      error: `Consent property mismatch: customer message does not reference property "${property.title}".`,
    };
  }

  return {
    valid: true,
    consentMessageId: matchingMessage.id,
  };
}


// ── 10. Escalate to Human Advisor ───────────────────────────────────────────

export const ESCALATION_REASONS = [
  'BUYER_REQUESTED_HUMAN',
  'COMPLEX_NEGOTIATION',
  'LOW_CONFIDENCE',
  'CONFLICTING_INFORMATION',
  'BUYER_COMPLAINT',
  'LEGAL_OR_FINANCIAL_SENSITIVITY',
  'REPEATED_FAILURE',
  'POLICY_RESTRICTION',
  'BOOKING_EXCEPTION',
] as const;
export type EscalationReason = (typeof ESCALATION_REASONS)[number];

export const ESCALATION_URGENCIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type EscalationUrgency = (typeof ESCALATION_URGENCIES)[number];

export const EscalateToHumanArgsSchema = z.object({
  leadId: z.string().trim().min(1).max(64),
  reason: z.enum(ESCALATION_REASONS),
  explanation: z.string().trim().min(5, 'Explanation must be at least 5 characters').max(500),
  urgency: z.enum(ESCALATION_URGENCIES).default('HIGH'),
  recommendedAdvisorAction: z
    .string()
    .trim()
    .min(5, 'Recommended advisor action must be at least 5 characters')
    .max(500),
});

export type EscalateToHumanArgs = z.infer<typeof EscalateToHumanArgsSchema>;

// ── 11. Plan Lead Follow-Up ──────────────────────────────────────────────────

export const PlanLeadFollowUpArgsSchema = z.object({
  leadId: z.string().trim().min(1).max(64),
  trigger: z.enum(FOLLOW_UP_TRIGGERS).optional(),
  recommendedAction: z.string().trim().min(5).max(500),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  suggestedDueDate: z.string().optional(),
  rationale: z.string().trim().max(500).optional(),
  draftMessage: z.string().trim().max(1000).optional(),
  suggestedDraftContent: z.string().trim().max(1000).optional(),
});

export type PlanLeadFollowUpArgs = z.infer<typeof PlanLeadFollowUpArgsSchema>;

// ── Function Declarations for Gemini SDK ─────────────────────────────────────

export const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: 'search_properties',
    description: 'Search verified property inventory belonging to this real estate organization matching price, bedroom, or location criteria.',
    parameters: {
      type: 'OBJECT',
      properties: {
        minPrice: { type: 'NUMBER', description: 'Minimum price ceiling in USD (optional)' },
        maxPrice: { type: 'NUMBER', description: 'Maximum price ceiling in USD (optional)' },
        bedrooms: { type: 'INTEGER', description: 'Minimum number of bedrooms (optional)' },
        city: { type: 'STRING', description: 'City name or neighborhood (optional)' },
        searchQuery: { type: 'STRING', description: 'Keywords matching title or address (optional)' },
      },
    },
  },
  {
    name: 'get_lead_context',
    description: 'Retrieve confirmed buyer requirements, current sales status, and interaction history for the active lead.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'The unique ID of the authorized lead' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'check_site_visit_availability',
    description: 'Check available 45-minute on-site walkthrough tour time slots for an advisor on a given date. Strictly read-only availability check.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: { type: 'STRING', description: 'Target date in YYYY-MM-DD format (must be future date)' },
        advisorId: { type: 'STRING', description: 'Advisor user ID (optional; defaults to lead assignee)' },
        propertyId: { type: 'STRING', description: 'Property ID to check eligibility and location for the tour (optional)' },
        preferredTime: { type: 'STRING', description: 'Optional specific time to check in HH:MM format (e.g. 14:00)' },
        timezone: { type: 'STRING', description: 'Authoritative IANA timezone identifier (e.g. America/New_York, Asia/Kolkata). Optional.' },
      },
      required: ['date'],
    },
  },
  {
    name: 'propose_follow_up_task',
    description: 'Propose a follow-up task for human advisor review. This proposal is not created in the database until approved.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'Lead ID associated with the task' },
        title: { type: 'STRING', description: 'Concise task description' },
        taskType: {
          type: 'STRING',
          enum: ['CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'PREPARE_DOCS', 'OTHER'],
          description: 'Type of follow-up task',
        },
        dueDate: { type: 'STRING', description: 'Due date and time in ISO 8601 format' },
        priority: {
          type: 'STRING',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'Priority level (default MEDIUM)',
        },
        description: { type: 'STRING', description: 'Context details for the task' },
        reason: { type: 'STRING', description: 'Explanation of why this task is proposed' },
      },
      required: ['leadId', 'title', 'taskType', 'dueDate', 'reason'],
    },
  },
  {
    name: 'propose_buyer_requirements',
    description: 'Propose new, corrected, or updated buyer requirements extracted from explicit conversation evidence. Persists a proposal awaiting advisor confirmation without silently overwriting confirmed requirements.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'The unique ID of the authorized lead' },
        minBudget: { type: 'NUMBER', description: 'Proposed minimum budget ceiling in USD (optional)' },
        maxBudget: { type: 'NUMBER', description: 'Proposed maximum budget ceiling in USD (optional)' },
        preferredLocations: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Array of preferred neighborhoods or cities (optional)',
        },
        propertyType: { type: 'STRING', description: 'Property type e.g. CONDO, SINGLE_FAMILY, TOWNHOUSE (optional)' },
        minBedrooms: { type: 'INTEGER', description: 'Minimum bedrooms count (optional)' },
        maxBedrooms: { type: 'INTEGER', description: 'Maximum bedrooms count (optional)' },
        possessionTimeline: { type: 'STRING', description: 'Move-in timeline e.g. IMMEDIATE, 30_DAYS, 60_DAYS (optional)' },
        changeType: {
          type: 'STRING',
          enum: ['NEW_PREFERENCE', 'CORRECTION', 'ADDITION', 'REMOVAL'],
          description: 'Nature of this requirement change (default NEW_PREFERENCE)',
        },
        sourceEvidence: { type: 'STRING', description: 'Quote or statement from customer justifying this requirement' },
        reason: { type: 'STRING', description: 'Explanation of why this proposal is submitted' },
      },
      required: ['leadId', 'sourceEvidence', 'reason'],
    },
  },
  {
    name: 'evaluate_buyer_qualification',
    description: 'Deterministically evaluate whether the buyer is qualified based on budget, location, bedroom/property preferences, and expressed purchase intent.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'The unique ID of the authorized lead' },
        hasExpressedIntent: { type: 'BOOLEAN', description: 'Whether the customer has communicated active purchase/rental intent' },
        notes: { type: 'STRING', description: 'Optional context on buyer qualification evaluation' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'refresh_property_matches',
    description: 'Recompute and refresh property matches for this lead against current inventory using confirmed requirements.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'The unique ID of the authorized lead' },
        forceRefresh: { type: 'BOOLEAN', description: 'Whether to force recomputation against database inventory' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'propose_site_visit',
    description: 'Propose a structured on-site walkthrough tour time slot for an eligible property after checking real advisor availability. A proposal is not a booking and does not reserve inventory.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'The unique ID of the authorized lead' },
        propertyId: { type: 'STRING', description: 'The unique ID of the verified property to visit' },
        date: { type: 'STRING', description: 'Target date in YYYY-MM-DD format (must be future date)' },
        preferredTime: { type: 'STRING', description: 'Requested start time in HH:MM format (e.g. 14:00)' },
        durationMinutes: { type: 'INTEGER', description: 'Tour duration in minutes (default 45)' },
        notes: { type: 'STRING', description: 'Optional context or specific focus areas for the tour' },
        timezone: { type: 'STRING', description: 'Authoritative IANA timezone identifier (e.g. America/New_York, Asia/Kolkata). Optional.' },
      },
      required: ['leadId', 'propertyId', 'date', 'preferredTime'],
    },
  },
  {
    name: 'book_site_visit',
    description: 'Book and schedule an actual on-site walkthrough tour for an eligible property ONLY when the buyer has explicitly consented to the specific slot. Concurrency-safe and linked to an advisor task.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'The unique ID of the authorized lead' },
        propertyId: { type: 'STRING', description: 'The unique ID of the verified property to book' },
        date: { type: 'STRING', description: 'Date in YYYY-MM-DD format (must be future date)' },
        time: { type: 'STRING', description: 'Time in HH:MM format (e.g. 14:00)' },
        durationMinutes: { type: 'INTEGER', description: 'Tour duration in minutes (default 45)' },
        buyerConsentEvidence: {
          type: 'STRING',
          description: 'Explicit statement or quote from customer agreeing to this specific visit date and time',
        },
        meetingLocation: { type: 'STRING', description: 'Walkthrough meeting location or address (optional)' },
        notes: { type: 'STRING', description: 'Additional instructions or notes for the advisor (optional)' },
        timezone: { type: 'STRING', description: 'Authoritative IANA timezone identifier (e.g. America/New_York, Asia/Kolkata). Optional.' },
      },
      required: ['leadId', 'propertyId', 'date', 'time', 'buyerConsentEvidence'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Escalate the conversation to a human advisor when buyer requests human, requests complex discounts/negotiation, has legal/financial questions, expresses complaints, or when information cannot be safely verified. Engages human takeover and creates an advisor task.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'The unique ID of the authorized lead' },
        reason: {
          type: 'STRING',
          enum: [
            'BUYER_REQUESTED_HUMAN',
            'COMPLEX_NEGOTIATION',
            'LOW_CONFIDENCE',
            'CONFLICTING_INFORMATION',
            'BUYER_COMPLAINT',
            'LEGAL_OR_FINANCIAL_SENSITIVITY',
            'REPEATED_FAILURE',
            'POLICY_RESTRICTION',
            'BOOKING_EXCEPTION',
          ],
          description: 'Explicit categorized reason for escalating to a human advisor',
        },
        explanation: {
          type: 'STRING',
          description: 'Factual description of the triggering issue or buyer request',
        },
        urgency: {
          type: 'STRING',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'Urgency of the escalation (default HIGH)',
        },
        recommendedAdvisorAction: {
          type: 'STRING',
          description: 'Clear recommended next action for the human advisor',
        },
      },
      required: ['leadId', 'reason', 'explanation', 'recommendedAdvisorAction'],
    },
  },
  {
    name: 'plan_lead_follow_up',
    description:
      'Propose a context-aware follow-up recommendation grounded in persistent buyer memory (completed tour next steps, unanswered inquiries, new matching inventory, or re-engagement check-ins). Does not create tasks or dispatch messages without advisor approval.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leadId: { type: 'STRING', description: 'The unique ID of the authorized lead' },
        trigger: {
          type: 'STRING',
          enum: [
            'UNANSWERED_QUESTION',
            'COMPLETED_VISIT_FOLLOW_UP',
            'VISIT_INTEREST_UNSCHEDULED',
            'NEW_MATCHING_INVENTORY',
            'INACTIVE_LEAD_CHECKIN',
            'ADVISOR_COMMITMENT_DUE',
          ],
          description: 'Identified trigger or rationale for following up',
        },
        recommendedAction: {
          type: 'STRING',
          description: 'Concrete next action for the advisor to take with the buyer',
        },
        priority: {
          type: 'STRING',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'Priority level for the follow-up recommendation',
        },
        suggestedDueDate: {
          type: 'STRING',
          description: 'Suggested due date/time in ISO 8601 format',
        },
        rationale: {
          type: 'STRING',
          description: 'Factual evidence-grounded explanation of why follow-up is appropriate now',
        },
        draftMessage: {
          type: 'STRING',
          description: 'Optional drafted message proposal for advisor review',
        },
      },
      required: ['leadId', 'recommendedAction', 'suggestedDueDate', 'rationale'],
    },
  },
] as const;

export const ALLOWED_TOOL_NAMES = new Set(AGENT_FUNCTION_DECLARATIONS.map((d) => d.name));

// ── Tool Execution Dispatcher ────────────────────────────────────────────────

export async function executeAgentTool(
  toolName: string,
  rawArgs: unknown,
  context: TrustedAgentContext,
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  if (!ALLOWED_TOOL_NAMES.has(toolName as any)) {
    return {
      toolName,
      status: 'ERROR',
      error: `Unknown tool "${toolName}". Allowed tools: ${Array.from(ALLOWED_TOOL_NAMES).join(', ')}`,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    switch (toolName) {
      case 'search_properties': {
        const parsed = SearchPropertiesArgsSchema.safeParse(rawArgs ?? {});
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid search_properties arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }
        const args = parsed.data;
        const properties = await getProperties({
          search: args.searchQuery,
          minPrice: args.minPrice,
          maxPrice: args.maxPrice,
          bedrooms: args.bedrooms,
          city: args.city,
          organizationId: context.organizationId,
        });

        // Bounded structured response (max 5 items, verified fields only)
        const bounded = properties.slice(0, 5).map((p) => ({
          id: p.id,
          title: p.title,
          address: p.address,
          city: p.city,
          price: p.price,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          propertyType: p.propertyType,
          status: p.status,
          features: p.features,
        }));

        return {
          toolName,
          status: 'SUCCESS',
          data: {
            totalFound: properties.length,
            returnedCount: bounded.length,
            properties: bounded,
            message:
              bounded.length === 0
                ? 'No verified properties found matching the requested criteria in current inventory.'
                : undefined,
          },
          durationMs: Date.now() - startTime,
        };
      }

      case 'get_lead_context': {
        const parsed = GetLeadContextArgsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid get_lead_context arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        // Security: Refuse cross-lead access; must match authenticated lead context
        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Access denied: Requested lead ID does not match active conversation context.',
            durationMs: Date.now() - startTime,
          };
        }

        const lead = await getLeadDetails(context.leadId, context.organizationId);
        const req = lead.requirements;

        const boundedContext = {
          leadId: lead.id,
          fullName: lead.fullName,
          status: lead.status,
          priority: lead.priority,
          source: lead.source,
          assignedAdvisorId: lead.assignedUserId,
          requirements: req
            ? {
                minBudget: req.minBudget,
                maxBudget: req.maxBudget,
                preferredLocations: req.preferredLocations,
                propertyType: req.propertyType,
                minBedrooms: req.minBedrooms,
                maxBedrooms: req.maxBedrooms,
                possessionTimeline: req.possessionTimeline,
                notes: req.notes,
              }
            : null,
          interactionSummary: {
            totalCallLogs: lead.callLogs.length,
            openTasksCount: lead.tasks.filter((t) => t.status === 'OPEN').length,
            siteVisitsCount: lead.siteVisits.length,
          },
          topMatches: lead.matches.slice(0, 3).map((m) => ({
            propertyId: m.property.id,
            title: m.property.title,
            price: m.property.price,
            bedrooms: m.property.bedrooms,
            city: m.property.city,
            matchScore: m.matchScore,
            reason: m.matchReason,
          })),
          buyerMemory: await assembleBuyerMemory(context.leadId, context.organizationId),
          followUpRecommendation: evaluateFollowUpNeed(
            await assembleBuyerMemory(context.leadId, context.organizationId),
          ),
        };

        return {
          toolName,
          status: 'SUCCESS',
          data: boundedContext,
          durationMs: Date.now() - startTime,
        };
      }

      case 'check_site_visit_availability': {
        const parsed = CheckSiteVisitAvailabilityArgsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid check_site_visit_availability arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        if (isPastDate(parsed.data.date)) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Cannot check availability for past dates.',
            durationMs: Date.now() - startTime,
          };
        }

        if (parsed.data.propertyId) {
          const property = await prisma.property.findFirst({
            where: { id: parsed.data.propertyId, organizationId: context.organizationId },
          });
          if (!property) {
            return {
              toolName,
              status: 'ERROR',
              error: 'Property not found in this organization.',
              durationMs: Date.now() - startTime,
            };
          }
          if (property.status !== 'AVAILABLE') {
            return {
              toolName,
              status: 'ERROR',
              error: `Property "${property.title}" is not available for site visits (status: ${property.status}).`,
              durationMs: Date.now() - startTime,
            };
          }
        }

        let advisorId = parsed.data.advisorId;
        if (!advisorId) {
          const lead = await getLeadDetails(context.leadId, context.organizationId);
          advisorId = lead.assignedUserId ?? context.userId;
        }

        if (!advisorId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'No advisor assigned to this lead or specified in request to check availability for.',
            durationMs: Date.now() - startTime,
          };
        }

        let resolvedTz: string;
        try {
          resolvedTz = await resolveTimezoneForLead(context.leadId, context.organizationId, parsed.data.timezone);
        } catch (tzErr: any) {
          return {
            toolName,
            status: 'ERROR',
            error: tzErr.message,
            durationMs: Date.now() - startTime,
          };
        }

        const standardSlots = parsed.data.preferredTime
          ? [parsed.data.preferredTime]
          : ['10:00', '11:30', '14:00', '15:30', '17:00'];

        const slotChecks: Array<{ time: string; available: boolean }> = [];

        for (const timeStr of standardSlots) {
          let startAtDate: Date;
          try {
            startAtDate = parseLocalDateTimeToUtc(parsed.data.date, timeStr, resolvedTz);
          } catch (slotParseErr: any) {
            slotChecks.push({ time: timeStr, available: false });
            continue;
          }
          const startAtIso = startAtDate.toISOString();
          try {
            const check = await checkAdvisorAvailability({
              organizationId: context.organizationId,
              callerId: context.userId ?? advisorId,
              callerRole: 'OWNER',
              advisorId,
              startAt: startAtIso,
              durationMinutes: 45,
            });
            slotChecks.push({ time: timeStr, available: check.available });
          } catch (slotErr) {
            slotChecks.push({ time: timeStr, available: false });
          }
        }

        const availableSlots = slotChecks
          .filter((s: { time: string; available: boolean }) => s.available)
          .map((s: { time: string; available: boolean }) => s.time);

        return {
          toolName,
          status: 'SUCCESS',
          data: {
            date: parsed.data.date,
            timezone: resolvedTz,
            advisorId,
            slotsChecked: slotChecks,
            availableSlots,
            isFullyBooked: availableSlots.length === 0,
            note:
              availableSlots.length === 0
                ? 'Advisor has no available 45-minute slots on this date.'
                : 'Available 45-minute walkthrough slots retrieved. This is an availability check only; visit is not booked.',
          },
          durationMs: Date.now() - startTime,
        };
      }


      case 'propose_follow_up_task': {
        const parsed = ProposeFollowUpTaskArgsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid propose_follow_up_task arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Access denied: Cannot propose task for a lead outside active conversation context.',
            durationMs: Date.now() - startTime,
          };
        }

        // Verify lead exists in this tenant
        await getLeadDetails(context.leadId, context.organizationId);

        // Scope C: Strictly unpersisted proposal; returns structured proposal without database mutation
        const proposal = {
          status: 'PROPOSED',
          persisted: false,
          requiresApproval: true,
          proposal: {
            leadId: parsed.data.leadId,
            title: parsed.data.title,
            taskType: parsed.data.taskType,
            dueDate: parsed.data.dueDate,
            priority: parsed.data.priority,
            description: parsed.data.description ?? null,
            reason: parsed.data.reason,
          },
          message:
            'Follow-up task proposal recorded for advisor review. The task has NOT been created in the database.',
        };

        return {
          toolName,
          status: 'SUCCESS',
          data: proposal,
          durationMs: Date.now() - startTime,
        };
      }

      case 'propose_buyer_requirements': {
        const parsed = ProposeBuyerRequirementsArgsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid propose_buyer_requirements arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Access denied: Cannot propose requirements for a lead outside active conversation context.',
            durationMs: Date.now() - startTime,
          };
        }

        const lead = await getLeadDetails(context.leadId, context.organizationId);
        const existingReq = lead.requirements;

        const previousValues = existingReq
          ? {
              minBudget: existingReq.minBudget,
              maxBudget: existingReq.maxBudget,
              preferredLocations: existingReq.preferredLocations,
              propertyType: existingReq.propertyType,
              minBedrooms: existingReq.minBedrooms,
              maxBedrooms: existingReq.maxBedrooms,
              possessionTimeline: existingReq.possessionTimeline,
            }
          : null;

        const proposedValues = {
          minBudget:
            parsed.data.minBudget !== undefined ? parsed.data.minBudget : (previousValues?.minBudget ?? null),
          maxBudget:
            parsed.data.maxBudget !== undefined ? parsed.data.maxBudget : (previousValues?.maxBudget ?? null),
          preferredLocations:
            parsed.data.preferredLocations !== undefined
              ? parsed.data.preferredLocations
              : (previousValues?.preferredLocations ?? []),
          propertyType:
            parsed.data.propertyType !== undefined
              ? parsed.data.propertyType
              : (previousValues?.propertyType ?? null),
          minBedrooms:
            parsed.data.minBedrooms !== undefined
              ? parsed.data.minBedrooms
              : (previousValues?.minBedrooms ?? null),
          maxBedrooms:
            parsed.data.maxBedrooms !== undefined
              ? parsed.data.maxBedrooms
              : (previousValues?.maxBedrooms ?? null),
          possessionTimeline:
            parsed.data.possessionTimeline !== undefined
              ? parsed.data.possessionTimeline
              : (previousValues?.possessionTimeline ?? null),
        };

        const proposal = await prisma.leadRequirementProposal.create({
          data: {
            leadId: context.leadId,
            organizationId: context.organizationId,
            proposedMinBudget: proposedValues.minBudget,
            proposedMaxBudget: proposedValues.maxBudget,
            proposedLocations: proposedValues.preferredLocations,
            proposedPropertyType: proposedValues.propertyType,
            proposedMinBedrooms: proposedValues.minBedrooms,
            proposedMaxBedrooms: proposedValues.maxBedrooms,
            proposedTimeline: proposedValues.possessionTimeline,
            confidence: 0.95,
            status: 'PENDING',
          },
        });

        await prisma.auditLog.create({
          data: {
            organizationId: context.organizationId,
            action: 'LEAD_REQUIREMENTS_EXTRACTED',
            entityType: 'LeadRequirementProposal',
            entityId: proposal.id,
            actor: 'ai_sales_agent',
            note: `AI proposed ${parsed.data.changeType} requirement update: ${parsed.data.reason}`,
            newValue: {
              proposalId: proposal.id,
              changeType: parsed.data.changeType,
              proposedValues,
              sourceEvidence: parsed.data.sourceEvidence,
            },
          },
        });

        return {
          toolName,
          status: 'SUCCESS',
          data: {
            proposalId: proposal.id,
            status: 'PENDING',
            persisted: true,
            requiresApproval: true,
            changeType: parsed.data.changeType,
            sourceEvidence: parsed.data.sourceEvidence,
            reason: parsed.data.reason,
            previousValues,
            proposedValues,
            message:
              'Requirement change proposal recorded in database pending human advisor review. Existing confirmed requirements were preserved intact.',
          },
          durationMs: Date.now() - startTime,
        };
      }

      case 'evaluate_buyer_qualification': {
        const parsed = EvaluateBuyerQualificationArgsSchema.safeParse(rawArgs ?? {});
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid evaluate_buyer_qualification arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Access denied: Cannot evaluate qualification for a lead outside active conversation context.',
            durationMs: Date.now() - startTime,
          };
        }

        const lead = await getLeadDetails(context.leadId, context.organizationId);
        const req = lead.requirements;

        const hasIntent = parsed.data.hasExpressedIntent;
        const hasBudget = Boolean(req && req.maxBudget && req.maxBudget > 0);
        const hasLocation = Boolean(req && req.preferredLocations && req.preferredLocations.length > 0);
        const hasPreference = Boolean(req && (req.propertyType || (req.minBedrooms && req.minBedrooms > 0)));

        const missingFields: string[] = [];
        if (!hasIntent) missingFields.push('buyer_intent');
        if (!hasBudget) missingFields.push('budget_range');
        if (!hasLocation) missingFields.push('preferred_locations');
        if (!hasPreference) missingFields.push('property_type_or_bedrooms');

        const isQualified = missingFields.length === 0;
        let statusTransitioned = false;
        let currentStatus = lead.status;

        if (isQualified && ['NEW', 'CONTACTED'].includes(lead.status)) {
          await updateLeadStatus({
            leadId: context.leadId,
            organizationId: context.organizationId,
            newStatus: 'QUALIFIED',
            actorEmail: 'ai_sales_agent',
            reason: 'Deterministically qualified by AI agent based on budget, location, and property preferences',
          });
          statusTransitioned = true;
          currentStatus = 'QUALIFIED';
        } else if (!isQualified && lead.status === 'NEW') {
          await updateLeadStatus({
            leadId: context.leadId,
            organizationId: context.organizationId,
            newStatus: 'CONTACTED',
            actorEmail: 'ai_sales_agent',
            reason: 'Customer initiated contact; ongoing buyer qualification',
          });
          statusTransitioned = true;
          currentStatus = 'CONTACTED';
        }

        let recommendedClarificationQuestion: string | null = null;
        if (!hasBudget && !hasLocation) {
          recommendedClarificationQuestion = 'Could you please share your target budget and preferred neighborhoods?';
        } else if (!hasBudget) {
          recommendedClarificationQuestion = 'What is your target price range or maximum budget?';
        } else if (!hasLocation) {
          recommendedClarificationQuestion = 'Which cities or neighborhoods are you most interested in?';
        } else if (!hasPreference) {
          recommendedClarificationQuestion = 'How many bedrooms are you looking for, or what property style do you prefer?';
        }

        return {
          toolName,
          status: 'SUCCESS',
          data: {
            leadId: context.leadId,
            isQualified,
            currentStatus,
            previousStatus: lead.status,
            statusTransitioned,
            qualificationChecklist: {
              hasIntent,
              hasBudget,
              hasLocation,
              hasPreference,
            },
            missingFields,
            recommendedClarificationQuestion,
          },
          durationMs: Date.now() - startTime,
        };
      }

      case 'refresh_property_matches': {
        const parsed = RefreshPropertyMatchesArgsSchema.safeParse(rawArgs ?? {});
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid refresh_property_matches arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Access denied: Cannot refresh matches for a lead outside active conversation context.',
            durationMs: Date.now() - startTime,
          };
        }

        const lead = await getLeadDetails(context.leadId, context.organizationId);
        if (!lead.requirements) {
          return {
            toolName,
            status: 'SUCCESS',
            data: {
              leadId: context.leadId,
              refreshed: false,
              totalMatches: 0,
              matches: [],
              message:
                'Cannot compute property matches: lead does not have confirmed requirements yet. Propose requirements first.',
            },
            durationMs: Date.now() - startTime,
          };
        }

        const matches = await computeMatchesForLead(context.leadId, context.organizationId);

        const boundedMatches = matches.slice(0, 5).map((m) => ({
          propertyId: m.property.id,
          title: m.property.title,
          address: m.property.address,
          city: m.property.city,
          price: m.property.price,
          bedrooms: m.property.bedrooms,
          bathrooms: m.property.bathrooms,
          propertyType: m.property.propertyType,
          matchScore: m.matchScore,
          matchReason: m.matchReason,
          failedCriteria: m.failedCriteria,
          isConfirmedMatch: m.failedCriteria.length === 0 && m.matchScore >= 0.5,
        }));

        return {
          toolName,
          status: 'SUCCESS',
          data: {
            leadId: context.leadId,
            refreshed: true,
            totalFound: matches.length,
            returnedCount: boundedMatches.length,
            matches: boundedMatches,
            message:
              boundedMatches.length === 0
                ? 'No verified properties found matching the confirmed requirements in current inventory.'
                : undefined,
          },
          durationMs: Date.now() - startTime,
        };
      }

      case 'propose_site_visit': {
        const parsed = ProposeSiteVisitArgsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid propose_site_visit arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Access denied: Cannot propose site visit for a lead outside active conversation context.',
            durationMs: Date.now() - startTime,
          };
        }

        if (isPastDate(parsed.data.date)) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Cannot propose site visit for dates in the past.',
            durationMs: Date.now() - startTime,
          };
        }

        const property = await prisma.property.findFirst({
          where: { id: parsed.data.propertyId, organizationId: context.organizationId },
        });

        if (!property) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Property not found in this organization.',
            durationMs: Date.now() - startTime,
          };
        }

        if (property.status !== 'AVAILABLE') {
          return {
            toolName,
            status: 'ERROR',
            error: `Property "${property.title}" is not available for site visits (status: ${property.status}).`,
            durationMs: Date.now() - startTime,
          };
        }

        const lead = await getLeadDetails(context.leadId, context.organizationId);
        const advisorId = lead.assignedUserId ?? context.userId;

        if (!advisorId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'No advisor assigned to lead or found in context to schedule tour with.',
            durationMs: Date.now() - startTime,
          };
        }

        let resolvedTz: string;
        try {
          resolvedTz = await resolveTimezoneForLead(context.leadId, context.organizationId, parsed.data.timezone);
        } catch (tzErr: any) {
          return {
            toolName,
            status: 'ERROR',
            error: tzErr.message,
            durationMs: Date.now() - startTime,
          };
        }

        let startAtDate: Date;
        try {
          startAtDate = parseLocalDateTimeToUtc(parsed.data.date, parsed.data.preferredTime, resolvedTz);
        } catch (parseErr: any) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid site visit slot: ${parseErr.message}`,
            durationMs: Date.now() - startTime,
          };
        }
        const startAtIso = startAtDate.toISOString();
        const availability = await checkAdvisorAvailability({
          organizationId: context.organizationId,
          callerId: context.userId ?? advisorId,
          callerRole: 'OWNER',
          advisorId,
          startAt: startAtIso,
          durationMinutes: parsed.data.durationMinutes,
        });

        if (!availability.available) {
          return {
            toolName,
            status: 'SUCCESS',
            data: {
              proposed: false,
              slotAvailable: false,
              propertyId: property.id,
              propertyTitle: property.title,
              date: parsed.data.date,
              time: parsed.data.preferredTime,
              timezone: resolvedTz,
              message:
                'The requested walkthrough time slot is currently unavailable for the advisor. Please choose an alternative slot.',
            },
            durationMs: Date.now() - startTime,
          };
        }

        return {
          toolName,
          status: 'SUCCESS',
          data: {
            proposed: true,
            slotAvailable: true,
            persisted: false,
            requiresBuyerConfirmation: true,
            property: {
              id: property.id,
              title: property.title,
              address: property.address,
              city: property.city,
              price: property.price,
            },
            advisor: {
              id: advisorId,
              name: lead.assignedUser?.name ?? 'Assigned Advisor',
            },
            slot: {
              date: parsed.data.date,
              time: parsed.data.preferredTime,
              timezone: resolvedTz,
              startAt: startAtIso,
              durationMinutes: parsed.data.durationMinutes,
            },
            meetingLocation: property.address,
            message:
              'Walkthrough tour proposal prepared. Awaiting explicit customer agreement before booking.',
          },
          durationMs: Date.now() - startTime,
        };
      }

      case 'book_site_visit': {
        const parsed = BookSiteVisitArgsSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid book_site_visit arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Access denied: Cannot book site visit for a lead outside active conversation context.',
            durationMs: Date.now() - startTime,
          };
        }

        if (isPastDate(parsed.data.date)) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Cannot book site visit for dates in the past.',
            durationMs: Date.now() - startTime,
          };
        }

        let resolvedTz: string;
        try {
          resolvedTz = await resolveTimezoneForLead(context.leadId, context.organizationId, parsed.data.timezone);
        } catch (tzErr: any) {
          return {
            toolName,
            status: 'ERROR',
            error: tzErr.message,
            durationMs: Date.now() - startTime,
          };
        }

        let startAtDate: Date;
        try {
          startAtDate = parseLocalDateTimeToUtc(parsed.data.date, parsed.data.time, resolvedTz);
        } catch (parseErr: any) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid site visit slot: ${parseErr.message}`,
            durationMs: Date.now() - startTime,
          };
        }
        const startAtIso = startAtDate.toISOString();

        const property = await prisma.property.findFirst({
          where: { id: parsed.data.propertyId, organizationId: context.organizationId },
        });

        if (!property) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Property not found in this organization.',
            durationMs: Date.now() - startTime,
          };
        }

        if (property.status !== 'AVAILABLE') {
          return {
            toolName,
            status: 'ERROR',
            error: `Property "${property.title}" is not available for site visits (status: ${property.status}).`,
            durationMs: Date.now() - startTime,
          };
        }

        // Authentic Buyer Consent Verification
        const consentVerification = await verifyBuyerVisitConsent({
          leadId: context.leadId,
          organizationId: context.organizationId,
          threadId: context.threadId,
          property: {
            id: property.id,
            title: property.title,
            address: property.address,
            city: property.city,
          },
          targetDate: parsed.data.date,
          targetTime: parsed.data.time,
          buyerConsentEvidence: parsed.data.buyerConsentEvidence,
        });

        if (!consentVerification.valid) {
          return {
            toolName,
            status: 'ERROR',
            error: `Consent verification failed: ${consentVerification.error}`,
            durationMs: Date.now() - startTime,
          };
        }

        const lead = await getLeadDetails(context.leadId, context.organizationId);
        const targetAdvisorId = lead.assignedUserId || context.userId;

        if (!targetAdvisorId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'No advisor assigned to this lead to host the visit.',
            durationMs: Date.now() - startTime,
          };
        }

        const callerId = context.userId ?? targetAdvisorId;
        const callerRole: UserRole = context.callerRole ?? (lead.assignedUserId === callerId ? 'AGENT' : 'OWNER');

        try {
          const consentNote = `[Verified Consent Msg: ${consentVerification.consentMessageId}]`;
          const visit = await scheduleSiteVisit({
            leadId: context.leadId,
            organizationId: context.organizationId,
            callerId,
            callerRole,
            callerEmail: context.callerEmail ?? 'ai_sales_agent',
            propertyId: property.id,
            startAt: startAtIso,
            durationMinutes: parsed.data.durationMinutes,
            meetingLocation: parsed.data.meetingLocation ?? property.address,
            notes: parsed.data.notes
              ? `${consentNote} ${parsed.data.notes}`
              : consentNote,
            assignedUserId: targetAdvisorId,
          });

          return {
            toolName,
            status: 'SUCCESS',
            data: {
              booked: true,
              visitId: visit.id,
              status: visit.status,
              startAt: visit.startAt,
              endAt: visit.endAt,
              timezone: resolvedTz,
              property: {
                id: property.id,
                title: property.title,
                address: property.address,
              },
              advisor: {
                id: targetAdvisorId,
                name: (visit as any).assignedUser?.name ?? 'Assigned Advisor',
              },
              leadTaskId: (visit as any).leadTask?.id,
              meetingLocation: visit.meetingLocation,
              buyerConsentEvidence: parsed.data.buyerConsentEvidence,
              verifiedConsentMessageId: consentVerification.consentMessageId,
              message: `Site visit successfully scheduled for ${parsed.data.date} at ${parsed.data.time} (${resolvedTz}) for "${property.title}".`,
            },
            durationMs: Date.now() - startTime,
          };
        } catch (err: any) {
          const isConflict =
            err?.statusCode === 409 ||
            err?.message?.includes('conflicting') ||

            err?.message?.includes('conflict');
          if (isConflict) {
            return {
              toolName,
              status: 'ERROR',
              error: 'Advisor has a conflicting site visit during the requested time window.',
              data: {
                booked: false,
                conflict: true,
                message:
                  'The requested slot is already booked. Please propose an alternate time.',
              },
              durationMs: Date.now() - startTime,
            };
          }

          const errMsg = err instanceof Error ? err.message : String(err);
          return {
            toolName,
            status: 'ERROR',
            error: errMsg,
            durationMs: Date.now() - startTime,
          };
        }
      }

      case 'escalate_to_human': {
        const parsed = EscalateToHumanArgsSchema.safeParse(rawArgs ?? {});
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid escalate_to_human arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        // Authorization & Scope check: lead must match active thread
        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Cross-lead escalation rejected: provided leadId does not match active thread context',
            durationMs: Date.now() - startTime,
          };
        }

        const orgId = requireOrgId(context.organizationId);

        // Fetch lead with requirements, assigned advisor, confirmed site visits, and matches
        const lead = await prisma.lead.findFirst({
          where: { id: context.leadId, organizationId: orgId },
          include: {
            requirements: true,
            assignedUser: { select: { id: true, name: true, email: true, role: true } },
            siteVisits: {
              where: { status: { in: ['SCHEDULED', 'COMPLETED'] } },
              include: { property: { select: { id: true, title: true, address: true, city: true } } },
              orderBy: { startAt: 'desc' },
              take: 5,
            },
            matches: {
              include: { property: { select: { id: true, title: true, price: true, city: true, bedrooms: true } } },
              take: 3,
            },
          },
        });

        if (!lead) {
          return {
            toolName,
            status: 'ERROR',
            error: `Lead ${context.leadId} not found in organization ${orgId}`,
            durationMs: Date.now() - startTime,
          };
        }

        // Verify thread belongs to this org
        const thread = await prisma.conversationThread.findFirst({
          where: { id: context.threadId, organizationId: orgId },
          include: {
            messages: { orderBy: { createdAt: 'desc' }, take: 10 },
          },
        });

        if (!thread) {
          return {
            toolName,
            status: 'ERROR',
            error: `Thread ${context.threadId} not found in organization ${orgId}`,
            durationMs: Date.now() - startTime,
          };
        }

        // Extract latest customer request and any pending proposals from recent messages
        const latestCustomerMessage =
          thread.messages.find((m) => m.senderType === 'CUSTOMER')?.content ?? '';

        let pendingReqProposal: unknown = null;
        let pendingVisitProposal: unknown = null;
        for (const msg of thread.messages) {
          if (msg.senderType === 'AI' && msg.suggestedAction && typeof msg.suggestedAction === 'object') {
            const act = msg.suggestedAction as Record<string, unknown>;
            if (!pendingReqProposal && act['requirementProposal']) {
              pendingReqProposal = act['requirementProposal'];
            }
            if (!pendingVisitProposal && act['siteVisitProposal']) {
              pendingVisitProposal = act['siteVisitProposal'];
            }
          }
        }

        // Construct Evidence-Grounded Advisor Handoff Brief
        const brief = {
          reason: parsed.data.reason,
          urgency: parsed.data.urgency,
          explanation: parsed.data.explanation,
          recommendedAdvisorAction: parsed.data.recommendedAdvisorAction,
          leadId: lead.id,
          threadId: context.threadId,
          buyerName: lead.fullName,
          buyerEmail: lead.email,
          buyerPhone: lead.phone,
          assignedAdvisor: lead.assignedUser
            ? {
                id: lead.assignedUser.id,
                name: lead.assignedUser.name || lead.assignedUser.email,
                email: lead.assignedUser.email,
              }
            : null,
          latestCustomerMessage,
          // Strictly distinguish confirmed facts vs pending proposals
          confirmedRequirements: lead.requirements
            ? {
                minBudget: lead.requirements.minBudget,
                maxBudget: lead.requirements.maxBudget,
                preferredLocations: lead.requirements.preferredLocations,
                minBedrooms: lead.requirements.minBedrooms,
                maxBedrooms: lead.requirements.maxBedrooms,
                propertyType: lead.requirements.propertyType,
                timeline: lead.requirements.possessionTimeline,
              }
            : null,
          pendingRequirementProposal: pendingReqProposal,
          confirmedSiteVisits: lead.siteVisits.map((v) => ({
            id: v.id,
            propertyTitle: v.property?.title ?? 'Scheduled Tour',
            startTime: v.startAt.toISOString(),
            endTime: v.endAt.toISOString(),
            status: v.status,
          })),
          pendingSiteVisitProposal: pendingVisitProposal,
          matchingProperties: lead.matches.map((m) => ({
            id: m.property.id,
            title: m.property.title,
            price: m.property.price,
            city: m.property.city,
            bedrooms: m.property.bedrooms,
          })),
          timestamp: new Date().toISOString(),
        };

        // Determine target assignee for the escalation task
        let targetAssigneeId = lead.assignedUserId;
        if (!targetAssigneeId) {
          if (context.userId) {
            const userInOrg = await prisma.user.findFirst({
              where: { id: context.userId, organizationId: orgId },
              select: { id: true },
            });
            if (userInOrg) targetAssigneeId = userInOrg.id;
          }
          if (!targetAssigneeId) {
            const fallbackUser = await prisma.user.findFirst({
              where: { organizationId: orgId },
              select: { id: true },
            });
            targetAssigneeId = fallbackUser?.id ?? null;
          }
        }

        try {
          // 1. Idempotent escalation task creation
          let taskId: string | null = null;
          if (targetAssigneeId) {
            const existingTask = await prisma.leadTask.findFirst({
              where: {
                leadId: lead.id,
                organizationId: orgId,
                status: 'OPEN',
                title: { startsWith: `Escalation [${parsed.data.reason}]` },
              },
            });

            if (existingTask) {
              taskId = existingTask.id;
              logger.info(`[Agent Tools] Reused existing open escalation task ${taskId} for lead ${lead.id}`);
            } else {
              const newTask = await prisma.leadTask.create({
                data: {
                  leadId: lead.id,
                  organizationId: orgId,
                  taskType: 'CALL',
                  title: `Escalation [${parsed.data.reason}]: ${lead.fullName}`,
                  description: `Urgency: ${parsed.data.urgency}\nReason: ${parsed.data.reason}\n\nExplanation:\n${parsed.data.explanation}\n\nRecommended Action:\n${parsed.data.recommendedAdvisorAction}`,
                  dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Due in 2 hours
                  priority: parsed.data.urgency,
                  assignedUserId: targetAssigneeId,
                  createdById: targetAssigneeId,
                  status: 'OPEN',
                },
              });
              taskId = newTask.id;
            }
          }

          // 2. Engage Human Takeover on the conversation thread
          await prisma.conversationThread.update({
            where: { id: context.threadId },
            data: {
              isHumanTakeover: true,
              state: 'HUMAN_TAKEOVER',
              takeoverBy: 'ai_sales_agent',
              autoReplyEnabled: false,
            },
          });

          // 3. Record Audit Log
          try {
            await prisma.auditLog.create({
              data: {
                organizationId: orgId,
                action: 'HUMAN_TAKEOVER_TOGGLED',
                entityType: 'ConversationThread',
                entityId: context.threadId,
                actor: context.callerEmail ?? 'ai_sales_agent',
                note: `Escalation triggered [${parsed.data.reason}]. Urgency: ${parsed.data.urgency}. Human takeover engaged.`,
                newValue: {
                  reason: parsed.data.reason,
                  urgency: parsed.data.urgency,
                  explanation: parsed.data.explanation,
                  recommendedAdvisorAction: parsed.data.recommendedAdvisorAction,
                  taskId,
                  leadId: lead.id,
                },
              },
            });
          } catch (auditErr) {
            logger.warn(`[Agent Tools] Audit log creation failed: ${(auditErr as Error).message}`);
          }

          return {
            toolName,
            status: 'SUCCESS',
            data: {
              escalated: true,
              reason: parsed.data.reason,
              urgency: parsed.data.urgency,
              explanation: parsed.data.explanation,
              recommendedAdvisorAction: parsed.data.recommendedAdvisorAction,
              taskId,
              brief,
              message: `Escalation to human advisor successfully recorded with urgency ${parsed.data.urgency}. Human takeover engaged.`,
            },
            durationMs: Date.now() - startTime,
          };
        } catch (persistErr) {
          const errMsg = persistErr instanceof Error ? persistErr.message : String(persistErr);
          logger.error(`[Agent Tools] Escalation persistence failed: ${errMsg}`);
          return {
            toolName,
            status: 'ERROR',
            error: `Failed to persist escalation: ${errMsg}`,
            durationMs: Date.now() - startTime,
          };
        }
      }

      case 'plan_lead_follow_up': {
        const parsed = PlanLeadFollowUpArgsSchema.safeParse(rawArgs ?? {});
        if (!parsed.success) {
          return {
            toolName,
            status: 'ERROR',
            error: `Invalid plan_lead_follow_up arguments: ${parsed.error.message}`,
            durationMs: Date.now() - startTime,
          };
        }

        if (parsed.data.leadId !== context.leadId) {
          return {
            toolName,
            status: 'ERROR',
            error: 'Access denied: Requested lead ID does not match active conversation context.',
            durationMs: Date.now() - startTime,
          };
        }

        const orgId = requireOrgId(context.organizationId);
        const memory = await assembleBuyerMemory(context.leadId, orgId);

        if (!memory.eligibility.eligibleForFollowUp) {
          return {
            toolName,
            status: 'SUCCESS',
            data: {
              proposed: false,
              ineligible: true,
              reason: memory.eligibility.ineligibilityReason,
              message: 'Lead is currently ineligible for automated follow-up.',
            },
            durationMs: Date.now() - startTime,
          };
        }

        const autoRec = evaluateFollowUpNeed(memory);
        const activeTrigger = parsed.data.trigger ?? autoRec.trigger ?? 'INACTIVE_LEAD_CHECKIN';
        const proposedAction = parsed.data.recommendedAction;
        const proposedPriority = parsed.data.priority;
        const proposedDueDate = parsed.data.suggestedDueDate ?? autoRec.suggestedDueDate;
        const proposedDraft = parsed.data.draftMessage ?? parsed.data.suggestedDraftContent ?? autoRec.suggestedDraftContent;
        const proposedRationale = parsed.data.rationale ?? autoRec.reason;

        const proposal = {
          trigger: activeTrigger,
          recommendedAction: proposedAction,
          priority: proposedPriority,
          suggestedDueDate: proposedDueDate,
          rationale: proposedRationale,
          draftMessage: proposedDraft,
          evidence: autoRec.evidence,
        };

        return {
          toolName,
          status: 'SUCCESS',
          data: {
            proposed: true,
            persisted: false,
            requiresAdvisorApproval: true,
            requiresAdvisorReview: true,
            followUpProposal: proposal,
            ...proposal,
          },
          durationMs: Date.now() - startTime,
        };
      }

      default:
        return {
          toolName,
          status: 'ERROR',
          error: `Unhandled tool "${toolName}"`,
          durationMs: Date.now() - startTime,
        };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[Agent Tools] Error executing tool ${toolName}: ${errorMsg}`);
    return {
      toolName,
      status: 'ERROR',
      error: `Internal tool execution error: ${errorMsg}`,
      durationMs: Date.now() - startTime,
    };
  }
}
