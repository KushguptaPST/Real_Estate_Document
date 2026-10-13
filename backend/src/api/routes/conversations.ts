// ─────────────────────────────────────────────────────────────────────────────
// /api/leads/:id/conversations — Multi-Channel Conversations & Takeover Routes
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import {
  getOrCreateLeadThread,
  handleCustomerMessage,
  handleAdvisorMessage,
  toggleHumanTakeover,
  toggleAutoPilot,
  reviewAiMessage,
  retryLeadMessage,
} from '../../services/conversation.service.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router({ mergeParams: true });

const PostMessageSchema = z.object({
  content: z.string().min(1, 'Message content cannot be empty'),
  channel: z.enum(['EMAIL', 'WHATSAPP', 'SMS', 'WEB_CHAT']).optional(),
});

const TakeoverSchema = z.object({
  isHumanTakeover: z.boolean(),
});

const AutoPilotSchema = z.object({
  autoReplyEnabled: z.boolean(),
});

const ReviewMessageSchema = z.object({
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EDITED']),
  editedContent: z.string().optional(),
});

/**
 * Server-side authorization check for conversation endpoints.
 * - Resolves lead in caller's organization. Cross-tenant returns 404 (no information leakage).
 * - AGENT callers are restricted strictly to their assigned leads (returns 403).
 * - OWNER callers are authorized across all leads in the organization.
 */
async function authorizeConversationLead(
  leadId: string,
  user: { id: string; role: string; organizationId: string },
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: user.organizationId },
  });
  if (!lead) {
    throw createError('Lead not found', 404);
  }
  if (user.role === 'AGENT' && lead.assignedUserId && lead.assignedUserId !== user.id) {
    throw createError('Agents may only access conversations for their assigned leads', 403);
  }
  return lead;
}

// ── GET /api/leads/:id/conversations ─────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leadId = req.params['id'];
    await authorizeConversationLead(leadId, req.user!);
    const thread = await getOrCreateLeadThread(leadId, req.user!.organizationId);
    res.json(thread);
  }),
);

// ── POST /api/leads/:id/conversations/messages (Customer Simulation / Inbound)
router.post(
  '/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    // In production environments, customer simulation is disabled unless explicitly enabled
    if (process.env['NODE_ENV'] === 'production' && process.env['ENABLE_CUSTOMER_SIMULATION'] !== 'true') {
      throw createError('Customer inquiry simulation is disabled in production environments', 403);
    }

    const leadId = req.params['id'];
    await authorizeConversationLead(leadId, req.user!);
    const parsed = PostMessageSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const result = await handleCustomerMessage({
      leadId,
      organizationId: req.user!.organizationId,
      content: parsed.data.content,
      channel: parsed.data.channel,
    });

    res.status(201).json(result);
  }),
);

// ── POST /api/leads/:id/conversations/messages/agent (Authenticated Advisor) ──
router.post(
  '/messages/agent',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leadId = req.params['id'];
    await authorizeConversationLead(leadId, req.user!);
    const parsed = PostMessageSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const result = await handleAdvisorMessage({
      leadId,
      organizationId: req.user!.organizationId,
      senderId: req.user!.id,
      senderEmail: req.user!.email,
      callerRole: req.user!.role,
      content: parsed.data.content,
      channel: parsed.data.channel,
    });

    res.status(201).json({
      message: result.message,
      ...result.message,
    });
  }),
);

// ── POST /api/leads/:id/conversations/takeover ───────────────────────────────
router.post(
  '/takeover',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leadId = req.params['id'];
    await authorizeConversationLead(leadId, req.user!);
    const parsed = TakeoverSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const thread = await getOrCreateLeadThread(leadId, req.user!.organizationId);
    const updated = await toggleHumanTakeover(
      thread.id,
      parsed.data.isHumanTakeover,
      req.user!.organizationId,
      req.user?.email,
    );

    res.json(updated);
  }),
);

// ── POST /api/leads/:id/conversations/autopilot ──────────────────────────────
router.post(
  '/autopilot',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leadId = req.params['id'];
    await authorizeConversationLead(leadId, req.user!);
    const parsed = AutoPilotSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const thread = await getOrCreateLeadThread(leadId, req.user!.organizationId);
    const updated = await toggleAutoPilot(
      thread.id,
      parsed.data.autoReplyEnabled,
      req.user!.organizationId,
      req.user?.email,
    );

    res.json(updated);
  }),
);

// ── PATCH /api/leads/:id/conversations/messages/:msgId ───────────────────────
router.patch(
  '/messages/:msgId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leadId = req.params['id'];
    await authorizeConversationLead(leadId, req.user!);
    const parsed = ReviewMessageSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const updated = await reviewAiMessage({
      messageId: req.params['msgId'],
      status: parsed.data.status,
      organizationId: req.user!.organizationId,
      leadId,
      editedContent: parsed.data.editedContent,
      actorEmail: req.user?.email,
    });

    res.json(updated);
  }),
);

// ── POST /api/leads/:id/conversations/messages/:msgId/retry ──────────────────
router.post(
  '/messages/:msgId/retry',
  requireAuth,
  asyncHandler(async (req, res) => {
    const leadId = req.params['id'];
    const messageId = req.params['msgId'];
    await authorizeConversationLead(leadId, req.user!);

    const result = await retryLeadMessage({
      leadId,
      messageId,
      organizationId: req.user!.organizationId,
      callerId: req.user!.id,
      callerRole: req.user!.role,
      actorEmail: req.user?.email,
    });

    res.json(result);
  }),
);

export default router;
