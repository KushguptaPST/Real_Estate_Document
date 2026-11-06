/**
 * Meta WhatsApp Business Cloud API Inbound Webhook
 *
 * Implements:
 * 1. GET  / — Meta hub challenge verification handshake
 * 2. POST / — Inbound message processor with speed-to-lead autopilot,
 *             human chat physics (micro-bubble chunking), and voice note delivery
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../../utils/prisma.js';
import { logger } from '../../../utils/logger.js';
import { whatsAppService } from '../../../services/messaging/whatsapp.service.js';
import {
  prepareConversationalBubbles,
  isNightOwlWindow,
  getNightOwlAcknowledgment,
} from '../../../services/messaging/humanChatPhysics.js';
import { generateAdvisorVoiceNote } from '../../../services/voice/voiceNote.service.js';
import { getOrCreateLeadThread } from '../../../services/conversation.service.js';
import { runSalesAgentLoop } from '../../../services/agent/agentRuntime.js';
import { walletService } from '../../../services/billing/wallet.service.js';

const router = Router();

/**
 * Meta Webhook Verification Handshake
 */
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env['META_VERIFY_TOKEN'] || 'contingency_copilot_meta_webhook_secret';

  if (mode === 'subscribe' && token === expectedToken) {
    logger.info('[WhatsApp Webhook] Verification challenge passed successfully');
    res.status(200).send(challenge);
    return;
  }

  logger.warn('[WhatsApp Webhook] Verification failed: token mismatch');
  res.status(403).json({ error: 'Verification token mismatch' });
});

/**
 * Inbound Webhook Event Processor
 */
router.post('/', async (req: Request, res: Response) => {
  // Acknowledge Meta immediately within 2 seconds
  res.status(200).json({ status: 'received' });

  const body = req.body;
  if (!body || body.object !== 'whatsapp_business_account') {
    return;
  }

  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    const contact = change?.contacts?.[0];

    if (!message) {
      // Could be a status update (delivered, read) rather than a new message
      return;
    }

    const rawFrom = message.from;
    const cleanPhone = whatsAppService.sanitizePhoneNumber(rawFrom);
    const metaMessageId = message.id;
    const contactName = contact?.profile?.name || '';

    logger.info(`[WhatsApp Inbound] Received message from ${cleanPhone} (${contactName || 'Unknown'})`);

    // Extract text content based on message type
    let customerText = '';
    if (message.type === 'text') {
      customerText = message.text?.body || '';
    } else if (message.type === 'interactive' && message.interactive?.button_reply) {
      customerText = message.interactive.button_reply.title || message.interactive.button_reply.id || '';
    } else if (message.type === 'button') {
      customerText = message.button?.text || '';
    } else if (message.type === 'audio') {
      customerText = '[Sent an audio voice message]';
    }

    if (!customerText.trim()) {
      return;
    }

    // Resolve tenant organization
    let orgId = process.env['DEFAULT_ORG_ID'] || 'demo-sandbox-org';

    if (!process.env['DEFAULT_ORG_ID']) {
      const tenantOrg = await prisma.organization.findFirst({
        select: { id: true },
      });
      if (tenantOrg) {
        orgId = tenantOrg.id;
      }
    }

    // Prevent duplicate processing of the same Meta message ID
    const existingMsg = await prisma.conversationMessage.findFirst({
      where: {
        providerMessageId: metaMessageId,
      },
    });
    if (existingMsg) {
      logger.info(`[WhatsApp Inbound] Skipping already processed message ID: ${metaMessageId}`);
      return;
    }

    // Find or provision Lead
    let lead = await prisma.lead.findFirst({
      where: {
        organizationId: orgId,
        phone: cleanPhone,
      },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          organizationId: orgId,
          phone: cleanPhone,
          fullName: contactName || `WhatsApp Buyer ${cleanPhone.slice(-4)}`,
          source: 'WHATSAPP',
          status: 'NEW',
          priority: 'HIGH', // Speed-to-lead inbound priority
        },
      });
      logger.info(`[WhatsApp Inbound] Provisioned new lead ID ${lead.id} for phone ${cleanPhone}`);
    }

    // Retrieve or create WhatsApp conversation thread
    const thread = await getOrCreateLeadThread(lead.id, orgId, 'WHATSAPP');

    // Record incoming customer message in CRM
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

    // Deduct metered WhatsApp speed-to-lead qualification ($0.06/lead)
    try {
      await walletService.deductWhatsAppQualification(orgId, {
        leadId: lead.id,
        phone: cleanPhone,
        leadName: lead.fullName,
      });
    } catch (waDeductErr: any) {
      logger.warn(`[Wallet WhatsApp Deduction Warning] ${waDeductErr.message}`);
    }

    // Check Human Takeover Guard
    if (thread.isHumanTakeover) {
      logger.info(`[WhatsApp Inbound] Lead ${lead.id} is under human takeover; AI auto-reply suppressed`);
      return;
    }

    // Check Night-Owl Window (10:00 PM - 08:00 AM)
    if (isNightOwlWindow()) {
      const nightOwlText = getNightOwlAcknowledgment(contactName);
      await whatsAppService.sendTextMessage(cleanPhone, nightOwlText);
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
      logger.info(`[WhatsApp Inbound] Night-owl acknowledgment sent to ${cleanPhone}`);
      return;
    }

    // Fetch recent messages for conversational context
    const recentDbMessages = await prisma.conversationMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    const recentMessages = recentDbMessages.reverse().map((m) => ({
      senderType: m.senderType,
      content: m.content,
    }));

    // Run Sales Agent Brain Loop
    const agentResult = await runSalesAgentLoop({
      leadId: lead.id,
      organizationId: orgId,
      threadId: thread.id,
      customerMessage: customerText,
      customerName: contactName || lead.fullName,
      recentMessages,
    });

    const replyText = agentResult.response;
    if (!replyText) {
      return;
    }

    // Enforce Human Chat Physics: Chunk into natural micro-bubbles
    const bubbles = prepareConversationalBubbles(replyText);

    // Dispatch micro-bubbles with typing simulation
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i]!;

      // Simulate human typing pause
      if (process.env['NODE_ENV'] !== 'test') {
        await new Promise((r) => setTimeout(r, Math.min(bubble.typingDelayMs, 2500)));
      }

      const sendRes = await whatsAppService.sendTextMessage(cleanPhone, bubble.text);

      await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgId,
          senderType: 'AGENT',
          content: bubble.text,
          approvalStatus: 'APPROVED',
          deliveryStatus: sendRes.success ? 'SENT' : 'FAILED',
          providerMessageId: sendRes.messageId,
          deliveryError: sendRes.error,
        },
      });
    }

    // Check if the user asked for voice notes or if this is an inaugural property match pitch
    const wantsVoice = /(voice|note|audio|call|speak|listen)/i.test(customerText);
    if (wantsVoice && bubbles[0]) {
      try {
        const voiceResult = await generateAdvisorVoiceNote(bubbles[0].text, {
          advisorName: 'Arjun',
          leadName: contactName,
        });

        await whatsAppService.sendVoiceNote(cleanPhone, voiceResult.audioBuffer);
        logger.info(`[WhatsApp Inbound] Cloned voice note delivered to ${cleanPhone}`);
      } catch (err: any) {
        logger.warn(`[WhatsApp Inbound] Voice note generation failed: ${err.message}`);
      }
    }

    // If site visit closing options are available, send quick-reply interactive buttons
    if (agentResult.suggestedFollowUps && agentResult.suggestedFollowUps.length > 0) {
      const buttons = agentResult.suggestedFollowUps.slice(0, 3).map((f, idx) => ({
        id: `slot_${idx}_${Date.now()}`,
        title: f.length > 20 ? f.slice(0, 20) : f,
      }));

      await whatsAppService.sendInteractiveButtons(
        cleanPhone,
        'Would one of these times work best to walk through the space in person?',
        buttons
      );
    }
  } catch (err: any) {
    logger.error(`[WhatsApp Webhook Error] ${err.message}`, { stack: err.stack });
  }
});

export default router;
