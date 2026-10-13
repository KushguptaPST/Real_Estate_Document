/**
 * /api/deals/:id/documents — PDF upload + list with Tenant Isolation
 */

import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { uploadMiddleware } from '../../middleware/upload.js';
import { storeFile, getSignedDocumentUrl } from '../../services/storage.service.js';
import { extractClausesFromPdf } from '../../services/ai.service.js';
import { computeDeadlinesForDeal } from '../../services/deadline.service.js';
import { extractTransactionTasksFromPdf } from '../../services/transactionTask.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

const router = Router({ mergeParams: true });


// ── GET /api/deals/:id/documents ──────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];

    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
    if (!deal) throw createError('Deal not found or access denied', 404);

    const docs = await prisma.document.findMany({
      where: { dealId, organizationId: orgId },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json(docs);
  }),
);

// ── POST /api/deals/:id/documents ─────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  uploadMiddleware.single('file'),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const file = req.file;
    if (!file) throw createError('No file uploaded', 400);

    // Verify deal exists and belongs to tenant
    const deal = await prisma.deal.findFirst({ where: { id: dealId, organizationId: orgId } });
    if (!deal) throw createError('Deal not found or access denied', 404);

    // Store file
    const { storagePath } = await storeFile(file.path, file.originalname);

    // Persist document record with organizationId
    const document = await prisma.document.create({
      data: {
        dealId,
        organizationId: orgId,
        filename: file.originalname,
        storagePath,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    // Log upload
    await prisma.auditLog.create({
      data: {
        dealId,
        organizationId: orgId,
        action: 'DOCUMENT_UPLOADED',
        entityType: 'Document',
        entityId: document.id,
        actor: req.user?.email ?? 'system',
        newValue: { filename: file.originalname, sizeBytes: file.size },
      },
    });

    // ── Gemini extraction pipeline ───────────────────────────────────────
    logger.info(`[Pipeline] Starting extraction for document ${document.id}`);

    await prisma.auditLog.create({
      data: { dealId, organizationId: orgId, action: 'EXTRACTION_STARTED', entityType: 'Document', entityId: document.id, actor: 'system' },
    });

    const extraction = await extractClausesFromPdf(file.path);
    const clauses = await Promise.all(
      extraction.clauses.map((clause) =>
        prisma.contingencyClause.create({
          data: {
            dealId,
            documentId: document.id,
            organizationId: orgId,
            clauseType: clause.clauseType,
            rawText: clause.rawText,
            pageNumber: clause.pageNumber,
            numberOfDays: clause.numberOfDays,
            dayType: clause.dayType,
            confidence: clause.confidence,
            ...(clause.boundingBox ? { boundingBox: clause.boundingBox } : {}),
          },
        }),
      ),
    );

    const baseAcceptanceDate = deal.acceptanceDate ?? new Date();
    const deadlines = await computeDeadlinesForDeal(dealId, baseAcceptanceDate, clauses, orgId);

    // Extract non-contingency milestone tasks into TaskProposal queue
    await extractTransactionTasksFromPdf(file.path, dealId, document.id, orgId).catch((err) => {
      logger.warn(`[Pipeline] Task extraction failed: ${err.message}`);
    });

    await prisma.auditLog.create({
      data: {
        dealId,
        organizationId: orgId,
        action: 'EXTRACTION_COMPLETED',
        entityType: 'Document',
        entityId: document.id,
        actor: 'system',
        newValue: { clauses: clauses.length, deadlines: deadlines.length, model: extraction.model },
      },
    });

    // ── Background Page-Level Indexing for AI Assistant ──────────────────
    (async () => {
      try {
        await prisma.document.update({
          where: { id: document.id },
          data: { indexStatus: 'INDEXING' },
        });

        const { extractPagesFromPdf } = await import('../../services/pdf.service.js');
        const { classifyDocument } = await import('../../services/docClassifier.service.js');
        const { chunkDocumentPages } = await import('../../services/chunk.service.js');
        const { generateEmbedding } = await import('../../services/embedding.service.js');

        const pages = await extractPagesFromPdf(file.path);
        const sampleText = pages.map((p) => p.text).join('\n').slice(0, 10000);
        const classification = await classifyDocument({ filename: file.originalname, sampleText });
        const chunks = chunkDocumentPages(pages);

        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk.content);
          await prisma.documentChunk.create({
            data: {
              documentId: document.id,
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
          where: { id: document.id },
          data: {
            docType: classification.docType,
            effectiveDate: classification.effectiveDate,
            pageCount: pages.length,
            indexStatus: 'READY',
            indexedAt: new Date(),
          },
        });

        if (classification.effectiveDate && (classification.docType === 'PURCHASE_AGREEMENT' || !deal.acceptanceDate)) {
          await prisma.deal.update({
            where: { id: dealId },
            data: { acceptanceDate: classification.effectiveDate },
          });
          const allClauses = await prisma.contingencyClause.findMany({ where: { dealId, organizationId: orgId } });
          await computeDeadlinesForDeal(dealId, classification.effectiveDate, allClauses, orgId);
        }

        await prisma.auditLog.create({
          data: {
            dealId,
            organizationId: orgId,
            action: 'DOCUMENT_INDEXED',
            entityType: 'Document',
            entityId: document.id,
            actor: 'system',
            newValue: {
              docType: classification.docType,
              pagesCount: pages.length,
              chunksCount: chunks.length,
            },
          },
        });
        logger.info(`[Pipeline] Indexed document ${document.id}: ${chunks.length} chunks across ${pages.length} pages`);
      } catch (indexErr) {
        logger.error(`[Pipeline] Indexing failed for document ${document.id}: ${(indexErr as Error).message}`);
        await prisma.document.update({
          where: { id: document.id },
          data: { indexStatus: 'FAILED' },
        }).catch(() => {});
      }
    })();

    res.status(201).json({
      document,
      extractedClauses: clauses.length,
      computedDeadlines: deadlines.length,
      message: 'Document uploaded, contingency extraction completed, indexing in progress.',
    });
  }),
);

// ── GET /api/deals/:id/documents/:docId/url ────────────────────────────────
router.get(
  '/:docId/url',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { id: dealId, docId } = req.params;

    const document = await prisma.document.findFirst({ where: { id: docId, dealId, organizationId: orgId } });
    if (!document) throw createError('Document not found or access denied', 404);

    const url = getSignedDocumentUrl(document.storagePath);
    res.json({ url, expiresInSeconds: 900 });
  }),
);

// ── GET /api/deals/:id/documents/:docId/file ───────────────────────────────
router.get(
  '/:docId/file',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { id: dealId, docId } = req.params;

    const document = await prisma.document.findFirst({ where: { id: docId, dealId, organizationId: orgId } });
    if (!document) throw createError('Document not found or access denied', 404);

    const { readFile } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');
    const path = await import('node:path');

    if (document.storagePath.startsWith('http://') || document.storagePath.startsWith('https://')) {
      const signedUrl = getSignedDocumentUrl(document.storagePath);
      const remoteRes = await fetch(signedUrl);
      if (!remoteRes.ok) throw createError('Failed to fetch remote document from storage', remoteRes.status);
      const arrayBuffer = await remoteRes.arrayBuffer();
      res.setHeader('Content-Type', document.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
      res.send(Buffer.from(arrayBuffer));
      return;
    }

    const resolvedPath = path.resolve(document.storagePath);
    if (!existsSync(resolvedPath)) {
      throw createError('Document file not found on local disk', 404);
    }

    const fileBuffer = await readFile(resolvedPath);
    res.setHeader('Content-Type', document.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`);
    res.send(fileBuffer);
  }),
);

export default router;
