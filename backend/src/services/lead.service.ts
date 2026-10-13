// ─────────────────────────────────────────────────────────────────────────────
// Lead Service — AI Lead Collection, Normalization, Deduplication & Requirement Extraction
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';
import {
  type LeadPriority,
  type LeadStatus,
  type LeadSource,
  type ProposalStatus,
  type UserRole,
  type CallDirection,
  type CallOutcome,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import { requireOrgId } from '../utils/tenant.js';


export const ACTIVE_LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'];
export const DEFAULT_ADVISOR_ACTIVE_LEAD_CAP = 25;

export function getAdvisorActiveLeadCap(_organizationId?: string): number {
  const envCap = process.env['ADVISOR_ACTIVE_LEAD_CAP'];
  if (envCap && !Number.isNaN(Number(envCap))) {
    return Number(envCap);
  }
  return DEFAULT_ADVISOR_ACTIVE_LEAD_CAP;
}

// ── Zod Validation Schemas for Structured Requirement Extraction ──────────────

export const RequirementExtractionSchema = z.object({
  minBudget: z.number().nullable().optional().catch(null),
  maxBudget: z.number().nullable().optional().catch(null),
  preferredLocations: z.array(z.string()).catch([]),
  propertyType: z.string().nullable().optional().catch(null),
  minBedrooms: z.number().nullable().optional().catch(null),
  maxBedrooms: z.number().nullable().optional().catch(null),
  possessionTimeline: z.string().nullable().optional().catch(null),
  summaryNotes: z.string().catch(''),
  clarificationNeeded: z.array(z.string()).catch([]),
});

export type ExtractedRequirements = z.infer<typeof RequirementExtractionSchema>;

const requirementJsonSchema = {
  type: 'object',
  properties: {
    minBudget: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    maxBudget: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    preferredLocations: { type: 'array', items: { type: 'string' } },
    propertyType: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    minBedrooms: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    maxBedrooms: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    possessionTimeline: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    summaryNotes: { type: 'string' },
    clarificationNeeded: { type: 'array', items: { type: 'string' } },
  },
  required: ['preferredLocations', 'summaryNotes'],
} as const;

// ── Helper: Normalization ─────────────────────────────────────────────────────

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 3 && trimmed.includes('@') ? trimmed : null;
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

// ── Deterministic Priority Calculation ───────────────────────────────────────

export function calculateLeadPriority(params: {
  maxBudget?: number | null;
  possessionTimeline?: string | null;
  hasPhone?: boolean;
}): LeadPriority {
  const { maxBudget, possessionTimeline, hasPhone } = params;
  const timelineLower = (possessionTimeline || '').toLowerCase();

  if (timelineLower.includes('immediate') || timelineLower.includes('asap') || timelineLower.includes('30')) {
    return 'URGENT';
  }
  if ((maxBudget && maxBudget > 750000) || timelineLower.includes('60')) {
    return 'HIGH';
  }
  if (hasPhone || maxBudget) {
    return 'MEDIUM';
  }
  return 'LOW';
}

// ── Service Core Functions ───────────────────────────────────────────────────

export interface InboundLeadInput {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  source?: LeadSource;
  externalId?: string | null;
  enquiryText?: string | null;
  /** Mandatory: resolved by the caller from the session or API key, never from request bodies. */
  organizationId: string;
}

/**
 * Normalizes incoming lead details, detects duplicates safely with concurrency guards,
 * creates or updates lead record, and extracts customer requirements via Gemini proposals.
 */
export async function ingestInboundLead(input: InboundLeadInput) {
  const normEmail = normalizeEmail(input.email);
  const normPhone = normalizePhone(input.phone);
  const source = input.source ?? 'WEBSITE_FORM';

  const orgId = requireOrgId(input.organizationId);
  logger.info(`[Lead Service] Ingesting lead for org ${orgId} (source ${source})`);

  // 1. Deduplication Search with Tenant Scoping
  let existingLead = null;

  if (input.externalId) {
    existingLead = await prisma.lead.findFirst({
      where: {
        externalId: input.externalId,
        organizationId: orgId,
      },
      include: { requirements: true },
    });
  }

  if (!existingLead && normEmail) {
    existingLead = await prisma.lead.findFirst({
      where: {
        email: normEmail,
        organizationId: orgId,
      },
      include: { requirements: true },
    });
  }

  if (!existingLead && normPhone) {
    existingLead = await prisma.lead.findFirst({
      where: {
        phone: normPhone,
        organizationId: orgId,
      },
      include: { requirements: true },
    });
  }

  let lead;

  if (existingLead) {
    logger.info(`[Lead Service] Duplicate lead detected. Updating Lead ID: ${existingLead.id}`);
    lead = await prisma.lead.update({
      where: { id: existingLead.id },
      data: {
        fullName: input.fullName || existingLead.fullName,
        email: normEmail ?? existingLead.email,
        phone: normPhone ?? existingLead.phone,
        status: existingLead.status === 'LOST' ? 'NEW' : existingLead.status,
      },
      include: { requirements: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_UPDATED',
        entityType: 'Lead',
        entityId: lead.id,
        actor: 'system',
        note: `Inbound enquiry received from existing lead (${source})`,
      },
    });
  } else {
    try {
      lead = await prisma.lead.create({
        data: {
          organizationId: orgId,
          source,
          externalId: input.externalId ?? null,
          fullName: input.fullName,
          email: normEmail,
          phone: normPhone,
          status: 'NEW',
          priority: 'MEDIUM',
        },
        include: { requirements: true },
      });
    } catch (err: any) {
      // Concurrency race condition handling (P2002 Unique constraint failed)
      if (err?.code === 'P2002') {
        logger.warn('[Lead Service] Concurrent duplicate lead insert detected. Fetching created lead.');
        const retryExisting = await prisma.lead.findFirst({
          where: {
            organizationId: orgId,
            OR: [
              ...(normEmail ? [{ email: normEmail }] : []),
              ...(normPhone ? [{ phone: normPhone }] : []),
            ],
          },
          include: { requirements: true },
        });
        if (retryExisting) {
          lead = retryExisting;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_CREATED',
        entityType: 'Lead',
        entityId: lead.id,
        actor: 'system',
        note: `New lead created from ${source}`,
      },
    });

    if (lead.assignedUserId) {
      await prisma.leadAssignmentHistory.create({
        data: {
          leadId: lead.id,
          organizationId: orgId,
          previousUserId: null,
          assignedUserId: lead.assignedUserId,
          changedById: lead.assignedUserId,
          reason: 'Initial assignment upon lead creation',
        },
      });
    }
  }

  // 2. Non-blocking Async Requirements Extraction if Enquiry Text Provided
  if (input.enquiryText && input.enquiryText.trim().length > 5) {
    extractAndPersistRequirements(lead.id, input.enquiryText, orgId).catch((err) => {
      logger.warn(`[Lead Service] Background requirement extraction error: ${err.message}`);
    });
  }

  return getLeadDetails(lead.id, orgId);
}

/**
 * Uses Gemini to extract structured requirement proposal, records proposal, and updates LeadRequirement.
 */
export async function extractAndPersistRequirements(leadId: string, text: string, organizationId: string) {
  const orgId = requireOrgId(organizationId);
  const apiKey = process.env['GEMINI_API_KEY'];
  let extracted: ExtractedRequirements = {
    minBudget: null,
    maxBudget: null,
    preferredLocations: [],
    propertyType: null,
    minBedrooms: null,
    maxBedrooms: null,
    possessionTimeline: null,
    summaryNotes: text.slice(0, 500),
    clarificationNeeded: [],
  };

  // Verify lead still exists (could be deleted in test teardown or concurrent cleanup)
  const leadExists = await prisma.lead.findFirst({ where: { id: leadId, organizationId: orgId }, select: { id: true } });
  if (!leadExists) throw createError('Lead not found', 404);

  if (apiKey && process.env.NODE_ENV !== 'test') {
    const ai = new GoogleGenAI({ apiKey });
    const candidateModels = Array.from(
      new Set(
        [
          process.env['GEMINI_MODEL'],
          'gemini-2.5-flash-lite',
          'gemini-3.5-flash-lite',
          'gemini-3.5-flash',
          'gemini-3.8-flash',
        ].filter(Boolean) as string[],
      ),
    );

    const prompt = `Analyze this real estate customer enquiry message and extract structured buyer/renter preferences.

<<UNTRUSTED_CONTENT source="customer_enquiry">>
${text}
<</UNTRUSTED_CONTENT>>

Extract:
1. minBudget & maxBudget (in USD, positive numbers or null).
2. preferredLocations (array of neighborhood or city names).
3. propertyType (e.g., "CONDO", "SINGLE_FAMILY", "TOWNHOUSE", "MULTI_FAMILY", or null).
4. minBedrooms & maxBedrooms (integer numbers or null).
5. possessionTimeline (e.g. "IMMEDIATE", "30_DAYS", "60_DAYS", "90_DAYS", or null).
6. summaryNotes (concise synthesis of what buyer wants).
7. clarificationNeeded (array of missing critical preference items).`;

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ text: prompt }],
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: requirementJsonSchema,
            temperature: 0,
          },
        });

        if (response.text) {
          const raw = JSON.parse(response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
          extracted = RequirementExtractionSchema.parse(raw);
          logger.info(`[Lead Service] Extracted requirements for lead ${leadId} using ${model}`);
          break;
        }
      } catch (err) {
        logger.warn(`[Lead Service] Model ${model} extraction failed: ${(err as Error).message}`);
      }
    }
  }

  let proposalRecord: any = null;
  try {
    proposalRecord = await prisma.leadRequirementProposal.create({
      data: {
        leadId,
        organizationId: orgId,
        proposedMinBudget: extracted.minBudget,
        proposedMaxBudget: extracted.maxBudget,
        proposedLocations: extracted.preferredLocations,
        proposedPropertyType: extracted.propertyType,
        proposedMinBedrooms: extracted.minBedrooms,
        proposedMaxBedrooms: extracted.maxBedrooms,
        proposedTimeline: extracted.possessionTimeline,
        confidence: 0.9,
        status: 'PENDING',
        reviewedAt: null,
        reviewedBy: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_REQUIREMENTS_EXTRACTED',
        entityType: 'LeadRequirementProposal',
        entityId: proposalRecord.id,
        actor: 'system',
        note: 'AI requirement proposal created (pending advisor review)',
        newValue: {
          minBudget: proposalRecord.proposedMinBudget,
          maxBudget: proposalRecord.proposedMaxBudget,
          locations: proposalRecord.proposedLocations,
          propertyType: proposalRecord.proposedPropertyType,
          status: 'PENDING',
        },
      },
    });
  } catch (dbErr) {
    logger.warn(`[Lead Service] Could not persist requirement proposal for lead ${leadId}: ${(dbErr as Error).message}`);
  }

  return proposalRecord;
}

/**
 * Returns complete details for a single lead scoped to tenant organization.
 */
export async function getLeadDetails(leadId: string, organizationId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: requireOrgId(organizationId) },
    include: {
      requirements: true,
      deal: true,
      proposals: { orderBy: { createdAt: 'desc' } },
      conversations: {
        include: {
          messages: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
      matches: {
        include: { property: true },
        orderBy: { matchScore: 'desc' },
      },
      assignedUser: { select: { id: true, name: true, email: true } },
      assignmentHistory: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          previousUser: { select: { id: true, name: true, email: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          changedBy: { select: { id: true, name: true, email: true } },
        },
      },
      callLogs: {
        orderBy: [{ calledAt: 'desc' }, { createdAt: 'desc' }],
        take: 20,
        include: {
          user: { select: { id: true, name: true, email: true } },
          followUpTask: true,
        },
      },
      tasks: {
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 30,
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          createdByUser: { select: { id: true, name: true, email: true } },
          completedUser: { select: { id: true, name: true, email: true } },
        },
      },
      siteVisits: {
        orderBy: [{ startAt: 'asc' }],
        take: 30,
        include: {
          property: { select: { id: true, title: true, address: true, city: true, price: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          createdByUser: { select: { id: true, name: true, email: true } },
          cancelledUser: { select: { id: true, name: true, email: true } },
          completedUser: { select: { id: true, name: true, email: true } },
          leadTask: { select: { id: true, title: true, status: true, dueDate: true, priority: true } },
        },
      },
    },
  });

  if (!lead) throw createError('Lead not found', 404);

  const now = Date.now();
  const daysSinceLastActivity = Math.floor(
    (now - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const isInactiveWarning =
    Boolean(lead.assignedUserId) &&
    ACTIVE_LEAD_STATUSES.includes(lead.status) &&
    daysSinceLastActivity >= 7;

  const tasksWithOverdue = (lead.tasks || []).map((t) => ({
    ...t,
    isOverdue: t.status === 'OPEN' && t.dueDate.getTime() < now,
  }));

  return {
    ...lead,
    tasks: tasksWithOverdue,
    daysSinceLastActivity,
    isInactiveWarning,
  };
}

/**
 * Lists all requirement proposals for a lead.
 */
export async function listRequirementProposals(leadId: string, organizationId: string) {
  const orgId = requireOrgId(organizationId);
  await getLeadDetails(leadId, orgId);
  return prisma.leadRequirementProposal.findMany({
    where: { leadId, organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Explicit advisor review of an AI requirement proposal (ACCEPT, REJECT, or MODIFY).
 * Preserves original requirements until explicit advisor review.
 */
export async function reviewRequirementProposal(params: {
  leadId: string;
  proposalId: string;
  organizationId: string;
  action: 'APPROVE' | 'REJECT' | 'MODIFY';
  modifiedData?: Partial<ExtractedRequirements>;
  reviewerEmail?: string;
}) {
  const orgId = requireOrgId(params.organizationId);
  const { leadId, proposalId, action, modifiedData, reviewerEmail } = params;

  const lead = await getLeadDetails(leadId, orgId);

  const proposal = await prisma.leadRequirementProposal.findFirst({
    where: { id: proposalId, leadId, organizationId: orgId },
  });
  if (!proposal) throw createError('Requirement proposal not found', 404);

  const now = new Date();
  const reviewer = reviewerEmail ?? 'advisor';

  if (action === 'REJECT') {
    const updatedProposal = await prisma.leadRequirementProposal.update({
      where: { id: proposalId },
      data: {
        status: 'REJECTED',
        reviewedAt: now,
        reviewedBy: reviewer,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_UPDATED',
        entityType: 'LeadRequirementProposal',
        entityId: proposalId,
        actor: reviewer,
        note: 'AI requirement proposal rejected by advisor',
      },
    });

    return { proposal: updatedProposal, requirements: lead.requirements };
  }

  // APPROVE or MODIFY: apply proposed fields to authoritative LeadRequirement
  const targetMinBudget = modifiedData?.minBudget !== undefined ? modifiedData.minBudget : proposal.proposedMinBudget;
  const targetMaxBudget = modifiedData?.maxBudget !== undefined ? modifiedData.maxBudget : proposal.proposedMaxBudget;
  const targetLocations = modifiedData?.preferredLocations !== undefined ? modifiedData.preferredLocations : proposal.proposedLocations;
  const targetPropertyType = modifiedData?.propertyType !== undefined ? modifiedData.propertyType : proposal.proposedPropertyType;
  const targetMinBedrooms = modifiedData?.minBedrooms !== undefined ? modifiedData.minBedrooms : proposal.proposedMinBedrooms;
  const targetMaxBedrooms = modifiedData?.maxBedrooms !== undefined ? modifiedData.maxBedrooms : proposal.proposedMaxBedrooms;
  const targetTimeline = modifiedData?.possessionTimeline !== undefined ? modifiedData.possessionTimeline : proposal.proposedTimeline;
  const targetNotes = modifiedData?.summaryNotes !== undefined ? modifiedData.summaryNotes : undefined;

  const targetStatus: ProposalStatus = action === 'MODIFY' ? 'MODIFIED' : 'APPROVED';

  const updatedProposal = await prisma.leadRequirementProposal.update({
    where: { id: proposalId },
    data: {
      status: targetStatus,
      reviewedAt: now,
      reviewedBy: reviewer,
    },
  });

  const existingReq = await prisma.leadRequirement.findUnique({ where: { leadId } });

  const updatedReq = await prisma.leadRequirement.upsert({
    where: { leadId },
    create: {
      leadId,
      minBudget: targetMinBudget,
      maxBudget: targetMaxBudget,
      preferredLocations: targetLocations,
      propertyType: targetPropertyType,
      minBedrooms: targetMinBedrooms,
      maxBedrooms: targetMaxBedrooms,
      possessionTimeline: targetTimeline,
      notes: targetNotes ?? null,
    },
    update: {
      minBudget: targetMinBudget !== undefined ? targetMinBudget : existingReq?.minBudget,
      maxBudget: targetMaxBudget !== undefined ? targetMaxBudget : existingReq?.maxBudget,
      preferredLocations: targetLocations && targetLocations.length > 0 ? targetLocations : existingReq?.preferredLocations,
      propertyType: targetPropertyType !== undefined ? targetPropertyType : existingReq?.propertyType,
      minBedrooms: targetMinBedrooms !== undefined ? targetMinBedrooms : existingReq?.minBedrooms,
      maxBedrooms: targetMaxBedrooms !== undefined ? targetMaxBedrooms : existingReq?.maxBedrooms,
      possessionTimeline: targetTimeline !== undefined ? targetTimeline : existingReq?.possessionTimeline,
      notes: targetNotes !== undefined ? targetNotes : existingReq?.notes,
    },
  });

  // Re-evaluate Lead Priority with advisor-confirmed requirements
  const computedPriority = calculateLeadPriority({
    maxBudget: updatedReq.maxBudget,
    possessionTimeline: updatedReq.possessionTimeline,
    hasPhone: !!lead.phone,
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { priority: computedPriority },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      action: 'LEAD_UPDATED',
      entityType: 'LeadRequirement',
      entityId: updatedReq.id,
      actor: reviewer,
      note: `AI requirement proposal ${action.toLowerCase()}ed and applied to lead requirements`,
      newValue: {
        maxBudget: updatedReq.maxBudget,
        locations: updatedReq.preferredLocations,
        propertyType: updatedReq.propertyType,
      },
    },
  });

  return { proposal: updatedProposal, requirements: updatedReq };
}

/**
 * Returns filtered list of leads strictly scoped to organizationId.
 */
export async function getLeads(params: {
  search?: string;
  status?: LeadStatus;
  priority?: LeadPriority;
  assignedUserId?: string | null;
  unassignedOnly?: boolean;
  organizationId: string;
}) {
  const { search, status, priority, assignedUserId, unassignedOnly, organizationId } = params;

  const whereClause: Record<string, unknown> = {
    organizationId: requireOrgId(organizationId),
  };

  const isValidString = (val?: string) => val && val !== 'undefined' && val !== 'null' && val.trim().length > 0;

  if (isValidString(status as string)) whereClause['status'] = status;
  if (isValidString(priority as string)) whereClause['priority'] = priority;

  if (unassignedOnly) {
    whereClause['assignedUserId'] = null;
  } else if (isValidString(assignedUserId as string)) {
    whereClause['assignedUserId'] = assignedUserId;
  }

  if (isValidString(search)) {
    const q = search!.trim();
    whereClause['OR'] = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where: whereClause,
    include: {
      requirements: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      _count: { select: { matches: true, conversations: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return leads.map((lead) => {
    const daysSinceLastActivity = Math.floor(
      (Date.now() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const isInactiveWarning =
      Boolean(lead.assignedUserId) &&
      ACTIVE_LEAD_STATUSES.includes(lead.status) &&
      daysSinceLastActivity >= 7;

    return {
      ...lead,
      daysSinceLastActivity,
      isInactiveWarning,
    };
  });
}

/**
 * Atomically claims an eligible unassigned lead for the calling advisor.
 * Enforces cap limits, atomic conditional update, and assignment history logging.
 */
export async function claimLead(params: {
  leadId: string;
  organizationId: string;
  advisorId: string;
  callerRole: UserRole;
  reason?: string;
}) {
  const orgId = requireOrgId(params.organizationId);
  const { leadId, advisorId, reason } = params;
  const targetAdvisorId = advisorId;
  const cap = getAdvisorActiveLeadCap(orgId);

  return prisma.$transaction(async (tx) => {
    const existingLead = await tx.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
      include: { assignedUser: { select: { id: true, name: true, email: true } } },
    });

    if (!existingLead) {
      throw createError('Lead not found', 404);
    }

    if (existingLead.status === 'WON' || existingLead.status === 'LOST') {
      throw createError(`Cannot claim lead with status ${existingLead.status}`, 400);
    }

    if (existingLead.assignedUserId !== null) {
      if (existingLead.assignedUserId === targetAdvisorId) {
        throw createError('You already own this lead', 400);
      }
      throw createError('This lead has already been claimed by another advisor', 409);
    }

    // Lock advisor row to serialize active lead count validation under concurrency
    await tx.$executeRaw`SELECT "id" FROM "users" WHERE "id" = ${targetAdvisorId} FOR UPDATE`;

    const currentActiveCount = await tx.lead.count({
      where: {
        organizationId: orgId,
        assignedUserId: targetAdvisorId,
        status: { in: ACTIVE_LEAD_STATUSES },
      },
    });

    if (currentActiveCount >= cap) {
      throw createError(`Advisor has reached the maximum cap of ${cap} active leads`, 422);
    }

    // Atomically claim lead using conditional update
    const updated = await tx.lead.updateMany({
      where: {
        id: leadId,
        organizationId: orgId,
        assignedUserId: null,
        status: { notIn: ['WON', 'LOST'] },
      },
      data: {
        assignedUserId: targetAdvisorId,
      },
    });

    if (updated.count === 0) {
      throw createError('This lead has already been claimed by another advisor', 409);
    }

    const historyEntry = await tx.leadAssignmentHistory.create({
      data: {
        leadId,
        organizationId: orgId,
        previousUserId: null,
        assignedUserId: targetAdvisorId,
        changedById: targetAdvisorId,
        reason: reason || 'Claimed from unassigned pool',
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_UPDATED',
        entityType: 'Lead',
        entityId: leadId,
        actor: targetAdvisorId,
        note: `Lead claimed by advisor (${historyEntry.reason})`,
        previousValue: { assignedUserId: null },
        newValue: { assignedUserId: targetAdvisorId },
      },
    });

    return tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        requirements: true,
        assignedUser: { select: { id: true, name: true, email: true } },
        assignmentHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            previousUser: { select: { id: true, name: true, email: true } },
            assignedUser: { select: { id: true, name: true, email: true } },
            changedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  });
}

/**
 * Releases an assigned lead back to the unassigned pool.
 */
export async function releaseLead(params: {
  leadId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  reason?: string;
}) {
  const orgId = requireOrgId(params.organizationId);
  const { leadId, callerId, callerRole, reason } = params;

  return prisma.$transaction(async (tx) => {
    const existingLead = await tx.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
      select: { id: true, assignedUserId: true, status: true },
    });

    if (!existingLead) {
      throw createError('Lead not found', 404);
    }

    if (existingLead.assignedUserId === null) {
      throw createError('Lead is already unassigned', 400);
    }

    // Role-based authorization
    if (callerRole === 'AGENT' && existingLead.assignedUserId !== callerId) {
      throw createError('Advisors cannot release leads assigned to other advisors', 403);
    }

    const previousUserId = existingLead.assignedUserId;

    // Atomically release lead
    const updated = await tx.lead.updateMany({
      where: {
        id: leadId,
        organizationId: orgId,
        assignedUserId: previousUserId,
      },
      data: {
        assignedUserId: null,
      },
    });

    if (updated.count === 0) {
      throw createError('Lead is no longer assigned to this advisor', 409);
    }

    const historyEntry = await tx.leadAssignmentHistory.create({
      data: {
        leadId,
        organizationId: orgId,
        previousUserId,
        assignedUserId: null,
        changedById: callerId,
        reason: reason || 'Released to unassigned pool',
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_UPDATED',
        entityType: 'Lead',
        entityId: leadId,
        actor: callerId,
        note: `Lead released to pool (${historyEntry.reason})`,
        previousValue: { assignedUserId: previousUserId },
        newValue: { assignedUserId: null },
      },
    });

    return tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        requirements: true,
        assignedUser: { select: { id: true, name: true, email: true } },
        assignmentHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            previousUser: { select: { id: true, name: true, email: true } },
            assignedUser: { select: { id: true, name: true, email: true } },
            changedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  });
}

/**
 * Assigns or reassigns a lead to an advisor within the organization.
 */
export async function reassignLead(params: {
  leadId: string;
  organizationId: string;
  targetUserId: string | null;
  callerId: string;
  callerRole: UserRole;
  reason?: string;
}) {
  const orgId = requireOrgId(params.organizationId);
  const { leadId, targetUserId, callerId, callerRole, reason } = params;

  if (targetUserId === null) {
    return releaseLead({ leadId, organizationId: orgId, callerId, callerRole, reason });
  }

  return prisma.$transaction(async (tx) => {
    const existingLead = await tx.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
      select: { id: true, assignedUserId: true, status: true },
    });

    if (!existingLead) {
      throw createError('Lead not found', 404);
    }

    // Role-based authorization:
    // Agents cannot reassign other advisors' leads and can only assign unassigned leads to themselves
    if (callerRole === 'AGENT') {
      if (existingLead.assignedUserId && existingLead.assignedUserId !== callerId) {
        throw createError('Agents cannot reassign leads owned by another advisor', 403);
      }
      if (targetUserId !== callerId) {
        throw createError('Agents can only assign leads to themselves', 403);
      }
    }

    if (existingLead.assignedUserId === targetUserId) {
      return tx.lead.findUniqueOrThrow({
        where: { id: leadId },
        include: {
          requirements: true,
          assignedUser: { select: { id: true, name: true, email: true } },
          assignmentHistory: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
              previousUser: { select: { id: true, name: true, email: true } },
              assignedUser: { select: { id: true, name: true, email: true } },
              changedBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    }

    // Verify target user is in the caller's organization
    const targetUser = await tx.user.findFirst({
      where: { id: targetUserId, organizationId: orgId },
      select: { id: true, name: true, email: true },
    });

    if (!targetUser) {
      throw createError('Assigned user is not a member of this organization', 422);
    }

    // Enforce active lead cap under concurrency row lock
    const cap = getAdvisorActiveLeadCap(orgId);
    await tx.$executeRaw`SELECT "id" FROM "users" WHERE "id" = ${targetUserId} FOR UPDATE`;

    const activeCount = await tx.lead.count({
      where: {
        organizationId: orgId,
        assignedUserId: targetUserId,
        status: { in: ACTIVE_LEAD_STATUSES },
      },
    });

    if (activeCount >= cap) {
      throw createError(`Target advisor has reached the maximum cap of ${cap} active leads`, 422);
    }

    const previousUserId = existingLead.assignedUserId;

    // Atomically reassign
    const updated = await tx.lead.updateMany({
      where: {
        id: leadId,
        organizationId: orgId,
        assignedUserId: previousUserId,
      },
      data: {
        assignedUserId: targetUserId,
      },
    });

    if (updated.count === 0) {
      throw createError('Lead assignment was concurrently modified', 409);
    }

    const historyEntry = await tx.leadAssignmentHistory.create({
      data: {
        leadId,
        organizationId: orgId,
        previousUserId,
        assignedUserId: targetUserId,
        changedById: callerId,
        reason: reason || (previousUserId ? 'Reassigned by organization owner' : 'Claimed from unassigned pool'),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'LEAD_UPDATED',
        entityType: 'Lead',
        entityId: leadId,
        actor: callerId,
        note: `Lead assigned to ${targetUser.email} (${historyEntry.reason})`,
        previousValue: { assignedUserId: previousUserId },
        newValue: { assignedUserId: targetUserId },
      },
    });

    return tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: {
        requirements: true,
        assignedUser: { select: { id: true, name: true, email: true } },
        assignmentHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            previousUser: { select: { id: true, name: true, email: true } },
            assignedUser: { select: { id: true, name: true, email: true } },
            changedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  });
}

/**
 * Retrieves the full chronological assignment history for a lead.
 */
export async function getLeadAssignmentHistory(leadId: string, organizationId: string) {
  const orgId = requireOrgId(organizationId);
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    select: { id: true },
  });
  if (!lead) throw createError('Lead not found', 404);

  return prisma.leadAssignmentHistory.findMany({
    where: { leadId, organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    include: {
      previousUser: { select: { id: true, name: true, email: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      changedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

/**
 * Manual edit of structured lead requirements by agent.
 */
export async function updateLeadRequirements(
  leadId: string,
  data: Partial<ExtractedRequirements>,
  organizationId: string,
  actorEmail?: string,
) {
  // Enforce tenant scoping
  await getLeadDetails(leadId, requireOrgId(organizationId));

  const existing = await prisma.leadRequirement.findUnique({ where: { leadId } });

  const updated = await prisma.leadRequirement.upsert({
    where: { leadId },
    create: {
      leadId,
      minBudget: data.minBudget ?? null,
      maxBudget: data.maxBudget ?? null,
      preferredLocations: data.preferredLocations ?? [],
      propertyType: data.propertyType ?? null,
      minBedrooms: data.minBedrooms ?? null,
      maxBedrooms: data.maxBedrooms ?? null,
      possessionTimeline: data.possessionTimeline ?? null,
      notes: data.summaryNotes ?? null,
    },
    update: {
      minBudget: data.minBudget !== undefined ? data.minBudget : existing?.minBudget,
      maxBudget: data.maxBudget !== undefined ? data.maxBudget : existing?.maxBudget,
      preferredLocations: data.preferredLocations !== undefined ? data.preferredLocations : existing?.preferredLocations,
      propertyType: data.propertyType !== undefined ? data.propertyType : existing?.propertyType,
      minBedrooms: data.minBedrooms !== undefined ? data.minBedrooms : existing?.minBedrooms,
      maxBedrooms: data.maxBedrooms !== undefined ? data.maxBedrooms : existing?.maxBedrooms,
      possessionTimeline: data.possessionTimeline !== undefined ? data.possessionTimeline : existing?.possessionTimeline,
      notes: data.summaryNotes !== undefined ? data.summaryNotes : existing?.notes,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      action: 'LEAD_UPDATED',
      entityType: 'LeadRequirement',
      entityId: updated.id,
      actor: actorEmail ?? 'system',
      note: 'Customer requirements manually updated by agent',
    },
  });

  return updated;
}

/**
 * Applies an approved requirement proposal to authoritative LeadRequirement with tenant check and audit log.
 */
export async function applyApprovedRequirementProposal(params: {
  leadId: string;
  proposalId: string;
  organizationId: string;
  reviewerEmail?: string;
}) {
  return reviewRequirementProposal({
    leadId: params.leadId,
    proposalId: params.proposalId,
    organizationId: params.organizationId,
    action: 'APPROVE',
    reviewerEmail: params.reviewerEmail,
  });
}

/**
 * Deterministically updates lead status with tenant scoping, allowed transition validation, and audit trail.
 */
export async function updateLeadStatus(params: {
  leadId: string;
  organizationId: string;
  newStatus: LeadStatus;
  actorEmail?: string;
  reason?: string;
}) {
  const orgId = requireOrgId(params.organizationId);
  const lead = await getLeadDetails(params.leadId, orgId);

  const currentStatus = lead.status;
  // If attempting to transition to QUALIFIED, only permit from NEW or CONTACTED
  if (params.newStatus === 'QUALIFIED' && !['NEW', 'CONTACTED'].includes(currentStatus)) {
    return lead;
  }

  const updated = await prisma.lead.update({
    where: { id: params.leadId },
    data: { status: params.newStatus },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      action: 'LEAD_UPDATED',
      entityType: 'Lead',
      entityId: params.leadId,
      actor: params.actorEmail ?? 'ai_sales_agent',
      note: params.reason ?? `Lead status transitioned from ${currentStatus} to ${params.newStatus}`,
      previousValue: { status: currentStatus },
      newValue: { status: params.newStatus },
    },
  });

  return updated;
}

/**
 * Records a manual phone call log for a lead with tenant isolation, authorization, and audit trail.
 */
export async function recordCallLog(params: {
  leadId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  callerEmail?: string;
  direction: CallDirection;
  outcome: CallOutcome;
  calledAt?: Date;
  durationSeconds?: number | null;
  notes?: string | null;
  followUpNeeded?: boolean;
  followUpDate?: Date | null;
}) {
  const orgId = requireOrgId(params.organizationId);
  const { leadId, callerId, callerRole, callerEmail, direction, outcome } = params;

  // 1. Verify lead exists within this organization
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    select: { id: true, assignedUserId: true, status: true, fullName: true },
  });

  if (!lead) {
    throw createError('Lead not found', 404);
  }

  // 2. Ownership authorization: AGENT can only log calls for own lead or unassigned lead
  if (callerRole === 'AGENT' && lead.assignedUserId && lead.assignedUserId !== callerId) {
    throw createError('Advisors cannot record calls for leads owned by another advisor', 403);
  }

  // 3. Validation
  const calledAt = params.calledAt ?? new Date();
  if (isNaN(calledAt.getTime())) {
    throw createError('Invalid call timestamp', 422);
  }
  // Disallow calledAt far in future (allow 5m clock skew)
  if (calledAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw createError('Call timestamp cannot be in the future', 422);
  }

  if (params.durationSeconds !== undefined && params.durationSeconds !== null) {
    if (!Number.isInteger(params.durationSeconds) || params.durationSeconds < 0) {
      throw createError('Duration must be a non-negative integer in seconds', 422);
    }
  }

  if (outcome === 'OTHER' && (!params.notes || params.notes.trim().length < 3)) {
    throw createError('Notes are required when outcome is OTHER', 422);
  }

  const followUpNeeded = Boolean(params.followUpNeeded);
  let followUpDate: Date | null = null;
  if (params.followUpDate) {
    followUpDate = new Date(params.followUpDate);
    if (isNaN(followUpDate.getTime())) {
      throw createError('Invalid follow-up date', 422);
    }
    if (followUpDate.getTime() < Date.now() - 60 * 1000) {
      throw createError('Follow-up date must be in the future', 422);
    }
  }

  // 4. Persistence in interactive transaction
  return prisma.$transaction(async (tx) => {
    const callLog = await tx.leadCallLog.create({
      data: {
        leadId,
        organizationId: orgId,
        userId: callerId,
        direction,
        outcome,
        calledAt,
        durationSeconds: params.durationSeconds ?? null,
        notes: params.notes?.trim() || null,
        followUpNeeded,
        followUpDate,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Atomically create actionable follow-up task if follow-up was requested with valid date
    let followUpTask: any = null;
    if (followUpNeeded && followUpDate) {
      followUpTask = await tx.leadTask.create({
        data: {
          leadId,
          organizationId: orgId,
          taskType: 'CALL',
          title: `Follow-up call with ${lead.fullName || 'Lead'}`,
          description: params.notes?.trim()
            ? `Call notes: ${params.notes.trim()}`
            : 'Follow-up requested from call log.',
          dueDate: followUpDate,
          status: 'OPEN',
          priority: 'HIGH',
          assignedUserId: lead.assignedUserId || callerId,
          createdById: callerId,
          callLogId: callLog.id,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          action: 'LEAD_TASK_CREATED',
          entityType: 'LeadTask',
          entityId: followUpTask.id,
          actor: callerEmail ?? callerId,
          note: `Auto-generated follow-up task from call: "${followUpTask.title}"`,
          newValue: {
            title: followUpTask.title,
            dueDate: followUpTask.dueDate,
            callLogId: callLog.id,
          },
        },
      });
    }

    // Touch lead's updatedAt to record active advisor engagement
    await tx.lead.update({
      where: { id: leadId },
      data: { updatedAt: new Date() },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'CALL_LOGGED',
        entityType: 'LeadCallLog',
        entityId: callLog.id,
        actor: callerEmail ?? callerId,
        note: `Call logged: ${direction} (${outcome})`,
        newValue: {
          direction,
          outcome,
          durationSeconds: callLog.durationSeconds,
          followUpNeeded: callLog.followUpNeeded,
          followUpDate: callLog.followUpDate,
          taskId: followUpTask?.id ?? null,
        },
      },
    });

    return {
      ...callLog,
      followUpTask,
    };
  });
}

/**
 * Returns call logs for a lead scoped to the tenant organization.
 */
export async function getLeadCallLogs(
  leadId: string,
  organizationId: string,
  options?: { limit?: number; offset?: number },
) {
  const orgId = requireOrgId(organizationId);

  // Validate lead exists in tenant
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    select: { id: true },
  });

  if (!lead) {
    throw createError('Lead not found', 404);
  }

  const limit = Math.min(options?.limit ?? 50, 100);
  const offset = options?.offset ?? 0;

  return prisma.leadCallLog.findMany({
    where: { leadId, organizationId: orgId },
    orderBy: [{ calledAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      followUpTask: true,
    },
    take: limit,
    skip: offset,
  });
}

export type TimelineCategory = 'ALL' | 'CALLS' | 'TASKS' | 'VISITS' | 'OWNERSHIP';

export interface TimelineEvent {
  id: string;
  eventType:
    | 'LEAD_CREATED'
    | 'LEAD_CLAIMED'
    | 'LEAD_RELEASED'
    | 'LEAD_REASSIGNED'
    | 'CALL_LOGGED'
    | 'TASK_CREATED'
    | 'TASK_COMPLETED'
    | 'TASK_CANCELLED'
    | 'SITE_VISIT_SCHEDULED'
    | 'SITE_VISIT_COMPLETED'
    | 'SITE_VISIT_CANCELLED'
    | 'SITE_VISIT_NO_SHOW';
  category: 'OWNERSHIP' | 'CALLS' | 'TASKS' | 'VISITS';
  timestamp: string;
  actor: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  title: string;
  description?: string | null;
  outcome?: string | null;
  metadata?: Record<string, any>;
  entityId: string;
  entityType: 'Lead' | 'LeadAssignmentHistory' | 'LeadCallLog' | 'LeadTask' | 'SiteVisit';
}

export interface GetLeadTimelineParams {
  leadId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  category?: TimelineCategory;
  limit?: number;
  offset?: number;
}

/**
 * Returns a unified reverse-chronological timeline of real canonical events for a lead.
 * Does not fabricate events; synthesizes strictly from stored models.
 */
export async function getLeadTimeline(params: GetLeadTimelineParams) {
  const orgId = requireOrgId(params.organizationId);

  // 1. Verify lead belongs to caller's tenant
  const lead = await prisma.lead.findFirst({
    where: { id: params.leadId, organizationId: orgId },
    select: {
      id: true,
      fullName: true,
      source: true,
      createdAt: true,
      assignedUserId: true,
    },
  });

  if (!lead) {
    throw createError('Lead not found', 404);
  }

  // 2. Role-based authorization
  if (params.callerRole === 'AGENT') {
    if (lead.assignedUserId && lead.assignedUserId !== params.callerId) {
      throw createError('Agents can only view activity for their assigned leads', 403);
    }
  }

  // 3. Query canonical sources concurrently
  const [assignmentHistory, callLogs, tasks, siteVisits] = await Promise.all([
    prisma.leadAssignmentHistory.findMany({
      where: { leadId: params.leadId, organizationId: orgId },
      include: {
        previousUser: { select: { id: true, name: true, email: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        changedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.leadCallLog.findMany({
      where: { leadId: params.leadId, organizationId: orgId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        followUpTask: { select: { id: true, title: true, status: true, dueDate: true } },
      },
      orderBy: [{ calledAt: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.leadTask.findMany({
      where: { leadId: params.leadId, organizationId: orgId },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        completedUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.siteVisit.findMany({
      where: { leadId: params.leadId, organizationId: orgId },
      include: {
        property: { select: { id: true, title: true, address: true, city: true, price: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        cancelledUser: { select: { id: true, name: true, email: true } },
        completedUser: { select: { id: true, name: true, email: true } },
        noShowUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const events: TimelineEvent[] = [];

  // Lead Ingestion Event
  events.push({
    id: `lead-create-${lead.id}`,
    eventType: 'LEAD_CREATED',
    category: 'OWNERSHIP',
    timestamp: lead.createdAt.toISOString(),
    actor: null,
    title: `Lead Created (${lead.source || 'MANUAL'})`,
    description: `Lead profile initialized for ${lead.fullName}`,
    outcome: null,
    metadata: { source: lead.source },
    entityId: lead.id,
    entityType: 'Lead',
  });

  // Assignment / Claim / Release / Reassign Events
  for (const h of assignmentHistory) {
    let eventType: TimelineEvent['eventType'] = 'LEAD_REASSIGNED';
    let title = 'Lead Reassigned';
    if (!h.previousUserId && h.assignedUserId) {
      eventType = 'LEAD_CLAIMED';
      title = `Lead Claimed by ${h.assignedUser?.name || h.assignedUser?.email || 'Advisor'}`;
    } else if (h.previousUserId && !h.assignedUserId) {
      eventType = 'LEAD_RELEASED';
      title = 'Lead Released to Pool';
    } else {
      title = `Lead Reassigned to ${h.assignedUser?.name || h.assignedUser?.email || 'Advisor'}`;
    }

    events.push({
      id: `assignment-${h.id}`,
      eventType,
      category: 'OWNERSHIP',
      timestamp: h.createdAt.toISOString(),
      actor: h.changedBy ?? null,
      title,
      description: h.reason || (eventType === 'LEAD_CLAIMED' ? 'Claimed from lead pool' : 'Ownership updated'),
      outcome: h.assignedUser ? `Assigned to ${h.assignedUser.name || h.assignedUser.email}` : 'Unassigned',
      metadata: {
        previousUserId: h.previousUserId,
        previousUserName: h.previousUser?.name || h.previousUser?.email,
        assignedUserId: h.assignedUserId,
        assignedUserName: h.assignedUser?.name || h.assignedUser?.email,
      },
      entityId: h.id,
      entityType: 'LeadAssignmentHistory',
    });
  }

  // Call Logs
  for (const c of callLogs) {
    const isOutbound = c.direction === 'OUTBOUND';
    const duration = c.durationSeconds
      ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s`
      : null;
    events.push({
      id: `call-${c.id}`,
      eventType: 'CALL_LOGGED',
      category: 'CALLS',
      timestamp: c.calledAt.toISOString(),
      actor: c.user ?? null,
      title: `${isOutbound ? 'Outbound Call' : 'Inbound Call'}: ${c.outcome.replace(/_/g, ' ')}`,
      description: c.notes || null,
      outcome: c.outcome,
      metadata: {
        direction: c.direction,
        durationSeconds: c.durationSeconds,
        durationFormatted: duration,
        followUpNeeded: c.followUpNeeded,
        followUpDate: c.followUpDate?.toISOString(),
        taskId: c.followUpTask?.id,
      },
      entityId: c.id,
      entityType: 'LeadCallLog',
    });
  }

  // Task Lifecycle Events
  for (const t of tasks) {
    // 1. Task Created
    events.push({
      id: `task-create-${t.id}`,
      eventType: 'TASK_CREATED',
      category: 'TASKS',
      timestamp: t.createdAt.toISOString(),
      actor: t.createdByUser ?? null,
      title: `Task Scheduled: ${t.title}`,
      description: t.description || null,
      outcome: `Due ${t.dueDate.toISOString().slice(0, 10)} (${t.priority} Priority)`,
      metadata: {
        taskType: t.taskType,
        priority: t.priority,
        dueDate: t.dueDate.toISOString(),
        assignedUserId: t.assignedUserId,
        assignedUserName: t.assignedUser?.name || t.assignedUser?.email,
      },
      entityId: t.id,
      entityType: 'LeadTask',
    });

    // 2. Task Completed
    if (t.status === 'COMPLETED' && t.completedAt) {
      events.push({
        id: `task-complete-${t.id}`,
        eventType: 'TASK_COMPLETED',
        category: 'TASKS',
        timestamp: t.completedAt.toISOString(),
        actor: t.completedUser ?? null,
        title: `Task Completed: ${t.title}`,
        description: null,
        outcome: 'Completed',
        metadata: {
          taskType: t.taskType,
          originalDueDate: t.dueDate.toISOString(),
        },
        entityId: t.id,
        entityType: 'LeadTask',
      });
    }

    // 3. Task Cancelled
    if (t.status === 'CANCELLED') {
      events.push({
        id: `task-cancel-${t.id}`,
        eventType: 'TASK_CANCELLED',
        category: 'TASKS',
        timestamp: t.updatedAt.toISOString(),
        actor: null,
        title: `Task Cancelled: ${t.title}`,
        description: null,
        outcome: 'Cancelled',
        metadata: {
          taskType: t.taskType,
        },
        entityId: t.id,
        entityType: 'LeadTask',
      });
    }
  }

  // Site Visit Lifecycle Events
  for (const v of siteVisits) {
    // 1. Site Visit Scheduled
    events.push({
      id: `visit-schedule-${v.id}`,
      eventType: 'SITE_VISIT_SCHEDULED',
      category: 'VISITS',
      timestamp: v.createdAt.toISOString(),
      actor: v.createdByUser ?? null,
      title: `Site Visit Scheduled${v.property ? `: ${v.property.title}` : ''}`,
      description: v.notes || (v.meetingLocation ? `Location: ${v.meetingLocation}` : null),
      outcome: `Scheduled for ${v.startAt.toISOString().slice(0, 16).replace('T', ' ')}`,
      metadata: {
        startAt: v.startAt.toISOString(),
        endAt: v.endAt.toISOString(),
        propertyId: v.propertyId,
        propertyTitle: v.property?.title,
        meetingLocation: v.meetingLocation,
        assignedUserId: v.assignedUserId,
        assignedUserName: v.assignedUser?.name || v.assignedUser?.email,
      },
      entityId: v.id,
      entityType: 'SiteVisit',
    });

    // 2. Site Visit Completed
    if (v.status === 'COMPLETED' && v.completedAt) {
      events.push({
        id: `visit-complete-${v.id}`,
        eventType: 'SITE_VISIT_COMPLETED',
        category: 'VISITS',
        timestamp: v.completedAt.toISOString(),
        actor: v.completedUser ?? null,
        title: `Site Visit Completed${v.property ? `: ${v.property.title}` : ''}`,
        description: v.outcomeNotes || null,
        outcome: 'Completed Showing',
        metadata: {
          propertyTitle: v.property?.title,
          outcomeNotes: v.outcomeNotes,
        },
        entityId: v.id,
        entityType: 'SiteVisit',
      });
    }

    // 3. Site Visit Cancelled
    if (v.status === 'CANCELLED' && v.cancelledAt) {
      events.push({
        id: `visit-cancel-${v.id}`,
        eventType: 'SITE_VISIT_CANCELLED',
        category: 'VISITS',
        timestamp: v.cancelledAt.toISOString(),
        actor: v.cancelledUser ?? null,
        title: `Site Visit Cancelled${v.property ? `: ${v.property.title}` : ''}`,
        description: v.cancelReason || null,
        outcome: 'Cancelled Showing',
        metadata: {
          propertyTitle: v.property?.title,
          cancelReason: v.cancelReason,
        },
        entityId: v.id,
        entityType: 'SiteVisit',
      });
    }

    // 4. Site Visit No-Show
    if (v.status === 'NO_SHOW' && v.noShowAt) {
      events.push({
        id: `visit-noshow-${v.id}`,
        eventType: 'SITE_VISIT_NO_SHOW',
        category: 'VISITS',
        timestamp: v.noShowAt.toISOString(),
        actor: v.noShowUser ?? null,
        title: `Site Visit Marked No-Show${v.property ? `: ${v.property.title}` : ''}`,
        description: v.outcomeNotes || null,
        outcome: 'Lead did not show up',
        metadata: {
          propertyTitle: v.property?.title,
        },
        entityId: v.id,
        entityType: 'SiteVisit',
      });
    }
  }

  // Filter by Category
  let filtered = events;
  if (params.category && params.category !== 'ALL') {
    filtered = events.filter((e) => e.category === params.category);
  }

  // Deterministic sorting: Timestamp DESC, tie-breaker id DESC
  filtered.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  // Bounded pagination
  const limit = Math.min(params.limit ?? 50, 100);
  const offset = Math.max(params.offset ?? 0, 0);
  const paginated = filtered.slice(offset, offset + limit);

  return {
    events: paginated,
    total: filtered.length,
    limit,
    offset,
  };
}
