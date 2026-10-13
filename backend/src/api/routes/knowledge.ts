// ─────────────────────────────────────────────────────────────────────────────
// /api/knowledge — Multi-Document Portfolio & Organization Grounded Knowledge Base
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';
import { askPortfolioAssistant } from '../../services/assistant.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();


const PortfolioAskSchema = z.object({
  question: z.string().min(2, 'Question is too short').max(2000, 'Question exceeds 2,000 characters'),
});

// ── POST /api/knowledge/ask (Portfolio & Policy Grounded Q&A) ─────────────────
router.post(
  '/ask',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const parsed = PortfolioAskSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const result = await askPortfolioAssistant({
      question: parsed.data.question,
      organizationId: orgId,
      actorEmail: req.user?.email,
    });

    res.json(result);
  }),
);

// ── GET /api/knowledge/documents (List Indexed Documents across Portfolio) ───
router.get(
  '/documents',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const docs = await prisma.document.findMany({
      where: { organizationId: orgId },
      orderBy: { uploadedAt: 'desc' },
      take: 50,
      include: {
        deal: { select: { propertyAddress: true } },
        _count: { select: { chunks: true } },
      },
    });

    res.json(
      docs.map((d) => ({
        id: d.id,
        dealId: d.dealId,
        propertyAddress: d.deal?.propertyAddress ?? 'Unassigned Deal',
        filename: d.filename,
        docType: d.docType,
        indexStatus: d.indexStatus,
        chunkCount: d._count.chunks,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
    );
  }),
);

export default router;
