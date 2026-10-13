// ─────────────────────────────────────────────────────────────────────────────
// /api/deals/:id/assistant — AI Knowledge Assistant API Routes with Tenant Scoping
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';
import {
  askDealAssistant,
  getDealSuggestions,
  getDealSummary,
} from '../../services/assistant.service.js';
import { extractPagesFromPdf } from '../../services/pdf.service.js';
import { chunkDocumentPages } from '../../services/chunk.service.js';
import { classifyDocument } from '../../services/docClassifier.service.js';
import { generateEmbedding } from '../../services/embedding.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router = Router({ mergeParams: true });


// Rate limiting in-memory map
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env['ASSISTANT_RATE_LIMIT'] ?? '30', 10);

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) return false;
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
}

const AskInputSchema = z.object({
  question: z.string().min(2, 'Question is too short').max(2000, 'Question exceeds 2,000 characters'),
  conversationId: z.string().optional(),
});

// ── POST /api/deals/:id/assistant/ask ─────────────────────────────────────────
router.post(
  '/ask',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const actorEmail = req.user?.email ?? 'system';
    const rateLimitKey = `${orgId}:${dealId}:${actorEmail}`;

    if (!checkRateLimit(rateLimitKey)) {
      throw createError('Assistant rate limit exceeded. Please wait a moment.', 429);
    }

    const { question, conversationId } = AskInputSchema.parse(req.body);

    const isSse = req.headers.accept?.includes('text/event-stream') || req.query['stream'] === 'true';

    if (isSse) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const sendSse = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await askDealAssistant({
          dealId,
          organizationId: orgId,
          question,
          conversationId,
          userId: req.user?.id,
          actorEmail,
          onStatusUpdate: (stage, message) => {
            sendSse('status', { stage, message });
          },
        });

        sendSse('answer', result);
        sendSse('done', {});
        res.end();
      } catch (err) {
        logger.error(`[Assistant SSE Error] ${(err as Error).message}`);
        const safe = (err as { isOperational?: boolean }).isOperational ? (err as Error).message : 'Assistant request failed';
        sendSse('error', { message: safe });
        res.end();
      }
      return;
    }

    const result = await askDealAssistant({
      dealId,
      organizationId: orgId,
      question,
      conversationId,
      userId: req.user?.id,
      actorEmail,
    });

    res.json(result);
  }),
);

// ── GET /api/deals/:id/assistant/suggestions ──────────────────────────────────
router.get(
  '/suggestions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const suggestions = await getDealSuggestions(dealId, orgId);
    res.json({ suggestions });
  }),
);

// ── GET /api/deals/:id/assistant/summary ──────────────────────────────────────
router.get(
  '/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const summary = await getDealSummary(dealId, orgId);
    res.json(summary);
  }),
);

// ── GET /api/deals/:id/assistant/conversations ────────────────────────────────
router.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const conversations = await prisma.assistantConversation.findMany({
      where: { dealId, organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    res.json(conversations);
  }),
);

// ── GET /api/deals/:id/assistant/conversations/:cid ───────────────────────────
router.get(
  '/conversations/:cid',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { id: dealId, cid } = req.params;
    const conversation = await prisma.assistantConversation.findFirst({
      where: { id: cid, dealId, organizationId: orgId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw createError('Conversation not found', 404);
    res.json(conversation);
  }),
);

// ── GET /api/deals/:id/assistant/index-status ─────────────────────────────────
router.get(
  '/index-status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];

    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
    if (!deal) throw createError('Deal not found or access denied', 404);

    const documents = await prisma.document.findMany({
      where: { dealId, organizationId: orgId },
      include: { _count: { select: { chunks: true } } },
    });

    const totalCount = documents.length;
    const indexedCount = documents.filter((d) => d.indexStatus === 'READY').length;
    const isAllReady = totalCount > 0 && indexedCount === totalCount;
    const isAnyIndexing = documents.some((d) => d.indexStatus === 'INDEXING');

    res.json({
      dealId,
      status: isAllReady ? 'READY' : isAnyIndexing ? 'INDEXING' : totalCount === 0 ? 'READY' : 'PENDING',
      indexedCount,
      totalCount,
      documents: documents.map((d) => ({
        id: d.id,
        filename: d.filename,
        docType: d.docType,
        indexStatus: d.indexStatus,
        pageCount: d.pageCount,
        chunkCount: d._count.chunks,
      })),
    });
  }),
);

// ── POST /api/deals/:id/assistant/reindex ──────────────────────────────────────
router.post(
  '/reindex',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];

    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
    if (!deal) throw createError('Deal not found or access denied', 404);

    const documents = await prisma.document.findMany({ where: { dealId, organizationId: orgId } });

    (async () => {
      for (const doc of documents) {
        try {
          await prisma.document.update({
            where: { id: doc.id },
            data: { indexStatus: 'INDEXING' },
          });

          await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });

          const pages = await extractPagesFromPdf(doc.storagePath);
          const sampleText = pages.map((p) => p.text).join('\n').slice(0, 10000);
          const classification = await classifyDocument({ filename: doc.filename, sampleText });
          const chunks = chunkDocumentPages(pages);

          for (const chunk of chunks) {
            const embedding = await generateEmbedding(chunk.content);
            await prisma.documentChunk.create({
              data: {
                documentId: doc.id,
                dealId,
                organizationId: orgId,
                pageNumber: chunk.pageNumber,
                chunkIndex: chunk.chunkIndex,
                sectionTitle: chunk.sectionTitle,
                content: chunk.content,
                tokenCount: chunk.tokenCount,
                source: chunk.source,
                embedding: embedding as unknown as object,
              },
            });
          }

          await prisma.document.update({
            where: { id: doc.id },
            data: {
              docType: classification.docType,
              effectiveDate: classification.effectiveDate,
              pageCount: pages.length,
              indexStatus: 'READY',
              indexedAt: new Date(),
            },
          });

          await prisma.auditLog.create({
            data: {
              dealId,
              organizationId: orgId,
              action: 'DOCUMENT_INDEXED',
              entityType: 'Document',
              entityId: doc.id,
              actor: 'system',
              newValue: { docType: classification.docType, chunksCount: chunks.length, pagesCount: pages.length },
            },
          });
        } catch (err) {
          logger.error(`[Reindex] Failed for doc ${doc.id}: ${(err as Error).message}`);
          await prisma.document.update({
            where: { id: doc.id },
            data: { indexStatus: 'FAILED' },
          });
        }
      }
    })();

    res.json({ message: 'Reindexing triggered in background', documentCount: documents.length });
  }),
);

export default router;
