import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 1B: Lead Call Logging, Authorization & Validation', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA1: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA2: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P1B Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P1B Org B' } });

    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA1 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentA2 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });
  });

  afterAll(async () => {
    await prisma.leadCallLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.lead.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  });

  // ── 1. Creation and Validation ─────────────────────────────────────────────
  describe('1. Creation and Validation', () => {
    it('successfully records an outbound call with duration, notes, and follow-up date', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Test Outbound Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const calledAt = new Date(Date.now() - 10 * 60 * 1000); // 10 mins ago
      const followUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          calledAt: calledAt.toISOString(),
          durationSeconds: 245,
          notes: 'Client confirmed budget of $650,000 and requested 3-bedroom listings.',
          followUpNeeded: true,
          followUpDate: followUpDate.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.leadId).toBe(lead.id);
      expect(res.body.organizationId).toBe(orgA.id);
      expect(res.body.userId).toBe(agentA1.user.id);
      expect(res.body.direction).toBe('OUTBOUND');
      expect(res.body.outcome).toBe('CONNECTED');
      expect(res.body.durationSeconds).toBe(245);
      expect(res.body.notes).toBe('Client confirmed budget of $650,000 and requested 3-bedroom listings.');
      expect(res.body.followUpNeeded).toBe(true);
      expect(new Date(res.body.followUpDate).toISOString()).toBe(followUpDate.toISOString());
      expect(res.body.user).toMatchObject({
        id: agentA1.user.id,
        email: agentA1.user.email,
      });
    });

    it('successfully records an inbound call with minimal required fields', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Test Inbound Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'INBOUND',
          outcome: 'CONNECTED',
        });

      expect(res.status).toBe(201);
      expect(res.body.direction).toBe('INBOUND');
      expect(res.body.outcome).toBe('CONNECTED');
      expect(res.body.durationSeconds).toBeNull();
      expect(res.body.notes).toBeNull();
      expect(res.body.followUpNeeded).toBe(false);
      expect(res.body.followUpDate).toBeNull();
      expect(res.body.calledAt).toBeTruthy();
    });

    it('rejects invalid call outcome with 422', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Invalid Outcome Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'SUPER_CALL',
        });

      expect(res.status).toBe(422);
    });

    it('rejects call timestamp in the future beyond 5 minutes skew with 422', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Future Call Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const futureTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          calledAt: futureTime.toISOString(),
        });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/future/i);
    });

    it('rejects negative duration with 422', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Negative Duration Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          durationSeconds: -30,
        });

      expect(res.status).toBe(422);
    });

    it('rejects non-integer duration with 422', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Float Duration Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          durationSeconds: 45.7,
        });

      expect(res.status).toBe(422);
    });

    it('rejects follow-up date in the past with 422', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Past FollowUp Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CALLBACK_REQUESTED',
          followUpNeeded: true,
          followUpDate: pastDate.toISOString(),
        });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toMatch(/future/i);
    });

    it('requires notes when outcome is OTHER with 422 if missing or too short', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Other Outcome Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      // Missing notes
      const res1 = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'OTHER',
        });

      expect(res1.status).toBe(422);
      expect(res1.body.error.message).toMatch(/notes are required/i);

      // Short notes (< 3 chars)
      const res2 = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'OTHER',
          notes: 'hi',
        });

      expect(res2.status).toBe(422);

      // Valid notes for OTHER succeeds
      const res3 = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'OTHER',
          notes: 'Spoke with attorney instead of buyer.',
        });

      expect(res3.status).toBe(201);
      expect(res3.body.outcome).toBe('OTHER');
      expect(res3.body.notes).toBe('Spoke with attorney instead of buyer.');
    });
  });

  // ── 2. Authorization and Tenant Isolation ──────────────────────────────────
  describe('2. Authorization and Tenant Isolation', () => {
    it('rejects unauthenticated call logging requests with 401', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Unauth Lead',
          organizationId: orgA.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
        });

      expect(res.status).toBe(401);
    });

    it('rejects call logging for another organization lead with 404 (no existence leak)', async () => {
      const leadOrgB = await prisma.lead.create({
        data: {
          fullName: 'Org B Lead',
          organizationId: orgB.id,
          assignedUserId: agentB.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${leadOrgB.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/not found/i);
    });

    it('rejects reading call logs for another organization lead with 404', async () => {
      const leadOrgB = await prisma.lead.create({
        data: {
          fullName: 'Org B Lead For Calls',
          organizationId: orgB.id,
          assignedUserId: agentB.user.id,
          status: 'NEW',
        },
      });

      // Org B logs a call
      await prisma.leadCallLog.create({
        data: {
          leadId: leadOrgB.id,
          organizationId: orgB.id,
          userId: agentB.user.id,
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
        },
      });

      const res = await request(app)
        .get(`/api/leads/${leadOrgB.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(404);
    });

    it('prevents agent from logging calls on another agent lead with 403 Forbidden', async () => {
      const leadOwnedByAgent1 = await prisma.lead.create({
        data: {
          fullName: 'Agent 1 Owned Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      // Agent 2 tries to log call on Agent 1's lead
      const res = await request(app)
        .post(`/api/leads/${leadOwnedByAgent1.id}/calls`)
        .set('Authorization', `Bearer ${agentA2.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          notes: 'Attempting to log call on peer lead',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/another advisor/i);
    });

    it('allows agent to log calls on unassigned pool leads (201)', async () => {
      const poolLead = await prisma.lead.create({
        data: {
          fullName: 'Unassigned Pool Lead',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${poolLead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'NO_ANSWER',
        });

      expect(res.status).toBe(201);
      expect(res.body.leadId).toBe(poolLead.id);
      expect(res.body.userId).toBe(agentA1.user.id);
    });

    it('allows owner to log calls on any lead in the organization (201)', async () => {
      const leadOwnedByAgent1 = await prisma.lead.create({
        data: {
          fullName: 'Agent 1 Lead Inspected by Owner',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${leadOwnedByAgent1.id}/calls`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          notes: 'Owner conducted VIP check-in call with client',
        });

      expect(res.status).toBe(201);
      expect(res.body.leadId).toBe(leadOwnedByAgent1.id);
      expect(res.body.userId).toBe(ownerA.user.id);
    });

    it('ignores client-supplied organizationId or actorId, enforcing trusted server context', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Context Tamper Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          organizationId: orgB.id, // Attempt to spoof Org B
          userId: agentB.user.id, // Attempt to spoof Agent B
        });

      expect(res.status).toBe(201);
      // Organization and user must remain strictly Org A and Agent A1
      expect(res.body.organizationId).toBe(orgA.id);
      expect(res.body.userId).toBe(agentA1.user.id);
    });
  });

  // ── 3. Persistence, Chronological Retrieval & Side Effects ─────────────────
  describe('3. Persistence, Chronological Retrieval & Side Effects', () => {
    it('returns call logs in newest-first chronological order', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Timeline Call Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const t1 = new Date(Date.now() - 3 * 3600 * 1000); // 3h ago
      const t2 = new Date(Date.now() - 2 * 3600 * 1000); // 2h ago
      const t3 = new Date(Date.now() - 1 * 3600 * 1000); // 1h ago

      await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ direction: 'OUTBOUND', outcome: 'NO_ANSWER', calledAt: t1.toISOString() });

      await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ direction: 'OUTBOUND', outcome: 'BUSY', calledAt: t2.toISOString() });

      await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ direction: 'INBOUND', outcome: 'CONNECTED', calledAt: t3.toISOString() });

      const res = await request(app)
        .get(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);

      // Verify newest first: t3, then t2, then t1
      expect(res.body[0].outcome).toBe('CONNECTED');
      expect(res.body[1].outcome).toBe('BUSY');
      expect(res.body[2].outcome).toBe('NO_ANSWER');
    });

    it('creates an AuditLog entry with action CALL_LOGGED', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Audit Call Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          durationSeconds: 120,
        });

      expect(res.status).toBe(201);
      const callLogId = res.body.id;

      const audit = await prisma.auditLog.findFirst({
        where: {
          entityId: callLogId,
          entityType: 'LeadCallLog',
          action: 'CALL_LOGGED',
        },
      });

      expect(audit).toBeTruthy();
      expect(audit!.organizationId).toBe(orgA.id);
      expect(audit!.actor).toBe(agentA1.user.email);
    });

    it('refreshes lead.updatedAt without altering lead ownership or status', async () => {
      const initialUpdatedAt = new Date(Date.now() - 8 * 24 * 3600 * 1000); // 8 days ago (stale)

      const lead = await prisma.lead.create({
        data: {
          fullName: 'Activity Refresh Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
          updatedAt: initialUpdatedAt,
        },
      });

      // Verify before call: stale updatedAt
      const beforeLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(beforeLead.updatedAt.getTime()).toBeLessThan(Date.now() - 7 * 24 * 3600 * 1000);

      // Log a call
      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
        });

      expect(res.status).toBe(201);

      // Verify lead in DB: updatedAt is now refreshed, but assignedUser and status are untouched
      const afterLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(afterLead.updatedAt.getTime()).toBeGreaterThan(Date.now() - 10 * 1000);
      expect(afterLead.assignedUserId).toBe(agentA1.user.id);
      expect(afterLead.status).toBe('QUALIFIED');
    });

    it('lead detail endpoint includes recent callLogs', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Detail Call Inclusion Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'INBOUND',
          outcome: 'CALLBACK_REQUESTED',
          notes: 'Customer called back regarding viewing',
        });

      const res = await request(app)
        .get(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.callLogs)).toBe(true);
      expect(res.body.callLogs.length).toBeGreaterThanOrEqual(1);
      expect(res.body.callLogs[0].outcome).toBe('CALLBACK_REQUESTED');
    });
  });
});
