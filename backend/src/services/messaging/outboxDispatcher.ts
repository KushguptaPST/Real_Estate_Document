/**
 * Outbox Dispatcher — Transactional Outbox Pattern for durable, idempotent email dispatch.
 * Handles concurrency, bounded exponential backoff, retry safety, and audit logging.
 */

import { type MessageChannel } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { maskEmail } from '../../utils/audit.js';
import { getMessagingProvider, isValidEmail, type OutboundMessagePayload } from './messagingProvider.js';

export interface QueueDispatchParams {
  messageId: string;
  organizationId: string;
  leadId: string;
  recipientEmail?: string;
  channel?: MessageChannel;
  content: string;
  subject?: string;
  actorEmail?: string;
}

export interface QueueDispatchResult {
  queued: boolean;
  jobId?: string;
  reason?: string;
  duplicate?: boolean;
}

/**
 * Enqueues an approved message into the transactional outbox.
 * Guarantees idempotency via database unique constraints on idempotencyKey and messageId.
 */
export async function queueMessageDispatch(params: QueueDispatchParams): Promise<QueueDispatchResult> {
  const { messageId, organizationId, leadId, content, subject, actorEmail, channel = 'EMAIL' } = params;

  // 1. Resolve & validate recipient email
  let recipient = params.recipientEmail;
  if (!recipient) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      select: { email: true, fullName: true },
    });
    recipient = lead?.email ?? undefined;
  }

  if (!recipient || !isValidEmail(recipient)) {
    logger.warn(`[Outbox] Dispatch rejected for message ${messageId}: Missing or invalid recipient email.`);
    await prisma.conversationMessage.update({
      where: { id: messageId },
      data: {
        deliveryStatus: 'FAILED',
        failedAt: new Date(),
        deliveryError: 'Lead does not have a valid recipient email address',
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        action: 'MESSAGE_DISPATCH_FAILED',
        entityType: 'ConversationMessage',
        entityId: messageId,
        actor: actorEmail ?? 'system',
        note: 'Dispatch failed: Missing or invalid recipient email address',
      },
    });

    return { queued: false, reason: 'Missing or invalid recipient email address' };
  }

  const idempotencyKey = `dispatch-${messageId}`;

  // 2. Check if a dispatch job already exists for this message
  const existingJob = await prisma.outboxJob.findUnique({
    where: { messageId },
  });

  if (existingJob) {
    logger.info(`[Outbox] Duplicate dispatch suppressed for message ${messageId}: Job ${existingJob.id} already exists.`);
    return { queued: true, jobId: existingJob.id, duplicate: true };
  }

  const defaultSubject = subject || 'Update regarding your property enquiry';
  const payload: OutboundMessagePayload = {
    to: recipient.trim(),
    subject: defaultSubject,
    text: content,
    html: `<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;"><p>${content.replace(/\n/g, '<br/>')}</p></div>`,
    metadata: {
      messageId,
      leadId,
      organizationId,
    },
  };

  // 3. Atomically update message state and insert OutboxJob inside a database transaction
  const result = await prisma.$transaction(async (tx) => {
    await tx.conversationMessage.update({
      where: { id: messageId },
      data: {
        deliveryStatus: 'QUEUED',
        idempotencyKey,
      },
    });

    const job = await tx.outboxJob.create({
      data: {
        organizationId,
        messageId,
        recipientEmail: recipient.trim(),
        channel,
        payload: payload as object,
        idempotencyKey,
        status: 'PENDING',
        nextAttemptAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        action: 'MESSAGE_DISPATCH_QUEUED',
        entityType: 'ConversationMessage',
        entityId: messageId,
        actor: actorEmail ?? 'system',
        note: `Message queued for outbound dispatch to ${maskEmail(recipient)}`,
      },
    });

    return job;
  });

  logger.info(`[Outbox] Queued dispatch job ${result.id} for message ${messageId} to ${maskEmail(recipient)}`);
  return { queued: true, jobId: result.id };
}

/**
 * Processes pending and retrying outbox jobs.
 * Enforces atomic database locks to prevent concurrent workers from claiming the same job.
 */
export async function processOutboxJobs(options: {
  batchSize?: number;
  workerId?: string;
} = {}): Promise<{ processed: number; succeeded: number; failed: number; retried: number }> {
  const batchSize = options.batchSize ?? 10;
  const workerId = options.workerId ?? `worker-${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date();
  const staleLockThreshold = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutes lock timeout

  // 1. Fetch eligible jobs: PENDING or RETRYING, nextAttemptAt <= now, not locked or stale lock
  const candidateJobs = await prisma.outboxJob.findMany({
    where: {
      status: { in: ['PENDING', 'RETRYING'] },
      nextAttemptAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLockThreshold } }],
    },
    take: batchSize,
    orderBy: { nextAttemptAt: 'asc' },
  });

  if (candidateJobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, retried: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  let retried = 0;

  const provider = getMessagingProvider();

  for (const job of candidateJobs) {
    // 2. Atomically acquire lock using conditional update
    const lockAcquired = await prisma.outboxJob.updateMany({
      where: {
        id: job.id,
        status: job.status,
        updatedAt: job.updatedAt,
      },
      data: {
        status: 'PROCESSING',
        lockedAt: now,
        lockedBy: workerId,
      },
    });

    if (lockAcquired.count === 0) {
      // Another worker acquired the job
      continue;
    }

    // 3. Mark message as SENDING
    await prisma.conversationMessage.update({
      where: { id: job.messageId },
      data: { deliveryStatus: 'SENDING' },
    });

    const payload = job.payload as unknown as OutboundMessagePayload;

    try {
      // 4. Send via messaging provider
      const dispatchResult = await provider.send(payload);

      if (dispatchResult.success) {
        // Success: Mark completed and sent
        await prisma.$transaction([
          prisma.outboxJob.updateMany({
            where: { id: job.id },
            data: {
              status: 'COMPLETED',
              providerMessageId: dispatchResult.providerMessageId,
              lockedAt: null,
              lockedBy: null,
            },
          }),
          prisma.conversationMessage.updateMany({
            where: { id: job.messageId },
            data: {
              deliveryStatus: 'SENT',
              sentAt: new Date(),
              providerMessageId: dispatchResult.providerMessageId,
              deliveryError: null,
            },
          }),
          prisma.auditLog.create({
            data: {
              organizationId: job.organizationId,
              action: 'MESSAGE_SENT',
              entityType: 'ConversationMessage',
              entityId: job.messageId,
              actor: 'system',
              note: `Message dispatched via ${provider.name} (ID: ${dispatchResult.providerMessageId}) to ${maskEmail(job.recipientEmail)}`,
            },
          }),
        ]);
        succeeded++;
      } else {
        // Failure: evaluate transient vs permanent
        const nextAttempts = job.attempts + 1;
        const isTransient = dispatchResult.isTransient ?? true;
        const canRetry = isTransient && nextAttempts < job.maxAttempts;

        if (canRetry) {
          // Bounded exponential backoff: 5s, 15s, 45s (capped at 5 minutes)
          const backoffSeconds = Math.min(300, 5 * Math.pow(3, job.attempts));
          const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

          await prisma.$transaction([
            prisma.outboxJob.updateMany({
              where: { id: job.id },
              data: {
                status: 'RETRYING',
                attempts: nextAttempts,
                nextAttemptAt,
                lastError: dispatchResult.error,
                lockedAt: null,
                lockedBy: null,
              },
            }),
            prisma.conversationMessage.updateMany({
              where: { id: job.messageId },
              data: {
                deliveryStatus: 'RETRY_PENDING',
                deliveryError: dispatchResult.error,
              },
            }),
          ]);
          retried++;
        } else {
          // Permanent failure or max attempts exhausted
          await prisma.$transaction([
            prisma.outboxJob.updateMany({
              where: { id: job.id },
              data: {
                status: 'FAILED',
                attempts: nextAttempts,
                lastError: dispatchResult.error,
                lockedAt: null,
                lockedBy: null,
              },
            }),
            prisma.conversationMessage.updateMany({
              where: { id: job.messageId },
              data: {
                deliveryStatus: 'FAILED',
                failedAt: new Date(),
                deliveryError: dispatchResult.error,
              },
            }),
            prisma.auditLog.create({
              data: {
                organizationId: job.organizationId,
                action: 'MESSAGE_DISPATCH_FAILED',
                entityType: 'ConversationMessage',
                entityId: job.messageId,
                actor: 'system',
                note: `Outbound dispatch failed permanently: ${dispatchResult.error}`,
              },
            }),
          ]);
          failed++;
        }
      }
    } catch (unexpectedErr: any) {
      logger.error(`[Outbox Worker Error] Unexpected error processing job ${job.id}: ${unexpectedErr.message}`);
      await prisma.outboxJob.updateMany({
        where: { id: job.id },
        data: {
          lockedAt: null,
          lockedBy: null,
          lastError: unexpectedErr.message,
        },
      });
      failed++;
    }
  }

  return {
    processed: candidateJobs.length,
    succeeded,
    failed,
    retried,
  };
}

/**
 * Resets a failed outbox job for authorized manual retry.
 */
export async function retryMessageDispatch(params: {
  messageId: string;
  organizationId: string;
  actorEmail?: string;
}): Promise<{ retried: boolean; message: string }> {
  const { messageId, organizationId, actorEmail } = params;

  const job = await prisma.outboxJob.findUnique({
    where: { messageId },
  });

  if (!job) {
    return { retried: false, message: 'No outbox job found for this message' };
  }

  if (job.status !== 'FAILED') {
    return { retried: false, message: `Only failed jobs can be retried (current status: ${job.status})` };
  }

  await prisma.$transaction([
    prisma.outboxJob.update({
      where: { id: job.id },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextAttemptAt: new Date(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
      },
    }),
    prisma.conversationMessage.update({
      where: { id: messageId },
      data: {
        deliveryStatus: 'QUEUED',
        failedAt: null,
        deliveryError: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        organizationId,
        action: 'MESSAGE_RETRY_REQUESTED',
        entityType: 'ConversationMessage',
        entityId: messageId,
        actor: actorEmail ?? 'system',
        note: `Manual retry requested for message ${messageId}`,
      },
    }),
  ]);

  // Immediately attempt processing
  await processOutboxJobs({ batchSize: 5 });

  return { retried: true, message: 'Dispatch retry queued successfully' };
}
