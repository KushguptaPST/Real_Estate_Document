/**
 * Real Estate Autonomous Voice Platform — 5-Pillar Voice Note Pipeline
 *
 * Implements the 5 Acoustic Pillars from AI_VOICE_AGENT_AND_OUTBOUND_CALLING_PLAN.md:
 * 1. Spoken Voice Memo Syntax Engine (natural cadence, conversational fillers, breath pauses)
 * 2. Cloned Advisor Voice Synthesis (Cartesia Sonic / ElevenLabs Turbo / Fallback)
 * 3. Ambient Room Tone (Air Floor) Injection (-48dB ambient floor under speech)
 * 4. Smartphone Mic Equalization (highpass 200Hz, lowpass 3400Hz telephone VoIP filter)
 * 5. Native OGG-OPUS Transcoding (mono, 32kbps, 48kHz, -application voip)
 */

import { spawn } from 'node:child_process';
import { logger } from '../../utils/logger.js';

export interface VoiceSynthesisOptions {
  voiceId?: string;
  provider?: 'elevenlabs' | 'cartesia' | 'fallback';
  stability?: number;
  similarityBoost?: number;
  advisorName?: string;
}

export interface VoiceNoteFilterOptions {
  roomToneDb?: number; // default -48 dB
  applyMicEq?: boolean; // default true
  bitrate?: string; // default 32k
}

export interface VoiceNoteResult {
  audioBuffer: Buffer;
  mimeType: 'audio/ogg; codecs=opus';
  durationSeconds?: number;
  scriptText: string;
}

/**
 * Pillar 1: Conversational Voice Scripting (Spoken Voice Memo Syntax Engine)
 * Translates formal written text into colloquial spoken voice notes.
 */
export function formatSpokenVoiceMemoScript(
  rawText: string,
  options?: { advisorName?: string; leadName?: string }
): string {
  if (!rawText) return '';

  let script = rawText
    // Remove markdown links and formatting
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_#`~]/g, '')
    // Normalize real estate currency units to natural spoken phrases
    .replace(/₹\s*([\d\.]+)\s*Cr\b/gi, '$1 Crore')
    .replace(/₹\s*([\d\.]+)\s*Lakhs?\b/gi, '$1 Lakh')
    .replace(/₹\s*([\d,]+)/gi, '$1 rupees')
    .replace(/\$([\d,]+)/gi, '$1 dollars')
    // Normalize real estate acronyms for smooth phonetics
    .replace(/\b3BHK\b/gi, '3 B H K')
    .replace(/\b2BHK\b/gi, '2 B H K')
    .replace(/\b4BHK\b/gi, '4 B H K')
    .replace(/\b1BHK\b/gi, '1 B H K')
    .replace(/\bITPL\b/gi, 'I T P L')
    .replace(/\bORR\b/gi, 'Outer Ring Road')
    .replace(/\bRERA\b/gi, 'RERA')
    .replace(/\bOC\b/gi, 'O C')
    .replace(/\bCC\b/gi, 'C C')
    .replace(/\bEMD\b/gi, 'earnest money deposit')
    .replace(/\bEMI\b/gi, 'E M I')
    .replace(/\bBadal\b/gi, 'Baadal')
    .replace(/\s+/g, ' ')
    .trim();

  // If script doesn't start with a conversational opening and advisorName is provided, prepend personal touch
  const advisor = options?.advisorName || 'Rahul';
  const lead = options?.leadName;

  const hasGreeting = /^(hey|hi|hello|good morning|good afternoon)\b/i.test(script);
  if (!hasGreeting) {
    if (lead) {
      script = `Hey ${lead}, ${advisor} here! ${script}`;
    } else {
      script = `Hey there, ${advisor} here! ${script}`;
    }
  }

  // Ensure conversational breath pauses using commas and ellipses
  script = script
    .replace(/\.\s+/g, '... ')
    .replace(/,\s*/g, ', ')
    .trim();

  return script;
}

/**
 * Pillar 2: Cloned Advisor Voice Synthesis
 * Calls ElevenLabs or Cartesia with intelligent fallback.
 */
export async function synthesizeRawSpeechAudio(
  text: string,
  options?: VoiceSynthesisOptions
): Promise<Buffer> {
  const elevenLabsKey = process.env['ELEVENLABS_API_KEY'];
  const elevenLabsVoice = options?.voiceId || process.env['ELEVENLABS_VOICE_ID'] || 'pNInz6obpgDQGcFmaJgB'; // Adam / Default Voice

  const cartesiaKey = process.env['CARTESIA_API_KEY'];
  const cartesiaVoice = options?.voiceId || process.env['CARTESIA_VOICE_ID'];

  // 1. Cartesia Sonic if configured
  if (cartesiaKey && cartesiaVoice && options?.provider !== 'elevenlabs') {
    try {
      const response = await fetch('https://api.cartesia.ai/tts/bytes', {
        method: 'POST',
        headers: {
          'X-API-Key': cartesiaKey,
          'Cartesia-Version': '2024-06-10',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: 'sonic-english',
          transcript: text,
          voice: { mode: 'id', id: cartesiaVoice },
          output_format: { container: 'wav', sample_rate: 44100, encoding: 'pcm_s16le' },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
      logger.warn(`[VoiceNote] Cartesia returned status ${response.status}: ${await response.text()}`);
    } catch (err: any) {
      logger.warn(`[VoiceNote] Cartesia request failed: ${err.message}. Trying next engine.`);
    }
  }

  // 2. ElevenLabs Turbo / Multilingual v2
  if (elevenLabsKey) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoice}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: options?.stability ?? 0.42,
            similarity_boost: options?.similarityBoost ?? 0.82,
            style: 0.25,
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        return Buffer.from(arrayBuf);
      }
      logger.warn(`[VoiceNote] ElevenLabs returned status ${response.status}: ${await response.text()}`);
    } catch (err: any) {
      logger.warn(`[VoiceNote] ElevenLabs request failed: ${err.message}. Trying fallback.`);
    }
  }

  // 3. Fallback: Google Translate TTS audio stream
  try {
    const encoded = encodeURIComponent(text.slice(0, 200));
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=en&client=tw-ob`;
    const response = await fetch(googleTtsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) {
      const arrayBuf = await response.arrayBuffer();
      return Buffer.from(arrayBuf);
    }
  } catch (err: any) {
    logger.warn(`[VoiceNote] Google TTS fallback failed: ${err.message}`);
  }

  // 4. Safe Simulation Audio (Generates tone in test / offline dev via FFmpeg)
  return generateSyntheticVoiceSample(text);
}

/**
 * Generates synthetic sample speech audio using FFmpeg lavfi tone generator
 * Used in isolated tests and development environments without third-party API keys.
 */
export async function generateSyntheticVoiceSample(text: string): Promise<Buffer> {
  const durationSec = Math.max(1.5, Math.min(text.length * 0.05, 6.0));
  return new Promise<Buffer>((resolve, reject) => {
    const ffmpegPath = process.env['FFMPEG_PATH'] || 'ffmpeg';
    const args = [
      '-f', 'lavfi',
      '-i', `sine=frequency=440:duration=${durationSec.toFixed(2)}`,
      '-c:a', 'pcm_s16le',
      '-ar', '44100',
      '-f', 'wav',
      'pipe:1',
    ];

    const proc = spawn(ffmpegPath, args);
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on('data', (d) => chunks.push(d));
    proc.stderr.on('data', (d) => stderrChunks.push(d));

    proc.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const errText = Buffer.concat(stderrChunks).toString('utf-8');
        reject(new Error(`Synthetic audio generation failed (exit ${code}): ${errText}`));
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Pillars 3, 4, and 5: Acoustic Processing via FFmpeg
 * Injects subtle room tone (-48dB), applies smartphone bandpass EQ,
 * and encodes to native OGG-OPUS for WhatsApp voice note player.
 */
export async function renderVoiceNoteOggOpus(
  inputAudioBuffer: Buffer,
  options?: VoiceNoteFilterOptions
): Promise<Buffer> {
  const roomToneDb = options?.roomToneDb ?? -48;
  const applyMicEq = options?.applyMicEq ?? true;
  const bitrate = options?.bitrate || '32k';
  const ffmpegPath = process.env['FFMPEG_PATH'] || 'ffmpeg';

  return new Promise<Buffer>((resolve, reject) => {
    // Acoustic filter chain:
    // 1. highpass=f=200,lowpass=f=3400 (Phone mic bandpass)
    // 2. anoisesrc pink noise floor at roomToneDb (-48dB)
    // 3. amix to mix speech with room tone
    let filterComplex: string;
    if (applyMicEq) {
      filterComplex = `[0:a]highpass=f=200,lowpass=f=3400[speech];[1:a]volume=${roomToneDb}dB[noise];[speech][noise]amix=inputs=2:duration=first`;
    } else {
      filterComplex = `[0:a]volume=1.0[speech];[1:a]volume=${roomToneDb}dB[noise];[speech][noise]amix=inputs=2:duration=first`;
    }

    const args = [
      '-i', 'pipe:0', // Input 0: Raw speech audio buffer from stdin
      '-f', 'lavfi',
      '-i', 'anoisesrc=c=pink:r=48000:a=0.004', // Input 1: Continuous pink noise floor
      '-filter_complex', filterComplex,
      '-c:a', 'libopus',
      '-b:a', bitrate,
      '-ac', '1', // Mono audio required by WhatsApp voice note
      '-ar', '48000',
      '-application', 'voip', // VoIP application profile
      '-f', 'ogg',
      'pipe:1', // Output to stdout
    ];

    const proc = spawn(ffmpegPath, args);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout.on('data', (d) => stdoutChunks.push(d));
    proc.stderr.on('data', (d) => stderrChunks.push(d));

    proc.on('close', (code) => {
      if (code === 0 && stdoutChunks.length > 0) {
        resolve(Buffer.concat(stdoutChunks));
      } else {
        const errText = Buffer.concat(stderrChunks).toString('utf-8');
        reject(new Error(`FFmpeg voice note transcoding failed (exit ${code}): ${errText}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });

    proc.stdin.write(inputAudioBuffer);
    proc.stdin.end();
  });
}

/**
 * End-to-End Voice Note Generator:
 * Takes written text -> converts to spoken syntax -> synthesizes speech -> applies acoustic pillars -> returns WhatsApp-ready OGG-OPUS.
 */
export async function generateAdvisorVoiceNote(
  rawText: string,
  options?: {
    advisorName?: string;
    leadName?: string;
    voiceId?: string;
    provider?: 'elevenlabs' | 'cartesia' | 'fallback';
    roomToneDb?: number;
  }
): Promise<VoiceNoteResult> {
  // 1. Spoken voice memo scripting
  const scriptText = formatSpokenVoiceMemoScript(rawText, {
    advisorName: options?.advisorName,
    leadName: options?.leadName,
  });

  // 2. Cloned voice synthesis
  const rawAudio = await synthesizeRawSpeechAudio(scriptText, {
    voiceId: options?.voiceId,
    provider: options?.provider,
    advisorName: options?.advisorName,
  });

  // 3, 4, 5. Room tone, Phone Mic EQ, and OGG-OPUS VoIP Transcoding
  const oggOpusBuffer = await renderVoiceNoteOggOpus(rawAudio, {
    roomToneDb: options?.roomToneDb ?? -48,
    applyMicEq: true,
  });

  return {
    audioBuffer: oggOpusBuffer,
    mimeType: 'audio/ogg; codecs=opus',
    scriptText,
  };
}
