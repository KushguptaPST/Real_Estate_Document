import { GoogleGenAI } from '@google/genai';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { extractTextFromPdf } from './pdf.service.js';
import { logger } from '../utils/logger.js';

export interface ExtractedClause {
  clauseType: string;
  rawText: string;
  pageNumber: number | null;
  numberOfDays: number | null;
  dayType: 'calendar' | 'business' | null;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

export interface ExtractionResult {
  clauses: ExtractedClause[];
  model: string;
  tokensUsed: number;
}

const ExtractedClauseSchema = z.object({
  clauseType: z.string().catch('contingency_clause'),
  rawText: z.string().catch(''),
  pageNumber: z.number().nullable().optional().catch(null),
  numberOfDays: z.number().nullable().optional().catch(null),
  dayType: z.enum(['calendar', 'business']).nullable().optional().catch(null),
  confidence: z.number().nullable().optional().catch(0.9),
  boundingBox: z.any().nullable().optional().catch(null),
});

const GeminiResponseSchema = z.object({
  clauses: z.array(ExtractedClauseSchema).catch([]),
});

const responseJsonSchema = {
  type: 'object',
  properties: {
    clauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clauseType: { type: 'string' },
          rawText: { type: 'string' },
          pageNumber: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
          numberOfDays: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
          dayType: { anyOf: [{ type: 'string', enum: ['calendar', 'business'] }, { type: 'null' }] },
          confidence: { type: 'number' },
          boundingBox: { anyOf: [{ type: 'object' }, { type: 'null' }] },
        },
        required: ['clauseType', 'rawText'],
      },
    },
  },
  required: ['clauses'],
} as const;

const EXTRACTION_PROMPT = `Analyze this real-estate purchase agreement and extract ALL contingency clauses, obligations, and deadlines (e.g., inspection, financing, loan approval, appraisal, title review, HOA documents, sale of buyer's property, hazard insurance, earnest money deposit, disclosures).

For each clause found:
1. clauseType: a short snake_case identifier (e.g. inspection_contingency, financing_contingency, appraisal_contingency, title_review).
2. rawText: the exact text passage from the contract establishing the deadline or contingency.
3. pageNumber: 1-based page number where the clause appears (if known, else null).
4. numberOfDays: the positive integer number of days stated for the deadline (e.g. 10, 14, 21, 30).
5. dayType: "calendar" or "business" (default to "calendar" if unspecified).
6. confidence: a score from 0.0 to 1.0 indicating confidence in extraction.
7. boundingBox: null.

If no qualifying contingencies exist in the contract, return {"clauses": []}. Do not invent details not present in the document.`;

/** Extract validated contingency data directly from a local PDF with Gemini. */
export async function extractClausesFromPdf(filePath: string): Promise<ExtractionResult> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const envModel = process.env['GEMINI_MODEL'] ?? 'gemini-3.6-flash';
  const candidateModels = Array.from(new Set([
    envModel,
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ].filter(Boolean) as string[]));


  const pdfTextResult = await extractTextFromPdf(filePath);
  const ai = new GoogleGenAI({ apiKey });

  logger.info(`[Gemini] Extracting contingency clauses from ${filePath} (${pdfTextResult.text.length} chars text layer)`);

  const hasTextLayer = pdfTextResult.text.trim().length > 50;
  const promptContents: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (hasTextLayer) {
    // Fast path: text layer is already extracted locally in milliseconds!
    promptContents.push({
      text: `DOCUMENT TEXT LAYER:\n${pdfTextResult.text.slice(0, 50000)}`,
    });
  } else {
    // Scanned image fallback: read base64 binary for multimodal vision OCR
    const pdfData = await readFile(filePath, { encoding: 'base64' });
    promptContents.push({
      inlineData: { mimeType: 'application/pdf', data: pdfData },
    });
  }

  promptContents.push({ text: EXTRACTION_PROMPT });

  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      logger.info(`[Gemini] Attempting extraction with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: promptContents,
        config: { responseMimeType: 'application/json', responseJsonSchema, temperature: 0 },
      });

      if (!response.text) throw new Error('Gemini returned no extraction result');

      const cleanedText = response.text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      const rawParsed = JSON.parse(cleanedText);
      const parsed = GeminiResponseSchema.parse(rawParsed);

      const sanitizedClauses: ExtractedClause[] = parsed.clauses.map((c) => ({
        clauseType: (c.clauseType || 'contingency_clause').toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        rawText: c.rawText || 'Contingency clause',
        pageNumber: typeof c.pageNumber === 'number' && c.pageNumber > 0 ? c.pageNumber : null,
        numberOfDays: typeof c.numberOfDays === 'number' && c.numberOfDays > 0 ? c.numberOfDays : null,
        dayType: c.dayType === 'business' ? 'business' : (c.numberOfDays ? 'calendar' : null),
        confidence: typeof c.confidence === 'number' ? Math.min(1, Math.max(0, c.confidence)) : 0.9,
        boundingBox: null,
      }));

      const tokensUsed = response.usageMetadata?.totalTokenCount ?? 0;
      logger.info(`[Gemini] Extracted ${sanitizedClauses.length} contingency clauses using ${model}`);
      return { clauses: sanitizedClauses, model, tokensUsed };
    } catch (err: unknown) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn(`[Gemini] Model ${model} failed (${errMsg.slice(0, 120)}), trying next candidate model...`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
