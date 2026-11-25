// ─────────────────────────────────────────────────────────────────────────────
// Plivo Voice API Service — Outbound Dialing, Bidirectional <Stream> XML,
// AMD Voicemail Handling, Warm <Dial> Transfers & Webhook Signature Verification
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';
import { logger } from '../../utils/logger.js';

export interface PlivoCallParams {
  from: string;
  to: string;
  answerUrl: string;
  hangupUrl?: string;
  machineDetectionUrl?: string;
  ringTimeout?: number;
}

export interface PlivoCallResult {
  success: boolean;
  callUuid?: string;
  isSimulated?: boolean;
  error?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sanitizeE164Phone(phone: string, defaultCountryCode = '91'): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  return `+${digits}`;
}

export class PlivoService {
  private getCredentials(): { authId?: string; authToken?: string; fromNumber?: string } {
    return {
      authId: process.env['PLIVO_AUTH_ID'],
      authToken: process.env['PLIVO_AUTH_TOKEN'],
      fromNumber: process.env['PLIVO_FROM_NUMBER'],
    };
  }

  public isConfigured(): boolean {
    const { authId, authToken } = this.getCredentials();
    return Boolean(authId && authToken);
  }

  /**
   * Verifies Plivo X-Plivo-Signature-V2 when PLIVO_AUTH_TOKEN is configured.
   */
  public verifyWebhookSignature(url: string, nonce: string | undefined, signatureHeader: string | undefined): boolean {
    const { authToken } = this.getCredentials();
    if (!authToken) return true; // Only enforce when Plivo credentials are configured
    if (!nonce || !signatureHeader) return false;

    try {
      const baseString = `${url}${nonce}`;
      const computed = crypto.createHmac('sha256', authToken).update(baseString).digest('base64');
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }

  /**
   * Originates an outbound call via Plivo REST API v1.
   */
  public async originateCall(params: PlivoCallParams): Promise<PlivoCallResult> {
    const { authId, authToken, fromNumber } = this.getCredentials();
    const from = sanitizeE164Phone(params.from || fromNumber || '+918000000000');
    const to = sanitizeE164Phone(params.to);

    if (!to) {
      return { success: false, error: 'Invalid destination phone number' };
    }

    if (!authId || !authToken) {
      const simUuid = `plivo-sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      logger.info(`[Plivo Simulated Call] From: ${from} -> To: ${to}, UUID: ${simUuid}`);
      return { success: true, callUuid: simUuid, isSimulated: true };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${authId}:${authToken}`).toString('base64');
      const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          answer_url: params.answerUrl,
          answer_method: 'POST',
          ...(params.hangupUrl ? { hangup_url: params.hangupUrl, hangup_method: 'POST' } : {}),
          machine_detection: 'true',
          machine_detection_time: 2500,
          ...(params.machineDetectionUrl
            ? { machine_detection_url: params.machineDetectionUrl, machine_detection_method: 'POST' }
            : {}),
          ring_timeout: params.ringTimeout ?? 30,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const data = (await res.json()) as { request_uuid?: string; message?: string; error?: string };
      if (!res.ok) {
        const err = data.error || data.message || `Plivo HTTP ${res.status}`;
        logger.error(`[Plivo REST Error] originateCall failed: ${err}`);
        return { success: false, error: err };
      }

      const callUuid = Array.isArray(data.request_uuid) ? data.request_uuid[0] : data.request_uuid;
      return { success: true, callUuid: callUuid || `plivo-${Date.now()}`, isSimulated: false };
    } catch (err: any) {
      logger.error(`[Plivo Exception] originateCall failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Redirects an active call to a warm-transfer XML endpoint.
   */
  public async transferActiveCall(callUuid: string, transferXmlUrl: string): Promise<PlivoCallResult> {
    const { authId, authToken } = this.getCredentials();
    if (!authId || !authToken) {
      logger.info(`[Plivo Simulated Transfer] Call: ${callUuid} -> ${transferXmlUrl}`);
      return { success: true, callUuid, isSimulated: true };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${authId}:${authToken}`).toString('base64');
      const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/${callUuid}/`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legs: 'aleg',
          aleg_url: transferXmlUrl,
          aleg_method: 'POST',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as any;
        return { success: false, error: data.error || `Plivo transfer failed (${res.status})` };
      }
      return { success: true, callUuid, isSimulated: false };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Generates Plivo XML to open a bidirectional WebSocket audio stream for real-time AI voice.
   */
  public buildStreamAnswerXml(params: {
    streamWsUrl: string;
    greetingText?: string;
    statusCallbackUrl?: string;
  }): string {
    const speakTag = params.greetingText
      ? `  <Speak voice="Polly.Aditi">${escapeXml(params.greetingText)}</Speak>\n`
      : '';
    const cbAttr = params.statusCallbackUrl ? ` statusCallbackUrl="${escapeXml(params.statusCallbackUrl)}"` : '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${speakTag}  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000"${cbAttr}>${escapeXml(params.streamWsUrl)}</Stream>
</Response>`;
  }

  /**
   * Generates Plivo XML for a live warm transfer to a Senior Property Advisor with 5s whisper.
   */
  public buildWarmTransferXml(params: {
    advisorPhone: string;
    callerId: string;
    whisperUrl: string;
    fallbackUrl: string;
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Aditi">Connecting you with our senior property advisor now. Please hold for a moment.</Speak>
  <Dial callerId="${escapeXml(params.callerId)}" timeout="20" confirmSound="${escapeXml(params.whisperUrl)}" action="${escapeXml(params.fallbackUrl)}" method="POST">
    <Number>${escapeXml(sanitizeE164Phone(params.advisorPhone))}</Number>
  </Dial>
</Response>`;
  }

  /**
   * Generates Plivo XML for the private advisor whisper before bridging.
   */
  public buildWhisperXml(whisperText: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Aditi">${escapeXml(whisperText)}</Speak>
</Response>`;
  }

  /**
   * Generates Plivo XML when Answering Machine Detection detects voicemail.
   */
  public buildVoicemailDropXml(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Wait length="1" />
  <Speak voice="Polly.Aditi">${escapeXml(message)}</Speak>
  <Hangup reason="completed" />
</Response>`;
  }
}

export const plivoService = new PlivoService();
