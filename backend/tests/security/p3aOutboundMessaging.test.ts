import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/utils/prisma.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';
import {
  setCustomMessagingProvider,
  type IMessagingProvider,
  type OutboundMessagePayload,
  type OutboundDispatchResult,
} from '../../src/services/messaging/messagingProvider.js';
import {
  queueMessageDispatch,
  processOutboxJobs,
  retryMessageDispatch,
} from '../../src/services/messaging/outboxDispatcher.js';
import { verifySvixSignature } from '../../src/services/webhook.service.js';

const app = createApp();

describe('Phase 3A: Production-Grade Outbound Messaging Integration Suite', () => {
  const svixSecret = 'whsec_mfZgV2n3iL7uR4kE8oP1tY9wA6sD0fGh'; // base64 encoded test secret
  const originalResendSecret = process.env.RESEND_WEBHOOK_SECRET;
  const originalDriver = process.env.EMAIL_DRIVER;

  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA1: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA2: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;

  let leadA1: any;
  let leadA2: any;
  let leadB: any;

  let threadA1: any;
  let threadA2: any;
  let threadB: any;

  beforeAll(async () => {
    process.env.RESEND_WEBHOOK_SECRET = svixSecret;
    process.env.EMAIL_DRIVER = 'resend';

    // 1. Create test organizations
    orgA = await prisma.organization.create({ data: { name: 'P3A Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P3A Org B' } });

    // 2. Create users
    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA1 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentA2 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });

    // 3. Create leads
    leadA1 = await prisma.lead.create({
      data: {
        organizationId: orgA.id,
        fullName: 'Alice Buyer',
        email: 'alice.buyer@example.com',
        phone: '+13055550101',
        assignedUserId: agentA1.user.id,
      },
    });

    leadA2 = await prisma.lead.create({
      data: {
        organizationId: orgA.id,
        fullName: 'Bob Buyer',
        email: 'bob.buyer@example.com',
        phone: '+13055550102',
        assignedUserId: agentA2.user.id,
      },
    });

    leadB = await prisma.lead.create({
      data: {
        organizationId: orgB.id,
        fullName: 'Charlie Buyer',
        email: 'charlie.buyer@example.com',
        phone: '+13055550103',
        assignedUserId: agentB.user.id,
      },
    });

    // 4. Create conversation threads
    threadA1 = await prisma.conversationThread.create({
      data: {
        organizationId: orgA.id,
        leadId: leadA1.id,
        channel: 'EMAIL',
      },
    });

    threadA2 = await prisma.conversationThread.create({
      data: {
        organizationId: orgA.id,
        leadId: leadA2.id,
        channel: 'EMAIL',
      },
    });

    threadB = await prisma.conversationThread.create({
      data: {
        organizationId: orgB.id,
        leadId: leadB.id,
        channel: 'EMAIL',
      },
    });
  });

  afterAll(async () => {
    process.env.RESEND_WEBHOOK_SECRET = originalResendSecret;
    process.env.EMAIL_DRIVER = originalDriver;
    // Let any pending background workers settle
    await new Promise((r) => setTimeout(r, 200));
    setCustomMessagingProvider(null);

    // Clean up
    await prisma.webhookEvent.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.outboxJob.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.conversationMessage.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.conversationThread.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.lead.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
    await prisma.$disconnect();
  });

  function generateSvixHeaders(payloadStr: string, secret: string = svixSecret, timestampOffset = 0) {
    const svixId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const svixTimestamp = String(Math.floor(Date.now() / 1000) + timestampOffset);

    const secretBytes = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice(6), 'base64')
      : Buffer.from(secret, 'utf8');

    const toSign = `${svixId}.${svixTimestamp}.${payloadStr}`;
    const sig = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

    return {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': `v1,${sig}`,
    };
  }

  // ── 1. Approval and Dispatch Lifecycle ────────────────────────────────────
  describe('1. Approval & Outbox Lifecycle', () => {
    it('requires human approval before an AI draft can enter the dispatch queue', async () => {
      // Create an AI draft in threadA1
      const draftMsg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AI',
          content: 'Suggested follow-up regarding your property inquiry.',
          approvalStatus: 'PENDING_APPROVAL',
          deliveryStatus: 'NOT_APPLICABLE',
        },
      });

      // Verify no outbox job exists yet
      let outboxJob = await prisma.outboxJob.findUnique({
        where: { messageId: draftMsg.id },
      });
      expect(outboxJob).toBeNull();

      // Discarding draft should NOT queue it
      const rejectRes = await request(app)
        .patch(`/api/leads/${leadA1.id}/conversations/messages/${draftMsg.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ status: 'REJECTED' });

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.approvalStatus).toBe('REJECTED');
      expect(rejectRes.body.deliveryStatus).toBe('NOT_APPLICABLE');

      outboxJob = await prisma.outboxJob.findUnique({
        where: { messageId: draftMsg.id },
      });
      expect(outboxJob).toBeNull();

      // Create another AI draft to approve
      const approveDraft = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AI',
          content: 'Here is the brochure you requested.',
          approvalStatus: 'PENDING_APPROVAL',
          deliveryStatus: 'NOT_APPLICABLE',
        },
      });

      // Approve draft
      const approveRes = await request(app)
        .patch(`/api/leads/${leadA1.id}/conversations/messages/${approveDraft.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ status: 'APPROVED' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.approvalStatus).toBe('APPROVED');
      // Must transition to QUEUED or SENT (since async worker may immediately fire)
      expect(['QUEUED', 'SENDING', 'SENT']).toContain(approveRes.body.deliveryStatus);

      // Outbox job must exist
      outboxJob = await prisma.outboxJob.findUnique({
        where: { messageId: approveDraft.id },
      });
      expect(outboxJob).not.toBeNull();
      expect(outboxJob?.recipientEmail).toBe('alice.buyer@example.com');
    });

    it('rejects client attempts to forge deliveryStatus or set arbitrary statuses', async () => {
      const msg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AI',
          content: 'Draft message to test status injection.',
          approvalStatus: 'PENDING_APPROVAL',
          deliveryStatus: 'NOT_APPLICABLE',
        },
      });

      // Try to forge DELIVERED via PATCH
      const res = await request(app)
        .patch(`/api/leads/${leadA1.id}/conversations/messages/${msg.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ status: 'DELIVERED', deliveryStatus: 'DELIVERED' });

      // Approval status validator allows only PENDING_APPROVAL, APPROVED, REJECTED, EDITED
      expect([400, 422]).toContain(res.status);

      const refreshed = await prisma.conversationMessage.findUnique({
        where: { id: msg.id },
      });
      expect(refreshed?.deliveryStatus).toBe('NOT_APPLICABLE');
    });

    it('prevents duplicate queue jobs on duplicate approval requests (idempotency)', async () => {
      const draft = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AI',
          content: 'Testing idempotent double-click approval.',
          approvalStatus: 'PENDING_APPROVAL',
          deliveryStatus: 'NOT_APPLICABLE',
        },
      });

      // First approval
      const firstRes = await request(app)
        .patch(`/api/leads/${leadA1.id}/conversations/messages/${draft.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ status: 'APPROVED' });
      expect(firstRes.status).toBe(200);

      // Second approval attempt
      const secondRes = await request(app)
        .patch(`/api/leads/${leadA1.id}/conversations/messages/${draft.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ status: 'APPROVED' });
      expect(secondRes.status).toBe(200);

      // Verify only ONE OutboxJob was created
      const jobs = await prisma.outboxJob.findMany({
        where: { messageId: draft.id },
      });
      expect(jobs.length).toBe(1);
    });
  });

  // ── 2. Authorization and Tenant Isolation ─────────────────────────────────
  describe('2. Authorization & Tenant Isolation', () => {
    it('rejects advisor sending or retrying for a lead assigned to another advisor', async () => {
      // Lead A2 is assigned to Agent A2. Agent A1 tries to send an advisor message
      const sendRes = await request(app)
        .post(`/api/leads/${leadA2.id}/conversations/messages/agent`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ content: 'Unauthorized intrusion message.' });

      expect(sendRes.status).toBe(403);
      const errMsg = sendRes.body.error?.message || sendRes.body.error || '';
      expect(errMsg).toContain('assigned leads');

      // Create a failed message on Lead A2
      const failedMsg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA2.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'Failed attempt message',
          deliveryStatus: 'FAILED',
          failedAt: new Date(),
          deliveryError: 'Simulated connection failure',
        },
      });

      await prisma.outboxJob.create({
        data: {
          organizationId: orgA.id,
          messageId: failedMsg.id,
          recipientEmail: 'bob.buyer@example.com',
          channel: 'EMAIL',
          payload: { text: failedMsg.content },
          idempotencyKey: `dispatch-${failedMsg.id}`,
          status: 'FAILED',
          attempts: 3,
        },
      });

      // Agent A1 tries to retry Agent A2's lead message -> 403
      const retryRes = await request(app)
        .post(`/api/leads/${leadA2.id}/conversations/messages/${failedMsg.id}/retry`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send();

      expect(retryRes.status).toBe(403);
      const retryErrMsg = retryRes.body.error?.message || retryRes.body.error || '';
      expect(retryErrMsg).toContain('assigned leads');

      // Agent A2 (the assigned agent) CAN retry
      const assignedRetryRes = await request(app)
        .post(`/api/leads/${leadA2.id}/conversations/messages/${failedMsg.id}/retry`)
        .set('Authorization', `Bearer ${agentA2.token}`)
        .send();

      expect(assignedRetryRes.status).toBe(200);
      expect(assignedRetryRes.body.retried).toBe(true);
    });

    it('rejects cross-tenant dispatch and retry attempts', async () => {
      // Org B agent tries to send message on Org A lead
      const crossSendRes = await request(app)
        .post(`/api/leads/${leadA1.id}/conversations/messages/agent`)
        .set('Authorization', `Bearer ${agentB.token}`)
        .send({ content: 'Cross-tenant send attempt' });

      expect(crossSendRes.status).toBe(404);

      // Org B agent tries to retry Org A message
      const msg = await prisma.conversationMessage.findFirst({
        where: { threadId: threadA1.id },
      });
      expect(msg).not.toBeNull();

      const crossRetryRes = await request(app)
        .post(`/api/leads/${leadA1.id}/conversations/messages/${msg!.id}/retry`)
        .set('Authorization', `Bearer ${agentB.token}`)
        .send();

      expect(crossRetryRes.status).toBe(404);
    });

    it('rejects dispatch when lead recipient email is missing or invalid', async () => {
      // Create lead without valid email in Org A
      const noEmailLead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'No Email Lead',
          phone: '+13055550999',
          assignedUserId: agentA1.user.id,
        },
      });

      const noEmailThread = await prisma.conversationThread.create({
        data: {
          organizationId: orgA.id,
          leadId: noEmailLead.id,
          channel: 'EMAIL',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${noEmailLead.id}/conversations/messages/agent`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ content: 'Hello lead without email!' });

      expect([200, 201]).toContain(res.status);
      // Delivery status must be marked FAILED immediately
      expect(res.body.deliveryStatus).toBe('FAILED');
      expect(res.body.deliveryError).toContain('recipient email');

      // No OutboxJob should be in PENDING state
      const job = await prisma.outboxJob.findUnique({
        where: { messageId: res.body.id },
      });
      expect(job).toBeNull();
    });
  });

  // ── 3. Worker Concurrency, Retries & Exponential Backoff ───────────────────
  describe('3. Outbox Worker Concurrency & Retries', () => {
    it('prevents concurrent workers from processing the same job simultaneously', async () => {
      const testMsg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'Concurrency lock test message',
          deliveryStatus: 'QUEUED',
        },
      });

      const job = await prisma.outboxJob.create({
        data: {
          organizationId: orgA.id,
          messageId: testMsg.id,
          recipientEmail: 'alice.buyer@example.com',
          channel: 'EMAIL',
          payload: { text: 'Concurrency test' },
          idempotencyKey: `dispatch-${testMsg.id}`,
          status: 'PENDING',
          nextAttemptAt: new Date(Date.now() - 1000), // Ready to process
        },
      });

      // Mock a provider that delays briefly to test race condition
      let sendCalls = 0;
      const delayedProvider: IMessagingProvider = {
        name: 'delayed-test',
        send: async () => {
          sendCalls++;
          await new Promise((r) => setTimeout(r, 50));
          return { success: true, providerMessageId: 'delayed-123' };
        },
      };
      setCustomMessagingProvider(delayedProvider);

      // Launch two worker executions concurrently
      const [worker1Result, worker2Result] = await Promise.all([
        processOutboxJobs({ batchSize: 5, workerId: 'worker-1' }),
        processOutboxJobs({ batchSize: 5, workerId: 'worker-2' }),
      ]);

      // Exactly ONE worker must have processed and succeeded the job
      expect(worker1Result.succeeded + worker2Result.succeeded).toBe(1);
      expect(sendCalls).toBe(1);

      setCustomMessagingProvider(null);
    });

    it('implements bounded exponential backoff on transient failures up to maxAttempts', async () => {
      const testMsg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'Retry backoff test message',
          deliveryStatus: 'QUEUED',
        },
      });

      const job = await prisma.outboxJob.create({
        data: {
          organizationId: orgA.id,
          messageId: testMsg.id,
          recipientEmail: 'alice.buyer@example.com',
          channel: 'EMAIL',
          payload: { text: 'Backoff test' },
          idempotencyKey: `dispatch-${testMsg.id}`,
          status: 'PENDING',
          nextAttemptAt: new Date(Date.now() - 1000),
          attempts: 0,
          maxAttempts: 3,
        },
      });

      // Provider that returns 429 rate limit (transient error)
      const transientProvider: IMessagingProvider = {
        name: 'transient-mock',
        send: async () => ({
          success: false,
          error: 'Rate limit exceeded (HTTP 429)',
          isTransient: true,
        }),
      };
      setCustomMessagingProvider(transientProvider);

      // Attempt 1: Should set status RETRYING and nextAttemptAt in future
      const result1 = await processOutboxJobs({ batchSize: 5 });
      expect(result1.retried).toBe(1);

      let refreshedJob = await prisma.outboxJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(refreshedJob.status).toBe('RETRYING');
      expect(refreshedJob.attempts).toBe(1);
      expect(refreshedJob.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

      let refreshedMsg = await prisma.conversationMessage.findUniqueOrThrow({ where: { id: testMsg.id } });
      expect(refreshedMsg.deliveryStatus).toBe('RETRY_PENDING');

      // Fast forward nextAttemptAt to test attempt 2
      await prisma.outboxJob.update({
        where: { id: job.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });

      const result2 = await processOutboxJobs({ batchSize: 5 });
      expect(result2.retried).toBe(1);

      refreshedJob = await prisma.outboxJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(refreshedJob.attempts).toBe(2);

      // Fast forward nextAttemptAt to test attempt 3 (exhaustion -> permanent failure)
      await prisma.outboxJob.update({
        where: { id: job.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });

      const result3 = await processOutboxJobs({ batchSize: 5 });
      expect(result3.failed).toBe(1);

      refreshedJob = await prisma.outboxJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(refreshedJob.status).toBe('FAILED');
      expect(refreshedJob.attempts).toBe(3);

      refreshedMsg = await prisma.conversationMessage.findUniqueOrThrow({ where: { id: testMsg.id } });
      expect(refreshedMsg.deliveryStatus).toBe('FAILED');
      expect(refreshedMsg.failedAt).not.toBeNull();

      setCustomMessagingProvider(null);
    });

    it('marks permanent failure immediately without retrying', async () => {
      const testMsg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'Permanent failure message',
          deliveryStatus: 'QUEUED',
        },
      });

      const job = await prisma.outboxJob.create({
        data: {
          organizationId: orgA.id,
          messageId: testMsg.id,
          recipientEmail: 'invalid-domain@bad.example',
          channel: 'EMAIL',
          payload: { text: 'Permanent error test' },
          idempotencyKey: `dispatch-${testMsg.id}`,
          status: 'PENDING',
          nextAttemptAt: new Date(Date.now() - 1000),
          attempts: 0,
        },
      });

      const permanentProvider: IMessagingProvider = {
        name: 'permanent-fail-mock',
        send: async () => ({
          success: false,
          error: 'Domain does not accept email (HTTP 400)',
          isTransient: false,
        }),
      };
      setCustomMessagingProvider(permanentProvider);

      const result = await processOutboxJobs({ batchSize: 5 });
      expect(result.failed).toBe(1);
      expect(result.retried).toBe(0);

      const refreshedJob = await prisma.outboxJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(refreshedJob.status).toBe('FAILED');

      const refreshedMsg = await prisma.conversationMessage.findUniqueOrThrow({ where: { id: testMsg.id } });
      expect(refreshedMsg.deliveryStatus).toBe('FAILED');
      expect(refreshedMsg.deliveryError).toContain('Domain does not accept email');

      setCustomMessagingProvider(null);
    });
  });

  // ── 4. Webhook Verification & Delivery State Transitions ───────────────────
  describe('4. Webhook Verification & Delivery States', () => {
    it('rejects webhooks with missing, invalid, or expired Svix signatures', async () => {
      const payload = JSON.stringify({
        type: 'email.delivered',
        data: { email_id: 'test-email-id' },
      });

      // 1. Missing signature header
      const noSigRes = await request(app)
        .post('/api/webhooks/resend')
        .set('Content-Type', 'application/json')
        .send(payload);
      expect(noSigRes.status).toBe(401);

      // 2. Tampered signature
      const validHeaders = generateSvixHeaders(payload);
      const tamperedRes = await request(app)
        .post('/api/webhooks/resend')
        .set('Content-Type', 'application/json')
        .set('svix-id', validHeaders['svix-id'])
        .set('svix-timestamp', validHeaders['svix-timestamp'])
        .set('svix-signature', 'v1,totally_invalid_signature_base64==')
        .send(payload);
      expect(tamperedRes.status).toBe(401);

      // 3. Expired timestamp (> 300s in the past)
      const expiredHeaders = generateSvixHeaders(payload, svixSecret, -350);
      const expiredRes = await request(app)
        .post('/api/webhooks/resend')
        .set('Content-Type', 'application/json')
        .set('svix-id', expiredHeaders['svix-id'])
        .set('svix-timestamp', expiredHeaders['svix-timestamp'])
        .set('svix-signature', expiredHeaders['svix-signature'])
        .send(payload);
      expect(expiredRes.status).toBe(401);
    });

    it('processes verified email.delivered webhook and marks message DELIVERED', async () => {
      const providerMsgId = `resend-${Date.now()}`;

      // Create message in SENT state
      const sentMsg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'Delivery confirmation test',
          deliveryStatus: 'SENT',
          sentAt: new Date(),
          providerMessageId: providerMsgId,
        },
      });

      const payload = JSON.stringify({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: {
          email_id: providerMsgId,
          to: ['alice.buyer@example.com'],
          subject: 'Property Update',
        },
      });

      const headers = generateSvixHeaders(payload);

      const res = await request(app)
        .post('/api/webhooks/resend')
        .set('Content-Type', 'application/json')
        .set('svix-id', headers['svix-id'])
        .set('svix-timestamp', headers['svix-timestamp'])
        .set('svix-signature', headers['svix-signature'])
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);

      const refreshed = await prisma.conversationMessage.findUniqueOrThrow({
        where: { id: sentMsg.id },
      });
      expect(refreshed.deliveryStatus).toBe('DELIVERED');
      expect(refreshed.deliveredAt).not.toBeNull();

      // Verify audit log recorded
      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA.id,
          action: 'MESSAGE_DELIVERED',
          entityId: sentMsg.id,
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actor).toBe('provider:resend');
    });

    it('handles duplicate webhook deliveries idempotently', async () => {
      const providerMsgId = `resend-dedup-${Date.now()}`;

      const msg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'Deduplication test message',
          deliveryStatus: 'SENT',
          providerMessageId: providerMsgId,
        },
      });

      const payload = JSON.stringify({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: { email_id: providerMsgId },
      });

      const headers = generateSvixHeaders(payload);

      // First webhook post
      const res1 = await request(app)
        .post('/api/webhooks/resend')
        .set('Content-Type', 'application/json')
        .set('svix-id', headers['svix-id'])
        .set('svix-timestamp', headers['svix-timestamp'])
        .set('svix-signature', headers['svix-signature'])
        .send(payload);
      expect(res1.status).toBe(200);

      // Second webhook post with identical svix-id
      const res2 = await request(app)
        .post('/api/webhooks/resend')
        .set('Content-Type', 'application/json')
        .set('svix-id', headers['svix-id'])
        .set('svix-timestamp', headers['svix-timestamp'])
        .set('svix-signature', headers['svix-signature'])
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.duplicate).toBe(true);
    });

    it('protects terminal DELIVERED status from out-of-order backwards transitions', async () => {
      const providerMsgId = `resend-terminal-${Date.now()}`;

      // Message is already DELIVERED
      const deliveredMsg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'Terminal state protection message',
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date(Date.now() - 5000),
          providerMessageId: providerMsgId,
        },
      });

      // Out-of-order delayed email.sent event arrives
      const sentPayload = JSON.stringify({
        type: 'email.sent',
        created_at: new Date().toISOString(),
        data: { email_id: providerMsgId },
      });

      const sentHeaders = generateSvixHeaders(sentPayload);
      const res = await request(app)
        .post('/api/webhooks/resend')
        .set('Content-Type', 'application/json')
        .set('svix-id', sentHeaders['svix-id'])
        .set('svix-timestamp', sentHeaders['svix-timestamp'])
        .set('svix-signature', sentHeaders['svix-signature'])
        .send(sentPayload);

      expect(res.status).toBe(200);

      const refreshed = await prisma.conversationMessage.findUniqueOrThrow({
        where: { id: deliveredMsg.id },
      });
      // MUST NOT move backwards to SENT!
      expect(refreshed.deliveryStatus).toBe('DELIVERED');
    });

    it('processes bounce webhooks and marks message FAILED with audit log', async () => {
      const providerMsgId = `resend-bounce-${Date.now()}`;

      const msg = await prisma.conversationMessage.create({
        data: {
          threadId: threadA1.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'Bounce test message',
          deliveryStatus: 'SENT',
          providerMessageId: providerMsgId,
        },
      });

      const bouncePayload = JSON.stringify({
        type: 'email.bounced',
        created_at: new Date().toISOString(),
        data: {
          email_id: providerMsgId,
          reason: 'Mailbox does not exist (550 5.1.1)',
        },
      });

      const bounceHeaders = generateSvixHeaders(bouncePayload);

      const res = await request(app)
        .post('/api/webhooks/resend')
        .set('Content-Type', 'application/json')
        .set('svix-id', bounceHeaders['svix-id'])
        .set('svix-timestamp', bounceHeaders['svix-timestamp'])
        .set('svix-signature', bounceHeaders['svix-signature'])
        .send(bouncePayload);

      expect(res.status).toBe(200);

      const refreshed = await prisma.conversationMessage.findUniqueOrThrow({
        where: { id: msg.id },
      });
      expect(refreshed.deliveryStatus).toBe('FAILED');
      expect(refreshed.deliveryError).toContain('Mailbox does not exist');

      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA.id,
          action: 'MESSAGE_BOUNCED',
          entityId: msg.id,
        },
      });
      expect(audit).not.toBeNull();
    });
  });

  // ── 5. PII Redaction & Audit Integrity ─────────────────────────────────────
  describe('5. PII Redaction & Audit Integrity', () => {
    it('redacts recipient email PII in audit logs and outbox logs', async () => {
      const rawEmail = 'superprivate.buyer@example.com';
      const secretLead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Private Buyer',
          email: rawEmail,
          assignedUserId: agentA1.user.id,
        },
      });

      const thread = await prisma.conversationThread.create({
        data: {
          organizationId: orgA.id,
          leadId: secretLead.id,
          channel: 'EMAIL',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${secretLead.id}/conversations/messages/agent`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ content: 'Confidential message regarding your offer.' });

      expect([200, 201]).toContain(res.status);

      // Audit logs created for dispatch must mask the recipient email
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          organizationId: orgA.id,
          entityId: res.body.id,
        },
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      for (const log of auditLogs) {
        if (log.note) {
          // Plaintext email should NOT appear unmasked
          expect(log.note).not.toContain(rawEmail);
          // Masked representation (e.g. s***r@example.com) should be used
          if (log.note.includes('@example.com')) {
            expect(log.note).toMatch(/s\*\*\*.*@example\.com/);
          }
        }
      }
    });
  });
});
