// ─────────────────────────────────────────────────────────────────────────────
// /api/deals/:id/tasks — Transaction Obligation Tasks & Review Routes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';
import {
  extractTransactionTasksFromPdf,
  reviewTransactionTask,
} from '../../services/transactionTask.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router({ mergeParams: true });


const ReviewTaskSchema = z.object({
  title: z.string().optional(),
  dueDate: z.string().optional(),
  amount: z.number().nullable().optional(),
  assignedTo: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED']).optional(),
});

// ── GET /api/deals/:id/tasks ──────────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];

    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
    if (!deal) throw createError('Deal not found or access denied', 404);

    const tasks = await prisma.transactionTask.findMany({
      where: { dealId, organizationId: orgId },
      orderBy: { dueDate: 'asc' },
    });
    res.json(tasks);
  }),
);

// ── POST /api/deals/:id/tasks/extract ────────────────────────────────────────
router.post(
  '/extract',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const documentId = req.body.documentId as string;

    if (!documentId) throw createError('documentId is required', 400);

    const doc = await prisma.document.findFirst({ where: { id: documentId, dealId, organizationId: orgId } });
    if (!doc) throw createError('Document not found or access denied', 404);

    const tasks = await extractTransactionTasksFromPdf(doc.storagePath, dealId, doc.id, orgId);
    res.status(201).json(tasks);
  }),
);

// ── PATCH /api/deals/:id/tasks/:taskId ───────────────────────────────────────
router.patch(
  '/:taskId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = ReviewTaskSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const updated = await reviewTransactionTask({
      taskId: req.params['taskId'],
      organizationId: orgId,
      dealId: req.params['id'],
      dueDate: parsed.data.dueDate,
      title: parsed.data.title,
      amount: parsed.data.amount ?? undefined,
      assignedTo: parsed.data.assignedTo,
      status: parsed.data.status,
      actorEmail: req.user?.email,
    });

    res.json(updated);
  }),
);

export default router;
