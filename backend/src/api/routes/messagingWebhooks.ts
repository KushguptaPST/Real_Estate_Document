/**
 * /api/webhooks — External Messaging Provider Webhooks
 *
 * Secure, signature-verified delivery and bounce webhooks for Resend and SendGrid.
 * Enforces:
 *  - Constant-time signature verification (Svix HMAC-SHA256 for Resend)
 *  - Fails closed if secrets are missing
 *  - Tenant isolation and deduplication via recordWebhookEvent
 *  - Terminal delivery states preserved (never downgrades DELIVERED)
 *  - Redacted logging (no unmasked PII or credentials)
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { maskEmail } from '../../utils/audit.js';
import {
  verifySvixSignature,
  verifyWebhookSignature,
  safeEqualSecret,
  getWebhookSecret,
  recordWebhookEvent,
  markWebhookProcessed,
} from '../../services/webhook.service.js';
import { rateLimit } from '../../utils/rateLimit.js';

const router = Router();
const webhookLimiter = rateLimit({ name: 'messaging-webhooks', windowMs: 60_000, max: 200 });

// ── Resend Webhook Handler (Svix signature) ─────────────────────────────────
router.post('/resend', webhookLimiter, async (req: Request, res: Response) => {
  const secret = process.env['RESEND_WEBHOOK_SECRET'] || process.env['WEBHOOK_SECRET'];
  if (!secret) {
    logger.error('[Resend Webhook] RESEND_WEBHOOK_SECRET not configured; rejecting webhook.');
    return res.status(401).json({ error: 'Webhook secret not configured' });
  }

  const svixId = (req.headers['svix-id'] || req.headers['webhook-id']) as string | undefined;
  const svixTimestamp = (req.headers['svix-timestamp'] || req.headers['webhook-timestamp']) as string | undefined;
  const svixSignature = (req.headers['svix-signature'] || req.headers['webhook-signature']) as string | undefined;

  const rawBody = (req as any).rawBody ?? (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || '')));

  const isValid = verifySvixSignature({
    secret,
    rawBody,
    id: svixId,
    timestamp: svixTimestamp,
    signatureHeader: svixSignature,
  });

  if (!isValid) {
    logger.warn('[Resend Webhook] Invalid or expired Svix signature rejected.');
    return res.status(401).json({ error: 'Invalid or expired signature' });
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Malformed payload' });
  }

  const eventType = payload.type as string; // e.g. "email.delivered", "email.bounced", "email.sent"
  const eventData = payload.data || {};
  const emailId = (eventData.email_id || eventData.id) as string | undefined;

  if (!eventType || !emailId) {
    logger.warn('[Resend Webhook] Missing eventType or emailId in payload.');
    return res.status(400).json({ error: 'Missing eventType or email_id' });
  }

  // Correlate with database message record
  const message = await prisma.conversationMessage.findFirst({
    where: { providerMessageId: emailId },
    include: {
      thread: { select: { leadId: true, organizationId: true } },
    },
  });

  if (!message) {
    logger.info(`[Resend Webhook] No message record found matching provider ID: ${emailId}`);
    return res.status(200).json({ received: true, matched: false });
  }

  const organizationId = message.organizationId || message.thread?.organizationId;
  if (!organizationId) {
    logger.error(`[Resend Webhook] Found message ${message.id} without organization context.`);
    return res.status(400).json({ error: 'Message missing organization context' });
  }

  // Idempotent deduplication check
  const eventId = svixId || `resend-${emailId}-${eventType}`;
  const dedup = await recordWebhookEvent({
    provider: 'resend',
    externalEventId: eventId,
    eventType,
    payload,
    organizationId,
  });

  if (dedup.isDuplicate) {
    logger.info(`[Resend Webhook] Idempotent duplicate event ignored: ${eventId}`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    if (eventType === 'email.delivered') {
      // Transition to DELIVERED if not already DELIVERED
      if (message.deliveryStatus !== 'DELIVERED') {
        await prisma.$transaction([
          prisma.conversationMessage.update({
            where: { id: message.id },
            data: {
              deliveryStatus: 'DELIVERED',
              deliveredAt: new Date(),
              deliveryError: null,
            },
          }),
          prisma.outboxJob.updateMany({
            where: { messageId: message.id },
            data: { status: 'COMPLETED' },
          }),
          prisma.auditLog.create({
            data: {
              organizationId,
              action: 'MESSAGE_DELIVERED',
              entityType: 'ConversationMessage',
              entityId: message.id,
              actor: 'provider:resend',
              note: `Delivery confirmed by Resend webhook (ID: ${emailId})`,
            },
          }),
        ]);
        logger.info(`[Resend Webhook] Message ${message.id} marked DELIVERED`);
      }
    } else if (eventType === 'email.bounced' || eventType === 'email.complained') {
      // Terminal failure: bounce or spam complaint
      // Do not overwrite if already confirmed delivered
      if (message.deliveryStatus !== 'DELIVERED') {
        const reason = eventData.reason || (eventType === 'email.complained' ? 'Spam complaint' : 'Email bounced');
        await prisma.$transaction([
          prisma.conversationMessage.update({
            where: { id: message.id },
            data: {
              deliveryStatus: 'FAILED',
              failedAt: new Date(),
              deliveryError: String(reason),
            },
          }),
          prisma.outboxJob.updateMany({
            where: { messageId: message.id },
            data: { status: 'FAILED', lastError: String(reason) },
          }),
          prisma.auditLog.create({
            data: {
              organizationId,
              action: 'MESSAGE_BOUNCED',
              entityType: 'ConversationMessage',
              entityId: message.id,
              actor: 'provider:resend',
              note: `Email bounced/failed via Resend webhook: ${reason}`,
            },
          }),
        ]);
        logger.info(`[Resend Webhook] Message ${message.id} marked FAILED (bounced: ${reason})`);
      }
    } else if (eventType === 'email.sent') {
      // Update to SENT if currently QUEUED or SENDING
      if (message.deliveryStatus === 'QUEUED' || message.deliveryStatus === 'SENDING') {
        await prisma.conversationMessage.update({
          where: { id: message.id },
          data: {
            deliveryStatus: 'SENT',
            sentAt: new Date(),
          },
        });
      }
    }

    await markWebhookProcessed(dedup.event.id, 'PROCESSED');
    return res.status(200).json({ received: true, processed: true });
  } catch (procErr: any) {
    logger.error(`[Resend Webhook Processing Error] ${procErr.message}`);
    await markWebhookProcessed(dedup.event.id, 'FAILED', procErr.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ── SendGrid Event Webhook Handler ──────────────────────────────────────────
router.post('/sendgrid', webhookLimiter, async (req: Request, res: Response) => {
  const secret = process.env['SENDGRID_WEBHOOK_SECRET'] || process.env['WEBHOOK_SECRET'];
  if (!secret) {
    logger.error('[SendGrid Webhook] SENDGRID_WEBHOOK_SECRET not configured; rejecting webhook.');
    return res.status(401).json({ error: 'Webhook secret not configured' });
  }

  const rawBody = (req as any).rawBody ?? (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || '')));
  const sigHeader = (req.headers['x-twilio-email-event-webhook-signature'] ||
    req.headers['x-webhook-signature']) as string | undefined;
  const sharedSecretHeader = (req.headers['x-sendgrid-secret'] ||
    req.headers['x-webhook-secret']) as string | undefined;

  let isValid = false;
  if (sigHeader) {
    isValid = verifyWebhookSignature({
      provider: 'sendgrid',
      signatureHeader: sigHeader,
      rawBody,
      secret,
    });
  } else if (sharedSecretHeader) {
    isValid = safeEqualSecret(sharedSecretHeader, secret);
  }

  if (!isValid) {
    logger.warn('[SendGrid Webhook] Invalid or missing signature / secret rejected.');
    return res.status(401).json({ error: 'Invalid or missing signature' });
  }

  const rawPayload = req.body;
  const events = Array.isArray(rawPayload) ? rawPayload : [rawPayload];

  let processedCount = 0;

  for (const item of events) {
    if (!item || typeof item !== 'object') continue;
    const eventType = item.event as string;
    const sgMessageId = (item.sg_message_id as string) || '';
    const cleanId = sgMessageId.split('.')[0] || sgMessageId;

    if (!cleanId) continue;

    // Find message by providerMessageId
    const message = await prisma.conversationMessage.findFirst({
      where: {
        OR: [{ providerMessageId: cleanId }, { providerMessageId: sgMessageId }],
      },
      include: {
        thread: { select: { leadId: true, organizationId: true } },
      },
    });

    if (!message) continue;

    const organizationId = message.organizationId || message.thread?.organizationId;
    if (!organizationId) continue;

    const externalEventId = `sendgrid-${cleanId}-${eventType}-${item.timestamp || Date.now()}`;
    const dedup = await recordWebhookEvent({
      provider: 'sendgrid',
      externalEventId,
      eventType,
      payload: item,
      organizationId,
    });

    if (dedup.isDuplicate) continue;

    try {
      if (eventType === 'delivered') {
        if (message.deliveryStatus !== 'DELIVERED') {
          await prisma.$transaction([
            prisma.conversationMessage.update({
              where: { id: message.id },
              data: {
                deliveryStatus: 'DELIVERED',
                deliveredAt: new Date(),
                deliveryError: null,
              },
            }),
            prisma.outboxJob.updateMany({
              where: { messageId: message.id },
              data: { status: 'COMPLETED' },
            }),
            prisma.auditLog.create({
              data: {
                organizationId,
                action: 'MESSAGE_DELIVERED',
                entityType: 'ConversationMessage',
                entityId: message.id,
                actor: 'provider:sendgrid',
                note: `Delivery confirmed by SendGrid webhook (ID: ${cleanId})`,
              },
            }),
          ]);
        }
      } else if (eventType === 'bounce' || eventType === 'dropped') {
        if (message.deliveryStatus !== 'DELIVERED') {
          const reason = item.reason || item.response || 'Email bounced or dropped';
          await prisma.$transaction([
            prisma.conversationMessage.update({
              where: { id: message.id },
              data: {
                deliveryStatus: 'FAILED',
                failedAt: new Date(),
                deliveryError: String(reason),
              },
            }),
            prisma.outboxJob.updateMany({
              where: { messageId: message.id },
              data: { status: 'FAILED', lastError: String(reason) },
            }),
            prisma.auditLog.create({
              data: {
                organizationId,
                action: 'MESSAGE_BOUNCED',
                entityType: 'ConversationMessage',
                entityId: message.id,
                actor: 'provider:sendgrid',
                note: `Email bounced/dropped via SendGrid webhook: ${reason}`,
              },
            }),
          ]);
        }
      } else if (eventType === 'processed') {
        if (message.deliveryStatus === 'QUEUED' || message.deliveryStatus === 'SENDING') {
          await prisma.conversationMessage.update({
            where: { id: message.id },
            data: {
              deliveryStatus: 'SENT',
              sentAt: new Date(),
            },
          });
        }
      }

      await markWebhookProcessed(dedup.event.id, 'PROCESSED');
      processedCount++;
    } catch (itemErr: any) {
      logger.error(`[SendGrid Event Error] ${itemErr.message}`);
      await markWebhookProcessed(dedup.event.id, 'FAILED', itemErr.message);
    }
  }

  return res.status(200).json({ received: true, processedCount });
});

export default router;
