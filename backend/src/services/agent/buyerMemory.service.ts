// ─────────────────────────────────────────────────────────────────────────────
// Phase 2E — Persistent Buyer Memory & Follow-Up Planning Engine
// ─────────────────────────────────────────────────────────────────────────────

import {
  type LeadStatus,
  type LeadPriority,
  type ConversationState,
  type SiteVisitStatus,
  type LeadTaskType,
  type UserRole,
} from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { requireOrgId } from '../../utils/tenant.js';
import { logger } from '../../utils/logger.js';
import { createError } from '../../middleware/errorHandler.js';
import { createLeadTask } from '../leadTask.service.js';


// ── Fact Provenance Types ────────────────────────────────────────────────────

export type FactProvenance =
  | 'AUTHORITATIVE_DB'
  | 'PENDING_PROPOSAL'
  | 'BUYER_STATED'
  | 'CONFIRMED_VISIT'
  | 'PROPOSED_VISIT'
  | 'ADVISOR_COMMITMENT'
  | 'INFERRED_UNCONFIRMED';

export interface PersistentBuyerMemory {
  leadId: string;
  organizationId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  assignedAdvisor: { id: string; name: string; email: string } | null;

  requirements: {
    confirmed: {
      minBudget: number | null;
      maxBudget: number | null;
      preferredLocations: string[];
      minBedrooms: number | null;
      maxBedrooms: number | null;
      propertyType: string | null;
      possessionTimeline: string | null;
      lastConfirmedAt: string | null;
    } | null;
    pendingProposals: Array<{
      id: string;
      changeType: string;
      proposedChanges: Record<string, unknown>;
      sourceEvidence: string;
      reason: string;
      createdAt: string;
    }>;
  };

  siteVisits: {
    confirmed: Array<{
      id: string;
      propertyId: string | null;
      propertyTitle: string;
      propertyPrice: number | null;
      propertyCity: string | null;
      startAt: string;
      endAt: string;
      status: SiteVisitStatus;
      completedAt: string | null;
      outcomeNotes: string | null;
    }>;
    pendingProposals: Array<{
      propertyId: string;
      propertyTitle?: string;
      date: string;
      preferredTime: string;
      proposedSlot: string;
      status: 'PROPOSED_NOT_BOOKED';
      notes?: string;
    }>;
  };

  propertiesContext: {
    visited: Array<{ id: string; title: string; price: number; city: string; completedAt: string }>;
    matched: Array<{ id: string; title: string; price: number; city: string; score: number; matchReason: string }>;
    discussedTitles: string[];
  };

  conversationState: {
    threadId: string | null;
    state: ConversationState;
    isHumanTakeover: boolean;
    takeoverBy: string | null;
    lastCustomerMessageAt: string | null;
    lastAdvisorMessageAt: string | null;
    lastMessageSender: string | null;
    lastActivityAt: string | null;
    unansweredQuestion: {
      isUnanswered: boolean;
      customerMessageId?: string;
      content?: string;
      receivedAt?: string;
      hoursPending?: number;
    } | null;
  };

  openTasks: Array<{
    id: string;
    taskType: LeadTaskType;
    title: string;
    dueDate: string;
    priority: LeadPriority;
    isOverdue: boolean;
  }>;

  recordedCommitments: Array<{
    type: 'CALL_LOG' | 'TASK' | 'MESSAGE';
    referenceId: string;
    notes: string;
    recordedAt: string;
  }>;

  eligibility: {
    eligibleForFollowUp: boolean;
    ineligibilityReason?: string;
  };

  generatedAt: string;
}

export const FOLLOW_UP_TRIGGERS = [
  'UNANSWERED_QUESTION',
  'COMPLETED_VISIT_FOLLOW_UP',
  'VISIT_INTEREST_UNSCHEDULED',
  'NEW_MATCHING_INVENTORY',
  'INACTIVE_LEAD_CHECKIN',
  'ADVISOR_COMMITMENT_DUE',
] as const;

export type FollowUpTrigger = (typeof FOLLOW_UP_TRIGGERS)[number];

export interface FollowUpRecommendation {
  shouldFollowUp: boolean;
  trigger: FollowUpTrigger | null;
  reason: string;
  recommendedAction: string;
  priority: LeadPriority;
  suggestedDueDate: string;
  evidence: string[];
  suggestedDraftContent?: string;
  requiresAdvisorReview: boolean;
  existingOpenTaskId?: string;
  alreadyPlanned: boolean;
}

// ── 1. Assemble Persistent Buyer Memory ──────────────────────────────────────

export async function assembleBuyerMemory(
  leadId: string,
  organizationId: string,
): Promise<PersistentBuyerMemory> {
  const orgId = requireOrgId(organizationId);

  // Fetch lead with all associated entities within tenant
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
      requirements: true,
      proposals: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      siteVisits: {
        include: {
          property: { select: { id: true, title: true, price: true, city: true } },
        },
        orderBy: { startAt: 'desc' },
        take: 10,
      },
      matches: {
        include: {
          property: { select: { id: true, title: true, price: true, city: true, status: true } },
        },
        orderBy: { matchScore: 'desc' },
        take: 5,
      },
      tasks: {
        where: { status: 'OPEN' },
        orderBy: { dueDate: 'asc' },
      },
      callLogs: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      conversations: {
        where: { organizationId: orgId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 15,
          },
        },
        take: 1,
      },
    },
  });

  if (!lead) {
    throw createError(`Lead ${leadId} not found in organization ${orgId}`, 404);
  }

  const thread = lead.conversations[0] ?? null;
  const messages = thread?.messages ?? [];

  // Parse pending proposals
  const pendingProposals = lead.proposals.map((p) => ({
    id: p.id,
    changeType: 'REQUIREMENTS_UPDATE',
    proposedChanges: {
      minBudget: p.proposedMinBudget,
      maxBudget: p.proposedMaxBudget,
      locations: p.proposedLocations,
      propertyType: p.proposedPropertyType,
      minBedrooms: p.proposedMinBedrooms,
      maxBedrooms: p.proposedMaxBedrooms,
      timeline: p.proposedTimeline,
    },
    sourceEvidence: p.sourceMessageId ? `Generated from message ${p.sourceMessageId}` : 'Extracted from conversation',
    reason: `Pending requirement proposal (confidence: ${p.confidence ? Math.round(p.confidence * 100) : 80}%)`,
    createdAt: p.createdAt.toISOString(),
  }));

  // Parse site visits
  const confirmedVisits = lead.siteVisits.map((v) => ({
    id: v.id,
    propertyId: v.propertyId,
    propertyTitle: v.property?.title ?? 'Walkthrough Tour',
    propertyPrice: v.property?.price ?? null,
    propertyCity: v.property?.city ?? null,
    startAt: v.startAt.toISOString(),
    endAt: v.endAt.toISOString(),
    status: v.status,
    completedAt: v.completedAt ? v.completedAt.toISOString() : null,
    outcomeNotes: v.outcomeNotes,
  }));

  // Extract pending tour proposals from AI message suggestedActions
  const pendingTourProposals: PersistentBuyerMemory['siteVisits']['pendingProposals'] = [];

  for (const m of messages) {
    if (m.senderType === 'AI' && m.suggestedAction && typeof m.suggestedAction === 'object') {
      const act = m.suggestedAction as Record<string, any>;
      if (act.siteVisitProposal && !act.siteVisitBooking) {
        const p = act.siteVisitProposal;
        pendingTourProposals.push({
          propertyId: p.propertyId,
          propertyTitle: p.propertyTitle ?? 'Proposed Property',
          date: p.date ?? '',
          preferredTime: p.preferredTime ?? '',
          proposedSlot: `${p.date || ''} ${p.preferredTime || ''}`.trim() || 'Upcoming Slot',
          status: 'PROPOSED_NOT_BOOKED',
          notes: p.notes,
        });
      }
    }
  }

  // Properties visited vs matched
  const visitedProperties = lead.siteVisits
    .filter((v) => v.status === 'COMPLETED' && v.property)
    .map((v) => ({
      id: v.property!.id,
      title: v.property!.title,
      price: v.property!.price,
      city: v.property!.city,
      completedAt: v.completedAt ? v.completedAt.toISOString() : v.endAt.toISOString(),
    }));

  const matchedProperties = lead.matches
    .filter((m) => m.property)
    .map((m) => ({
      id: m.property.id,
      title: m.property.title,
      price: m.property.price,
      city: m.property.city,
      score: m.matchScore,
      matchReason: m.matchReason,
    }));

  // Extract discussed property titles from message contents
  const discussedTitles: string[] = [];
  const propertyTitleKeywords = matchedProperties.map((p) => p.title);
  for (const msg of messages) {
    for (const title of propertyTitleKeywords) {
      if (msg.content.toLowerCase().includes(title.toLowerCase()) && !discussedTitles.includes(title)) {
        discussedTitles.push(title);
      }
    }
  }

  // Message timestamps & unanswered inquiry calculation
  let lastCustMsgAt: string | null = null;
  let lastAdvisorMsgAt: string | null = null;
  let lastSender: string | null = null;
  let unansweredQuestion: PersistentBuyerMemory['conversationState']['unansweredQuestion'] = null;

  if (messages.length > 0) {
    // Note: messages ordered desc (newest first)
    const latestMessage = messages[0];
    lastSender = latestMessage.senderType;

    const custMsgs = messages.filter((m) => m.senderType === 'CUSTOMER');
    const advisorMsgs = messages.filter((m) => m.senderType === 'AGENT' || m.senderType === 'AI');

    if (custMsgs.length > 0) {
      lastCustMsgAt = custMsgs[0].createdAt.toISOString();
    }
    if (advisorMsgs.length > 0) {
      lastAdvisorMsgAt = advisorMsgs[0].createdAt.toISOString();
    }

    // Check if the latest message is an unanswered customer question
    if (latestMessage.senderType === 'CUSTOMER') {
      const nowMs = Date.now();
      const custMsgMs = latestMessage.createdAt.getTime();
      const hoursPending = Math.round((nowMs - custMsgMs) / (1000 * 60 * 60));

      // Check whether this message asks a genuine question
      const content = latestMessage.content.trim();
      const isQuestion =
        content.includes('?') ||
        /\b(how|what|when|where|why|can|is|are|could|would|do|does|price|cost|available|tour|visit)\b/i.test(
          content,
        );

      if (isQuestion) {
        unansweredQuestion = {
          isUnanswered: true,
          customerMessageId: latestMessage.id,
          content: latestMessage.content,
          receivedAt: latestMessage.createdAt.toISOString(),
          hoursPending,
        };
      }
    }
  }

  // Interaction recency: latest of messages, call logs, completed visits
  const interactionTimestamps = [
    messages[0]?.createdAt.getTime() ?? 0,
    lead.callLogs[0]?.calledAt.getTime() ?? lead.callLogs[0]?.createdAt.getTime() ?? 0,
    lead.siteVisits[0]?.completedAt?.getTime() ?? lead.siteVisits[0]?.startAt.getTime() ?? 0,
  ].filter(Boolean);

  const lastActivityMs = interactionTimestamps.length > 0
    ? Math.max(...interactionTimestamps)
    : lead.createdAt.getTime();
  const lastActivityAt = new Date(lastActivityMs).toISOString();

  // Open tasks
  const now = new Date();
  const openTasks = lead.tasks.map((t) => ({
    id: t.id,
    taskType: t.taskType,
    title: t.title,
    dueDate: t.dueDate.toISOString(),
    priority: t.priority,
    isOverdue: t.dueDate.getTime() < now.getTime(),
  }));

  // Recorded advisor commitments from call logs or tasks
  const recordedCommitments: PersistentBuyerMemory['recordedCommitments'] = [];
  for (const log of lead.callLogs) {
    if (log.notes && /follow|call|send|review|prepare|meet|promise|will/i.test(log.notes)) {
      recordedCommitments.push({
        type: 'CALL_LOG',
        referenceId: log.id,
        notes: log.notes,
        recordedAt: log.createdAt.toISOString(),
      });
    }
  }

  // Eligibility evaluation
  let eligibleForFollowUp = true;
  let ineligibilityReason: string | undefined = undefined;

  if (lead.status === 'WON') {
    eligibleForFollowUp = false;
    ineligibilityReason = 'Lead is in closed terminal state (WON).';
  } else if (lead.status === 'LOST') {
    eligibleForFollowUp = false;
    ineligibilityReason = 'Lead is in closed terminal state (LOST).';
  } else if (thread?.isHumanTakeover || thread?.state === 'HUMAN_TAKEOVER') {
    eligibleForFollowUp = false;
    ineligibilityReason = 'Human takeover is active. Automated follow-up is paused.';
  } else if (thread?.state === 'PAUSED' || thread?.state === 'CLOSED') {
    eligibleForFollowUp = false;
    ineligibilityReason = `Conversation is in state ${thread.state}.`;
  }

  return {
    leadId: lead.id,
    organizationId: orgId,
    fullName: lead.fullName,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    priority: lead.priority,
    assignedAdvisor: lead.assignedUser
      ? {
          id: lead.assignedUser.id,
          name: lead.assignedUser.name || lead.assignedUser.email,
          email: lead.assignedUser.email,
        }
      : null,
    requirements: {
      confirmed: lead.requirements
        ? {
            minBudget: lead.requirements.minBudget,
            maxBudget: lead.requirements.maxBudget,
            preferredLocations: lead.requirements.preferredLocations,
            minBedrooms: lead.requirements.minBedrooms,
            maxBedrooms: lead.requirements.maxBedrooms,
            propertyType: lead.requirements.propertyType,
            possessionTimeline: lead.requirements.possessionTimeline,
            lastConfirmedAt: lead.requirements.updatedAt.toISOString(),
          }
        : null,
      pendingProposals,
    },
    siteVisits: {
      confirmed: confirmedVisits,
      pendingProposals: pendingTourProposals,
    },
    propertiesContext: {
      visited: visitedProperties,
      matched: matchedProperties,
      discussedTitles,
    },
    conversationState: {
      threadId: thread?.id ?? null,
      state: thread?.state ?? 'AUTOPILOT',
      isHumanTakeover: thread?.isHumanTakeover ?? false,
      takeoverBy: thread?.takeoverBy ?? null,
      lastCustomerMessageAt: lastCustMsgAt,
      lastAdvisorMessageAt: lastAdvisorMsgAt,
      lastMessageSender: lastSender,
      lastActivityAt,
      unansweredQuestion,
    },
    openTasks,
    recordedCommitments,
    eligibility: {
      eligibleForFollowUp,
      ineligibilityReason,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── 2. Evaluate Deterministic Follow-Up Need ─────────────────────────────────

export function evaluateFollowUpNeed(memory: PersistentBuyerMemory): FollowUpRecommendation {
  const now = new Date();
  const defaultDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24h

  // 1. Mandatory Suppression Rules
  if (!memory.eligibility.eligibleForFollowUp) {
    return {
      shouldFollowUp: false,
      trigger: null,
      reason: memory.eligibility.ineligibilityReason ?? 'Lead ineligible for follow-up.',
      recommendedAction: 'No follow-up action permitted under current lead state.',
      priority: 'LOW',
      suggestedDueDate: defaultDueDate,
      evidence: [],
      requiresAdvisorReview: true,
      alreadyPlanned: false,
    };
  }

  // 2. Trigger: UNANSWERED_QUESTION (> 12 hours without reply)
  const uq = memory.conversationState.unansweredQuestion;
  if (uq && uq.isUnanswered && (uq.hoursPending ?? 0) >= 12) {
    const existingTask = memory.openTasks.find((t) =>
      /unanswered|inquiry|question|reply/i.test(t.title),
    );

    return {
      shouldFollowUp: !existingTask,
      trigger: 'UNANSWERED_QUESTION',
      reason: `Buyer question received ${uq.hoursPending} hours ago remains unanswered.`,
      recommendedAction: `Review buyer inquiry and prepare response: "${uq.content?.slice(0, 80)}"`,
      priority: 'HIGH',
      suggestedDueDate: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2h
      evidence: [
        `Inquiry: "${uq.content}" received at ${uq.receivedAt}`,
        `No advisor or AI response sent in ${uq.hoursPending} hours`,
      ],
      suggestedDraftContent: `Hi ${memory.fullName}, thank you for checking in! Regarding your question: "${uq.content?.slice(0, 60)}...", I wanted to follow up with the latest information.`,
      requiresAdvisorReview: true,
      existingOpenTaskId: existingTask?.id,
      alreadyPlanned: Boolean(existingTask),
    };
  }

  // 3. Trigger: COMPLETED_VISIT_FOLLOW_UP (Completed visit within 7 days, no follow-up task)
  const recentCompletedVisit = memory.siteVisits.confirmed.find((v) => {
    if (v.status !== 'COMPLETED') return false;
    const completedMs = v.completedAt ? new Date(v.completedAt).getTime() : new Date(v.endAt).getTime();
    return now.getTime() >= completedMs && now.getTime() - completedMs <= 7 * 24 * 60 * 60 * 1000;
  });

  if (recentCompletedVisit) {
    // Check if an open task already covers this visit or follow-up
    const existingTask = memory.openTasks.find(
      (t) =>
        t.title.toLowerCase().includes(recentCompletedVisit.propertyTitle.toLowerCase()) ||
        /completed_visit_follow_up|post-visit|walkthrough feedback|visit feedback|tour feedback/i.test(
          t.title,
        ),
    );

    // Check if an advisor or customer message already occurred AFTER the visit
    const visitEndMs = new Date(recentCompletedVisit.endAt).getTime();
    const lastMsgMs = memory.conversationState.lastActivityAt
      ? new Date(memory.conversationState.lastActivityAt).getTime()
      : 0;
    const conversationFollowedUp = lastMsgMs > visitEndMs + 60 * 60 * 1000; // 1 hour after tour

    if (!conversationFollowedUp) {
      return {
        shouldFollowUp: !existingTask,
        trigger: 'COMPLETED_VISIT_FOLLOW_UP',
        reason: `Walkthrough completed for "${recentCompletedVisit.propertyTitle}" with no subsequent post-tour follow-up recorded.`,
        recommendedAction: `Contact buyer to collect walkthrough feedback for "${recentCompletedVisit.propertyTitle}" and gauge interest.`,
        priority: 'HIGH',
        suggestedDueDate: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours
        evidence: [
          `Completed walkthrough: ${recentCompletedVisit.propertyTitle} on ${new Date(recentCompletedVisit.startAt).toLocaleDateString()}`,
          `Outcome notes: ${recentCompletedVisit.outcomeNotes ?? 'None recorded'}`,
        ],
        suggestedDraftContent: `Hi ${memory.fullName}, thank you for touring ${recentCompletedVisit.propertyTitle}! I would love to hear your thoughts on the home and answer any questions you might have.`,
        requiresAdvisorReview: true,
        existingOpenTaskId: existingTask?.id,
        alreadyPlanned: Boolean(existingTask),
      };
    }
  }

  // 4. Trigger: VISIT_INTEREST_UNSCHEDULED (Buyer proposal or tour intent, but no visit scheduled)
  if (
    memory.siteVisits.pendingProposals.length > 0 &&
    !memory.siteVisits.confirmed.some((v) => v.status === 'SCHEDULED')
  ) {
    const propProposal = memory.siteVisits.pendingProposals[0];
    const existingTask = memory.openTasks.find((t) => /tour|visit|walkthrough/i.test(t.title));

    return {
      shouldFollowUp: !existingTask,
      trigger: 'VISIT_INTEREST_UNSCHEDULED',
      reason: `Walkthrough proposal was offered for slot "${propProposal.proposedSlot}" but tour was not confirmed.`,
      recommendedAction: `Confirm buyer availability and coordinate an on-site walkthrough slot.`,
      priority: 'MEDIUM',
      suggestedDueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      evidence: [
        `Pending tour proposal for slot: ${propProposal.proposedSlot}`,
        `No confirmed site visit booked in database`,
      ],
      suggestedDraftContent: `Hi ${memory.fullName}, following up on scheduling a property tour! Are you still interested in seeing homes this week? Let me know which days suit your schedule best.`,
      requiresAdvisorReview: true,
      existingOpenTaskId: existingTask?.id,
      alreadyPlanned: Boolean(existingTask),
    };
  }

  // 5. Trigger: NEW_MATCHING_INVENTORY (Fresh matched property not yet discussed or visited)
  const unpresentedMatch = memory.propertiesContext.matched.find((m) => {
    const isVisited = memory.propertiesContext.visited.some((v) => v.id === m.id);
    const isDiscussed = memory.propertiesContext.discussedTitles.includes(m.title);
    const scoreVal = m.score <= 1 ? m.score * 100 : m.score;
    return !isVisited && !isDiscussed && scoreVal >= 70;
  });

  if (unpresentedMatch && memory.requirements.confirmed) {
    const existingTask = memory.openTasks.find((t) =>
      t.title.toLowerCase().includes(unpresentedMatch.title.toLowerCase()),
    );

    return {
      shouldFollowUp: !existingTask,
      trigger: 'NEW_MATCHING_INVENTORY',
      reason: `Verified matching inventory found: "${unpresentedMatch.title}" in ${unpresentedMatch.city} ($${unpresentedMatch.price.toLocaleString()}) with ${unpresentedMatch.score}% match score.`,
      recommendedAction: `Present new matching listing "${unpresentedMatch.title}" to buyer.`,
      priority: 'MEDIUM',
      suggestedDueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      evidence: [
        `Property: ${unpresentedMatch.title} ($${unpresentedMatch.price.toLocaleString()})`,
        `Match reason: ${unpresentedMatch.matchReason}`,
        `Not yet presented or visited in conversation history`,
      ],
      suggestedDraftContent: `Hi ${memory.fullName}, a new property just came up that closely aligns with your preferences: ${unpresentedMatch.title} in ${unpresentedMatch.city} ($${unpresentedMatch.price.toLocaleString()}). Would you like me to share more details?`,
      requiresAdvisorReview: true,
      existingOpenTaskId: existingTask?.id,
      alreadyPlanned: Boolean(existingTask),
    };
  }

  // 6. Trigger: INACTIVE_LEAD_CHECKIN (>= 3 days inactivity on qualified lead)
  if (memory.conversationState.lastActivityAt) {
    const lastActivityMs = new Date(memory.conversationState.lastActivityAt).getTime();
    const daysInactive = Math.floor((now.getTime() - lastActivityMs) / (1000 * 60 * 60 * 24));

    if (daysInactive >= 3 && memory.requirements.confirmed) {
      const existingTask = memory.openTasks.find((t) => /check-in|re-engage|inactivity/i.test(t.title));

      return {
        shouldFollowUp: !existingTask,
        trigger: 'INACTIVE_LEAD_CHECKIN',
        reason: `Lead has had no recorded activity for ${daysInactive} days.`,
        recommendedAction: `Perform polite check-in to confirm if home search timeline is still active.`,
        priority: 'LOW',
        suggestedDueDate: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
        evidence: [
          `Last activity was on ${new Date(lastActivityMs).toLocaleDateString()} (${daysInactive} days ago)`,
          `Confirmed preferences: $${memory.requirements.confirmed.minBudget?.toLocaleString()} - $${memory.requirements.confirmed.maxBudget?.toLocaleString()} in ${memory.requirements.confirmed.preferredLocations.join(', ') || 'Any'}`,
        ],
        suggestedDraftContent: `Hi ${memory.fullName}, I hope you're having a great week! I'm checking in to see how your home search is progressing and if you would like an updated list of properties.`,
        requiresAdvisorReview: true,
        existingOpenTaskId: existingTask?.id,
        alreadyPlanned: Boolean(existingTask),
      };
    }
  }

  // No urgent follow-up required
  return {
    shouldFollowUp: false,
    trigger: null,
    reason: 'Lead activity is current and all tasks/walkthroughs are up to date.',
    recommendedAction: 'No immediate follow-up required.',
    priority: 'LOW',
    suggestedDueDate: defaultDueDate,
    evidence: ['All inquiries answered', 'No unscheduled walkthrough proposals', 'No overdue commitments'],
    requiresAdvisorReview: false,
    alreadyPlanned: false,
  };
}

// ── In-Flight Concurrency Deduplicator ───────────────────────────────────────
const inFlightFollowUpPlans = new Map<string, Promise<any>>();

// ── 3. Plan & Persist Follow-Up Task and Draft (Idempotent) ───────────────────

export async function createFollowUpTaskAndDraft(params: {
  leadId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  trigger?: FollowUpTrigger;
  title?: string;
  description?: string;
  priority?: LeadPriority;
  dueDate?: Date;
  draftContent?: string;
}): Promise<{
  taskId: string;
  taskTitle: string;
  task: any;
  draftMessageId: string | null;
  draftMessage: any | null;
  approvalStatus: string | null;
  trigger: FollowUpTrigger;
  recommendation: FollowUpRecommendation;
  isExisting: boolean;
}> {
  const orgId = requireOrgId(params.organizationId);
  const dedupeKey = `${orgId}:${params.leadId}:${params.trigger ?? 'ACTIVE'}`;

  const inFlight = inFlightFollowUpPlans.get(dedupeKey);
  if (inFlight) {
    return inFlight;
  }

  const executionPromise = (async () => {
    const { leadId, callerId, callerRole, callerEmail } = params;

    // 1. Re-evaluate Memory and Trigger to ensure fresh conditions
    const memory = await assembleBuyerMemory(leadId, orgId);

  if (!memory.eligibility.eligibleForFollowUp) {
    throw createError(
      memory.eligibility.ineligibilityReason ?? 'Lead is currently ineligible for follow-up.',
      422,
    );
  }

  const rec = evaluateFollowUpNeed(memory);
  const activeTrigger = params.trigger ?? rec.trigger ?? 'INACTIVE_LEAD_CHECKIN';

  const title =
    params.title?.trim() ||
    `Follow-Up [${activeTrigger}]: ${memory.fullName}`;

  const priority = params.priority ?? rec.priority;
  const dueDate = params.dueDate ?? new Date(rec.suggestedDueDate);

  // 2. Strict Idempotency Check: Prevent duplicate open tasks with same title/trigger
  const existingOpenTask = await prisma.leadTask.findFirst({
    where: {
      leadId,
      organizationId: orgId,
      status: 'OPEN',
      title: { startsWith: `Follow-Up [${activeTrigger}]` },
    },
  });

  let taskRecord: any;
  let isExisting = false;

  if (existingOpenTask) {
    logger.info(`[Follow-Up] Reusing existing open task ${existingOpenTask.id} for lead ${leadId}`);
    taskRecord = existingOpenTask;
    isExisting = true;
  } else {
    // Determine assignee
    const targetUserId = memory.assignedAdvisor?.id ?? callerId;

    taskRecord = await createLeadTask({
      leadId,
      organizationId: orgId,
      callerId,
      callerRole,
      callerEmail,
      taskType: activeTrigger === 'UNANSWERED_QUESTION' ? 'MESSAGE' : 'CALL',
      title,
      description:
        params.description ||
        `Trigger: ${activeTrigger}\nRationale: ${rec.reason}\nRecommended Action: ${rec.recommendedAction}\nEvidence:\n${rec.evidence.join('\n')}`,
      dueDate,
      priority,
      assignedUserId: targetUserId,
    });
  }

  // 3. Draft Message Creation (PENDING_APPROVAL strictly)
  let draftMessageRecord: any = null;
  const draftText = params.draftContent || rec.suggestedDraftContent;

  if (draftText && memory.conversationState.threadId) {
    // Prevent duplicate draft messages for the same trigger
    const existingDraft = await prisma.conversationMessage.findFirst({
      where: {
        threadId: memory.conversationState.threadId,
        organizationId: orgId,
        senderType: 'AI',
        approvalStatus: 'PENDING_APPROVAL',
        content: draftText,
      },
    });

    if (existingDraft) {
      draftMessageRecord = existingDraft;
    } else {
      draftMessageRecord = await prisma.conversationMessage.create({
        data: {
          threadId: memory.conversationState.threadId,
          organizationId: orgId,
          senderType: 'AI',
          content: draftText,
          suggestedAction: {
            followUpPlan: {
              trigger: activeTrigger,
              reason: rec.reason,
              recommendedAction: rec.recommendedAction,
              priority,
              suggestedDueDate: dueDate.toISOString(),
              taskId: taskRecord.id,
            },
            evidence: rec.evidence,
          } as object,
          approvalStatus: 'PENDING_APPROVAL',
        },
      });
    }
  }

  // 4. Record Audit Log
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_TASK_CREATED',
        entityType: 'LeadTask',
        entityId: taskRecord.id,
        actor: callerEmail ?? 'ai_sales_agent',
        note: `Follow-up plan created [${activeTrigger}] with priority ${priority}`,
        newValue: {
          trigger: activeTrigger,
          taskId: taskRecord.id,
          draftId: draftMessageRecord?.id ?? null,
        },
      },
    });
  } catch (auditErr) {
    logger.warn(`[Follow-Up] Audit logging failed: ${(auditErr as Error).message}`);
  }

    return {
      taskId: taskRecord.id,
      taskTitle: taskRecord.title,
      task: taskRecord,
      draftMessageId: draftMessageRecord?.id ?? null,
      draftMessage: draftMessageRecord,
      approvalStatus: draftMessageRecord?.approvalStatus ?? null,
      trigger: activeTrigger,
      recommendation: rec,
      isExisting,
    };
  })();

  inFlightFollowUpPlans.set(dedupeKey, executionPromise);
  try {
    return await executionPromise;
  } finally {
    inFlightFollowUpPlans.delete(dedupeKey);
  }
}
