import { normalizeText, findQuoteInText } from './quoteMatcher';

describe('quoteMatcher', () => {
  test('normalizes smart quotes, ligatures, and extra spaces', () => {
    const raw = '“Buyer shall have  17 days   after acceptance…”';
    const normalized = normalizeText(raw);
    expect(normalized).toBe('"buyer shall have 17 days after acceptance..."');
  });

  test('finds exact quote in normalized text layer', () => {
    const docText = 'Paragraph 14. A. Buyer shall have 17 calendar days after acceptance to inspect property.';
    const quote = 'Buyer shall have 17 calendar days after acceptance';
    const result = findQuoteInText(docText, quote);
    expect(result.matched).toBe(true);
    expect(result.exactMatchFound).toBe(true);
  });

  test('rejects fabricated or non-existent quotes', () => {
    const docText = 'Paragraph 14. Buyer shall inspect property within 10 days.';
    const fakeQuote = 'Seller agrees to pay $50,000 credit for roof repairs at closing.';
    const result = findQuoteInText(docText, fakeQuote);
    expect(result.matched).toBe(false);
  });
});
