// ─────────────────────────────────────────────────────────────────────────────
// /api/tasks — Lead Follow-Up Tasks & Reminders (Advisor Task Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import {
  getAdvisorTasks,
  updateLeadTask,
  completeLeadTask,
  cancelLeadTask,
  getAdvisorActionQueue,
} from '../../services/leadTask.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

export const UpdateTaskSchema = z.object({
  taskType: z.enum(['CALL', 'MESSAGE', 'SITE_VISIT', 'SEND_DETAILS', 'DOCUMENT_FOLLOW_UP', 'OTHER']).optional(),
  title: z.string().min(1, 'Title cannot be empty').optional(),
  description: z.string().optional().nullable(),
  dueDate: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid task due date' })
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedUserId: z.string().optional(),
});

export const CancelTaskSchema = z.object({
  reason: z.string().optional(),
});

// ── GET /api/tasks/action-queue ───────────────────────────────────────────────
// Returns consolidated action queue for advisor with deduplication, bucketing, and attention rules
router.get(
  '/action-queue',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const advisorId = req.query['advisorId'] as string | undefined;
    const timezone = req.query['timezone'] as string | undefined;
    const bucket = req.query['bucket'] as any;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

    // AGENT users cannot query another advisor's action queue
    if (req.user!.role === 'AGENT' && advisorId && advisorId !== req.user!.id) {
      throw createError('Advisors cannot inspect other advisors’ action queues', 403);
    }

    const queue = await getAdvisorActionQueue({
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      advisorId,
      timezone,
      bucket,
      limit,
      offset,
    });

    res.json(queue);
  }),
);

// ── GET /api/tasks ────────────────────────────────────────────────────────────
// Lists advisor's tasks with filters: upcoming, overdue, completed, all
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const filter = req.query['filter'] as 'upcoming' | 'overdue' | 'completed' | 'all' | undefined;
    const status = req.query['status'] as any;
    const assignedUserId = req.query['assignedUserId'] as string | undefined;
    const leadId = req.query['leadId'] as string | undefined;
    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
    const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

    // AGENT users cannot query another advisor's tasks
    if (req.user!.role === 'AGENT' && assignedUserId && assignedUserId !== req.user!.id) {
      throw createError('Advisors cannot view other advisors’ task queues', 403);
    }

    const tasks = await getAdvisorTasks(orgId, req.user!.id, req.user!.role, {
      filter,
      status,
      assignedUserId,
      leadId,
      limit,
      offset,
    });

    res.json(tasks);
  }),
);

// ── PATCH /api/tasks/:id ──────────────────────────────────────────────────────
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = UpdateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid task update payload', 422);
    }

    const updated = await updateLeadTask({
      taskId: req.params['id'],
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

// ── POST /api/tasks/:id/complete ──────────────────────────────────────────────
router.post(
  '/:id/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const completed = await completeLeadTask({
      taskId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
    });

    res.json(completed);
  }),
);

// ── POST /api/tasks/:id/cancel ────────────────────────────────────────────────
router.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = CancelTaskSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const cancelled = await cancelLeadTask({
      taskId: req.params['id'],
      organizationId: orgId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      callerEmail: req.user!.email,
      reason,
    });

    res.json(cancelled);
  }),
);

export default router;
