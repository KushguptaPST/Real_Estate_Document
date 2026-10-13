/**
 * /api/deals — CRUD for Deals (purchase agreements) with Tenant Isolation
 */

import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { auditFieldChanges } from '../../utils/audit.js';

const router = Router();


// ── Validation schemas ─────────────────────────────────────────────────────

const CreateDealSchema = z.object({
  propertyAddress: z.string().min(1),
  buyerName: z.string().optional(),
  sellerName: z.string().optional(),
  acceptanceDate: z.string().date().optional(), // ISO 8601
});

const PatchDealSchema = CreateDealSchema.partial().extend({
  status: z.enum(['ACTIVE', 'CLOSED', 'CANCELLED']).optional(),
});

// ── GET /api/deals ────────────────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const deals = await prisma.deal.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deadlines: true } } },
    });
    res.json(deals);
  }),
);

// ── POST /api/deals ───────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = CreateDealSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const orgId = req.user!.organizationId;
    const { propertyAddress, buyerName, sellerName, acceptanceDate } = parsed.data;

    const deal = await prisma.deal.create({
      data: {
        organizationId: orgId,
        propertyAddress,
        buyerName,
        sellerName,
        acceptanceDate: acceptanceDate ? new Date(acceptanceDate) : undefined,
        auditLogs: {
          create: {
            organizationId: orgId,
            action: 'DEAL_CREATED',
            entityType: 'Deal',
            actor: req.user?.email ?? 'system',
            newValue: { propertyAddress },
          },
        },
      },
    });
    res.status(201).json(deal);
  }),
);

// ── GET /api/deals/:id ────────────────────────────────────────────────────
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const deal = await prisma.deal.findFirst({
      where: { id: req.params['id'], organizationId: orgId },
      include: {
        documents: true,
        deadlines: { include: { clause: true }, orderBy: { computedDate: 'asc' } },
        clauses: true,
      },
    });
    if (!deal) throw createError('Deal not found', 404);
    res.json(deal);
  }),
);

// ── PATCH /api/deals/:id ──────────────────────────────────────────────────
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = PatchDealSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const orgId = req.user!.organizationId;
    const existing = await prisma.deal.findFirst({
      where: { id: req.params['id'], organizationId: orgId },
    });
    if (!existing) throw createError('Deal not found', 404);

    const updated = await prisma.deal.update({
      where: { id: req.params['id'] },
      data: {
        ...parsed.data,
        acceptanceDate: parsed.data.acceptanceDate ? new Date(parsed.data.acceptanceDate) : undefined,
        auditLogs: {
          create: {
            organizationId: orgId,
            action: 'DEAL_UPDATED',
            entityType: 'Deal',
            actor: req.user?.email ?? 'system',
            ...auditFieldChanges(existing, parsed.data, ['buyerName', 'sellerName']),
          },
        },
      },
    });
    res.json(updated);
  }),
);

export default router;
