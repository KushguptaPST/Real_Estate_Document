import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 1C: Lead Follow-Up Tasks and Reminders', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA1: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA2: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P1C Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P1C Org B' } });

    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA1 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentA2 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });
  });

  afterAll(async () => {
    await prisma.leadTask.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
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
    it('creates a valid follow-up task with all standard fields', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Task Lead 1',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const dueDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 2 days in future

      const res = await request(app)
        .post(`/api/leads/${lead.id}/tasks`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          taskType: 'SITE_VISIT',
          title: 'Conduct on-site property walkthrough',
          description: 'Show unit 402 and review amenities with buyer',
          dueDate: dueDate.toISOString(),
          priority: 'HIGH',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.leadId).toBe(lead.id);
      expect(res.body.organizationId).toBe(orgA.id);
      expect(res.body.taskType).toBe('SITE_VISIT');
      expect(res.body.title).toBe('Conduct on-site property walkthrough');
      expect(res.body.description).toBe('Show unit 402 and review amenities with buyer');
      expect(res.body.status).toBe('OPEN');
      expect(res.body.priority).toBe('HIGH');
      expect(res.body.assignedUserId).toBe(agentA1.user.id);
      expect(res.body.createdById).toBe(agentA1.user.id);
      expect(res.body.isOverdue).toBe(false);
    });

    it('rejects task creation with empty title', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Task Lead Empty Title',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/tasks`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          title: '   ',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(422);
    });

    it('rejects task creation with invalid due date', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Task Lead Invalid Date',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/tasks`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          title: 'Valid Title',
          dueDate: 'invalid-not-a-date',
        });

      expect(res.status).toBe(422);
    });

    it('rejects task creation for cross-tenant lead (tenant isolation)', async () => {
      const leadB = await prisma.lead.create({
        data: {
          fullName: 'Tenant B Lead',
          organizationId: orgB.id,
          assignedUserId: agentB.user.id,
          status: 'NEW',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${leadB.id}/tasks`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          title: 'Unauthorized Task',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(404);
    });

    it('rejects assignment to an advisor in another organization', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Cross Assignee Lead',
          organizationId: orgA.id,
          assignedUserId: ownerA.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/tasks`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({
          title: 'Cross-tenant assignment task',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          assignedUserId: agentB.user.id, // belongs to orgB
        });

      expect(res.status).toBe(422);
    });
  });

  // ── 2. Authorization and Isolation ─────────────────────────────────────────
  describe('2. Authorization and Isolation', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(401);
    });

    it('prevents AGENT from creating tasks on leads owned by another advisor', async () => {
      const leadOwnedByA2 = await prisma.lead.create({
        data: {
          fullName: 'Lead Owned By Agent A2',
          organizationId: orgA.id,
          assignedUserId: agentA2.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${leadOwnedByA2.id}/tasks`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          title: 'Advising Task Attempt',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(res.status).toBe(403);
    });

    it('prevents AGENT from assigning tasks to other advisors', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Lead for Self Assign',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/tasks`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          title: 'Task delegated without permission',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          assignedUserId: agentA2.user.id,
        });

      expect(res.status).toBe(403);
    });

    it('prevents AGENT from viewing another advisor task queue', async () => {
      const res = await request(app)
        .get(`/api/tasks?assignedUserId=${agentA2.user.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(403);
    });

    it('allows OWNER to create and assign tasks to any advisor in the organization', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Owner Managed Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/tasks`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({
          title: 'Owner Assigned Follow-Up',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          assignedUserId: agentA2.user.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.assignedUserId).toBe(agentA2.user.id);
      expect(res.body.createdById).toBe(ownerA.user.id);
    });

    it('ignores client-supplied organizationId and createdById (derived from session only)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Spoofed Tenant Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/tasks`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          title: 'Spoofed Org Task',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          organizationId: orgB.id,
          createdById: agentB.user.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.organizationId).toBe(orgA.id);
      expect(res.body.createdById).toBe(agentA1.user.id);
    });
  });

  // ── 3. Task Lifecycle and State Transitions ────────────────────────────────
  describe('3. Task Lifecycle and State Transitions', () => {
    it('completes an OPEN task, records completion timestamp and actor, touches lead updatedAt', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Completion Test Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
          updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      const task = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Prepare comparative market analysis',
          dueDate: new Date(Date.now() + 86400000),
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/tasks/${task.id}/complete`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.completedAt).toBeTruthy();
      expect(res.body.completedById).toBe(agentA1.user.id);
      expect(res.body.isOverdue).toBe(false);

      // Verify lead's updatedAt was refreshed
      const refreshedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(refreshedLead!.updatedAt.getTime()).toBeGreaterThan(lead.updatedAt.getTime());
    });

    it('repeated completion requests are idempotent and do not overwrite completion metadata', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Idempotent Complete Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const task = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Verify buyer loan pre-approval',
          dueDate: new Date(Date.now() + 86400000),
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // First completion by agentA1
      const res1 = await request(app)
        .post(`/api/tasks/${task.id}/complete`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res1.status).toBe(200);
      const firstCompletedAt = res1.body.completedAt;
      const firstCompletedById = res1.body.completedById;

      // Repeated completion call (e.g. by ownerA)
      const res2 = await request(app)
        .post(`/api/tasks/${task.id}/complete`)
        .set('Authorization', `Bearer ${ownerA.token}`);

      expect(res2.status).toBe(200);
      expect(res2.body.completedAt).toBe(firstCompletedAt);
      expect(res2.body.completedById).toBe(firstCompletedById);
    });

    it('cancels an OPEN task with reason tracking', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Cancel Test Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const task = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Draft physical purchase agreement draft',
          dueDate: new Date(Date.now() + 86400000),
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/tasks/${task.id}/cancel`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ reason: 'Buyer postponed property search to next quarter' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.isOverdue).toBe(false);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: task.id, action: 'LEAD_TASK_CANCELLED' },
      });
      expect(audit).toBeTruthy();
      expect(audit?.note).toContain('Buyer postponed');
    });

    it('rejects completing a cancelled task and cancelling a completed task', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Invalid Transition Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const cancelledTask = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Cancelled Task',
          dueDate: new Date(Date.now() + 86400000),
          status: 'CANCELLED',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      const resComplete = await request(app)
        .post(`/api/tasks/${cancelledTask.id}/complete`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(resComplete.status).toBe(422);

      const completedTask = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Completed Task',
          dueDate: new Date(Date.now() + 86400000),
          status: 'COMPLETED',
          completedAt: new Date(),
          completedById: agentA1.user.id,
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      const resCancel = await request(app)
        .post(`/api/tasks/${completedTask.id}/cancel`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(resCancel.status).toBe(422);
    });
  });

  // ── 4. Overdue and Upcoming Filtering ───────────────────────────────────────
  describe('4. Overdue and Upcoming Filtering', () => {
    it('correctly calculates overdue tasks from persisted dueDate and excludes completed/cancelled tasks', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Filtering Test Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const pastDue = new Date(Date.now() - 3600000); // 1 hour ago
      const futureDue = new Date(Date.now() + 86400000); // Tomorrow

      // Overdue open task
      const overdueTask = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Overdue open task',
          dueDate: pastDue,
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // Upcoming open task
      const upcomingTask = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Upcoming open task',
          dueDate: futureDue,
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // Past due but completed task (should NOT be overdue)
      const completedPastTask = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Past due completed task',
          dueDate: pastDue,
          status: 'COMPLETED',
          completedAt: new Date(),
          completedById: agentA1.user.id,
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // 1. Query overdue filter
      const resOverdue = await request(app)
        .get('/api/tasks?filter=overdue')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(resOverdue.status).toBe(200);
      const overdueIds = resOverdue.body.map((t: any) => t.id);
      expect(overdueIds).toContain(overdueTask.id);
      expect(overdueIds).not.toContain(upcomingTask.id);
      expect(overdueIds).not.toContain(completedPastTask.id);

      // Verify every task returned in overdue filter has isOverdue === true
      resOverdue.body.forEach((t: any) => {
        expect(t.status).toBe('OPEN');
        expect(t.isOverdue).toBe(true);
      });

      // 2. Query upcoming filter
      const resUpcoming = await request(app)
        .get('/api/tasks?filter=upcoming')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(resUpcoming.status).toBe(200);
      const upcomingIds = resUpcoming.body.map((t: any) => t.id);
      expect(upcomingIds).toContain(upcomingTask.id);
      expect(upcomingIds).not.toContain(overdueTask.id);
      expect(upcomingIds).not.toContain(completedPastTask.id);

      // 3. Query completed filter
      const resCompleted = await request(app)
        .get('/api/tasks?filter=completed')
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(resCompleted.status).toBe(200);
      const completedIds = resCompleted.body.map((t: any) => t.id);
      expect(completedIds).toContain(completedPastTask.id);
      expect(completedIds).not.toContain(overdueTask.id);
    });
  });

  // ── 5. Call Log Follow-Up Integration ──────────────────────────────────────
  describe('5. Call Log Follow-Up Integration', () => {
    it('atomically creates a linked LeadTask when a call log specifies followUpNeeded with followUpDate', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Call Task Integration Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const followUpDate = new Date(Date.now() + 24 * 3600 * 1000);

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'OUTBOUND',
          outcome: 'CONNECTED',
          calledAt: new Date().toISOString(),
          durationSeconds: 180,
          notes: 'Customer asked for property deed verification documents',
          followUpNeeded: true,
          followUpDate: followUpDate.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      expect(res.body.followUpNeeded).toBe(true);
      expect(res.body.followUpTask).toBeTruthy();
      expect(res.body.followUpTask.callLogId).toBe(res.body.id);
      expect(res.body.followUpTask.status).toBe('OPEN');
      expect(res.body.followUpTask.taskType).toBe('CALL');
      expect(res.body.followUpTask.title).toContain('Follow-up call with Call Task Integration Lead');
      expect(new Date(res.body.followUpTask.dueDate).toISOString()).toBe(followUpDate.toISOString());

      // Verify the task exists in DB and is linked to the callLog
      const persistedTask = await prisma.leadTask.findUnique({
        where: { callLogId: res.body.id },
      });
      expect(persistedTask).toBeTruthy();
      expect(persistedTask?.leadId).toBe(lead.id);
      expect(persistedTask?.assignedUserId).toBe(agentA1.user.id);
    });

    it('does NOT create a task if followUpNeeded is false or followUpDate is missing', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'No Task Call Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/calls`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          direction: 'INBOUND',
          outcome: 'NO_ANSWER',
          calledAt: new Date().toISOString(),
          notes: 'Missed call from lead',
          followUpNeeded: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.followUpTask).toBeNull();

      const tasksForLead = await prisma.leadTask.findMany({
        where: { leadId: lead.id },
      });
      expect(tasksForLead.length).toBe(0);
    });

    it('retrieving lead details includes tasks with accurate dynamic isOverdue calculation', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Details Include Tasks Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'CONTACTED',
        },
      });

      await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Review property tax documents',
          dueDate: new Date(Date.now() - 5000), // 5 seconds ago
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      const res = await request(app)
        .get(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.tasks).toBeDefined();
      expect(res.body.tasks.length).toBe(1);
      expect(res.body.tasks[0].title).toBe('Review property tax documents');
      expect(res.body.tasks[0].isOverdue).toBe(true);
    });
  });

  // ── 6. Regressions ─────────────────────────────────────────────────────────
  describe('6. Regressions: Lead Status, Claiming and Releases Unaffected', () => {
    it('lead status and ownership remain completely intact after task creation and completion', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Regression Safe Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
          priority: 'URGENT',
        },
      });

      // Create task
      const taskRes = await request(app)
        .post(`/api/leads/${lead.id}/tasks`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          title: 'Send mortgage broker contacts',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(taskRes.status).toBe(201);

      // Complete task
      await request(app)
        .post(`/api/tasks/${taskRes.body.id}/complete`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      // Verify lead status and priority are untouched
      const leadCheck = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(leadCheck!.status).toBe('QUALIFIED');
      expect(leadCheck!.priority).toBe('URGENT');
      expect(leadCheck!.assignedUserId).toBe(agentA1.user.id);
    });
  });
});
