// ─────────────────────────────────────────────────────────────────────────────
// Citation Verifier Service
// Strict server-side quote verification against actual document chunk text.
// ─────────────────────────────────────────────────────────────────────────────

import type { Citation } from '../types/assistant.js';

export interface ChunkVerificationTarget {
  documentId: string;
  pageNumber: number;
  content: string;
  source?: 'text' | 'ocr';
}

export interface VerificationInput {
  answer: string;
  citations: Citation[];
  chunks: ChunkVerificationTarget[];
  validDeadlineIds: Set<string>;
}

export interface VerificationResult {
  verifiedAnswer: string;
  verifiedCitations: Citation[];
  hasVerifiableContent: boolean;
  droppedCitationsCount: number;
}

/**
 * Normalizes text for robust contract quote matching:
 * - Unicode NFKC normalization
 * - Converts curly quotes / apostrophes to standard straight ASCII
 * - Replaces non-breaking spaces with standard space
 * - Un-hyphenates line-break hyphenations (e.g. "inspec-\ntion" -> "inspection")
 * - Collapses multiple whitespaces & newlines into single spaces
 * - Lowercases for case-insensitive verification
 */
export function normalizeTextForMatching(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2') // un-hyphenate words broken across lines
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether candidateQuote appears verbatim (or normalized) in pageText.
 */
export function isQuotePresentOnPage(candidateQuote: string, pageText: string): boolean {
  const normQuote = normalizeTextForMatching(candidateQuote);
  if (!normQuote || normQuote.length < 5) return false;

  const normPage = normalizeTextForMatching(pageText);
  if (normPage.includes(normQuote)) return true;

  // Partial tolerance: if the quote is long (> 60 chars), check if a core 80% continuous window matches
  if (normQuote.length > 60) {
    const subLength = Math.floor(normQuote.length * 0.8);
    const startSlice = normQuote.slice(0, subLength);
    const endSlice = normQuote.slice(normQuote.length - subLength);
    if (normPage.includes(startSlice) || normPage.includes(endSlice)) {
      return true;
    }
  }

  return false;
}

/**
 * Verifies all citations against the underlying document page chunks and deadline records.
 * Ensures that fake or hallucinated citations are discarded and markdown footnotes [^n] are adjusted.
 */
export function verifyCitations(input: VerificationInput): VerificationResult {
  const { answer, citations, chunks, validDeadlineIds } = input;
  const verifiedCitations: Citation[] = [];
  const validCitationIdMap = new Map<number, number>(); // oldId -> newId

  let nextId = 1;
  let droppedCount = 0;

  for (const citation of citations) {
    if (citation.sourceType === 'deadline') {
      // Validate that deadlineId actually exists in the database
      if (citation.deadlineId && validDeadlineIds.has(citation.deadlineId)) {
        const newId = nextId++;
        validCitationIdMap.set(citation.id, newId);

        let pageNum = citation.pageNumber;
        let docId = citation.documentId;
        if (!pageNum && citation.quote) {
          const chunkMatch = chunks.find(c => isQuotePresentOnPage(citation.quote!, c.content));
          if (chunkMatch) {
            pageNum = chunkMatch.pageNumber;
            docId = docId || chunkMatch.documentId;
          }
        }

        verifiedCitations.push({
          ...citation,
          id: newId,
          pageNumber: pageNum,
          documentId: docId,
          isConfirmed: citation.isConfirmed ?? true,
        });
      } else {
        droppedCount++;
      }
      continue;
    }

    if (citation.sourceType === 'document') {
      const targetDocId = citation.documentId;
      const targetPage = citation.pageNumber;
      const quote = citation.quote ?? '';

      // Find matching chunks for this document and page
      const matchingChunks = chunks.filter(
        c => (!targetDocId || c.documentId === targetDocId) &&
             (!targetPage || c.pageNumber === targetPage),
      );

      const combinedPageText = matchingChunks.map(c => c.content).join(' ');
      const isOcrPage = matchingChunks.some(c => c.source === 'ocr');

      let isValid = false;

      if (quote && combinedPageText) {
        isValid = isQuotePresentOnPage(quote, combinedPageText);
      } else if (isOcrPage && matchingChunks.length > 0) {
        // Scanned OCR page with lower precision: allow page-level citation
        isValid = true;
      }

      if (isValid) {
        const newId = nextId++;
        validCitationIdMap.set(citation.id, newId);
        verifiedCitations.push({
          ...citation,
          id: newId,
          isOcr: isOcrPage,
        });
      } else {
        // Quote could not be verified in the actual document text
        droppedCount++;
      }
      continue;
    }

    if (citation.sourceType === 'deal') {
      const newId = nextId++;
      validCitationIdMap.set(citation.id, newId);
      verifiedCitations.push({ ...citation, id: newId });
    }
  }

  // Rewrite footnote markers [^n] in markdown to match renumbered valid citations
  let verifiedAnswer = answer.replace(/\[\^(\d+)\]/g, (match, rawNum) => {
    const oldNum = parseInt(rawNum, 10);
    const mapped = validCitationIdMap.get(oldNum);
    return mapped ? `[^${mapped}]` : '';
  });

  // Clean up any double spaces caused by removed citations
  verifiedAnswer = verifiedAnswer.replace(/\s{2,}/g, ' ').trim();

  const hasVerifiableContent = verifiedCitations.length > 0 || !answer.toLowerCase().includes('not specify');

  return {
    verifiedAnswer,
    verifiedCitations,
    hasVerifiableContent,
    droppedCitationsCount: droppedCount,
  };
}
