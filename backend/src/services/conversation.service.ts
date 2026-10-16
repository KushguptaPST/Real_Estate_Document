// ─────────────────────────────────────────────────────────────────────────────
// Conversation Service — Multi-Channel Assistant, State Machine & Safety Guardrails
// ─────────────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';
import {
  type MessageChannel,
  type SenderType,
  type ApprovalStatus,
  type ConversationState,
  type UserRole,
} from '@prisma/client';

import { prisma } from '../utils/prisma.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { getLeadDetails } from './lead.service.js';
import { createError } from '../middleware/errorHandler.js';
import { requireOrgId } from '../utils/tenant.js';
import { runSalesAgentLoop } from './agent/agentRuntime.js';
import {
  queueMessageDispatch,
  processOutboxJobs,
  retryMessageDispatch,
} from './messaging/outboxDispatcher.js';
import { sendTelegramMessage } from './telegram.service.js';


const SuggestedReplySchema = z.object({
  suggestedReply: z.string(),
  reasoning: z.string().catch(''),
  suggestedFollowUps: z.array(z.string()).catch([]),
  extractedPreferences: z
    .object({
      minBudget: z.number().nullable().optional(),
      maxBudget: z.number().nullable().optional(),
      locations: z.array(z.string()).optional(),
    })
    .optional(),
});

const replyJsonSchema = {
  type: 'object',
  properties: {
    suggestedReply: { type: 'string' },
    reasoning: { type: 'string' },
    suggestedFollowUps: { type: 'array', items: { type: 'string' } },
  },
  required: ['suggestedReply'],
} as const;

/**
 * Loads or provisions the active conversation thread for a lead scoped to organization.
 */
export async function getOrCreateLeadThread(
  leadId: string,
  organizationId: string,
  channel: MessageChannel = 'EMAIL',
) {
  const orgId = requireOrgId(organizationId);
  const ch = channel;

  // Ensure lead exists in this tenant
  await getLeadDetails(leadId, orgId);

  let thread = await prisma.conversationThread.findFirst({
    where: {
      leadId,
      channel: ch,
      organizationId: orgId,
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!thread) {
    thread = await prisma.conversationThread.create({
      data: {
        leadId,
        organizationId: orgId,
        channel: ch,
        state: 'AUTOPILOT',
        isHumanTakeover: false,
        autoReplyEnabled: true,
      },
      include: { messages: true },
    });
  }

  return thread;
}

/**
 * Handles authenticated advisor message submission during human takeover / advisor intervention.
 * Strictly derives author and senderType (AGENT) from authenticated user identity.
 * Does NOT generate AI reply or enter buyer-memory as customer statements.
 */
async function dispatchOutboundMessage(params: {
  messageId: string;
  leadId: string;
  organizationId: string;
  channel: MessageChannel;
  content: string;
  actorEmail?: string;
  lead: { email?: string | null; externalId?: string | null };
}) {
  const { messageId, leadId, organizationId, channel, content, actorEmail, lead } = params;
  const isTelegram = (channel as string) === 'TELEGRAM' || Boolean(lead.externalId?.startsWith('telegram:'));
  const tgChatId = lead.externalId?.startsWith('telegram:')
    ? lead.externalId.replace('telegram:', '')
    : null;

  if (isTelegram && tgChatId) {
    try {
      const delivered = await sendTelegramMessage(
        tgChatId,
        content,
        { parseMode: 'HTML' }
      );
      if (delivered) {
        await prisma.conversationMessage.update({
          where: { id: messageId },
          data: {
            deliveryStatus: 'DELIVERED',
            deliveredAt: new Date(),
            sentAt: new Date(),
            deliveryError: null,
          },
        });
        await prisma.auditLog.create({
          data: {
            organizationId,
            action: 'MESSAGE_SENT',
            entityType: 'ConversationMessage',
            entityId: messageId,
            actor: actorEmail ?? 'system',
            note: `Message dispatched via Telegram to chat ${tgChatId}`,
          },
        });
        return;
      }
    } catch (tgErr: any) {
      logger.error(`[Telegram Dispatch Error] ${tgErr.message}`);
    }

    await prisma.conversationMessage.update({
      where: { id: messageId },
      data: {
        deliveryStatus: 'FAILED',
        failedAt: new Date(),
        deliveryError: 'Failed to deliver message via Telegram bot API',
      },
    });
    return;
  }

  // Standard Email / Outbox dispatch
  try {
    await queueMessageDispatch({
      messageId,
      organizationId,
      leadId,
      recipientEmail: lead.email ?? undefined,
      channel,
      content,
      actorEmail,
    });
    processOutboxJobs({ batchSize: 5 }).catch((err) =>
      logger.error(`[Outbox Worker Error] Failed processing message dispatch: ${err.message}`),
    );
  } catch (queueErr: any) {
    logger.error(`[Outbox Error] Failed to queue message dispatch: ${queueErr.message}`);
  }
}

export async function handleAdvisorMessage(params: {
  leadId: string;
  organizationId: string;
  senderId: string;
  senderEmail?: string;
  callerRole: UserRole;
  content: string;
  channel?: MessageChannel;
}) {
  const { leadId, senderId, senderEmail, callerRole, channel = 'EMAIL', content } = params;
  const orgId = requireOrgId(params.organizationId);

  // 1. Authorize: Lead must belong to organization
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
  });
  if (!lead) throw createError('Lead not found', 404);

  // 2. Role authorization: AGENT can only act on their assigned lead
  if (callerRole === 'AGENT' && lead.assignedUserId && lead.assignedUserId !== senderId) {
    throw createError('Agents can only send advisor messages for their assigned leads', 403);
  }

  const thread = await getOrCreateLeadThread(leadId, orgId, channel);

  // Save Advisor Message: senderType is strictly AGENT, senderId is authenticated user ID!
  const advisorMsg = await prisma.conversationMessage.create({
    data: {
      threadId: thread.id,
      organizationId: orgId,
      senderType: 'AGENT',
      senderId,
      content,
      approvalStatus: 'APPROVED',
      deliveryStatus: 'SENDING',
    },
  });

  // Outbound dispatch: Direct to Telegram if lead is from Telegram, otherwise queue to email outbox
  await dispatchOutboundMessage({
    messageId: advisorMsg.id,
    leadId,
    organizationId: orgId,
    channel,
    content,
    actorEmail: senderEmail ?? senderId,
    lead,
  });

  const updatedMsg = await prisma.conversationMessage.findUnique({
    where: { id: advisorMsg.id },
  });

  return {
    message: updatedMsg ?? advisorMsg,
  };
}

/**
 * Handles incoming customer message with explicit state machine checks.
 * Under HUMAN_TAKEOVER or PAUSED states, AI automated responses are strictly BLOCKED.
 */

export async function handleCustomerMessage(params: {
  leadId: string;
  organizationId: string;
  channel?: MessageChannel;
  content: string;
}) {
  const { leadId, channel = 'EMAIL', content } = params;
  const orgId = requireOrgId(params.organizationId);

  const thread = await getOrCreateLeadThread(leadId, orgId, channel);

  // Save Customer Message
  const customerMsg = await prisma.conversationMessage.create({
    data: {
      threadId: thread.id,
      organizationId: orgId,
      senderType: 'CUSTOMER',
      content,
      approvalStatus: 'APPROVED',
    },
  });

  // State Machine Safeguard Check
  if (thread.state === 'HUMAN_TAKEOVER' || thread.isHumanTakeover || thread.state === 'PAUSED' || thread.state === 'CLOSED') {
    logger.info(`[Conversation] State is ${thread.state} for lead ${leadId}. Customer-facing AI response suppressed.`);
    return {
      message: customerMsg,
      aiReply: null,
      suppressedReason: `Human takeover is active. Conversation is currently in state '${thread.state}'. Automated responses are disabled.`,
    };
  }

  // Generate Suggested Reply Proposal via Bounded Agent Runtime
  const suggested = await generateSuggestedReply({
    threadId: thread.id,
    leadId,
    organizationId: orgId,
    customerMessage: content,
  });

  if ((suggested as any).suppressed) {
    return {
      message: customerMsg,
      aiReply: null,
      suppressedReason: (suggested as any).suppressedReason ?? 'AI response suppressed.',
    };
  }

  // Status calculation: In AUTOPILOT mode (autoReplyEnabled), conversation replies are auto-approved instantly.
  // In DRAFT_ONLY mode (or test suites), replies default to PENDING_APPROVAL.
  const isAutoApprove =
    (thread.state === 'AUTOPILOT' || thread.autoReplyEnabled) &&
    (process.env['AUTO_APPROVE_AI_REPLIES'] === 'true' || process.env['NODE_ENV'] !== 'test');

  const initialStatus: ApprovalStatus = isAutoApprove ? 'APPROVED' : 'PENDING_APPROVAL';

  const aiMsg = await prisma.conversationMessage.create({
    data: {
      threadId: thread.id,
      organizationId: orgId,
      senderType: 'AI',
      content: suggested.suggestedReply,
      suggestedAction: {
        followUps: suggested.suggestedFollowUps,
        reasoning: suggested.reasoning,
        toolExecutions: (suggested as any).toolExecutions ?? [],
        taskProposal: (suggested as any).taskProposal ?? null,
        requirementProposal: (suggested as any).requirementProposal ?? null,
        qualificationResult: (suggested as any).qualificationResult ?? null,
        siteVisitProposal: (suggested as any).siteVisitProposal ?? null,
        siteVisitBooking: (suggested as any).siteVisitBooking ?? null,
        escalation: (suggested as any).escalation ?? null,
        followUpProposal: (suggested as any).followUpProposal ?? null,
      } as object,
      approvalStatus: initialStatus,
    },
  });

  // When auto-approved in AUTOPILOT mode, enqueue for durable dispatch
  if (initialStatus === 'APPROVED') {
    try {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId: orgId },
        select: { id: true, email: true, externalId: true },
      });

      if (lead) {
        await dispatchOutboundMessage({
          messageId: aiMsg.id,
          leadId,
          organizationId: orgId,
          channel: thread.channel,
          content: aiMsg.content,
          actorEmail: 'ai_sales_agent',
          lead,
        });
      }
    } catch (dispatchErr: any) {
      logger.error(`[Conversation Dispatch Error] Failed to dispatch autopilot message: ${dispatchErr.message}`);
    }
  }

  return {
    message: customerMsg,
    aiReply: aiMsg,
    suggestedFollowUps: suggested.suggestedFollowUps,
  };
}

/**
 * Generates context-aware suggested reply using the Phase 2A agent runtime.
 */
export async function generateSuggestedReply(params: {
  threadId: string;
  leadId: string;
  organizationId: string;
  customerMessage?: string;
}) {
  const { threadId, leadId } = params;
  const organizationId = requireOrgId(params.organizationId);

  const lead = await getLeadDetails(leadId, organizationId);
  const thread = await prisma.conversationThread.findFirst({
    where: { id: threadId, leadId, organizationId },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });

  if (!thread) throw createError('Thread not found', 404);

  const latestCustomerMsg =
    params.customerMessage ??
    thread.messages.find((m) => m.senderType === 'CUSTOMER')?.content ??
    'Hello, I am looking for property information.';

  const recentMessages = thread.messages
    .slice()
    .reverse()
    .map((m) => ({ senderType: m.senderType, content: m.content }));

  const agentResult = await runSalesAgentLoop({
    leadId,
    organizationId,
    threadId,
    customerMessage: latestCustomerMsg,
    recentMessages,
  });

  if (agentResult.suppressed) {
    return {
      suggestedReply: '',
      reasoning: agentResult.reasoning,
      suggestedFollowUps: [],
      suppressed: true,
      suppressedReason: agentResult.suppressedReason,
      toolExecutions: agentResult.executedTools,
    };
  }

  return {
    suggestedReply: agentResult.response,
    reasoning: agentResult.reasoning,
    suggestedFollowUps: agentResult.suggestedFollowUps,
    toolExecutions: agentResult.executedTools,
    taskProposal: agentResult.taskProposal ?? null,
    requirementProposal: agentResult.requirementProposal ?? null,
    qualificationResult: agentResult.qualificationResult ?? null,
    siteVisitProposal: agentResult.siteVisitProposal ?? null,
    siteVisitBooking: agentResult.siteVisitBooking ?? null,
    escalation: agentResult.escalation ?? null,
    followUpProposal: agentResult.followUpProposal ?? null,
  };
}

/**
 * Toggles human takeover mode with explicit conversation state transition.
 */
export async function toggleHumanTakeover(
  threadId: string,
  isHumanTakeover: boolean,
  organizationId: string,
  actorEmail?: string,
) {
  const orgId = requireOrgId(organizationId);
  const actor = actorEmail;

  const targetState: ConversationState = isHumanTakeover ? 'HUMAN_TAKEOVER' : 'AUTOPILOT';

  const thread = await prisma.conversationThread.findFirst({
    where: { id: threadId, organizationId: orgId },
  });
  if (!thread) throw createError('Thread not found', 404);

  const updated = await prisma.conversationThread.update({
    where: { id: threadId },
    data: {
      state: targetState,
      isHumanTakeover,
      takeoverBy: isHumanTakeover ? (actor ?? 'agent') : null,
      autoReplyEnabled: !isHumanTakeover,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: thread.organizationId,
      action: 'HUMAN_TAKEOVER_TOGGLED',
      entityType: 'ConversationThread',
      entityId: threadId,
      actor: actor ?? 'system',
      note: isHumanTakeover
        ? 'Agent enabled Human Takeover. AI automated replies are strictly paused.'
        : 'Agent disabled Human Takeover. AI assistant resumed in AUTOPILOT state.',
    },
  });

  return updated;
}

/**
 * Toggles auto-pilot mode for a conversation thread.
 */
export async function toggleAutoPilot(
  threadId: string,
  autoReplyEnabled: boolean,
  organizationId: string,
  actorEmail?: string,
) {
  const orgId = requireOrgId(organizationId);
  const actor = actorEmail;

  const thread = await prisma.conversationThread.findFirst({
    where: { id: threadId, organizationId: orgId },
  });
  if (!thread) throw createError('Thread not found', 404);

  const newState: ConversationState = autoReplyEnabled ? 'AUTOPILOT' : 'DRAFT_ONLY';

  const updated = await prisma.conversationThread.update({
    where: { id: threadId },
    data: {
      autoReplyEnabled,
      state: thread.isHumanTakeover ? 'HUMAN_TAKEOVER' : newState,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: thread.organizationId,
      action: 'LEAD_UPDATED',
      entityType: 'ConversationThread',
      entityId: threadId,
      actor: actor ?? 'system',
      note: autoReplyEnabled
        ? 'Assisted Draft Mode enabled. AI suggested replies are generated as drafts for review.'
        : 'Manual Mode enabled. AI suggested replies are paused.',
    },
  });

  return updated;
}

/**
 * Approves, edits, or rejects an AI suggested reply message before dispatching.
 */
export async function reviewAiMessage(params: {
  messageId: string;
  status: ApprovalStatus;
  organizationId: string;
  /** When given, the message must also belong to this lead's thread. */
  leadId?: string;
  editedContent?: string;
  actorEmail?: string;
}) {
  const { messageId, status, leadId, editedContent, actorEmail } = params;
  const organizationId = requireOrgId(params.organizationId);

  const existing = await prisma.conversationMessage.findFirst({
    where: {
      id: messageId,
      organizationId,
      thread: { organizationId, ...(leadId ? { leadId } : {}) },
    },
    include: {
      thread: true,
    },
  });
  if (!existing) throw createError('Message not found', 404);

  if (existing.senderType === 'CUSTOMER') {
    throw createError('Customer-authored messages cannot be modified or reviewed through AI endpoints', 400);
  }
  if (existing.senderType !== 'AI') {
    throw createError('Only AI-generated messages can be reviewed', 400);
  }

  const updated = await prisma.conversationMessage.update({
    where: { id: messageId },
    data: {
      approvalStatus: status,
      content: editedContent || existing.content,
      senderType: status === 'EDITED' ? 'AGENT' : existing.senderType,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: existing.organizationId,
      action: 'LEAD_UPDATED',
      entityType: 'ConversationMessage',
      entityId: messageId,
      actor: actorEmail ?? 'system',
      note: `AI suggested message reviewed with status: ${status}`,
    },
  });

  // When AI draft is approved, enter the durable dispatch queue
  if (status === 'APPROVED' && existing.deliveryStatus === 'NOT_APPLICABLE') {
    try {
      const lead = await prisma.lead.findFirst({
        where: { id: existing.thread.leadId, organizationId },
        select: { id: true, email: true, externalId: true },
      });

      if (lead) {
        await dispatchOutboundMessage({
          messageId,
          leadId: existing.thread.leadId,
          organizationId,
          channel: existing.thread.channel,
          content: updated.content,
          actorEmail,
          lead,
        });
      }
    } catch (queueErr: any) {
      logger.error(`[Outbox Error] Failed to dispatch approved AI draft: ${queueErr.message}`);
    }
  }

  const finalMsg = await prisma.conversationMessage.findUnique({
    where: { id: messageId },
  });

  return finalMsg ?? updated;
}

/**
 * Retries dispatch of an eligible failed outbound message for an assigned advisor's lead.
 */
export async function retryLeadMessage(params: {
  leadId: string;
  messageId: string;
  organizationId: string;
  callerId: string;
  callerRole: UserRole;
  actorEmail?: string;
}) {
  const { leadId, messageId, callerId, callerRole, actorEmail } = params;
  const organizationId = requireOrgId(params.organizationId);

  // 1. Authorize lead belongs to organization
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
  });
  if (!lead) throw createError('Lead not found', 404);

  // 2. Role authorization: AGENT can only act on their assigned lead
  if (callerRole === 'AGENT' && lead.assignedUserId && lead.assignedUserId !== callerId) {
    throw createError('Agents can only retry messages for their assigned leads', 403);
  }

  // 3. Message must belong to this lead and thread
  const message = await prisma.conversationMessage.findFirst({
    where: {
      id: messageId,
      organizationId,
      thread: { leadId, organizationId },
    },
  });
  if (!message) throw createError('Message not found', 404);

  if (message.deliveryStatus !== 'FAILED') {
    throw createError(`Only failed messages can be retried (current status: ${message.deliveryStatus})`, 400);
  }

  const result = await retryMessageDispatch({
    messageId,
    organizationId,
    actorEmail: actorEmail ?? callerId,
  });

  const updated = await prisma.conversationMessage.findUnique({
    where: { id: messageId },
  });

  return {
    ...result,
    message: updated,
  };
}
