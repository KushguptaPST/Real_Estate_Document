// ─────────────────────────────────────────────────────────────────────────────
// Provider COGS Sub-Ledger Service
// Tracks actual vendor expenditure in INR for Unit Economics & Super-Admin P&L.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

/** Authoritative blended INR COGS assumptions (~₹84/USD). */
export const COGS_RATES_INR = {
  plivoVoicePerMin: 1.3, // India PSTN origination/bridging
  elevenLabsPerChar: 0.0042, // Flash v2.5 (~$0.05 / 1k chars)
  cartesiaPerChar: 0.003,
  edgeTtsPerChar: 0,
  deepgramPerMin: 0.36, // Nova-2 streaming (~$0.0043 / min)
  geminiInputPerToken: 0.0000126, // ~$0.15 / 1M input tokens
  geminiOutputPerToken: 0.0000504, // ~$0.60 / 1M output tokens
  geminiFallbackPerTurn: 0.04,
  metaWhatsAppTemplate: 0.85,
  metaWhatsAppService: 0.15,
  razorpayFeeRate: 0.0236, // 2% + 18% GST
} as const;

export interface ProviderCostInput {
  organizationId: string;
  provider:
    | 'PLIVO_VOICE'
    | 'PLIVO_DID'
    | 'ELEVENLABS_TTS'
    | 'CARTESIA_TTS'
    | 'EDGE_TTS'
    | 'DEEPGRAM_STT'
    | 'GEMINI_LLM'
    | 'META_WHATSAPP'
    | 'RAZORPAY_FEE';
  operation: string;
  units: number;
  unitType: 'SECONDS' | 'MINUTES' | 'CHARS' | 'TOKENS' | 'MESSAGES' | 'INR' | 'DID_MONTH';
  costInr: number;
  leadId?: string | null;
  callSessionId?: string | null;
  agentRunTraceId?: string | null;
  metadata?: Record<string, unknown>;
}

function roundInr(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export async function recordProviderCost(input: ProviderCostInput): Promise<void> {
  try {
    if (!input.organizationId || input.units < 0 || input.costInr < 0) return;

    await prisma.providerCostEvent.create({
      data: {
        organizationId: input.organizationId,
        provider: input.provider,
        operation: input.operation,
        units: input.units,
        unitType: input.unitType,
        costInr: roundInr(input.costInr),
        leadId: input.leadId ?? null,
        callSessionId: input.callSessionId ?? null,
        agentRunTraceId: input.agentRunTraceId ?? null,
        metadata: (input.metadata ?? undefined) as object | undefined,
      },
    });
  } catch (err: any) {
    logger.warn(`[COGS Tracker] Failed to record ${input.provider} cost event: ${err.message}`);
  }
}

export async function recordPlivoVoiceCost(params: {
  organizationId: string;
  durationSeconds: number;
  callSessionId?: string;
  leadId?: string | null;
  isSimulated?: boolean;
}): Promise<void> {
  if (params.durationSeconds <= 0) return;
  const minutes = params.durationSeconds / 60;
  const costInr = params.isSimulated ? 0 : minutes * COGS_RATES_INR.plivoVoicePerMin;
  await recordProviderCost({
    organizationId: params.organizationId,
    provider: 'PLIVO_VOICE',
    operation: params.isSimulated ? 'simulated_call_leg' : 'voice_call_leg',
    units: params.durationSeconds,
    unitType: 'SECONDS',
    costInr,
    callSessionId: params.callSessionId,
    leadId: params.leadId,
  });
}

export async function recordSttCost(params: {
  organizationId: string;
  durationSeconds: number;
  callSessionId?: string;
  leadId?: string | null;
}): Promise<void> {
  if (params.durationSeconds <= 0) return;
  const costInr = (params.durationSeconds / 60) * COGS_RATES_INR.deepgramPerMin;
  await recordProviderCost({
    organizationId: params.organizationId,
    provider: 'DEEPGRAM_STT',
    operation: 'nova2_streaming_stt',
    units: params.durationSeconds,
    unitType: 'SECONDS',
    costInr,
    callSessionId: params.callSessionId,
    leadId: params.leadId,
  });
}

export async function recordTtsCost(params: {
  organizationId: string;
  provider: 'ELEVENLABS_TTS' | 'CARTESIA_TTS' | 'EDGE_TTS';
  chars: number;
  callSessionId?: string;
  leadId?: string | null;
}): Promise<void> {
  if (params.chars <= 0) return;
  const perChar =
    params.provider === 'ELEVENLABS_TTS'
      ? COGS_RATES_INR.elevenLabsPerChar
      : params.provider === 'CARTESIA_TTS'
      ? COGS_RATES_INR.cartesiaPerChar
      : COGS_RATES_INR.edgeTtsPerChar;

  await recordProviderCost({
    organizationId: params.organizationId,
    provider: params.provider,
    operation: 'tts_synthesis',
    units: params.chars,
    unitType: 'CHARS',
    costInr: params.chars * perChar,
    callSessionId: params.callSessionId,
    leadId: params.leadId,
  });
}

export async function recordGeminiCost(params: {
  organizationId: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  leadId?: string | null;
  agentRunTraceId?: string;
}): Promise<void> {
  const totalTokens = params.inputTokens + params.outputTokens;
  const costInr =
    totalTokens > 0
      ? params.inputTokens * COGS_RATES_INR.geminiInputPerToken +
        params.outputTokens * COGS_RATES_INR.geminiOutputPerToken
      : COGS_RATES_INR.geminiFallbackPerTurn;

  await recordProviderCost({
    organizationId: params.organizationId,
    provider: 'GEMINI_LLM',
    operation: params.model,
    units: Math.max(1, totalTokens),
    unitType: 'TOKENS',
    costInr,
    leadId: params.leadId,
    agentRunTraceId: params.agentRunTraceId,
    metadata: { inputTokens: params.inputTokens, outputTokens: params.outputTokens },
  });
}

export async function recordWhatsAppCost(params: {
  organizationId: string;
  isTemplate: boolean;
  leadId?: string | null;
  messageCount?: number;
}): Promise<void> {
  const count = Math.max(1, params.messageCount ?? 1);
  const unitCost = params.isTemplate ? COGS_RATES_INR.metaWhatsAppTemplate : COGS_RATES_INR.metaWhatsAppService;
  await recordProviderCost({
    organizationId: params.organizationId,
    provider: 'META_WHATSAPP',
    operation: params.isTemplate ? 'template_message' : 'service_reply',
    units: count,
    unitType: 'MESSAGES',
    costInr: count * unitCost,
    leadId: params.leadId,
  });
}

export async function recordRazorpayFee(params: {
  organizationId: string;
  grossAmountInr: number;
  paymentId?: string;
}): Promise<void> {
  if (params.grossAmountInr <= 0) return;
  await recordProviderCost({
    organizationId: params.organizationId,
    provider: 'RAZORPAY_FEE',
    operation: 'gateway_processing_fee',
    units: params.grossAmountInr,
    unitType: 'INR',
    costInr: params.grossAmountInr * COGS_RATES_INR.razorpayFeeRate,
    metadata: params.paymentId ? { paymentId: params.paymentId } : undefined,
  });
}
