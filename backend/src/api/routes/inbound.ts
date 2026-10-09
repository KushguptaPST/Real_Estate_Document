/**
 * /api/inbound/email — Inbound Webhook Parser & Event Logger / SendGrid Inbound Parse Webhook
 *
 * Receives forwarded emails with purchase agreement PDF attachments or lead webhook payloads.
 */

import { Router } from 'express';
import multer from 'multer';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { storeFile } from '../../services/storage.service.js';
import { extractClausesFromPdf } from '../../services/ai.service.js';
import { computeDeadlinesForDeal } from '../../services/deadline.service.js';
import { sendEmail, generateTemplate } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { verifyWebhookSignature, recordWebhookEvent, markWebhookProcessed } from '../../services/webhook.service.js';
import { ingestInboundLead } from '../../services/lead.service.js';

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/temp/', limits: { fileSize: 25 * 1024 * 1024 } });

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

router.post('/email', upload.array('attachments', 5), async (req, res) => {
  const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;

  // 1. Signature-verified Lead Ingestion
  if (signatureHeader) {
    const provider = 'email';
    const eventId = (req.body?.eventId || req.headers['x-request-id'] || `email-${Date.now()}`) as string;

    const isValidSig = verifyWebhookSignature({
      provider,
      signatureHeader,
      rawBody: JSON.stringify(req.body),
    });

    if (!isValidSig) {
      logger.warn('[Inbound Webhook] Rejected request with invalid signature header');
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const { event, isDuplicate } = await recordWebhookEvent({
      provider,
      externalEventId: eventId,
      eventType: 'inbound_email',
      payload: req.body,
      organizationId: req.body?.organizationId || null,
    });

    if (isDuplicate) {
      res.status(200).json({ received: true, message: 'Duplicate event ignored' });
      return;
    }

    try {
      if (req.body?.fromName || req.body?.from) {
        await ingestInboundLead({
          fullName: req.body?.fromName || req.body?.from || 'Inbound Email Inquiry',
          email: req.body?.from,
          enquiryText: req.body?.body || req.body?.subject,
          source: 'EMAIL',
          organizationId: req.body?.organizationId || null,
        });
      }

      await markWebhookProcessed(event.id, 'PROCESSED');
      res.status(202).json({ received: true, status: 'PROCESSED', eventId: event.id });
      return;
    } catch (err: any) {
      logger.error(`[Inbound Webhook] Processing failed: ${err.message}`);
      await markWebhookProcessed(event.id, 'FAILED', err.message);
      res.status(500).json({ error: 'Webhook processing failure' });
      return;
    }
  }

  // 2. SendGrid Inbound Parse attachments
  try {
    // 1. Shared secret protection
    const secretParam = req.query['secret'] || req.headers['x-inbound-secret'];
    const expectedSecret = process.env['INBOUND_WEBHOOK_SECRET'];

    if (expectedSecret && secretParam !== expectedSecret) {
      logger.warn('[Inbound Webhook] Unauthorized request — invalid secret key');
      res.status(401).json({ error: 'Unauthorized webhook request' });
      return;
    }

    const { to, from, subject } = req.body || {};
    logger.info(`[Inbound Webhook] Received inbound email from: ${from}, to: ${to}, subject: ${subject}`);

    // 2. Identify Deal by inbound alias or subject match
    let deal = null;

    // Match deal-<shortId>@inbound.domain.com
    const toAddress = String(to || '').toLowerCase();
    const aliasMatch = toAddress.match(/deal-([a-z0-9]+)@/i);

    if (aliasMatch && aliasMatch[1]) {
      const aliasId = aliasMatch[1];
      deal = await prisma.deal.findFirst({
        where: {
          OR: [
            { inboundAlias: aliasId },
            { id: { startsWith: aliasId } },
          ],
        },
        include: { notificationSettings: true },
      });
    }

    // Fallback: match property address in subject line
    if (!deal && subject) {
      const allDeals = await prisma.deal.findMany({
        where: { status: 'ACTIVE' },
        include: { notificationSettings: true },
      });
      deal = allDeals.find((d) =>
        subject.toLowerCase().includes(d.propertyAddress.toLowerCase()),
      ) || null;
    }

    if (!deal) {
      logger.warn(`[Inbound Webhook] No matching deal found for email to ${to} / subject "${subject}"`);
      res.status(404).json({ error: 'No matching active deal found for inbound email' });
      return;
    }

    // 3. Sender allowlist check
    const senderEmail = (String(from || '').match(/<([^>]+)>/)?.[1] || String(from || '')).toLowerCase().trim();
    const settings = deal.notificationSettings;

    const configuredRecipients = Array.isArray(settings?.recipients)
      ? settings.recipients.filter((recipient): recipient is string => typeof recipient === 'string')
      : [];
    if (configuredRecipients.length > 0) {
      const isAllowed = configuredRecipients.some((r) => r.toLowerCase().trim() === senderEmail);
      if (!isAllowed) {
        logger.warn(`[Inbound Webhook] Sender ${senderEmail} not in allowlist for deal ${deal.id}`);
        res.status(403).json({ error: 'Sender email address not authorized for this deal' });
        return;
      }
    }

    // 4. Validate & process PDF attachments
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'No file attachments found in inbound email' });
      return;
    }

    let processedCount = 0;

    for (const file of files) {
      // Validate MIME type & magic bytes
      const isMimePdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
      const isMagicPdf = await isValidPdfMagicBytes(file.path);

      if (!isMimePdf || !isMagicPdf) {
        logger.warn(`[Inbound Webhook] Rejected non-PDF file ${file.originalname} (mime: ${file.mimetype}, magic: ${isMagicPdf})`);
        continue;
      }

      // Save document via storage service
      const { storagePath } = await storeFile(file.path, file.originalname);

      const document = await prisma.document.create({
        data: {
          dealId: deal.id,
          filename: file.originalname,
          storagePath,
          mimeType: 'application/pdf',
          sizeBytes: file.size,
        },
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          dealId: deal.id,
          action: 'DOCUMENT_UPLOADED',
          entityType: 'Document',
          entityId: document.id,
          actor: senderEmail || 'email-inbound',
          newValue: { filename: file.originalname, sizeBytes: file.size, source: 'email' },
        },
      });

      await prisma.auditLog.create({
        data: {
          dealId: deal.id,
          action: 'EMAIL_INBOUND_RECEIVED',
          entityType: 'Document',
          entityId: document.id,
          actor: senderEmail,
          newValue: { filename: file.originalname, from: senderEmail },
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
                  dealId: deal!.id,
                  documentId: document.id,
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

          const baseAcceptanceDate = deal!.acceptanceDate ?? new Date();
          await computeDeadlinesForDeal(deal!.id, baseAcceptanceDate, clauses);

          // Send confirmation email
          const recipient = senderEmail || configuredRecipients[0] || 'agent@contingencycopilot.com';
          const email = generateTemplate('docs_received', {
            dealAddress: deal!.propertyAddress,
            dealId: deal!.id,
          });
          await sendEmail({ to: recipient, subject: email.subject, html: email.html, text: email.text });
        } catch (err: unknown) {
          logger.error(`[Inbound Pipeline] Background extraction error for ${document.id}:`, err);
        }
      })();

      processedCount++;
    }

    res.status(200).json({
      received: true,
      dealId: deal.id,
      processedAttachments: processedCount,
      message: `Processed ${processedCount} valid PDF attachments for deal ${deal.propertyAddress}`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('[Inbound Webhook] Failed to process email:', err);
    res.status(500).json({ error: `Internal server error: ${errorMsg}` });
  }
});

export default router;
