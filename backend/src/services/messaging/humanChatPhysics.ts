/**
 * Human Chat Physics & Conversational Cadence Engine
 *
 * Implements Section 12 from AI_VOICE_AGENT_AND_OUTBOUND_CALLING_PLAN.md:
 * - 12.1 Micro-Bubble Delivery: Splits bulk paragraphs into 2-3 natural bubbles
 * - 12.2 The Tennis Volley Rule: Strictly ONE low-friction question per turn
 * - Dynamic Human Typing Simulation: Realistic typing speed (45ms per character)
 * - 12.5 Night-Owl Etiquette: Suppresses late night pings (10:00 PM - 08:00 AM)
 */

export interface ChatBubble {
  text: string;
  typingDelayMs: number;
}

/**
 * Splits response text into natural conversational micro-bubbles.
 * Standard bots dump a 200-word essay at once. Real advisors send 2-3 short bubbles.
 */
export function chunkMessageBubbles(rawText: string): string[] {
  if (!rawText) return [];

  // Clean markdown headers and list formatting
  const clean = rawText
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .trim();

  // Split on double newlines or paragraph breaks first
  const rawParagraphs = clean
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rawParagraphs.length >= 2 && rawParagraphs.length <= 4) {
    return rawParagraphs;
  }

  // If it's a single block of text, split on sentence boundaries
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 2) {
    return [clean];
  }

  // Combine into 2 or 3 natural bubbles:
  // Bubble 1: Acknowledge & Greeting
  // Bubble 2: Core Insight & Value / Property details
  // Bubble 3: Call to Action / Site Visit Volley
  const bubbles: string[] = [];

  if (sentences.length === 3) {
    return sentences;
  }

  if (sentences.length >= 4) {
    // Bubble 1: First sentence
    bubbles.push(sentences[0]!);

    // Bubble 2: Middle sentences (up to 2)
    bubbles.push(sentences.slice(1, sentences.length - 1).join(' '));

    // Bubble 3: Last closing sentence (often the question / CTA)
    bubbles.push(sentences[sentences.length - 1]!);
    return bubbles;
  }

  return [clean];
}

/**
 * Enforces The Tennis Volley Rule (12.2):
 * Never interrogate the buyer. Keep strictly ONE question mark across the bubbles.
 * Any earlier questions are rewritten into statements.
 */
export function enforceTennisVolleyRule(bubbles: string[]): string[] {
  if (bubbles.length <= 1) return bubbles;

  const result: string[] = [];
  const questionCount = bubbles.reduce((acc, b) => acc + (b.includes('?') ? 1 : 0), 0);

  if (questionCount <= 1) {
    return bubbles;
  }

  // If multiple questions exist, soften the earlier ones into statements and preserve the final volley question
  let remainingQuestions = questionCount;

  for (let i = 0; i < bubbles.length; i++) {
    let bubble = bubbles[i]!;

    if (bubble.includes('?') && remainingQuestions > 1) {
      // Soften earlier questions into open statements
      bubble = bubble
        .replace(/can you tell me if you are looking for (.*?)\?/i, 'Let me know if you are looking for $1.')
        .replace(/are you looking for (.*?)\?/i, 'whether you prefer $1.')
        .replace(/would you prefer (.*?)\?/i, 'if you prefer $1.')
        .replace(/\?/g, '.');

      remainingQuestions--;
    }

    result.push(bubble);
  }

  return result;
}

/**
 * Calculates human typing simulation delay.
 * Dynamic formula: max(1.2s, min(chars * 0.045s, 3.8s))
 */
export function calculateTypingDelayMs(bubbleText: string): number {
  if (!bubbleText) return 1000;
  const chars = bubbleText.length;
  return Math.round(Math.max(1200, Math.min(chars * 45, 3800)));
}

/**
 * Prepares conversational payload broken down into micro-bubbles with typing delays.
 */
export function prepareConversationalBubbles(replyText: string): ChatBubble[] {
  const rawBubbles = chunkMessageBubbles(replyText);
  const compliantBubbles = enforceTennisVolleyRule(rawBubbles);

  return compliantBubbles.map((text) => ({
    text,
    typingDelayMs: calculateTypingDelayMs(text),
  }));
}

/**
 * Checks if the given time falls in the Night-Owl window (10:00 PM to 08:00 AM).
 */
export function isNightOwlWindow(date: Date = new Date()): boolean {
  const hour = date.getHours();
  // 22:00 (10 PM) through 07:59 (8 AM)
  return hour >= 22 || hour < 8;
}

/**
 * Returns the polite Night-Owl acknowledgment message for late night leads.
 */
export function getNightOwlAcknowledgment(leadName?: string): string {
  const nameGreeting = leadName ? ` ${leadName}` : '';
  return `Hey${nameGreeting}! 👋 Saw your inquiry. It's a bit late, so I won't disturb you tonight. I'll pull up the verified floor plans and pricing first thing tomorrow morning around 10:00 AM!`;
}
