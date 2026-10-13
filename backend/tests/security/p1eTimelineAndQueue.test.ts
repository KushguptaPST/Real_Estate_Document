import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 1E: Unified Lead Activity Timeline & Advisor Action Queue', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA1: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA2: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P1E Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P1E Org B' } });

    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA1 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentA2 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });
  });

  afterAll(async () => {
    await prisma.leadTask.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.siteVisit.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.leadCallLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.leadAssignmentHistory.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.property.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.lead.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. UNIFIED ACTIVITY TIMELINE TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. Unified Lead Activity Timeline (GET /api/leads/:id/timeline)', () => {
    it('synthesizes canonical events across lead creation, assignment, calls, tasks, and visits in deterministic descending order', async () => {
      // 1. Create a lead
      const baseTime = Date.now() - 100000;
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Timeline Test Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
          createdAt: new Date(baseTime),
        },
      });

      // 2. Assignment history
      await prisma.leadAssignmentHistory.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          previousUserId: null,
          assignedUserId: agentA1.user.id,
          changedById: agentA1.user.id,
          reason: 'Claimed via cockpit',
          createdAt: new Date(baseTime + 10000),
        },
      });

      // 3. Call log
      await prisma.leadCallLog.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          userId: agentA1.user.id,
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          calledAt: new Date(baseTime + 20000),
          durationSeconds: 185,
          notes: 'Discussed 3-bedroom condo requirements',
        },
      });

      // 4. Task lifecycle (Created and Completed)
      const task = await prisma.leadTask.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          taskType: 'SEND_DETAILS',
          title: 'Send floor plans brochure',
          dueDate: new Date(baseTime + 80000),
          status: 'COMPLETED',
          completedAt: new Date(baseTime + 30000),
          completedById: agentA1.user.id,
          createdById: agentA1.user.id,
          assignedUserId: agentA1.user.id,
          createdAt: new Date(baseTime + 25000),
        },
      });

      // 5. Site visit lifecycle (Scheduled)
      await prisma.siteVisit.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          startAt: new Date(baseTime + 120000),
          endAt: new Date(baseTime + 123600),
          meetingLocation: 'Sales Gallery 101',
          status: 'SCHEDULED',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
          createdAt: new Date(baseTime + 40000),
        },
      });

      const res = await request(app)
        .get(`/api/leads/${lead.id}/timeline`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(6); // LEAD_CREATED + CLAIMED + CALL + TASK_CREATED + TASK_COMPLETED + VISIT_SCHEDULED
      expect(res.body.events).toHaveLength(6);

      // Verify descending timestamp order
      for (let i = 0; i < res.body.events.length - 1; i++) {
        const tCurr = new Date(res.body.events[i].timestamp).getTime();
        const tNext = new Date(res.body.events[i + 1].timestamp).getTime();
        expect(tCurr).toBeGreaterThanOrEqual(tNext);
      }

      // Check event types present
      const eventTypes = res.body.events.map((e: any) => e.eventType);
      expect(eventTypes).toContain('SITE_VISIT_SCHEDULED');
      expect(eventTypes).toContain('TASK_COMPLETED');
      expect(eventTypes).toContain('TASK_CREATED');
      expect(eventTypes).toContain('CALL_LOGGED');
      expect(eventTypes).toContain('LEAD_CLAIMED');
      expect(eventTypes).toContain('LEAD_CREATED');

      // Check actor attribution
      const callEvent = res.body.events.find((e: any) => e.eventType === 'CALL_LOGGED');
      expect(callEvent.actor).toBeTruthy();
      expect(callEvent.actor.id).toBe(agentA1.user.id);
      expect(callEvent.outcome).toBe('CONNECTED');
      expect(callEvent.metadata.durationFormatted).toBe('3m 5s');
    });

    it('filters timeline events by category (CALLS, TASKS, VISITS, OWNERSHIP)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Filter Category Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      await prisma.leadCallLog.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          userId: agentA1.user.id,
          direction: 'INBOUND',
          outcome: 'CONNECTED',
          calledAt: new Date(),
        },
      });

      await prisma.leadTask.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          taskType: 'CALL',
          title: 'Quick follow up call',
          dueDate: new Date(),
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // Filter: CALLS
      const callsRes = await request(app)
        .get(`/api/leads/${lead.id}/timeline?category=CALLS`)
        .set('Authorization', `Bearer ${agentA1.token}`);
      expect(callsRes.status).toBe(200);
      expect(callsRes.body.events.every((e: any) => e.category === 'CALLS')).toBe(true);
      expect(callsRes.body.events).toHaveLength(1);

      // Filter: TASKS
      const tasksRes = await request(app)
        .get(`/api/leads/${lead.id}/timeline?category=TASKS`)
        .set('Authorization', `Bearer ${agentA1.token}`);
      expect(tasksRes.status).toBe(200);
      expect(tasksRes.body.events.every((e: any) => e.category === 'TASKS')).toBe(true);

      // Filter: OWNERSHIP
      const ownRes = await request(app)
        .get(`/api/leads/${lead.id}/timeline?category=OWNERSHIP`)
        .set('Authorization', `Bearer ${agentA1.token}`);
      expect(ownRes.status).toBe(200);
      expect(ownRes.body.events.every((e: any) => e.category === 'OWNERSHIP')).toBe(true);
    });

    it('supports bounded pagination (limit, offset) without unbounded responses', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Pagination Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      // Create 5 tasks
      for (let i = 0; i < 5; i++) {
        await prisma.leadTask.create({
          data: {
            organizationId: orgA.id,
            leadId: lead.id,
            taskType: 'OTHER',
            title: `Pagination Task ${i}`,
            dueDate: new Date(),
            status: 'OPEN',
            assignedUserId: agentA1.user.id,
            createdById: agentA1.user.id,
          },
        });
      }

      const p1 = await request(app)
        .get(`/api/leads/${lead.id}/timeline?limit=2&offset=0`)
        .set('Authorization', `Bearer ${agentA1.token}`);
      expect(p1.status).toBe(200);
      expect(p1.body.events).toHaveLength(2);
      expect(p1.body.total).toBe(6); // 5 tasks + 1 lead create

      const p2 = await request(app)
        .get(`/api/leads/${lead.id}/timeline?limit=2&offset=2`)
        .set('Authorization', `Bearer ${agentA1.token}`);
      expect(p2.status).toBe(200);
      expect(p2.body.events).toHaveLength(2);
      expect(p2.body.events[0].id).not.toBe(p1.body.events[0].id);
    });

    it('enforces tenant isolation and returns 404 for foreign-org lead timeline', async () => {
      const leadB = await prisma.lead.create({
        data: {
          fullName: 'Org B Lead',
          organizationId: orgB.id,
          assignedUserId: agentB.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .get(`/api/leads/${leadB.id}/timeline`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/Lead not found/i);
    });

    it('restricts AGENT from inspecting another advisor’s assigned lead timeline (403)', async () => {
      const leadA2 = await prisma.lead.create({
        data: {
          fullName: 'Agent A2 Lead',
          organizationId: orgA.id,
          assignedUserId: agentA2.user.id,
          status: 'NEW',
        },
      });

      // Agent A1 tries to access Agent A2's assigned lead
      const res = await request(app)
        .get(`/api/leads/${leadA2.id}/timeline`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Agents can only view activity/i);

      // OWNER A can view Agent A2's assigned lead
      const ownerRes = await request(app)
        .get(`/api/leads/${leadA2.id}/timeline`)
        .set('Authorization', `Bearer ${ownerA.token}`);

      expect(ownerRes.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ADVISOR ACTION QUEUE TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. Advisor Action Queue (GET /api/tasks/action-queue)', () => {
    it('buckets tasks into overdue, today, upcoming, and attention required accurately', async () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      const lead = await prisma.lead.create({
        data: {
          fullName: 'Action Queue Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      // 1. Overdue task (2 days ago)
      const overdueDate = new Date(Date.now() - 48 * 3600 * 1000);
      await prisma.leadTask.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          taskType: 'CALL',
          title: 'Overdue Follow-up Call',
          dueDate: overdueDate,
          priority: 'URGENT',
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // 2. Due today task
      const todayDate = new Date(`${todayStr}T15:00:00.000Z`);
      await prisma.leadTask.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          taskType: 'SEND_DETAILS',
          title: 'Send contract draft today',
          dueDate: todayDate,
          priority: 'HIGH',
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // 3. Upcoming task (3 days in future)
      const futureDate = new Date(Date.now() + 72 * 3600 * 1000);
      await prisma.leadTask.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          taskType: 'OTHER',
          title: 'Upcoming Review',
          dueDate: futureDate,
          priority: 'MEDIUM',
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      const res = await request(app)
        .get('/api/tasks/action-queue?timezone=UTC')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeTruthy();
      expect(res.body.summary.overdueCount).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.dueTodayCount).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.upcomingCount).toBeGreaterThanOrEqual(1);

      // Verify specific bucket filter works
      const overdueRes = await request(app)
        .get('/api/tasks/action-queue?bucket=overdue&timezone=UTC')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(overdueRes.status).toBe(200);
      expect(overdueRes.body.items.every((item: any) => item.bucket === 'overdue')).toBe(true);
      expect(overdueRes.body.items.some((item: any) => item.title === 'Overdue Follow-up Call')).toBe(true);
    });

    it('deduplicates site visits and linked auto-generated follow-up tasks into a single visit action item', async () => {
      const prop = await prisma.property.create({
        data: {
          organizationId: orgA.id,
          title: 'P1E Luxury Condo',
          address: '500 Skyline Blvd',
          city: 'Miami',
          price: 950000,
          bedrooms: 3,
          bathrooms: 2,
          propertyType: 'CONDO',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          fullName: 'Deduplication Tour Buyer',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
        },
      });

      const tourTime = new Date(Date.now() + 24 * 3600 * 1000);

      // Create site visit
      const visit = await prisma.siteVisit.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          propertyId: prop.id,
          startAt: tourTime,
          endAt: new Date(tourTime.getTime() + 3600 * 1000),
          status: 'SCHEDULED',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // Create linked task with siteVisitId
      const linkedTask = await prisma.leadTask.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          siteVisitId: visit.id,
          taskType: 'SITE_VISIT',
          title: `Site Visit: P1E Luxury Condo`,
          dueDate: tourTime,
          status: 'OPEN',
          priority: 'HIGH',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      const res = await request(app)
        .get('/api/tasks/action-queue?timezone=UTC')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);

      // Find items referencing this visit or linked task
      const itemsForVisit = res.body.items.filter(
        (i: any) => i.siteVisitId === visit.id || i.leadTaskId === linkedTask.id,
      );

      // Must be EXACTLY 1 item, not 2 duplicates
      expect(itemsForVisit).toHaveLength(1);
      expect(itemsForVisit[0].actionType).toBe('SITE_VISIT');
      expect(itemsForVisit[0].siteVisitId).toBe(visit.id);
      expect(itemsForVisit[0].leadTaskId).toBe(linkedTask.id);
      expect(itemsForVisit[0].property).toBeTruthy();
      expect(itemsForVisit[0].property.title).toBe('P1E Luxury Condo');
    });

    it('identifies explainable attention-required reasons for stalled or uncontacted leads', async () => {
      // 1. Uncontacted lead (status NEW, 0 calls)
      const newLead = await prisma.lead.create({
        data: {
          fullName: 'New Uncontacted Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'NEW',
        },
      });

      // 2. Active lead with no tasks and no visits scheduled
      const inactiveLead = await prisma.lead.create({
        data: {
          fullName: 'Stalled Active Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
        },
      });

      // 3. Lapsed lead where last call was 10 days ago
      const lapsedLead = await prisma.lead.create({
        data: {
          fullName: 'Lapsed Outreach Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });
      await prisma.leadCallLog.create({
        data: {
          organizationId: orgA.id,
          leadId: lapsedLead.id,
          userId: agentA1.user.id,
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          calledAt: new Date(Date.now() - 10 * 86400 * 1000), // 10 days ago
        },
      });

      const res = await request(app)
        .get('/api/tasks/action-queue?bucket=attention&timezone=UTC')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);

      const reasons = res.body.items.map((i: any) => ({
        leadId: i.lead.id,
        reason: i.attentionReason,
      }));

      const newLeadAttention = reasons.find((r: any) => r.leadId === newLead.id);
      expect(newLeadAttention).toBeTruthy();
      expect(newLeadAttention.reason).toMatch(/New lead awaiting first contact/i);

      const inactiveLeadAttention = reasons.find((r: any) => r.leadId === inactiveLead.id);
      expect(inactiveLeadAttention).toBeTruthy();
      expect(inactiveLeadAttention.reason).toMatch(/No open task or site visit scheduled/i);

      const lapsedLeadAttention = reasons.find((r: any) => r.leadId === lapsedLead.id);
      expect(lapsedLeadAttention).toBeTruthy();
      expect(lapsedLeadAttention.reason).toMatch(/No recorded outreach for/i);
    });

    it('prohibits AGENT from querying another advisor’s action queue (403)', async () => {
      const res = await request(app)
        .get(`/api/tasks/action-queue?advisorId=${agentA2.user.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Advisors cannot inspect other advisors/i);
    });

    it('allows OWNER to inspect an advisor’s queue or all organization work', async () => {
      // Owner queries specific advisor queue
      const resSpecific = await request(app)
        .get(`/api/tasks/action-queue?advisorId=${agentA1.user.id}`)
        .set('Authorization', `Bearer ${ownerA.token}`);

      expect(resSpecific.status).toBe(200);
      expect(resSpecific.body.advisorId).toBe(agentA1.user.id);

      // Owner queries entire organization queue
      const resAll = await request(app)
        .get('/api/tasks/action-queue')
        .set('Authorization', `Bearer ${ownerA.token}`);

      expect(resAll.status).toBe(200);
      expect(resAll.body.advisorId).toBeNull();
    });

    it('enforces tenant boundary on action queue (Agent B cannot see Org A tasks)', async () => {
      const res = await request(app)
        .get('/api/tasks/action-queue')
        .set('Authorization', `Bearer ${agentB.token}`);

      expect(res.status).toBe(200);
      // All items in Agent B's queue must belong to Org B leads
      for (const item of res.body.items) {
        const lead = await prisma.lead.findUnique({ where: { id: item.lead.id } });
        expect(lead?.organizationId).toBe(orgB.id);
      }
    });

    it('tracks completed today items accurately upon task completion', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Completed Today Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const task = await prisma.leadTask.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          taskType: 'CALL',
          title: 'Task to Complete',
          dueDate: new Date(),
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // Complete the task
      const completeRes = await request(app)
        .post(`/api/tasks/${task.id}/complete`)
        .set('Authorization', `Bearer ${agentA1.token}`);
      expect(completeRes.status).toBe(200);

      // Fetch completed bucket
      const queueRes = await request(app)
        .get('/api/tasks/action-queue?bucket=completed&timezone=UTC')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(queueRes.status).toBe(200);
      expect(queueRes.body.items.some((i: any) => i.leadTaskId === task.id)).toBe(true);
      expect(queueRes.body.summary.completedCount).toBeGreaterThanOrEqual(1);
    });
  });
});
