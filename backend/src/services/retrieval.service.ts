// ─────────────────────────────────────────────────────────────────────────────
// Retrieval Service — Hybrid RAG with Tenant Pre-Filtering & Token-Budget Context Building
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../utils/prisma.js';
import { generateEmbedding, cosineSimilarity } from './embedding.service.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';
import type { Document } from '@prisma/client';
import { requireOrgId } from '../utils/tenant.js';


export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentName: string;
  docType: string;
  pageNumber: number;
  sectionTitle: string | null;
  content: string;
  tokenCount: number;
  source: 'text' | 'ocr';
  score?: number;
}

export interface RetrievalResult {
  mode: 'full_context' | 'hybrid_retrieval';
  chunks: RetrievedChunk[];
  totalTokens: number;
  documentsIncluded: string[];
}

/**
 * Retrieves the most relevant document chunks for answering a query.
 * Enforces TENANT PRE-FILTERING before similarity scoring.
 */
export async function retrieveRelevantChunks(params: {
  dealId: string;
  organizationId: string;
  query: string;
  documents: Document[];
}): Promise<RetrievalResult> {
  const { dealId, query, documents } = params;
  const organizationId = requireOrgId(params.organizationId);
  const fullContextBudget = parseInt(process.env['ASSISTANT_FULL_CONTEXT_TOKENS'] ?? '120000', 10);
  const topK = parseInt(process.env['ASSISTANT_TOP_K'] ?? '6', 10);

  // 1. Tenant Verification
  const deal = await prisma.deal.findFirst({
    where: {
      id: dealId,
      organizationId,
    },
  });

  if (!deal) {
    throw createError('Deal not found or access denied', 404);
  }

  // 2. Fetch chunks scoped strictly by dealId and organizationId
  const allDbChunks = await prisma.documentChunk.findMany({
    where: {
      dealId,
      organizationId,
    },
    orderBy: [{ documentId: 'asc' }, { pageNumber: 'asc' }, { chunkIndex: 'asc' }],
  });

  const docMap = new Map(documents.map((d) => [d.id, d]));

  const allChunks: RetrievedChunk[] = allDbChunks.map((c) => {
    const doc = docMap.get(c.documentId);
    return {
      id: c.id,
      documentId: c.documentId,
      documentName: doc?.filename ?? 'Document',
      docType: doc?.docType ?? 'OTHER',
      pageNumber: c.pageNumber,
      sectionTitle: c.sectionTitle,
      content: c.content,
      tokenCount: c.tokenCount ?? Math.ceil(c.content.length / 4),
      source: c.source === 'ocr' ? 'ocr' : 'text',
    };
  });

  const totalDealTokens = allChunks.reduce((acc, c) => acc + c.tokenCount, 0);

  // ── Mode 1: Full Context Injection ─────────────────────────────────────────
  if (totalDealTokens <= fullContextBudget) {
    logger.info(`[Retrieval] Deal tokens (${totalDealTokens}) within budget (${fullContextBudget}). Using full context mode.`);
    return {
      mode: 'full_context',
      chunks: allChunks,
      totalTokens: totalDealTokens,
      documentsIncluded: Array.from(new Set(allChunks.map((c) => c.documentName))),
    };
  }

  // ── Mode 2: Hybrid Retrieval (Contracts in full + Bulky docs hybrid) ────────
  logger.info(`[Retrieval] Deal tokens (${totalDealTokens}) exceed budget. Using hybrid retrieval.`);

  const coreDocTypes = new Set(['PURCHASE_AGREEMENT', 'COUNTER_OFFER', 'ADDENDUM']);
  const coreChunks = allChunks.filter((c) => coreDocTypes.has(c.docType));
  const bulkyChunks = allChunks.filter((c) => !coreDocTypes.has(c.docType));

  const queryEmbedding = await generateEmbedding(query);
  const scoredBulkyChunks: Array<{ chunk: RetrievedChunk; score: number }> = [];

  for (const chunk of bulkyChunks) {
    const dbChunk = allDbChunks.find((db) => db.id === chunk.id);
    let vectorScore = 0;

    if (dbChunk?.embedding && Array.isArray(dbChunk.embedding)) {
      vectorScore = cosineSimilarity(queryEmbedding, dbChunk.embedding as number[]);
    }

    const keywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 3);
    let keywordHits = 0;
    const lowerContent = chunk.content.toLowerCase();
    for (const kw of keywords) {
      if (lowerContent.includes(kw)) keywordHits++;
    }
    const keywordScore = Math.min(1, keywordHits * 0.2);

    const combinedScore = vectorScore * 0.7 + keywordScore * 0.3;
    scoredBulkyChunks.push({ chunk, score: combinedScore });
  }

  scoredBulkyChunks.sort((a, b) => b.score - a.score);
  const topBulky = scoredBulkyChunks.slice(0, topK).map((sc) => sc.chunk);

  const selectedChunkIds = new Set<string>(topBulky.map((c) => c.id));
  for (const bChunk of topBulky) {
    const neighborPages = allChunks.filter(
      (c) => c.documentId === bChunk.documentId && Math.abs(c.pageNumber - bChunk.pageNumber) === 1,
    );
    for (const n of neighborPages) {
      selectedChunkIds.add(n.id);
    }
  }

  const finalChunks = [
    ...coreChunks,
    ...allChunks.filter((c) => selectedChunkIds.has(c.id) && !coreDocTypes.has(c.docType)),
  ];

  const totalTokens = finalChunks.reduce((acc, c) => acc + c.tokenCount, 0);

  return {
    mode: 'hybrid_retrieval',
    chunks: finalChunks,
    totalTokens,
    documentsIncluded: Array.from(new Set(finalChunks.map((c) => c.documentName))),
  };
}
