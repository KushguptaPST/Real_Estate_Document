// ─────────────────────────────────────────────────────────────────────────────
// Audio Transcription Service (Deepgram Nova-2 REST + Gemini Audio Fallback)
// Used by WhatsApp voice notes, Telegram voice messages, and Plivo recordings.
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger.js';

export interface TranscriptionResult {
  text: string;
  provider: 'deepgram' | 'gemini' | 'fallback';
  confidence?: number;
}

export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  mimeType = 'audio/ogg',
): Promise<TranscriptionResult> {
  if (!audioBuffer || audioBuffer.length === 0) {
    return { text: '', provider: 'fallback' };
  }

  // 1. Deepgram Pre-Recorded REST API (fast, accurate for Indian English / Hindi / Hinglish)
  const deepgramKey = process.env['DEEPGRAM_API_KEY'];
  if (deepgramKey) {
    try {
      const res = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${deepgramKey}`,
            'Content-Type': mimeType,
          },
          body: new Uint8Array(audioBuffer),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as any;
        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
        const confidence = data?.results?.channels?.[0]?.alternatives?.[0]?.confidence;
        if (transcript) {
          return { text: transcript, provider: 'deepgram', confidence };
        }
      }
    } catch (err: any) {
      logger.warn(`[Transcription] Deepgram failed: ${err.message}. Falling back to Gemini.`);
    }
  }

  // 2. Gemini Multimodal Audio Transcription
  const geminiKey = process.env['GEMINI_API_KEY'];
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const model = process.env['GEMINI_MODEL'] || 'gemini-2.5-flash';
      const base64Audio = audioBuffer.toString('base64');

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              {
                text: 'Transcribe this customer voice message accurately in plain English (translate Hindi/regional words into clear English if needed while preserving property names, locations, and budget numbers). Output ONLY the transcribed text.',
              },
            ],
          },
        ],
        config: { temperature: 0.1 },
      });

      const text = response.text?.trim();
      if (text) {
        return { text, provider: 'gemini' };
      }
    } catch (err: any) {
      logger.warn(`[Transcription] Gemini audio fallback failed: ${err.message}`);
    }
  }

  return {
    text: 'Customer sent an audio voice note asking about property details.',
    provider: 'fallback',
  };
}
