import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface ExtractedDeadline {
  clause_type: string;
  number_of_days: number;
  day_type: 'business' | 'calendar';
  reference_point: string;
  source_text: string;
  confidence: 'high' | 'low';
}

export interface ExtractionResult {
  acceptance_date: string;
  deadlines: ExtractedDeadline[];
}

const SYSTEM_PROMPT = `You are a real estate contract analyst. Extract contingency
deadlines from purchase agreements. For each deadline found, return:
- clause_type (e.g. "inspection", "loan", "appraisal", "close_of_escrow")
- number_of_days (integer)
- day_type ("business" or "calendar" - assume "calendar" unless explicitly stated as "business days")
- reference_point (usually "acceptance_date")
- source_text (the exact sentence from the contract that states this deadline)
- confidence ("high" or "low" - use "low" if the language is ambiguous)

Also extract:
- acceptance_date (the date the agreement was accepted, in YYYY-MM-DD format)

Return ONLY valid JSON, no other text, in this shape:
{
  "acceptance_date": "YYYY-MM-DD",
  "deadlines": [
    {
      "clause_type": "...",
      "number_of_days": 0,
      "day_type": "...",
      "reference_point": "...",
      "source_text": "...",
      "confidence": "..."
    }
  ]
}`;

export async function extractDeadlines(contractText: string): Promise<ExtractionResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: contractText }],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return JSON.parse(textBlock.text) as ExtractionResult;
}