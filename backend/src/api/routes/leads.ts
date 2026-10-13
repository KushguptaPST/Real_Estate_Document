// ─────────────────────────────────────────────────────────────────────────────
// /api/leads — AI Lead Management API Routes with Tenant Isolation
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import {
  ingestInboundLead,
  getLeads,
  getLeadDetails,
  updateLeadRequirements,
  extractAndPersistRequirements,
  listRequirementProposals,
  reviewRequirementProposal,
  claimLead,
  releaseLead,
  reassignLead,
  getLeadAssignmentHistory,
  recordCallLog,
  getLeadCallLogs,
  getLeadTimeline,
} from '../../services/lead.service.js';
import {
  createLeadTask,
  getLeadTasks,
  updateLeadTask,
  completeLeadTask,
  cancelLeadTask,
} from '../../services/leadTask.service.js';
import {
  scheduleSiteVisit,
  getLeadSiteVisits,
} from '../../services/siteVisit.service.js';
import {
  assembleBuyerMemory,
  evaluateFollowUpNeed,
  createFollowUpTaskAndDraft,
} from '../../services/agent/buyerMemory.service.js';
import { prisma } from '../../utils/prisma.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { resolveApiKey } from '../../services/organization.service.js';
import { convertLeadToDeal } from '../../services/leadConversion.service.js';
import { rateLimit } from '../../utils/rateLimit.js';
import { auditFieldChanges } from '../../utils/audit.js';

const router = Router();


const InboundLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.enum(['WEBSITE_FORM', 'PORTAL_INQUIRY', 'WHATSAPP', 'EMAIL', 'MANUAL']).optional(),
  externalId: z.string().optional().nullable(),
  enquiryText: z.string().max(5000).optional().nullable(),
  // Any organizationId in the body is stripped: tenant comes from the API key or session only.
});

const UpdateLeadSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedUserId: z.string().optional().nullable(),
  reason: z.string().max(500).optional(),
});

const ClaimLeadSchema = z.object({
  reason: z.string().max(500).optional(),
});

const ReleaseLeadSchema = z.object({
  reason: z.string().max(500).optional(),
});

const ReassignLeadSchema = z.object({
  targetUserId: z.string().nullable(),
  reason: z.string().max(500).optional(),
});

const CreateCallLogSchema = z.object({
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  outcome: z.enum([
    'CONNECTED',
    'NO_ANSWER',
    'BUSY',
    'CALLBACK_REQUESTED',
    'VOICEMAIL',
    'WRONG_NUMBER',
    'OTHER',
  ]),
  calledAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid call timestamp' })
    .optional(),
  durationSeconds: z
    .number()
    .int('Duration must be an integer')
    .min(0, 'Duration must be non-negative')
    .optional()
    .nullable(),
  notes: z.string().max(5000).optional().nullable(),
  followUpNeeded: z.boolean().optional(),
  followUpDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid follow-up date' })
    .optional()
    .nullable(),
});

const CreateLeadTaskSchema = z.object({
  taskType: z.enum(['CALL', 'MESSAGE', 'SITE_VISIT', 'SEND_DETAILS', 'DOCUMENT_FOLLOW_UP', 'OTHER']).optional(),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional().nullable(),
  dueDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid task due date' }),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedUserId: z.string().optional(),
});

const UpdateLeadTaskSchema = z.object({
  taskType: z.enum(['CALL', 'MESSAGE', 'SITE_VISIT', 'SEND_DETAILS', 'DOCUMENT_FOLLOW_UP', 'OTHER']).optional(),
  title: z.string().min(1, 'Task title cannot be empty').optional(),
  description: z.string().optional().nullable(),
  dueDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid task due date' })
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedUserId: z.string().optional(),
});

const CancelLeadTaskSchema = z.object({
  reason: z.string().optional(),
});

const ScheduleSiteVisitSchema = z.object({
  propertyId: z.string().optional().nullable(),
  startAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid start time' }),
  endAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid end time' }).optional(),
  durationMinutes: z.coerce.number().positive().optional(),
  meetingLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedUserId: z.string().optional(),
});

const LEAD_PII_FIELDS = ['fullName', 'email', 'phone'] as const;

// Public intake: limited per source IP before key lookup, then per API key.
const intakeIpLimiter = rateLimit({ name: 'lead-intake-ip', windowMs: 60_000, max: 60 });
const intakeKeyLimiter = rateLimit({
  name: 'lead-intake-key',
  windowMs: 60_000,
  max: parseInt(process.env['LEAD_INTAKE_RATE_LIMIT'] ?? '30', 10),
  key: (req) => (req as typeof req & { apiKeyId?: string }).apiKeyId ?? req.ip ?? 'unknown',
});

const RequirementUpdateSchema = z.object({
  minBudget: z.number().nullable().optional(),
  maxBudget: z.number().nullable().optional(),
  preferredLocations: z.array(z.string()).optional(),
  propertyType: z.string().nullable().optional(),
  minBedrooms: z.number().nullable().optional(),
  maxBedrooms: z.number().nullable().optional(),
  possessionTimeline: z.string().nullable().optional(),
  summaryNotes: z.string().optional(),
});

const ExtractInputSchema = z.object({
  enquiryText: z.string().min(5, 'Enquiry text must be at least 5 characters'),
});

const ReviewProposalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'MODIFY']).optional(),
  status: z.enum(['APPROVED', 'REJECTED', 'MODIFIED']).optional(),
  minBudget: z.number().nullable().optional(),
  maxBudget: z.number().nullable().optional(),
  preferredLocations: z.array(z.string()).optional(),
  propertyType: z.string().nullable().optional(),
  minBedrooms: z.number().nullable().optional(),
  maxBedrooms: z.number().nullable().optional(),
  possessionTimeline: z.string().nullable().optional(),
  summaryNotes: z.string().optional(),
});

// ── POST /api/leads/inbound (Server-to-server intake, org API key required) ──
router.post(
  '/inbound',
  intakeIpLimiter,
  asyncHandler(async (req, res, next) => {
    const key = await resolveApiKey(req.header('x-api-key') ?? undefined, 'lead_intake');
    if (!key) throw createError('A valid API key is required', 401);
    (req as typeof req & { apiKeyId?: string; apiKeyOrgId?: string }).apiKeyId = key.id;
    (req as typeof req & { apiKeyId?: string; apiKeyOrgId?: string }).apiKeyOrgId = key.organizationId;
    next();
  }),
  intakeKeyLimiter,
  asyncHandler(async (req, res) => {
    const parsed = InboundLeadSchema.safeParse(req.body);
    if (!parsed.success) throw createError('Invalid lead payload', 422);

    await ingestInboundLead({
      ...parsed.data,
      organizationId: (req as typeof req & { apiKeyOrgId: string }).apiKeyOrgId,
    });
    // Deliberately minimal: never echo stored lead data (or whether it already existed).
    res.status(202).json({ received: true });
  }),
);

// ── GET /api/leads (Authenticated List) ───────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const search = req.query['search'] as string | undefined;
    const status = req.query['status'] as any;
    const priority = req.query['priority'] as any;
    const assignedUserId = req.query['assignedUserId'] as string | undefined;
    const unassignedOnly = req.query['unassigned'] === 'true' || req.query['unassignedOnly'] === 'true';

    const leads = await getLeads({
      search,
      status,
      priority,
      assignedUserId,
      unassignedOnly,
      organizationId: orgId,
    });
    res.json(leads);
  }),
);

// ── POST /api/leads (Manual Agent Creation) ──────────────────────────────────
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = InboundLeadSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const lead = await ingestInboundLead({
      ...parsed.data,
      source: parsed.data.source ?? 'MANUAL',
      organizationId: orgId,
    });
    res.status(201).json(lead);
  }),
);

// ── GET /api/leads/:id ────────────────────────────────────────────────────────
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const lead = await getLeadDetails(req.params['id'], orgId);
    res.json(lead);
  }),
);

// ── POST /api/leads/:id/claim (Atomic Self-Claim) ────────────────────────────
router.post(
  '/:id/claim',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = ClaimLeadSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const lead = await claimLead({
      leadId: req.params['id'],
      organizationId: orgId,
      advisorId: req.user!.id,
      callerRole: req.user!.role,
      reason,
    });
    res.json(lead);
  }),
);

// ── POST /api/leads/:id/release (Release back to pool) ─────────────────────────
router.post(
  '/:id/release',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = ReleaseLeadSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const lead = await releaseLead({
      leadId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      reason,
    });
    res.json(lead);
  }),
);

// ── POST /api/leads/:id/reassign (Reassign or Unassign) ────────────────────────
router.post(
  '/:id/reassign',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = ReassignLeadSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const lead = await reassignLead({
      leadId: req.params['id'],
      organizationId: orgId,
      targetUserId: parsed.data.targetUserId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      reason: parsed.data.reason,
    });
    res.json(lead);
  }),
);

// ── GET /api/leads/:id/assignments (Chronological Assignment History) ─────────
router.get(
  '/:id/assignments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const history = await getLeadAssignmentHistory(req.params['id'], orgId);
    res.json(history);
  }),
);

// ── POST /api/leads/:id/calls (Record Manual Call Log) ────────────────────────
router.post(
  '/:id/calls',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = CreateCallLogSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid call payload', 422);
    }

    const callLog = await recordCallLog({
      leadId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      direction: parsed.data.direction,
      outcome: parsed.data.outcome,
      calledAt: parsed.data.calledAt ? new Date(parsed.data.calledAt) : undefined,
      durationSeconds: parsed.data.durationSeconds,
      notes: parsed.data.notes,
      followUpNeeded: parsed.data.followUpNeeded,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : undefined,
    });

    res.status(201).json(callLog);
  }),
);

// ── GET /api/leads/:id/calls (List Call Logs) ─────────────────────────────────
router.get(
  '/:id/calls',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

    const callLogs = await getLeadCallLogs(req.params['id'], orgId, { limit, offset });
    res.json(callLogs);
  }),
);

// ── POST /api/leads/:id/tasks (Create Lead Follow-Up Task) ────────────────────
router.post(
  '/:id/tasks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = CreateLeadTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid task payload', 422);
    }

    const task = await createLeadTask({
      leadId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      taskType: parsed.data.taskType,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: new Date(parsed.data.dueDate),
      priority: parsed.data.priority,
      assignedUserId: parsed.data.assignedUserId,
    });

    res.status(201).json(task);
  }),
);

// ── GET /api/leads/:id/tasks (List Lead Follow-Up Tasks) ──────────────────────
router.get(
  '/:id/tasks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const status = req.query['status'] as any;
    const tasks = await getLeadTasks(req.params['id'], orgId, req.user!.id, req.user!.role, {
      status,
    });
    res.json(tasks);
  }),
);

// ── PATCH /api/leads/:id/tasks/:taskId ────────────────────────────────────────
router.patch(
  '/:id/tasks/:taskId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = UpdateLeadTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid task update payload', 422);
    }

    const updated = await updateLeadTask({
      taskId: req.params['taskId'],
      leadId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      priority: parsed.data.priority,
      assignedUserId: parsed.data.assignedUserId,
      taskType: parsed.data.taskType,
    });

    res.json(updated);
  }),
);

// ── POST /api/leads/:id/tasks/:taskId/complete ────────────────────────────────
router.post(
  '/:id/tasks/:taskId/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const completed = await completeLeadTask({
      taskId: req.params['taskId'],
      leadId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
    });

    res.json(completed);
  }),
);

// ── POST /api/leads/:id/tasks/:taskId/cancel ──────────────────────────────────
router.post(
  '/:id/tasks/:taskId/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = CancelLeadTaskSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const cancelled = await cancelLeadTask({
      taskId: req.params['taskId'],
      leadId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      reason,
    });

    res.json(cancelled);
  }),
);

// ── POST /api/leads/:id/site-visits (Schedule Site Visit) ─────────────────────
router.post(
  '/:id/site-visits',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = ScheduleSiteVisitSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid site visit payload', 400);
    }

    const visit = await scheduleSiteVisit({
      leadId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      ...parsed.data,
    });

    res.status(201).json(visit);
  }),
);

// ── GET /api/leads/:id/site-visits (List Lead Site Visits) ────────────────────
router.get(
  '/:id/site-visits',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const visits = await getLeadSiteVisits({
      leadId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
    });

    res.json(visits);
  }),
);

// ── GET /api/leads/:id/timeline (Unified Lead Activity Timeline) ──────────────
router.get(
  '/:id/timeline',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const leadId = req.params['id'];
    const category = req.query['category'] as any;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

    const timeline = await getLeadTimeline({
      leadId,
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      category,
      limit,
      offset,
    });

    res.json(timeline);
  }),
);

// ── PATCH /api/leads/:id ──────────────────────────────────────────────────────
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = UpdateLeadSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const leadId = req.params['id'];
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
    });
    if (!existing) throw createError('Lead not found', 404);

    const { assignedUserId, reason, ...otherUpdates } = parsed.data;

    let updatedLead: any = existing;

    // Handle reassignment through the atomic ownership service
    if (assignedUserId !== undefined && assignedUserId !== existing.assignedUserId) {
      updatedLead = await reassignLead({
        leadId,
        organizationId: orgId,
        targetUserId: assignedUserId,
        callerId: req.user!.id,
        callerRole: req.user!.role,
        reason: reason || 'Updated via lead profile',
      });
    }

    // Handle non-assignment field updates
    if (Object.keys(otherUpdates).length > 0) {
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: otherUpdates,
        include: {
          requirements: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      });

      const audit = auditFieldChanges(existing, otherUpdates, LEAD_PII_FIELDS);

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          action: 'LEAD_UPDATED',
          entityType: 'Lead',
          entityId: leadId,
          actor: req.user?.email ?? 'system',
          previousValue: audit.previousValue,
          newValue: audit.newValue,
        },
      });

      updatedLead = updated;
    } else if (assignedUserId === undefined || assignedUserId === existing.assignedUserId) {
      // No updates occurred; fetch fresh lead view
      updatedLead = await prisma.lead.findUniqueOrThrow({
        where: { id: leadId },
        include: {
          requirements: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      });
    }

    res.json(updatedLead);
  }),
);

// ── PATCH /api/leads/:id/requirements ───────────────────────────────────────
router.patch(
  '/:id/requirements',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = RequirementUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const leadId = req.params['id'];
    const updated = await updateLeadRequirements(leadId, parsed.data, orgId, req.user?.email);
    res.json(updated);
  }),
);

// ── POST /api/leads/:id/extract ──────────────────────────────────────────────
router.post(
  '/:id/extract',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = ExtractInputSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const leadId = req.params['id'];
    const requirements = await extractAndPersistRequirements(leadId, parsed.data.enquiryText, orgId);
    res.json(requirements);
  }),
);

// ── GET /api/leads/:id/proposals ─────────────────────────────────────────────
router.get(
  '/:id/proposals',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const proposals = await listRequirementProposals(req.params['id'], orgId);
    res.json(proposals);
  }),
);

// ── POST /api/leads/:id/proposals/:proposalId/accept ─────────────────────────
router.post(
  '/:id/proposals/:proposalId/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const result = await reviewRequirementProposal({
      leadId: req.params['id'],
      proposalId: req.params['proposalId'],
      organizationId: orgId,
      action: 'APPROVE',
      reviewerEmail: req.user?.email,
    });
    res.json(result);
  }),
);

// ── POST /api/leads/:id/proposals/:proposalId/reject ─────────────────────────
router.post(
  '/:id/proposals/:proposalId/reject',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const result = await reviewRequirementProposal({
      leadId: req.params['id'],
      proposalId: req.params['proposalId'],
      organizationId: orgId,
      action: 'REJECT',
      reviewerEmail: req.user?.email,
    });
    res.json(result);
  }),
);

// ── PATCH /api/leads/:id/proposals/:proposalId ───────────────────────────────
router.patch(
  '/:id/proposals/:proposalId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = ReviewProposalSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const action = parsed.data.action ?? (parsed.data.status === 'REJECTED' ? 'REJECT' : parsed.data.status === 'MODIFIED' ? 'MODIFY' : 'APPROVE');
    const result = await reviewRequirementProposal({
      leadId: req.params['id'],
      proposalId: req.params['proposalId'],
      organizationId: orgId,
      action,
      modifiedData: parsed.data,
      reviewerEmail: req.user?.email,
    });
    res.json(result);
  }),
);

const PlanFollowUpSchema = z.object({
  trigger: z
    .enum([
      'UNANSWERED_QUESTION',
      'COMPLETED_VISIT_FOLLOW_UP',
      'VISIT_INTEREST_UNSCHEDULED',
      'NEW_MATCHING_INVENTORY',
      'INACTIVE_LEAD_CHECKIN',
      'ADVISOR_COMMITMENT_DUE',
    ])
    .optional(),
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().or(z.string()).optional(),
  draftContent: z.string().max(5000).optional(),
});

// ── GET /api/leads/:id/memory (Read-Only Persistent Buyer Memory) ───────────
router.get(
  '/:id/memory',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const leadId = req.params['id'];
    const memory = await assembleBuyerMemory(leadId, orgId);
    const recommendation = evaluateFollowUpNeed(memory);
    res.json({ memory, recommendation });
  }),
);

// ── POST /api/leads/:id/follow-up/plan (Execute Safe Follow-Up Plan & Task) ───
router.post(
  '/:id/follow-up/plan',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const leadId = req.params['id'];
    const parsed = PlanFollowUpSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid plan payload', 422);
    }

    const result = await createFollowUpTaskAndDraft({
      leadId,
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      trigger: parsed.data.trigger,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      draftContent: parsed.data.draftContent,
    });

    res.status(201).json(result);
  }),
);

// ── Validation Schema: Convert to Deal ───────────────────────────────────────
const ConvertToDealSchema = z.object({
  propertyId: z.string().optional(),
  propertyAddress: z.string().min(1).optional(),
  buyerName: z.string().min(1).optional(),
  sellerName: z.string().optional(),
  acceptanceDate: z.string().optional(),
  timezone: z.string().optional(),
  eligibilityOverride: z.boolean().optional(),
  overrideReason: z.string().max(500).optional(),
});

// ── POST /api/leads/:id/convert-to-deal (Convert Qualified Lead into Active Deal) ──
router.post(
  '/:id/convert-to-deal',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const leadId = req.params['id'];
    const parsed = ConvertToDealSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid conversion payload', 422);
    }

    const result = await convertLeadToDeal({
      leadId,
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      propertyId: parsed.data.propertyId,
      propertyAddress: parsed.data.propertyAddress,
      buyerName: parsed.data.buyerName,
      sellerName: parsed.data.sellerName,
      acceptanceDate: parsed.data.acceptanceDate,
      timezone: parsed.data.timezone,
      eligibilityOverride: parsed.data.eligibilityOverride,
      overrideReason: parsed.data.overrideReason,
    });

    res.status(201).json(result);
  }),
);

export default router;
