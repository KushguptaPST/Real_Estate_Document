// ─────────────────────────────────────────────────────────────────────────────
// Embedding Service
// Generates vector embeddings via Gemini text-embedding-004
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger.js';

export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    logger.warn('[Embedding] GEMINI_API_KEY missing, returning mock embedding vector');
    return new Array(768).fill(0);
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env['GEMINI_EMBEDDING_MODEL'] ?? 'gemini-embedding-001';

  try {
    const cleanText = text.slice(0, 8000).replace(/\s+/g, ' ').trim();
    if (!cleanText) return new Array(768).fill(0);

    const response = await ai.models.embedContent({
      model,
      contents: [{ text: cleanText }],
    });

    const values = response.embeddings?.[0]?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Gemini embedding returned empty vector');
    }

    return values;
  } catch (err) {
    logger.warn(`[Embedding] Failed to generate embedding: ${(err as Error).message}`);
    return new Array(768).fill(0);
  }
}

/**
 * Computes cosine similarity between two numeric vectors in code.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
