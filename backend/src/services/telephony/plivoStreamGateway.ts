// ─────────────────────────────────────────────────────────────────────────────
// Plivo Bidirectional <Stream> WebSocket Gateway
// Handles real-time mulaw 8kHz audio streaming, barge-in cancellation,
// Deepgram/Gemini STT, Agentic AI turn execution, and streaming TTS playback.
// ─────────────────────────────────────────────────────────────────────────────

import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { spawn } from 'node:child_process';
import { WebSocket, WebSocketServer } from 'ws';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { runSalesAgentLoop } from '../agent/agentRuntime.js';
import { getOrCreateLeadThread } from '../conversation.service.js';
import { transcribeAudioBuffer } from '../voice/transcription.service.js';
import { walletService } from '../billing/wallet.service.js';
import { plivoService } from './plivo.service.js';
import { getPlatformConfig, recordTtsOutcome, type TtsEngine } from '../platformConfig.service.js';
import { recordPlivoVoiceCost, recordSttCost, recordTtsCost } from '../costTracker.service.js';

interface ActiveStreamState {
  sessionId: string;
  streamId: string;
  callUuid: string;
  organizationId: string;
  leadId: string | null;
  threadId: string | null;
  isSpeaking: boolean;
  ttsAbortController: AbortController | null;
  transcriptBuffer: Array<{ speaker: 'BUYER' | 'AI'; text: string; at: string }>;
  audioAccumulator: Buffer[];
  lastVoiceFrameAt: number;
  deepgramWs: WebSocket | null;
  startedAt: number;
  processingTurn: boolean;
  transferred: boolean;
}

/**
 * Converts MP3/WAV buffer to raw 8kHz mono mu-law PCM for Plivo <Stream>.
 */
async function transcodeToMulaw8k(inputBuffer: Buffer): Promise<Buffer> {
  const ffmpegPath = process.env['FFMPEG_PATH'] || 'ffmpeg';
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-ar', '8000',
      '-ac', '1',
      '-f', 'mulaw',
      'pipe:1',
    ]);
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout.on('data', (c) => chunks.push(c));
    proc.stderr.on('data', (c) => errChunks.push(c));
    proc.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`FFmpeg mulaw transcode failed (${code}): ${Buffer.concat(errChunks).toString('utf8')}`));
      }
    });
    proc.on('error', reject);
    proc.stdin.write(inputBuffer);
    proc.stdin.end();
  });
}

/**
 * Synthesizes spoken reply and returns mu-law 8kHz audio ready to stream to Plivo.
 * Uses PlatformConfig.primaryTtsEngine with automatic consecutive-failure failover:
 * ElevenLabs Flash v2.5 native ulaw_8000 -> Cartesia Sonic -> Microsoft Edge Neural.
 */
async function synthesizeCallAudioMulaw(
  text: string,
  meta?: { organizationId: string; sessionId: string; leadId?: string | null },
): Promise<Buffer | null> {
  if (!text.trim()) return null;

  const platformCfg = await getPlatformConfig().catch(() => null);
  const primary = (platformCfg?.primaryTtsEngine as TtsEngine) || 'eleven_flash_v2_5';
  const order: TtsEngine[] =
    primary === 'edge_neural'
      ? ['edge_neural']
      : primary === 'cartesia_sonic'
      ? ['cartesia_sonic', 'edge_neural', 'eleven_flash_v2_5']
      : ['eleven_flash_v2_5', 'cartesia_sonic', 'edge_neural'];

  const elevenKey = process.env['ELEVENLABS_API_KEY'];
  const elevenVoice = process.env['ELEVENLABS_VOICE_ID'] || 'pNInz6obpgDQGcFmaJgB';
  const cartesiaKey = process.env['CARTESIA_API_KEY'];
  const cartesiaVoice = process.env['CARTESIA_VOICE_ID'];

  for (const engine of order) {
    if (engine === 'eleven_flash_v2_5') {
      if (!elevenKey) continue;
      try {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}?output_format=ulaw_8000`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenKey,
              'Content-Type': 'application/json',
              Accept: 'audio/basic',
            },
            body: JSON.stringify({
              text,
              model_id: process.env['ELEVENLABS_CALL_MODEL'] || 'eleven_flash_v2_5',
              voice_settings: {
                stability: 0.48,
                similarity_boost: 0.8,
                style: 0.2,
                use_speaker_boost: true,
              },
            }),
            signal: AbortSignal.timeout(6000),
          },
        );
        if (res.ok) {
          await recordTtsOutcome('eleven_flash_v2_5', true).catch(() => {});
          if (meta) {
            await recordTtsCost({
              organizationId: meta.organizationId,
              provider: 'ELEVENLABS_TTS',
              chars: text.length,
              callSessionId: meta.sessionId,
              leadId: meta.leadId,
            });
          }
          return Buffer.from(await res.arrayBuffer());
        }
        logger.warn(`[Plivo Stream TTS] ElevenLabs returned ${res.status}, falling back`);
        await recordTtsOutcome('eleven_flash_v2_5', false, `HTTP ${res.status}`).catch(() => {});
      } catch (err: any) {
        logger.warn(`[Plivo Stream TTS] ElevenLabs error: ${err.message}, falling back`);
        await recordTtsOutcome('eleven_flash_v2_5', false, err.message).catch(() => {});
      }
      continue;
    }

    if (engine === 'cartesia_sonic') {
      if (!cartesiaKey || !cartesiaVoice) continue;
      try {
        const res = await fetch('https://api.cartesia.ai/tts/bytes', {
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
            output_format: { container: 'raw', encoding: 'pcm_mulaw', sample_rate: 8000 },
          }),
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          await recordTtsOutcome('cartesia_sonic', true).catch(() => {});
          if (meta) {
            await recordTtsCost({
              organizationId: meta.organizationId,
              provider: 'CARTESIA_TTS',
              chars: text.length,
              callSessionId: meta.sessionId,
              leadId: meta.leadId,
            });
          }
          return Buffer.from(await res.arrayBuffer());
        }
        await recordTtsOutcome('cartesia_sonic', false, `HTTP ${res.status}`).catch(() => {});
      } catch (err: any) {
        logger.warn(`[Plivo Stream TTS] Cartesia error: ${err.message}, falling back`);
        await recordTtsOutcome('cartesia_sonic', false, err.message).catch(() => {});
      }
      continue;
    }

    if (engine === 'edge_neural') {
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(
          process.env['PLIVO_TTS_VOICE'] || 'en-IN-NeerjaExpressiveNeural',
          OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
        );
        const { audioStream } = tts.toStream(text);
        const mp3Chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          audioStream.on('data', (c: any) => mp3Chunks.push(Buffer.from(c)));
          audioStream.on('end', () => resolve());
          audioStream.on('error', reject);
        });

        if (mp3Chunks.length > 0) {
          if (meta) {
            await recordTtsCost({
              organizationId: meta.organizationId,
              provider: 'EDGE_TTS',
              chars: text.length,
              callSessionId: meta.sessionId,
              leadId: meta.leadId,
            });
          }
          return await transcodeToMulaw8k(Buffer.concat(mp3Chunks));
        }
      } catch (err: any) {
        logger.warn(`[Plivo Stream TTS] Edge TTS failed: ${err.message}`);
      }
    }
  }
  return null;
}

/**
 * Wraps raw mulaw bytes in a simple WAV header so offline/Gemini STT can decode it cleanly.
 */
function wrapMulawInWav(mulawBytes: Buffer): Buffer {
  const header = Buffer.alloc(58);
  header.write('RIFF', 0);
  header.writeUInt32LE(50 + mulawBytes.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(18, 16); // fmt chunk size
  header.writeUInt16LE(7, 20);  // format = 7 (ITU G.711 mu-law)
  header.writeUInt16LE(1, 22);  // mono
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.writeUInt16LE(0, 36);
  header.write('fact', 38);
  header.writeUInt32LE(4, 42);
  header.writeUInt32LE(mulawBytes.length, 46);
  header.write('data', 50);
  header.writeUInt32LE(mulawBytes.length, 54);
  return Buffer.concat([header, mulawBytes]);
}

function sendBargeInClear(ws: WebSocket, state: ActiveStreamState): void {
  if (!state.isSpeaking) return;
  state.isSpeaking = false;
  state.ttsAbortController?.abort();
  state.ttsAbortController = null;
  if (ws.readyState === WebSocket.OPEN && state.streamId) {
    ws.send(JSON.stringify({ event: 'clearAudio', streamId: state.streamId }));
  }
}

async function streamMulawToPlivo(ws: WebSocket, state: ActiveStreamState, mulawAudio: Buffer): Promise<void> {
  const abortController = new AbortController();
  state.ttsAbortController = abortController;
  state.isSpeaking = true;

  // Send 160-byte (20ms @ 8kHz) chunks
  const CHUNK_SIZE = 1600; // 200ms frames
  for (let offset = 0; offset < mulawAudio.length; offset += CHUNK_SIZE) {
    if (abortController.signal.aborted || ws.readyState !== WebSocket.OPEN) {
      break;
    }
    const slice = mulawAudio.subarray(offset, Math.min(offset + CHUNK_SIZE, mulawAudio.length));
    ws.send(
      JSON.stringify({
        event: 'playAudio',
        media: {
          contentType: 'audio/x-mulaw',
          sampleRate: 8000,
          payload: slice.toString('base64'),
        },
      }),
    );
    await new Promise((r) => setTimeout(r, 180));
  }

  state.isSpeaking = false;
}

async function processBuyerUtterance(ws: WebSocket, state: ActiveStreamState, utterance: string): Promise<void> {
  const cleanText = utterance.trim();
  if (!cleanText || state.processingTurn || !state.leadId || !state.threadId) return;

  state.processingTurn = true;
  try {
    state.transcriptBuffer.push({ speaker: 'BUYER', text: cleanText, at: new Date().toISOString() });

    await prisma.conversationMessage.create({
      data: {
        threadId: state.threadId,
        organizationId: state.organizationId,
        senderType: 'CUSTOMER',
        content: cleanText,
        approvalStatus: 'APPROVED',
        deliveryStatus: 'DELIVERED',
      },
    });

    const recent = await prisma.conversationMessage.findMany({
      where: { threadId: state.threadId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    const agentResult = await runSalesAgentLoop({
      leadId: state.leadId,
      organizationId: state.organizationId,
      threadId: state.threadId,
      customerMessage: cleanText,
      recentMessages: recent.reverse().map((m) => ({ senderType: m.senderType, content: m.content })),
      channel: 'VOICE_CALL',
    });

    if (agentResult.suppressed || !agentResult.response) {
      return;
    }

    state.transcriptBuffer.push({ speaker: 'AI', text: agentResult.response, at: new Date().toISOString() });

    await prisma.conversationMessage.create({
      data: {
        threadId: state.threadId,
        organizationId: state.organizationId,
        senderType: 'AI',
        content: agentResult.response,
        suggestedAction: {
          specialist: agentResult.specialist,
          stage: agentResult.stage,
        } as object,
        approvalStatus: 'APPROVED',
        deliveryStatus: 'SENT',
      },
    });

    const mulaw = await synthesizeCallAudioMulaw(agentResult.response, {
      organizationId: state.organizationId,
      sessionId: state.sessionId,
      leadId: state.leadId,
    });
    if (mulaw && ws.readyState === WebSocket.OPEN) {
      await streamMulawToPlivo(ws, state, mulaw);
    }

    if (agentResult.escalation) {
      const transferred = await executeAutoWarmTransfer({
        sessionId: state.sessionId,
        callUuid: state.callUuid,
        organizationId: state.organizationId,
        leadId: state.leadId,
        reason: (agentResult.escalation as any)?.reason,
      });
      if (transferred.transferred) {
        state.transferred = true;
      }
    }
  } catch (err: any) {
    logger.error(`[Plivo Stream] Turn processing failed: ${err.message}`);
  } finally {
    state.processingTurn = false;
  }
}

/**
 * Resolves the assigned advisor's mobile (or Broker Owner fallback) and redirects the active
 * Plivo call into the <Dial> + whisper warm-transfer flow.
 */
export async function executeAutoWarmTransfer(params: {
  sessionId: string;
  callUuid: string;
  organizationId: string;
  leadId: string | null;
  reason?: string;
}): Promise<{ transferred: boolean; advisorPhone?: string; advisorName?: string; reason?: string }> {
  const lead = params.leadId
    ? await prisma.lead.findFirst({
        where: { id: params.leadId, organizationId: params.organizationId },
        include: {
          requirements: true,
          assignedUser: { select: { id: true, name: true, phone: true } },
        },
      })
    : null;

  const ownerFallback =
    lead?.assignedUser?.phone
      ? null
      : await prisma.user.findFirst({
          where: {
            organizationId: params.organizationId,
            role: 'OWNER',
            phone: { not: null },
          },
          select: { id: true, name: true, phone: true },
        });

  const targetAdvisor = lead?.assignedUser?.phone ? lead.assignedUser : ownerFallback;
  if (!targetAdvisor?.phone) {
    logger.warn(
      `[Plivo Warm Transfer] No advisor/owner phone configured on org ${params.organizationId}; keeping lead follow-up notification.`,
    );
    return { transferred: false, reason: 'No advisor or owner phone number configured' };
  }

  const publicBase = (
    process.env['APP_PUBLIC_URL'] ||
    process.env['API_PUBLIC_URL'] ||
    'http://localhost:3001'
  ).replace(/\/$/, '');

  const whisperText = `Warm transfer for ${lead?.fullName || 'buyer'}. Reason: ${
    params.reason || 'High-intent buyer requested human advisor'
  }. Preferred areas: ${lead?.requirements?.preferredLocations?.join(', ') || 'TBD'}.`;

  const transferXmlUrl = `${publicBase}/api/webhooks/plivo/transfer/${params.sessionId}?advisorPhone=${encodeURIComponent(
    targetAdvisor.phone,
  )}&whisper=${encodeURIComponent(whisperText)}`;

  const transferRes = await plivoService.transferActiveCall(params.callUuid, transferXmlUrl);
  if (!transferRes.success) {
    logger.error(`[Plivo Warm Transfer] Failed for call ${params.callUuid}: ${transferRes.error}`);
    return { transferred: false, reason: transferRes.error };
  }

  const session = await prisma.voiceCallSession.findUnique({
    where: { id: params.sessionId },
    select: { campaignId: true },
  });

  await prisma.voiceCallSession.update({
    where: { id: params.sessionId },
    data: { status: 'TRANSFERRED', outcome: 'WARM_TRANSFER' },
  }).catch(() => {});

  if (session?.campaignId) {
    await prisma.campaign.update({
      where: { id: session.campaignId },
      data: { warmTransfersRequested: { increment: 1 } },
    }).catch(() => {});
  }

  if (lead) {
    await prisma.leadCallLog.create({
      data: {
        leadId: lead.id,
        organizationId: params.organizationId,
        userId: targetAdvisor.id,
        direction: 'OUTBOUND',
        outcome: 'CONNECTED',
        durationSeconds: 0,
        notes: `AI automatically initiated warm transfer to ${targetAdvisor.name || targetAdvisor.phone} (${params.callUuid}).`,
      },
    }).catch(() => {});
  }

  return {
    transferred: true,
    advisorPhone: targetAdvisor.phone,
    advisorName: targetAdvisor.name || undefined,
  };
}

let wssInstance: WebSocketServer | null = null;

export function attachPlivoStreamGateway(httpServer: HttpServer): WebSocketServer {
  if (wssInstance) return wssInstance;

  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    const urlPath = (request.url || '').split('?')[0] || '';
    if (!urlPath.startsWith('/ws/plivo/')) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
    const urlPath = (request.url || '').split('?')[0] || '';
    const sessionId = urlPath.replace('/ws/plivo/', '').trim();

    const callSession = await prisma.voiceCallSession.findUnique({
      where: { id: sessionId },
    });

    if (!callSession) {
      logger.warn(`[Plivo Stream] Unknown callSessionId ${sessionId}; closing WS`);
      ws.close(1008, 'Unknown call session');
      return;
    }

    let threadId: string | null = null;
    if (callSession.leadId) {
      const thread = await getOrCreateLeadThread(callSession.leadId, callSession.organizationId, 'VOICE_CALL');
      threadId = thread.id;
    }

    const state: ActiveStreamState = {
      sessionId: callSession.id,
      streamId: '',
      callUuid: callSession.callUuid,
      organizationId: callSession.organizationId,
      leadId: callSession.leadId,
      threadId,
      isSpeaking: false,
      ttsAbortController: null,
      transcriptBuffer: [],
      audioAccumulator: [],
      lastVoiceFrameAt: Date.now(),
      deepgramWs: null,
      startedAt: Date.now(),
      processingTurn: false,
      transferred: false,
    };

    await prisma.voiceCallSession.update({
      where: { id: callSession.id },
      data: { status: 'IN_PROGRESS' },
    }).catch(() => {});

    // Open Deepgram Live Streaming STT if DEEPGRAM_API_KEY is available
    const dgKey = process.env['DEEPGRAM_API_KEY'];
    if (dgKey) {
      try {
        const dgWs = new WebSocket(
          'wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&model=nova-2&interim_results=true&endpointing=350',
          { headers: { Authorization: `Token ${dgKey}` } } as any,
        );
        state.deepgramWs = dgWs;
        dgWs.on('message', (raw: Buffer) => {
          try {
            const evt = JSON.parse(raw.toString('utf8'));
            const alt = evt?.channel?.alternatives?.[0];
            const transcript = alt?.transcript?.trim();
            if (transcript && state.isSpeaking) {
              sendBargeInClear(ws, state);
            }
            if (transcript && evt.is_final) {
              processBuyerUtterance(ws, state, transcript).catch(() => {});
            }
          } catch {
            // Ignore malformed Deepgram frame
          }
        });
      } catch (err: any) {
        logger.warn(`[Plivo Stream] Deepgram live WS failed, falling back to turn buffer: ${err.message}`);
      }
    }

    // Fallback silence timer when Deepgram live WS is not configured
    const silenceCheckTimer = setInterval(async () => {
      if (state.deepgramWs && state.deepgramWs.readyState === WebSocket.OPEN) return;
      if (state.audioAccumulator.length === 0 || state.processingTurn) return;
      if (Date.now() - state.lastVoiceFrameAt < 1100) return;

      const mulawBuf = Buffer.concat(state.audioAccumulator.splice(0));
      if (mulawBuf.length < 2400) return; // Ignore < 300ms noise bursts

      const wavBuf = wrapMulawInWav(mulawBuf);
      const stt = await transcribeAudioBuffer(wavBuf, 'audio/wav');
      if (stt.text && stt.provider !== 'fallback') {
        await processBuyerUtterance(ws, state, stt.text);
      }
    }, 350);

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === 'start') {
          state.streamId = msg.start?.streamId || '';
          logger.info(`[Plivo Stream] Connected streamId=${state.streamId} callUuid=${state.callUuid}`);
        } else if (msg.event === 'media' && msg.media?.payload) {
          const frame = Buffer.from(msg.media.payload, 'base64');
          if (state.deepgramWs && state.deepgramWs.readyState === WebSocket.OPEN) {
            state.deepgramWs.send(frame);
          } else {
            // Simple mulaw amplitude check for VAD/barge-in
            let energy = 0;
            for (let i = 0; i < frame.length; i += 4) {
              energy += Math.abs(frame[i]! - 127);
            }
            const avgEnergy = energy / Math.max(1, Math.floor(frame.length / 4));
            if (avgEnergy > 14) {
              state.lastVoiceFrameAt = Date.now();
              if (state.isSpeaking) {
                sendBargeInClear(ws, state);
              }
              state.audioAccumulator.push(frame);
            }
          }
        } else if (msg.event === 'stop') {
          ws.close();
        }
      } catch {
        // Ignore malformed Plivo event
      }
    });

    ws.on('close', async () => {
      clearInterval(silenceCheckTimer);
      state.ttsAbortController?.abort();
      if (state.deepgramWs && state.deepgramWs.readyState === WebSocket.OPEN) {
        state.deepgramWs.close();
      }

      const durationSeconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
      const summary =
        state.transcriptBuffer.length > 0
          ? state.transcriptBuffer.map((t) => `${t.speaker}: ${t.text}`).join('\n')
          : 'Voice call session completed.';

      await prisma.voiceCallSession.update({
        where: { id: state.sessionId },
        data: {
          status: state.transferred ? 'TRANSFERRED' : 'COMPLETED',
          durationSeconds,
          transcript: state.transcriptBuffer as object,
          summary,
          endedAt: new Date(),
        },
      }).catch(() => {});

      await walletService.deductVoiceCall(state.organizationId, durationSeconds, {
        callUuid: state.callUuid,
      }).catch(() => {});

      await recordPlivoVoiceCost({
        organizationId: state.organizationId,
        durationSeconds,
        callSessionId: state.sessionId,
        leadId: state.leadId,
      });
      if (state.deepgramWs) {
        await recordSttCost({
          organizationId: state.organizationId,
          durationSeconds,
          callSessionId: state.sessionId,
          leadId: state.leadId,
        });
      }
    });
  });

  return wss;
}
