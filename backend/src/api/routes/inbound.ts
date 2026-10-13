/**
 * /api/inbound/email — Inbound email webhook
 *
 * Two authenticated paths, both fail closed when their secret is not configured:
 *  1. JSON lead webhook: HMAC-SHA256 over the raw body (`X-Webhook-Signature`,
 *     EMAIL_WEBHOOK_SECRET / WEBHOOK_SECRET) **and** an org lead-intake API key
 *     (`X-Api-Key`) that determines the tenant.
 *  2. SendGrid Inbound Parse (multipart): shared secret (`X-Inbound-Secret` header
 *     or `?secret=`, INBOUND_WEBHOOK_SECRET) checked before any file is accepted;
 *     the deal is resolved only by its exact, high-entropy inbound alias.
 * The tenant is never taken from the request body.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { readFile } from 'node:fs/promises';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';
import { storeFile } from '../../services/storage.service.js';
import { extractClausesFromPdf } from '../../services/ai.service.js';
import { computeDeadlinesForDeal } from '../../services/deadline.service.js';
import { sendEmail, generateTemplate } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import {
  verifyWebhookSignature,
  getWebhookSecret,
  safeEqualSecret,
  recordWebhookEvent,
  markWebhookProcessed,
} from '../../services/webhook.service.js';
import { ingestInboundLead } from '../../services/lead.service.js';
import { resolveApiKey } from '../../services/organization.service.js';
import { rateLimit } from '../../utils/rateLimit.js';

const router = Router();
const upload = multer({ dest: 'uploads/temp/', limits: { fileSize: 25 * 1024 * 1024, files: 5 } });


const inboundLimiter = rateLimit({ name: 'inbound-email', windowMs: 60_000, max: 120 });

const SignedLeadSchema = z.object({
  eventId: z.string().min(1).max(200),
  from: z.string().email().max(320),
  fromName: z.string().max(200).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(10_000).optional(),
});

// Validate PDF magic bytes (%PDF -> 0x25 0x50 0x44 0x46)
async function isValidPdfMagicBytes(filePath: string): Promise<boolean> {
  try {
    const buffer = await readFile(filePath);
    if (buffer.length < 4) return false;
    return (
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46    // F
    );
  } catch {
    return false;
  }
}

function deny(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

// ── 1. Signed JSON lead webhook ──────────────────────────────────────────────
async function handleSignedLead(req: Request, res: Response): Promise<void> {
  const provider = 'email';

  if (!getWebhookSecret(provider)) {
    logger.error('[Inbound Webhook] Signing secret not configured; refusing signed webhook.');
    deny(res, 503, 'Webhook endpoint is not configured');
    return;
  }

  const isValidSig = verifyWebhookSignature({
    provider,
    signatureHeader: req.header('x-webhook-signature') ?? undefined,
    rawBody: req.rawBody,
  });
  if (!isValidSig) {
    logger.warn('[Inbound Webhook] Rejected request with missing or invalid signature');
    deny(res, 401, 'Invalid webhook signature');
    return;
  }

  const key = await resolveApiKey(req.header('x-api-key') ?? undefined, 'lead_intake');
  if (!key) {
    deny(res, 401, 'A valid API key is required');
    return;
  }

  const parsed = SignedLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    deny(res, 422, 'Invalid webhook payload');
    return;
  }
  const payload = parsed.data;

  // Event ids are namespaced per tenant so one org can never pre-claim another's ids.
  const { event, isDuplicate } = await recordWebhookEvent({
    provider,
    externalEventId: `${key.organizationId}:${payload.eventId}`,
    eventType: 'inbound_email',
    payload,
    organizationId: key.organizationId,
  });

  if (isDuplicate) {
    res.status(200).json({ received: true, message: 'Duplicate event ignored' });
    return;
  }

  try {
    await ingestInboundLead({
      fullName: payload.fromName || payload.from,
      email: payload.from,
      enquiryText: payload.body || payload.subject,
      source: 'EMAIL',
      organizationId: key.organizationId,
    });
    await markWebhookProcessed(event.id, 'PROCESSED');
    res.status(202).json({ received: true, status: 'PROCESSED', eventId: event.id });
  } catch (err) {
    logger.error(`[Inbound Webhook] Processing failed: ${(err as Error).message}`);
    await markWebhookProcessed(event.id, 'FAILED', (err as Error).message);
    deny(res, 500, 'Webhook processing failure');
  }
}

// ── 2. Inbound Parse (multipart) — secret checked before multer touches disk ─
function requireInboundSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env['INBOUND_WEBHOOK_SECRET'];
  if (!expected) {
    logger.error('[Inbound Webhook] INBOUND_WEBHOOK_SECRET not configured; refusing inbound parse.');
    deny(res, 503, 'Webhook endpoint is not configured');
    return;
  }
  const provided = req.header('x-inbound-secret') ?? req.query['secret'];
  if (!safeEqualSecret(provided, expected)) {
    logger.warn('[Inbound Webhook] Unauthorized request — invalid secret key');
    deny(res, 401, 'Unauthorized webhook request');
    return;
  }
  next();
}

async function handleInboundParse(req: Request, res: Response): Promise<void> {
  try {
    const { to, from } = req.body || {};

    // Resolve the deal ONLY by its exact inbound alias: deal-<alias>@<domain>.
    const toAddress = String(to || '').toLowerCase();
    const alias = toAddress.match(/deal-([a-z0-9]{16,64})@/)?.[1];
    const deal = alias
      ? await prisma.deal.findFirst({
          where: { inboundAlias: alias, status: 'ACTIVE', organizationId: { not: null } },
          include: { notificationSettings: true },
        })
      : null;

    if (!deal || !deal.organizationId) {
      logger.warn('[Inbound Webhook] No matching active deal for inbound alias');
      deny(res, 404, 'No matching active deal found for inbound email');
      return;
    }
    const orgId = deal.organizationId;

    // Sender allowlist is mandatory: with no configured recipients nothing is accepted.
    const senderEmail = (String(from || '').match(/<([^>]+)>/)?.[1] || String(from || '')).toLowerCase().trim();
    const settings = deal.notificationSettings;
    const configuredRecipients = Array.isArray(settings?.recipients)
      ? settings.recipients.filter((recipient): recipient is string => typeof recipient === 'string')
      : [];
    const isAllowed = configuredRecipients.some((r) => r.toLowerCase().trim() === senderEmail);
    if (!senderEmail || !isAllowed) {
      logger.warn(`[Inbound Webhook] Sender not in allowlist for deal ${deal.id}`);
      deny(res, 403, 'Sender email address not authorized for this deal');
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      deny(res, 400, 'No file attachments found in inbound email');
      return;
    }

    let processedCount = 0;

    for (const file of files) {
      const isMimePdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
      const isMagicPdf = await isValidPdfMagicBytes(file.path);

      if (!isMimePdf || !isMagicPdf) {
        logger.warn(`[Inbound Webhook] Rejected non-PDF attachment (mime: ${file.mimetype}, magic: ${isMagicPdf})`);
        continue;
      }

      const { storagePath } = await storeFile(file.path, file.originalname);

      const document = await prisma.document.create({
        data: {
          dealId: deal.id,
          organizationId: orgId,
          filename: file.originalname,
          storagePath,
          mimeType: 'application/pdf',
          sizeBytes: file.size,
        },
      });

      await prisma.auditLog.create({
        data: {
          dealId: deal.id,
          organizationId: orgId,
          action: 'DOCUMENT_UPLOADED',
          entityType: 'Document',
          entityId: document.id,
          actor: senderEmail,
          newValue: { filename: file.originalname, sizeBytes: file.size, source: 'email' },
        },
      });

      await prisma.auditLog.create({
        data: {
          dealId: deal.id,
          organizationId: orgId,
          action: 'EMAIL_INBOUND_RECEIVED',
          entityType: 'Document',
          entityId: document.id,
          actor: senderEmail,
          newValue: { filename: file.originalname },
        },
      });

      // Trigger AI extraction in background
      void (async () => {
        try {
          logger.info(`[Inbound Pipeline] Starting extraction for document ${document.id}`);
          const extraction = await extractClausesFromPdf(file.path);
          const clauses = await Promise.all(
            extraction.clauses.map((clause) =>
              prisma.contingencyClause.create({
                data: {
                  dealId: deal.id,
                  documentId: document.id,
                  organizationId: orgId,
                  clauseType: clause.clauseType,
                  rawText: clause.rawText,
                  pageNumber: clause.pageNumber,
                  numberOfDays: clause.numberOfDays,
                  dayType: clause.dayType,
                  confidence: clause.confidence,
                },
              }),
            ),
          );

          const baseAcceptanceDate = deal.acceptanceDate ?? new Date();
          await computeDeadlinesForDeal(deal.id, baseAcceptanceDate, clauses, orgId);

          // Confirmation goes only to the allowlisted sender (an agent on this deal).
          const email = generateTemplate('docs_received', {
            dealAddress: deal.propertyAddress,
            dealId: deal.id,
          });
          await sendEmail({ to: senderEmail, subject: email.subject, html: email.html, text: email.text });
        } catch (err: unknown) {
          logger.error(`[Inbound Pipeline] Background extraction error for ${document.id}: ${(err as Error)?.message}`);
        }
      })();

      processedCount++;
    }

    res.status(200).json({
      received: true,
      dealId: deal.id,
      processedAttachments: processedCount,
    });
  } catch (err: unknown) {
    logger.error(`[Inbound Webhook] Failed to process email: ${(err as Error)?.message}`);
    deny(res, 500, 'Internal server error');
  }
}

router.post(
  '/email',
  inboundLimiter,
  (req: Request, res: Response, next: NextFunction) => {
    if (req.is('multipart/form-data')) {
      requireInboundSecret(req, res, () => upload.array('attachments', 5)(req, res, (err?: unknown) => {
        if (err) {
          deny(res, 400, 'Invalid attachment upload');
          return;
        }
        handleInboundParse(req, res).catch(next);
      }));
      return;
    }
    handleSignedLead(req, res).catch(next);
  },
);

export default router;
