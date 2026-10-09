/**
 * /api/deals/:id/deadlines — View and confirm/edit deadlines with Tenant Isolation
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { scheduleAlerts } from '../../services/alert.service.js';
import { computeDeadlinesForDeal } from '../../services/deadline.service.js';
import { resetDeadlineAlertWindows } from '../../services/scheduler.service.js';

const router = Router({ mergeParams: true });
const prisma = new PrismaClient();

const ConfirmDeadlineSchema = z.object({
  confirmedDate: z.string().datetime(),
  confirmedBy: z.string().min(1).optional(),
  activate: z.boolean().optional(),
});

// ── GET /api/deals/:id/deadlines ──────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];

    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
    if (!deal) throw createError('Deal not found or access denied', 404);

    let deadlines = await prisma.deadline.findMany({
      where: { dealId, organizationId: orgId },
      include: { clause: true },
      orderBy: { computedDate: 'asc' },
    });

    if (deadlines.length === 0) {
      const fullDeal = await prisma.deal.findFirst({
        where: { id: dealId, organizationId: orgId },
        include: { clauses: true },
      });
      if (fullDeal && fullDeal.clauses.length > 0) {
        const baseDate = fullDeal.acceptanceDate ?? fullDeal.createdAt;
        await computeDeadlinesForDeal(dealId, baseDate, fullDeal.clauses);
        deadlines = await prisma.deadline.findMany({
          where: { dealId, organizationId: orgId },
          include: { clause: true },
          orderBy: { computedDate: 'asc' },
        });
      }
    }

    res.json(deadlines);
  }),
);

// ── PATCH /api/deals/:id/deadlines/:dId ──────────────────────────────────
router.patch(
  '/:dId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = ConfirmDeadlineSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const existing = await prisma.deadline.findFirst({
      where: { id: req.params['dId'], organizationId: orgId },
    });
    if (!existing) throw createError('Deadline not found or access denied', 404);

    const { confirmedDate, activate } = parsed.data;
    const confirmedBy = req.user?.email ?? parsed.data.confirmedBy;
    const isEdit = new Date(confirmedDate).getTime() !== existing.computedDate.getTime();
    const newStatus = activate ? 'ACTIVE' : 'CONFIRMED';

    const updated = await prisma.deadline.update({
      where: { id: req.params['dId'] },
      data: {
        confirmedDate: new Date(confirmedDate),
        confirmedBy,
        confirmedAt: new Date(),
        status: newStatus,
      },
    });

    await prisma.auditLog.create({
      data: {
        dealId: existing.dealId,
        organizationId: orgId,
        action: isEdit ? 'DEADLINE_EDITED' : 'DEADLINE_CONFIRMED',
        entityType: 'Deadline',
        entityId: existing.id,
        previousValue: { label: existing.label, computedDate: existing.computedDate, status: existing.status },
        newValue: { label: existing.label, confirmedDate, status: newStatus, confirmedBy },
        actor: confirmedBy ?? 'system',
      },
    });

    if (isEdit) {
      await resetDeadlineAlertWindows(existing.id);
    }

    // If activating, schedule alerts (stub)
    if (activate) {
      await scheduleAlerts(existing.dealId);
      await prisma.auditLog.create({
        data: {
          dealId: existing.dealId,
          organizationId: orgId,
          action: 'DEADLINE_ACTIVATED',
          entityType: 'Deadline',
          entityId: existing.id,
          newValue: { label: existing.label, confirmedDate: updated.confirmedDate },
          actor: confirmedBy ?? 'system',
        },
      });
    }

    res.json(updated);
  }),
);

export default router;
