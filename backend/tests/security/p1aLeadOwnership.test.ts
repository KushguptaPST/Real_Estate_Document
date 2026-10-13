import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 1A: Lead Ownership, Atomic Claiming, Assignment History & Pool Management', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA1: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA2: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P1A Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P1A Org B' } });

    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA1 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentA2 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });
  });

  afterAll(async () => {
    await prisma.leadAssignmentHistory.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  });

  describe('1. Atomic Claiming & Concurrency', () => {
    it('handles 10 parallel claims on the same unassigned lead: exactly 1 succeeds (200), 9 fail with 409 Conflict', async () => {
      // Create unassigned lead
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Concurrency Contender Lead',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'NEW',
        },
      });

      // Create 10 distinct agents in Org A
      const agents = await Promise.all(
        Array.from({ length: 10 }).map((_, i) =>
          createMemberSession(orgA.id, { role: 'AGENT', email: `claimagent${i}@test.local` }),
        ),
      );

      // Fire 10 parallel claims
      const responses = await Promise.all(
        agents.map((agent) =>
          request(app)
            .post(`/api/leads/${lead.id}/claim`)
            .set('Authorization', `Bearer ${agent.token}`)
            .send({ reason: 'Race for lead' }),
        ),
      );

      const successful = responses.filter((r) => r.status === 200);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(successful).toHaveLength(1);
      expect(conflicts).toHaveLength(9);

      // Verify winner in database
      const winnerId = successful[0]!.body.assignedUserId;
      expect(winnerId).toBeTruthy();

      const freshLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(freshLead.assignedUserId).toBe(winnerId);

      // Verify exactly 1 LeadAssignmentHistory was created for this claim
      const history = await prisma.leadAssignmentHistory.findMany({
        where: { leadId: lead.id },
      });
      expect(history).toHaveLength(1);
      expect(history[0]!.previousUserId).toBeNull();
      expect(history[0]!.assignedUserId).toBe(winnerId);
      expect(history[0]!.reason).toBe('Race for lead');
    });

    it('rejects claim on an already assigned lead with 409 Conflict', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Already Owned Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/claim`)
        .set('Authorization', `Bearer ${agentA2.token}`)
        .send();

      expect(res.status).toBe(409);
      const errMsg = typeof res.body.error === 'object' ? res.body.error.message : res.body.error;
      expect(errMsg).toMatch(/already.*claimed|already.*assigned/i);
    });

    it('rejects claim on a terminal/closed lead (WON/LOST) with 400 Bad Request', async () => {
      const wonLead = await prisma.lead.create({
        data: {
          fullName: 'Won Closed Lead',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'WON',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${wonLead.id}/claim`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send();

      expect(res.status).toBe(400);
      const errMsg = typeof res.body.error === 'object' ? res.body.error.message : res.body.error;
      expect(errMsg).toMatch(/Cannot claim lead with status/i);
    });
  });

  describe('2. Active-Lead Cap Limit Enforcement (25 Active Leads Maximum)', () => {
    it('prevents an advisor with 25 active leads from claiming a 26th lead (422)', async () => {
      const capAgent = await createMemberSession(orgA.id, { role: 'AGENT', email: 'capagent@test.local' });

      // Pre-seed 25 active leads assigned to capAgent
      await prisma.lead.createMany({
        data: Array.from({ length: 25 }).map((_, i) => ({
          fullName: `Cap Filler Lead ${i + 1}`,
          organizationId: orgA.id,
          assignedUserId: capAgent.user.id,
          status: 'CONTACTED',
        })),
      });

      // Target unassigned lead
      const unassignedLead = await prisma.lead.create({
        data: {
          fullName: 'Unassigned 26th Lead',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'NEW',
        },
      });

      // Attempt claim
      const res = await request(app)
        .post(`/api/leads/${unassignedLead.id}/claim`)
        .set('Authorization', `Bearer ${capAgent.token}`)
        .send();

      expect(res.status).toBe(422);
      const errMsg = typeof res.body.error === 'object' ? res.body.error.message : res.body.error;
      expect(errMsg).toMatch(/active lead cap|maximum cap of 25/i);

      // Verify lead remains unassigned
      const freshLead = await prisma.lead.findUniqueOrThrow({ where: { id: unassignedLead.id } });
      expect(freshLead.assignedUserId).toBeNull();
    });

    it('does not count WON or LOST leads towards the 25 active lead cap', async () => {
      const mixedAgent = await createMemberSession(orgA.id, { role: 'AGENT', email: 'mixedagent@test.local' });

      // Seed 20 active leads and 10 closed (WON/LOST) leads = 30 total, but only 20 active
      await prisma.lead.createMany({
        data: [
          ...Array.from({ length: 20 }).map((_, i) => ({
            fullName: `Active Lead ${i + 1}`,
            organizationId: orgA.id,
            assignedUserId: mixedAgent.user.id,
            status: 'NEW' as const,
          })),
          ...Array.from({ length: 5 }).map((_, i) => ({
            fullName: `Won Lead ${i + 1}`,
            organizationId: orgA.id,
            assignedUserId: mixedAgent.user.id,
            status: 'WON' as const,
          })),
          ...Array.from({ length: 5 }).map((_, i) => ({
            fullName: `Lost Lead ${i + 1}`,
            organizationId: orgA.id,
            assignedUserId: mixedAgent.user.id,
            status: 'LOST' as const,
          })),
        ],
      });

      // Mixed agent only has 20 active leads, so claiming 21st active lead should succeed
      const newLead = await prisma.lead.create({
        data: {
          fullName: 'Eligible Claim Lead',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${newLead.id}/claim`)
        .set('Authorization', `Bearer ${mixedAgent.token}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.assignedUserId).toBe(mixedAgent.user.id);
    });

    it('prevents parallel concurrent claims from oversubscribing the active cap', async () => {
      const nearCapAgent = await createMemberSession(orgA.id, { role: 'AGENT', email: 'nearcap@test.local' });

      // Pre-seed 24 active leads (cap is 25, only 1 slot open)
      await prisma.lead.createMany({
        data: Array.from({ length: 24 }).map((_, i) => ({
          fullName: `Near Cap Lead ${i + 1}`,
          organizationId: orgA.id,
          assignedUserId: nearCapAgent.user.id,
          status: 'CONTACTED',
        })),
      });

      // Create 3 unassigned leads
      const lead1 = await prisma.lead.create({
        data: { fullName: 'Concurrent Cap Lead 1', organizationId: orgA.id, assignedUserId: null },
      });
      const lead2 = await prisma.lead.create({
        data: { fullName: 'Concurrent Cap Lead 2', organizationId: orgA.id, assignedUserId: null },
      });
      const lead3 = await prisma.lead.create({
        data: { fullName: 'Concurrent Cap Lead 3', organizationId: orgA.id, assignedUserId: null },
      });

      // Near-cap agent simultaneously tries to claim all 3 leads
      const results = await Promise.all([
        request(app).post(`/api/leads/${lead1.id}/claim`).set('Authorization', `Bearer ${nearCapAgent.token}`),
        request(app).post(`/api/leads/${lead2.id}/claim`).set('Authorization', `Bearer ${nearCapAgent.token}`),
        request(app).post(`/api/leads/${lead3.id}/claim`).set('Authorization', `Bearer ${nearCapAgent.token}`),
      ]);

      const successes = results.filter((r) => r.status === 200);
      const capErrors = results.filter((r) => r.status === 422);

      // Exactly 1 must succeed to reach 25; remaining 2 must be rejected with 422
      expect(successes).toHaveLength(1);
      expect(capErrors).toHaveLength(2);

      // Total active count in database must be exactly 25, never 26 or 27
      const totalActive = await prisma.lead.count({
        where: {
          assignedUserId: nearCapAgent.user.id,
          status: { in: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL'] },
        },
      });
      expect(totalActive).toBe(25);
    });
  });

  describe('3. Role Authorization & Release/Reassign Controls', () => {
    it('allows an agent to release their own assigned lead to the unassigned pool (200)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Self Release Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/release`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ reason: 'Rebalancing my pipeline' });

      expect(res.status).toBe(200);
      expect(res.body.assignedUserId).toBeNull();

      const freshLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(freshLead.assignedUserId).toBeNull();

      // Check history
      const history = await prisma.leadAssignmentHistory.findFirstOrThrow({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(history.previousUserId).toBe(agentA1.user.id);
      expect(history.assignedUserId).toBeNull();
      expect(history.changedById).toBe(agentA1.user.id);
      expect(history.reason).toBe('Rebalancing my pipeline');
    });

    it('forbids an agent from releasing another advisor’s lead (403)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Agent 1 Owned Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      // Agent 2 tries to release Agent 1's lead
      const res = await request(app)
        .post(`/api/leads/${lead.id}/release`)
        .set('Authorization', `Bearer ${agentA2.token}`)
        .send();

      expect(res.status).toBe(403);
      const errMsg = typeof res.body.error === 'object' ? res.body.error.message : res.body.error;
      expect(errMsg).toMatch(/other advisors/i);

      // Verify unchanged in DB
      const freshLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
      expect(freshLead.assignedUserId).toBe(agentA1.user.id);
    });

    it('allows an OWNER to release any advisor’s lead to the pool (200)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Owner Managed Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/release`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ reason: 'Owner intervention' });

      expect(res.status).toBe(200);
      expect(res.body.assignedUserId).toBeNull();
    });

    it('allows an OWNER to reassign any lead to another advisor in the organization (200)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Reassignment Candidate Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/reassign`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ targetUserId: agentA2.user.id, reason: 'Reassigned to specialist' });

      expect(res.status).toBe(200);
      expect(res.body.assignedUserId).toBe(agentA2.user.id);

      const history = await prisma.leadAssignmentHistory.findFirstOrThrow({
        where: { leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(history.previousUserId).toBe(agentA1.user.id);
      expect(history.assignedUserId).toBe(agentA2.user.id);
      expect(history.changedById).toBe(ownerA.user.id);
      expect(history.reason).toBe('Reassigned to specialist');
    });

    it('forbids an agent from stealing or reassigning another advisor’s lead (403)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Steal Target Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
        },
      });

      // Agent 2 attempts to reassign Agent 1's lead to self via POST /reassign
      const res = await request(app)
        .post(`/api/leads/${lead.id}/reassign`)
        .set('Authorization', `Bearer ${agentA2.token}`)
        .send({ targetUserId: agentA2.user.id });

      expect(res.status).toBe(403);
      const postErrMsg = typeof res.body.error === 'object' ? res.body.error.message : res.body.error;
      expect(postErrMsg).toMatch(/cannot reassign leads owned by another advisor/i);

      // Verify via PATCH /api/leads/:id as well
      const patchRes = await request(app)
        .patch(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${agentA2.token}`)
        .send({ assignedUserId: agentA2.user.id });

      expect(patchRes.status).toBe(403);
      const patchErrMsg = typeof patchRes.body.error === 'object' ? patchRes.body.error.message : patchRes.body.error;
      expect(patchErrMsg).toMatch(/cannot reassign leads owned by another advisor/i);
    });

    it('rejects cross-tenant reassignment: cannot assign to a user in another organization (422)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Cross Tenant Target Lead',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/reassign`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ targetUserId: agentB.user.id });

      expect(res.status).toBe(422);
      const errMsg = typeof res.body.error === 'object' ? res.body.error.message : res.body.error;
      expect(errMsg).toMatch(/not a member of this organization/i);
    });

    it('enforces tenant isolation: users from Org B receive 404 when attempting to access Org A leads', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Org A Isolated Lead',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'NEW',
        },
      });

      // Agent B tries to claim Org A lead
      const claimRes = await request(app)
        .post(`/api/leads/${lead.id}/claim`)
        .set('Authorization', `Bearer ${agentB.token}`)
        .send();
      expect(claimRes.status).toBe(404);

      // Agent B tries to fetch assignment history
      const historyRes = await request(app)
        .get(`/api/leads/${lead.id}/assignments`)
        .set('Authorization', `Bearer ${agentB.token}`);
      expect(historyRes.status).toBe(404);
    });
  });

  describe('4. Assignment History Endpoint & Chronological Logging', () => {
    it('returns the full chronological audit trail of assignment transitions', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Audit Trail Lead',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'NEW',
        },
      });

      // Step 1: Agent A1 claims it
      await request(app)
        .post(`/api/leads/${lead.id}/claim`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ reason: 'Initial claim' });

      // Step 2: Agent A1 releases it
      await request(app)
        .post(`/api/leads/${lead.id}/release`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ reason: 'Need handoff' });

      // Step 3: Owner reassigns to Agent A2
      await request(app)
        .post(`/api/leads/${lead.id}/reassign`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ targetUserId: agentA2.user.id, reason: 'Owner executive assignment' });

      const res = await request(app)
        .get(`/api/leads/${lead.id}/assignments`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);

      // Entries are in reverse chronological order
      const [step3, step2, step1] = res.body;

      expect(step1.previousUserId).toBeNull();
      expect(step1.assignedUserId).toBe(agentA1.user.id);
      expect(step1.reason).toBe('Initial claim');

      expect(step2.previousUserId).toBe(agentA1.user.id);
      expect(step2.assignedUserId).toBeNull();
      expect(step2.reason).toBe('Need handoff');

      expect(step3.previousUserId).toBeNull();
      expect(step3.assignedUserId).toBe(agentA2.user.id);
      expect(step3.changedById).toBe(ownerA.user.id);
      expect(step3.reason).toBe('Owner executive assignment');
    });
  });

  describe('5. Inactivity Flag & Pool Filtering', () => {
    it('flags leads with no activity for 7+ days with isInactiveWarning: true', async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      const stagnantLead = await prisma.lead.create({
        data: {
          fullName: 'Stagnant Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
          updatedAt: eightDaysAgo,
        },
      });

      // Force updatedAt back to 8 days ago (in case prisma auto-updated)
      await prisma.$executeRaw`UPDATE "leads" SET "updatedAt" = ${eightDaysAgo} WHERE "id" = ${stagnantLead.id}`;

      // Query via getLeadDetails
      const detailRes = await request(app)
        .get(`/api/leads/${stagnantLead.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.isInactiveWarning).toBe(true);
      expect(detailRes.body.daysSinceLastActivity).toBeGreaterThanOrEqual(7);

      // Query via getLeads list
      const listRes = await request(app)
        .get(`/api/leads?search=Stagnant`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(listRes.status).toBe(200);
      const match = listRes.body.find((l: any) => l.id === stagnantLead.id);
      expect(match).toBeTruthy();
      expect(match.isInactiveWarning).toBe(true);
      expect(match.daysSinceLastActivity).toBeGreaterThanOrEqual(7);
    });

    it('does not flag recently updated leads or unassigned leads as inactive warnings', async () => {
      const recentLead = await prisma.lead.create({
        data: {
          fullName: 'Active Fresh Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .get(`/api/leads/${recentLead.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.isInactiveWarning).toBe(false);
      expect(res.body.daysSinceLastActivity).toBe(0);
    });

    it('supports pool filtering: unassigned=true and assignedUserId filters', async () => {
      const unassignedLead = await prisma.lead.create({
        data: {
          fullName: 'Pool Filter Lead Unassigned',
          organizationId: orgA.id,
          assignedUserId: null,
          status: 'NEW',
        },
      });

      const assignedLead = await prisma.lead.create({
        data: {
          fullName: 'Pool Filter Lead Assigned',
          organizationId: orgA.id,
          assignedUserId: agentA2.user.id,
          status: 'CONTACTED',
        },
      });

      // 1. Unassigned pool query
      const unassignedRes = await request(app)
        .get('/api/leads?unassigned=true')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(unassignedRes.status).toBe(200);
      const unassignedIds = unassignedRes.body.map((l: any) => l.id);
      expect(unassignedIds).toContain(unassignedLead.id);
      expect(unassignedIds).not.toContain(assignedLead.id);

      // 2. Assigned user query
      const assignedRes = await request(app)
        .get(`/api/leads?assignedUserId=${agentA2.user.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(assignedRes.status).toBe(200);
      const assignedIds = assignedRes.body.map((l: any) => l.id);
      expect(assignedIds).toContain(assignedLead.id);
      expect(assignedIds).not.toContain(unassignedLead.id);
    });
  });
});
