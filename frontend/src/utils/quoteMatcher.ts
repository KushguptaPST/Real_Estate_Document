// ─────────────────────────────────────────────────────────────────────────────
// Quote Matcher Utility
// Client-side text normalization & matching for highlighting verified quotes in PDF
// ─────────────────────────────────────────────────────────────────────────────

export interface QuoteMatchResult {
  isMatched: boolean;
  matchSnippet?: string;
  confidence: number;
}

export interface FindQuoteResult {
  matched: boolean;
  exactMatchFound: boolean;
  confidence: number;
  matchSnippet?: string;
}

/**
 * Normalizes text for matching across PDF text items:
 * - Unicode NFKC normalization
 * - Converts curly quotes / apostrophes to straight ASCII
 * - Replaces ellipsis with three dots
 * - Replaces non-breaking spaces
 * - Collapses multiple spaces and newlines
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const normalizeClientText = normalizeText;

/**
 * Finds quote in document text layer, with exact matching and fallback.
 */
export function findQuoteInText(docText: string, quote: string): FindQuoteResult {
  const normDoc = normalizeText(docText);
  const normQuote = normalizeText(quote);

  if (!normDoc || !normQuote) {
    return { matched: false, exactMatchFound: false, confidence: 0 };
  }

  if (normDoc.includes(normQuote)) {
    return { matched: true, exactMatchFound: true, confidence: 1.0, matchSnippet: quote };
  }

  if (normQuote.length > 30) {
    const subLen = Math.floor(normQuote.length * 0.7);
    const startPart = normQuote.slice(0, subLen);
    const endPart = normQuote.slice(normQuote.length - subLen);
    if (normDoc.includes(startPart) || normDoc.includes(endPart)) {
      return { matched: true, exactMatchFound: false, confidence: 0.85, matchSnippet: quote };
    }
  }

  return { matched: false, exactMatchFound: false, confidence: 0 };
}

/**
 * Checks if a target quote matches in page text, with tolerance for OCR/whitespace differences.
 */
export function findQuoteInPage(quote: string, pageText: string): QuoteMatchResult {
  const normQuote = normalizeClientText(quote);
  const normPage = normalizeClientText(pageText);

  if (!normQuote || !normPage) {
    return { isMatched: false, confidence: 0 };
  }

  if (normPage.includes(normQuote)) {
    return { isMatched: true, matchSnippet: quote, confidence: 1.0 };
  }

  // Partial tolerance for longer quotes
  if (normQuote.length > 50) {
    const subLen = Math.floor(normQuote.length * 0.7);
    const startPart = normQuote.slice(0, subLen);
    const endPart = normQuote.slice(normQuote.length - subLen);

    if (normPage.includes(startPart) || normPage.includes(endPart)) {
      return { isMatched: true, matchSnippet: quote, confidence: 0.85 };
    }
  }

  return { isMatched: false, confidence: 0 };
}

/**
 * Finds the exact continuous text item indices corresponding to the target quote or search phrase.
 * Prevents false-positive highlighting of random isolated words across the page.
 */
export function findMatchingItemIndices(
  items: Array<{ str?: string }>,
  targetQuote: string
): number[] {
  if (!items || items.length === 0 || !targetQuote || !targetQuote.trim()) return [];

  // 1. Build continuous character-to-item mapping
  let continuousText = '';
  const charToItem: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const str = items[i]?.str ?? '';
    if (str.length === 0) continue;

    if (continuousText.length > 0 && !continuousText.endsWith(' ')) {
      continuousText += ' ';
      charToItem.push(i);
    }

    for (let c = 0; c < str.length; c++) {
      continuousText += str[c];
      charToItem.push(i);
    }
  }

  const normContinuous = continuousText.toLowerCase();
  const normTarget = targetQuote.trim().toLowerCase();

  // Try exact substring match first
  let matchIdx = normContinuous.indexOf(normTarget);
  let matchLength = normTarget.length;

  // If not found, try matching first 45-60 chars of target
  if (matchIdx === -1 && normTarget.length > 30) {
    const subTarget = normTarget.slice(0, Math.min(50, normTarget.length));
    matchIdx = normContinuous.indexOf(subTarget);
    if (matchIdx !== -1) {
      matchLength = subTarget.length;
    }
  }

  // If still not found, try matching 4-word continuous sequence
  if (matchIdx === -1) {
    const words = normTarget.split(/\s+/).filter((w) => w.length > 2);
    if (words.length >= 3) {
      const phrase = words.slice(0, Math.min(5, words.length)).join(' ');
      matchIdx = normContinuous.indexOf(phrase);
      if (matchIdx !== -1) {
        matchLength = phrase.length;
      }
    }
  }

  if (matchIdx === -1 || matchLength === 0) {
    return [];
  }

  // 3. Extract only the exact items in the matched range
  const matchedItemSet = new Set<number>();
  const endIdx = Math.min(matchIdx + matchLength, charToItem.length);

  for (let c = matchIdx; c < endIdx; c++) {
    const itemIndex = charToItem[c];
    if (itemIndex !== undefined && itemIndex >= 0) {
      matchedItemSet.add(itemIndex);
    }
  }

  return Array.from(matchedItemSet);
}

