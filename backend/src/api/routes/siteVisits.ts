// ─────────────────────────────────────────────────────────────────────────────
// /api/site-visits — Real Estate Property Site Visit Scheduling & Management
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import {
  getSiteVisits,
  checkAdvisorAvailability,
  rescheduleSiteVisit,
  cancelSiteVisit,
  completeSiteVisit,
  markNoShowSiteVisit,
} from '../../services/siteVisit.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

export const CheckAvailabilitySchema = z.object({
  startAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid start time' }),
  endAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid end time' }).optional(),
  durationMinutes: z.coerce.number().positive().optional(),
  advisorId: z.string().optional(),
  excludeVisitId: z.string().optional(),
});

export const RescheduleVisitSchema = z.object({
  startAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid start time' }).optional(),
  endAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid end time' }).optional(),
  durationMinutes: z.coerce.number().positive().optional(),
  meetingLocation: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  assignedUserId: z.string().optional(),
});

export const CancelVisitSchema = z.object({
  reason: z.string().optional().nullable(),
});

export const CompleteVisitSchema = z.object({
  outcomeNotes: z.string().optional().nullable(),
});

export const NoShowVisitSchema = z.object({
  notes: z.string().optional().nullable(),
});

// ── GET /api/site-visits/availability ─────────────────────────────────────────
// Advisory check for advisor availability during interval
router.get(
  '/availability',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = CheckAvailabilitySchema.safeParse(req.query);
    if (!parse.success) {
      throw createError(parse.error.errors[0]?.message ?? 'Invalid availability check parameters', 400);
    }

    const { startAt, endAt, durationMinutes, advisorId, excludeVisitId } = parse.data;

    // Agents cannot check another advisor's availability
    if (req.user!.role === 'AGENT' && advisorId && advisorId !== req.user!.id) {
      throw createError('Agents cannot inspect other advisors’ schedules', 403);
    }

    const result = await checkAdvisorAvailability({
      organizationId: req.user!.organizationId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      advisorId,
      startAt,
      endAt,
      durationMinutes,
      excludeVisitId,
    });

    res.json(result);
  }),
);

// ── GET /api/site-visits ──────────────────────────────────────────────────────
// Lists authorized site visits with date and status filters
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const status = req.query['status'] as any;
    const startDate = req.query['startDate'] as string | undefined;
    const endDate = req.query['endDate'] as string | undefined;
    const advisorId = req.query['advisorId'] as string | undefined;
    const propertyId = req.query['propertyId'] as string | undefined;
    const leadId = req.query['leadId'] as string | undefined;

    // Agents can only list their own visits
    if (req.user!.role === 'AGENT' && advisorId && advisorId !== req.user!.id) {
      throw createError('Advisors cannot inspect other advisors’ site visits', 403);
    }

    const visits = await getSiteVisits({
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      status,
      startDate,
      endDate,
      advisorId,
      propertyId,
      leadId,
    });

    res.json(visits);
  }),
);

// ── PATCH /api/site-visits/:id ────────────────────────────────────────────────
// Reschedule or update visit permitted fields
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = RescheduleVisitSchema.safeParse(req.body);
    if (!parse.success) {
      throw createError(parse.error.errors[0]?.message ?? 'Invalid site visit update data', 400);
    }

    const updated = await rescheduleSiteVisit({
      visitId: req.params['id'] as string,
      organizationId: req.user!.organizationId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      ...parse.data,
    });

    res.json(updated);
  }),
);

// ── POST /api/site-visits/:id/cancel ──────────────────────────────────────────
// Cancel site visit with optional reason
router.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = CancelVisitSchema.safeParse(req.body);
    if (!parse.success) {
      throw createError(parse.error.errors[0]?.message ?? 'Invalid cancellation data', 400);
    }

    const cancelled = await cancelSiteVisit({
      visitId: req.params['id'] as string,
      organizationId: req.user!.organizationId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      reason: parse.data.reason,
    });

    res.json(cancelled);
  }),
);

// ── POST /api/site-visits/:id/complete ────────────────────────────────────────
// Mark site visit completed and record outcome
router.post(
  '/:id/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = CompleteVisitSchema.safeParse(req.body);
    if (!parse.success) {
      throw createError(parse.error.errors[0]?.message ?? 'Invalid completion data', 400);
    }

    const completed = await completeSiteVisit({
      visitId: req.params['id'] as string,
      organizationId: req.user!.organizationId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      outcomeNotes: parse.data.outcomeNotes,
    });

    res.json(completed);
  }),
);

// ── POST /api/site-visits/:id/no-show ─────────────────────────────────────────
// Record customer no-show
router.post(
  '/:id/no-show',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parse = NoShowVisitSchema.safeParse(req.body);
    if (!parse.success) {
      throw createError(parse.error.errors[0]?.message ?? 'Invalid no-show data', 400);
    }

    const noShow = await markNoShowSiteVisit({
      visitId: req.params['id'] as string,
      organizationId: req.user!.organizationId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      notes: parse.data.notes,
    });

    res.json(noShow);
  }),
);

export default router;
