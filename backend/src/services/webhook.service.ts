import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { requireOrgId } from '../utils/tenant.js';


export interface WebhookVerificationParams {
  provider: string;
  signatureHeader?: string;
  rawBody: string | Buffer | undefined;
  secret?: string;
}

/** The signing secret for a provider, or undefined when none is configured. */
export function getWebhookSecret(provider: string): string | undefined {
  return process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] || process.env['WEBHOOK_SECRET'] || undefined;
}

/**
 * Verify a webhook HMAC-SHA256 signature over the raw request bytes, in constant
 * time. Fails closed: a missing secret, header or body is always a rejection.
 */
export function verifyWebhookSignature({ provider, signatureHeader, rawBody, secret }: WebhookVerificationParams): boolean {
  const webhookSecret = secret || getWebhookSecret(provider);

  if (!webhookSecret) {
    logger.error(`[Webhook] No signing secret configured for provider ${provider}; rejecting request.`);
    return false;
  }
  if (!signatureHeader || rawBody === undefined || rawBody === null) return false;

  const provided = signatureHeader.trim().replace(/^sha256=/, '');
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;

  const computed = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest();
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), computed);
}

/** Constant-time comparison for shared-secret headers. */
export function safeEqualSecret(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export interface SvixVerificationParams {
  secret?: string;
  rawBody: Buffer | string | undefined;
  id?: string;
  timestamp?: string;
  signatureHeader?: string;
  toleranceSeconds?: number;
}

/**
 * Verifies standard Svix webhook signatures (used by Resend and other modern webhook senders).
 * Fails closed if secret or required headers are missing.
 */
export function verifySvixSignature({
  secret,
  rawBody,
  id,
  timestamp,
  signatureHeader,
  toleranceSeconds = 300,
}: SvixVerificationParams): boolean {
  const webhookSecret = secret || process.env['RESEND_WEBHOOK_SECRET'] || process.env['WEBHOOK_SECRET'];

  if (!webhookSecret) {
    logger.error('[Webhook] No Svix signing secret configured; rejecting request.');
    return false;
  }

  if (!id || !timestamp || !signatureHeader || rawBody === undefined || rawBody === null) {
    return false;
  }

  // 1. Verify timestamp to prevent replay attacks
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > toleranceSeconds) {
    logger.warn('[Webhook] Svix signature timestamp expired or skewed.');
    return false;
  }

  // 2. Decode secret key: "whsec_..." is base64 encoded
  let secretBytes: Buffer;
  try {
    if (webhookSecret.startsWith('whsec_')) {
      secretBytes = Buffer.from(webhookSecret.slice(6), 'base64');
    } else {
      secretBytes = Buffer.from(webhookSecret, 'utf8');
    }
  } catch {
    return false;
  }

  // 3. Construct signed payload: "${id}.${timestamp}.${rawBody}"
  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const toSign = `${id}.${timestamp}.${bodyString}`;

  const expectedSignature = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

  // 4. Check signatures: "v1,sig1 v1,sig2"
  const signatures = signatureHeader.trim().split(/\s+/);
  for (const sig of signatures) {
    const parts = sig.split(',');
    if (parts.length === 2 && parts[0] === 'v1') {
      const candidate = parts[1];
      if (candidate.length === expectedSignature.length) {
        if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expectedSignature))) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Persists inbound webhook event with unique deduplication key for idempotency.
 * Returns { isDuplicate: true } if event was previously received and processed.
 */
export async function recordWebhookEvent(params: {
  provider: string;
  externalEventId: string;
  eventType: string;
  payload: any;
  organizationId: string;
}) {
  const { provider, externalEventId, eventType, payload } = params;
  const organizationId = requireOrgId(params.organizationId);

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      provider_externalEventId: {
        provider,
        externalEventId,
      },
    },
  });

  if (existing) {
    logger.info(`[Webhook Service] Duplicate webhook event ignored: ${provider}/${externalEventId}`);
    return { event: existing, isDuplicate: true };
  }

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        provider,
        externalEventId,
        eventType,
        payload: payload as object,
        organizationId,
        status: 'PENDING',
      },
    });
    return { event, isDuplicate: false };
  } catch (err) {
    // A concurrent delivery of the same event won the insert: treat as a duplicate.
    if ((err as { code?: string }).code === 'P2002') {
      const winner = await prisma.webhookEvent.findUniqueOrThrow({
        where: { provider_externalEventId: { provider, externalEventId } },
      });
      logger.info(`[Webhook Service] Concurrent duplicate webhook event ignored: ${provider}/${externalEventId}`);
      return { event: winner, isDuplicate: true };
    }
    throw err;
  }
}

/**
 * Marks webhook event as completed or failed safely without throwing if record was cleaned up.
 */
export async function markWebhookProcessed(eventId: string, status: 'PROCESSED' | 'FAILED', error?: string) {
  if (!eventId) return null;
  return prisma.webhookEvent.updateMany({
    where: { id: eventId },
    data: {
      status,
      error,
      processedAt: new Date(),
    },
  });
}
