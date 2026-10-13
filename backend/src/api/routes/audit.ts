/**
 * /api/deals/:id/audit — Immutable audit log for a deal with Tenant Isolation
 *
 * GET /api/deals/:id/audit  → paginated audit log entries
 */

import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router({ mergeParams: true });


router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const page = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt((req.query['limit'] as string) ?? '50', 10) || 50));

    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
    if (!deal) throw createError('Deal not found or access denied', 404);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { dealId, organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where: { dealId, organizationId: orgId } }),
    ]);

    res.json({
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }),
);

export default router;
