/**
 * Meta WhatsApp Business Cloud API Inbound Webhook
 *
 * Implements:
 * 1. GET  / — Meta hub challenge verification handshake (multi-tenant or default)
 * 2. POST / — Multi-tenant inbound message processor with optional HMAC-SHA256 verification,
 *             audio voice-note transcription, human chat physics, and agentic qualification.
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { prisma } from '../../../utils/prisma.js';
import { logger } from '../../../utils/logger.js';
import { whatsAppService, type WhatsAppCredentialsOverride } from '../../../services/messaging/whatsapp.service.js';
import {
  prepareConversationalBubbles,
  isNightOwlWindow,
  getNightOwlAcknowledgment,
} from '../../../services/messaging/humanChatPhysics.js';
import { generateAdvisorVoiceNote } from '../../../services/voice/voiceNote.service.js';
import { transcribeAudioBuffer } from '../../../services/voice/transcription.service.js';
import { getOrCreateLeadThread } from '../../../services/conversation.service.js';
import { runSalesAgentLoop } from '../../../services/agent/agentRuntime.js';
import { walletService } from '../../../services/billing/wallet.service.js';
import { resolveOrgByWhatsappPhoneId } from '../../../services/channelRegistry.service.js';
import { recordWhatsAppCost } from '../../../services/costTracker.service.js';

const router = Router();

function verifyMetaHubSignature(req: Request): boolean {
  const appSecret = process.env['META_APP_SECRET'];
  if (!appSecret) return true;
  const header = req.header('x-hub-signature-256');
  if (!header || !req.rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

router.get('/', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedDefault = process.env['META_VERIFY_TOKEN'] || 'contingency_copilot_meta_webhook_secret';

  if (mode === 'subscribe' && typeof token === 'string') {
    if (token === expectedDefault) {
      logger.info('[WhatsApp Webhook] Verification challenge passed (default token)');
      res.status(200).send(challenge);
      return;
    }

    const matchingOrg = await prisma.organizationChannel.findFirst({
      where: { whatsappVerifyToken: token },
      select: { organizationId: true },
    });
    if (matchingOrg) {
      logger.info(`[WhatsApp Webhook] Verification challenge passed for org ${matchingOrg.organizationId}`);
      res.status(200).send(challenge);
      return;
    }
  }

  logger.warn('[WhatsApp Webhook] Verification failed: token mismatch');
  res.status(403).json({ error: 'Verification token mismatch' });
});

router.post('/', async (req: Request, res: Response) => {
  if (!verifyMetaHubSignature(req)) {
    logger.warn('[WhatsApp Webhook] Rejected request with invalid X-Hub-Signature-256');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  // Acknowledge Meta immediately within 2 seconds
  res.status(200).json({ status: 'received' });

  const body = req.body;
  if (!body || body.object !== 'whatsapp_business_account') {
    return;
  }

  try {
    const entry = body.entry?.[0];
    const changeObj = entry?.changes?.[0];
    const field: string | undefined = changeObj?.field;
    const change = changeObj?.value;
    const metadataPhoneId: string | undefined = change?.metadata?.phone_number_id;

    // ── Handle WhatsApp Coexistence Echoes (Human advisor replied from mobile WhatsApp Business App) ──
    const echoMessages = change?.message_echoes;
    if ((field === 'smb_message_echoes' || Array.isArray(echoMessages)) && Array.isArray(echoMessages) && echoMessages.length > 0) {
      const resolvedTenant = await resolveOrgByWhatsappPhoneId(metadataPhoneId);
      if (!resolvedTenant) return;
      const orgId = resolvedTenant.organizationId;

      for (const echo of echoMessages) {
        const buyerPhone = whatsAppService.sanitizePhoneNumber(String(echo.to || echo.from || ''));
        const echoText = echo.text?.body || (echo.type ? `[Advisor sent ${echo.type} from WhatsApp Business App]` : '');
        const echoMsgId = echo.id;
        if (!buyerPhone || !echoText) continue;

        const existingEcho = echoMsgId
          ? await prisma.conversationMessage.findFirst({ where: { providerMessageId: echoMsgId } })
          : null;
        if (existingEcho) continue;

        const lead = await prisma.lead.findFirst({
          where: { organizationId: orgId, phone: buyerPhone },
        });
        if (!lead) continue;

        const thread = await getOrCreateLeadThread(lead.id, orgId, 'WHATSAPP');
        await prisma.$transaction([
          prisma.conversationMessage.create({
            data: {
              threadId: thread.id,
              organizationId: orgId,
              senderType: 'AGENT',
              content: echoText,
              providerMessageId: echoMsgId,
              deliveryStatus: 'DELIVERED',
              approvalStatus: 'APPROVED',
              idempotencyKey: echoMsgId ? `wa-echo-${echoMsgId}` : undefined,
            },
          }),
          prisma.conversationThread.updateMany({
            where: { leadId: lead.id, organizationId: orgId },
            data: {
              isHumanTakeover: true,
              state: 'HUMAN_TAKEOVER',
              takeoverBy: 'whatsapp_mobile_app',
              autoReplyEnabled: false,
            },
          }),
        ]);
        logger.info(`[WhatsApp Coexistence Echo] Advisor replied on mobile for lead ${lead.id}; HUMAN_TAKEOVER engaged.`);
      }
      return;
    }

    // Log delivery & failure status callbacks from Meta Cloud API (e.g., #131049, #131026, #131047)
    const statuses = change?.statuses;
    if (Array.isArray(statuses) && statuses.length > 0) {
      for (const st of statuses) {
        if (st.status === 'failed' || Array.isArray(st.errors)) {
          logger.warn(`[WhatsApp Status FAILED] to=${st.recipient_id} id=${st.id} errors=${JSON.stringify(st.errors)}`);
        } else {
          logger.info(`[WhatsApp Status] to=${st.recipient_id} id=${st.id} status=${st.status}`);
        }
      }
    }

    const message = change?.messages?.[0];
    const contact = change?.contacts?.[0];

    if (!message) {
      return;
    }

    const rawFrom = message.from;
    const cleanPhone = whatsAppService.sanitizePhoneNumber(rawFrom);
    const metaMessageId = message.id;
    const contactName = contact?.profile?.name || '';

    logger.info(`[WhatsApp Inbound] Message from ${cleanPhone} (${contactName || 'Unknown'}) on phoneId=${metadataPhoneId || 'default'}`);

    const resolvedTenant = await resolveOrgByWhatsappPhoneId(metadataPhoneId);
    if (!resolvedTenant) {
      logger.warn('[WhatsApp Inbound] Could not resolve organization for inbound message');
      return;
    }
    const orgId = resolvedTenant.organizationId;
    const waCredentials: WhatsAppCredentialsOverride | undefined =
      resolvedTenant.accessToken && resolvedTenant.phoneNumberId
        ? { token: resolvedTenant.accessToken, phoneNumberId: resolvedTenant.phoneNumberId }
        : undefined;

    let customerText = '';
    if (message.type === 'text') {
      customerText = message.text?.body || '';
    } else if (message.type === 'interactive' && message.interactive?.button_reply) {
      customerText = message.interactive.button_reply.title || message.interactive.button_reply.id || '';
    } else if (message.type === 'button') {
      customerText = message.button?.text || '';
    } else if (message.type === 'audio' && message.audio?.id) {
      const downloaded = await whatsAppService.downloadMedia(message.audio.id, waCredentials);
      if (downloaded) {
        const transcript = await transcribeAudioBuffer(downloaded.buffer, downloaded.mimeType);
        customerText = transcript.text;
      } else {
        customerText = 'Customer sent a voice message asking about property details.';
      }
    }

    if (!customerText.trim()) {
      return;
    }

    const existingMsg = await prisma.conversationMessage.findFirst({
      where: { providerMessageId: metaMessageId },
    });
    if (existingMsg) {
      logger.info(`[WhatsApp Inbound] Skipping duplicate message ID: ${metaMessageId}`);
      return;
    }

    let lead = await prisma.lead.findFirst({
      where: { organizationId: orgId, phone: cleanPhone },
      include: { assignedUser: { select: { name: true } } },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          organizationId: orgId,
          phone: cleanPhone,
          fullName: contactName || `WhatsApp Buyer ${cleanPhone.slice(-4)}`,
          source: 'WHATSAPP',
          status: 'NEW',
          stage: 'NEW_INBOUND',
          priority: 'HIGH',
        },
        include: { assignedUser: { select: { name: true } } },
      });
      logger.info(`[WhatsApp Inbound] Provisioned new lead ${lead.id} for phone ${cleanPhone} in org ${orgId}`);
    }

    const thread = await getOrCreateLeadThread(lead.id, orgId, 'WHATSAPP');

    await prisma.conversationMessage.create({
      data: {
        threadId: thread.id,
        organizationId: orgId,
        senderType: 'CUSTOMER',
        content: customerText,
        providerMessageId: metaMessageId,
        deliveryStatus: 'DELIVERED',
        idempotencyKey: `meta-wa-${metaMessageId}`,
      },
    });

    try {
      await walletService.deductWhatsAppQualification(orgId, {
        leadId: lead.id,
        phone: cleanPhone,
        leadName: lead.fullName,
      });
    } catch (waDeductErr: any) {
      logger.warn(`[Wallet WhatsApp Deduction Warning] ${waDeductErr.message}`);
    }

    if (thread.isHumanTakeover || thread.state === 'HUMAN_TAKEOVER') {
      logger.info(`[WhatsApp Inbound] Lead ${lead.id} is under human takeover; AI auto-reply suppressed`);
      return;
    }

    if (isNightOwlWindow() && process.env['NODE_ENV'] !== 'test') {
      const nightOwlText = getNightOwlAcknowledgment(contactName);
      await whatsAppService.sendTextMessage(cleanPhone, nightOwlText, { credentials: waCredentials });
      await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgId,
          senderType: 'AGENT',
          content: nightOwlText,
          approvalStatus: 'APPROVED',
          deliveryStatus: 'SENT',
        },
      });
      return;
    }

    const recentDbMessages = await prisma.conversationMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    const recentMessages = recentDbMessages.reverse().map((m) => ({
      senderType: m.senderType,
      content: m.content,
    }));

    const agentResult = await runSalesAgentLoop({
      leadId: lead.id,
      organizationId: orgId,
      threadId: thread.id,
      customerMessage: customerText,
      customerName: contactName || lead.fullName,
      recentMessages,
      channel: 'WHATSAPP',
    });

    const replyText = agentResult.response;
    if (!replyText || agentResult.suppressed) {
      return;
    }

    const bubbles = prepareConversationalBubbles(replyText);

    for (const bubble of bubbles) {
      if (process.env['NODE_ENV'] !== 'test') {
        await new Promise((r) => setTimeout(r, Math.min(bubble.typingDelayMs, 2500)));
      }

      const sendRes = await whatsAppService.sendTextMessage(cleanPhone, bubble.text, {
        credentials: waCredentials,
      });
      if (sendRes.success && !sendRes.isSimulated) {
        await recordWhatsAppCost({
          organizationId: orgId,
          isTemplate: false,
          leadId: lead.id,
        });
      }

      await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgId,
          senderType: 'AI',
          content: bubble.text,
          suggestedAction: {
            specialist: agentResult.specialist,
            stage: agentResult.stage,
            followUps: agentResult.suggestedFollowUps,
          } as object,
          approvalStatus: 'APPROVED',
          deliveryStatus: sendRes.success ? 'SENT' : 'FAILED',
          providerMessageId: sendRes.messageId,
          deliveryError: sendRes.error,
        },
      });
    }

    const wantsVoice = /\b(voice|note|audio|listen)\b/i.test(customerText);
    if (wantsVoice && bubbles[0]) {
      try {
        const advisorName = lead.assignedUser?.name || 'Property Advisor';
        const voiceResult = await generateAdvisorVoiceNote(bubbles[0].text, {
          advisorName,
          leadName: contactName || lead.fullName,
        });
        await whatsAppService.sendVoiceNote(cleanPhone, voiceResult.audioBuffer, {
          credentials: waCredentials,
        });
      } catch (err: any) {
        logger.warn(`[WhatsApp Inbound] Voice note generation failed: ${err.message}`);
      }
    }

    if (
      (agentResult.siteVisitProposal || (agentResult.matchedProperties && agentResult.matchedProperties.length > 0)) &&
      agentResult.suggestedFollowUps &&
      agentResult.suggestedFollowUps.length > 0
    ) {
      const buttons = agentResult.suggestedFollowUps.slice(0, 3).map((f, idx) => ({
        id: `wa_opt_${idx}_${Date.now()}`,
        title: f.length > 20 ? f.slice(0, 20) : f,
      }));

      await whatsAppService.sendInteractiveButtons(
        cleanPhone,
        'Quick options:',
        buttons,
        { credentials: waCredentials },
      );
    }
  } catch (err: any) {
    logger.error(`[WhatsApp Webhook Error] ${err.message}`, { stack: err.stack });
  }
});

export default router;
