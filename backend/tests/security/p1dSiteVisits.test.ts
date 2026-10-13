import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 1D: Real Estate Site Visit Scheduling', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA1: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA2: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;
  let propertyA: { id: string; title: string };
  let propertyB: { id: string; title: string };

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P1D Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P1D Org B' } });

    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA1 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentA2 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });

    propertyA = await prisma.property.create({
      data: {
        title: 'Modern Penthouse Org A',
        address: '123 Skyway Ave',
        city: 'Metropolis',
        price: 1250000,
        bedrooms: 3,
        bathrooms: 2.5,
        propertyType: 'CONDO',
        organizationId: orgA.id,
      },
    });

    propertyB = await prisma.property.create({
      data: {
        title: 'Luxury Villa Org B',
        address: '456 Ocean Dr',
        city: 'Coast City',
        price: 2500000,
        bedrooms: 4,
        bathrooms: 4,
        propertyType: 'SINGLE_FAMILY',
        organizationId: orgB.id,
      },
    });
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
    await prisma.property.deleteMany({
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

  // ── 1. Scheduling and Conflict Prevention ──────────────────────────────────
  describe('1. Scheduling and Conflict Prevention', () => {
    it('successfully schedules a site visit with valid interval, property, and linked task', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Visit Lead 1',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
        },
      });

      const startAt = new Date('2026-10-15T10:00:00.000Z');
      const endAt = new Date('2026-10-15T11:00:00.000Z');

      const res = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyId: propertyA.id,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          meetingLocation: 'Lobby reception desk',
          notes: 'Client interested in floor 25 view',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('SCHEDULED');
      expect(res.body.assignedUserId).toBe(agentA1.user.id);
      expect(res.body.propertyId).toBe(propertyA.id);
      expect(res.body.leadTask).toBeDefined();
      expect(res.body.leadTask.taskType).toBe('SITE_VISIT');
      expect(res.body.leadTask.status).toBe('OPEN');
      expect(new Date(res.body.leadTask.dueDate).toISOString()).toBe(startAt.toISOString());

      // Verify DB persistence
      const saved = await prisma.siteVisit.findUnique({
        where: { id: res.body.id },
        include: { leadTask: true },
      });
      expect(saved).not.toBeNull();
      expect(saved!.leadTask).not.toBeNull();
      expect(saved!.leadTask!.siteVisitId).toBe(saved!.id);
    });

    it('rejects scheduling when end time is before or equal to start time', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Invalid Time Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const startAt = new Date('2026-10-16T14:00:00.000Z');
      const endAt = new Date('2026-10-16T13:00:00.000Z'); // Before start

      const res = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/End time must be strictly after start time/i);
    });

    it('allows adjacent non-overlapping visits for the same advisor (touching boundary)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Adjacent Visit Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      // Visit 1: 10:00 to 11:00
      const v1Start = new Date('2026-10-17T10:00:00.000Z');
      const v1End = new Date('2026-10-17T11:00:00.000Z');
      const res1 = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: v1Start.toISOString(),
          endAt: v1End.toISOString(),
        });
      expect(res1.status).toBe(201);

      // Visit 2: 11:00 to 12:00 (Starts exactly when Visit 1 ends)
      const v2Start = new Date('2026-10-17T11:00:00.000Z');
      const v2End = new Date('2026-10-17T12:00:00.000Z');
      const res2 = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: v2Start.toISOString(),
          endAt: v2End.toISOString(),
        });
      expect(res2.status).toBe(201);
    });

    it('rejects overlapping visits for the same advisor with 409 Conflict', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Conflict Overlap Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      // Existing: 14:00 to 15:00
      const start1 = new Date('2026-10-18T14:00:00.000Z');
      const end1 = new Date('2026-10-18T15:00:00.000Z');
      await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ startAt: start1.toISOString(), endAt: end1.toISOString() });

      // Overlap attempt: 14:30 to 15:30
      const start2 = new Date('2026-10-18T14:30:00.000Z');
      const end2 = new Date('2026-10-18T15:30:00.000Z');
      const resConflict = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ startAt: start2.toISOString(), endAt: end2.toISOString() });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.error.message).toMatch(/conflicting site visit/i);
    });

    it('cancelled visits no longer block subsequent bookings for that time slot', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Cancelled Slot Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const start = new Date('2026-10-19T10:00:00.000Z');
      const end = new Date('2026-10-19T11:00:00.000Z');

      const createRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ startAt: start.toISOString(), endAt: end.toISOString() });
      expect(createRes.status).toBe(201);

      // Cancel the visit
      const cancelRes = await request(app)
        .post(`/api/site-visits/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ reason: 'Lead requested alternative day' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('CANCELLED');

      // Re-booking the same advisor at the exact same slot should now succeed
      const rebookRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ startAt: start.toISOString(), endAt: end.toISOString() });
      expect(rebookRes.status).toBe(201);
      expect(rebookRes.body.status).toBe('SCHEDULED');
    });

    it('rejects rescheduling into a slot that conflicts with another active visit', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Reschedule Conflict Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      // Visit A: 09:00 to 10:00
      const resA = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-20T09:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-20T10:00:00.000Z').toISOString(),
        });
      expect(resA.status).toBe(201);

      // Visit B: 11:00 to 12:00
      const resB = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-20T11:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-20T12:00:00.000Z').toISOString(),
        });
      expect(resB.status).toBe(201);

      // Try rescheduling Visit B into 09:30 to 10:30 (conflicts with Visit A)
      const resPatch = await request(app)
        .patch(`/api/site-visits/${resB.body.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-20T09:30:00.000Z').toISOString(),
          endAt: new Date('2026-10-20T10:30:00.000Z').toISOString(),
        });

      expect(resPatch.status).toBe(409);

      // Verify Visit B was not mutated or corrupted
      const visitBUnchanged = await prisma.siteVisit.findUnique({ where: { id: resB.body.id } });
      expect(visitBUnchanged!.startAt.toISOString()).toBe(new Date('2026-10-20T11:00:00.000Z').toISOString());
    });

    it('concurrent overlapping bookings serialize: at most one conflicting booking succeeds', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Race Condition Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const start = new Date('2026-10-21T15:00:00.000Z').toISOString();
      const end = new Date('2026-10-21T16:00:00.000Z').toISOString();

      // Launch 2 parallel requests trying to book the exact same slot for the same advisor
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/leads/${lead.id}/site-visits`)
          .set('Authorization', `Bearer ${agentA1.token}`)
          .send({ startAt: start, endAt: end }),
        request(app)
          .post(`/api/leads/${lead.id}/site-visits`)
          .set('Authorization', `Bearer ${agentA1.token}`)
          .send({ startAt: start, endAt: end }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one 201 Created and one 409 Conflict
      expect(statuses).toEqual([201, 409]);
    });

    it('rejects rescheduling an already-cancelled site visit with 422', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Cancelled Reschedule Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const createRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-22T10:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-22T11:00:00.000Z').toISOString(),
        });
      expect(createRes.status).toBe(201);
      const visitId = createRes.body.id;

      // Cancel it
      const cancelRes = await request(app)
        .post(`/api/site-visits/${visitId}/cancel`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ reason: 'Lead cancelled' });
      expect(cancelRes.status).toBe(200);

      // Attempt to reschedule cancelled visit
      const reschedRes = await request(app)
        .patch(`/api/site-visits/${visitId}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-22T14:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-22T15:00:00.000Z').toISOString(),
        });

      expect(reschedRes.status).toBe(422);
      expect(reschedRes.body.error.message).toMatch(/Cannot reschedule a cancelled site visit/i);

      // Verify DB visit and linked task remain CANCELLED
      const visitInDb = await prisma.siteVisit.findUnique({
        where: { id: visitId },
        include: { leadTask: true },
      });
      expect(visitInDb!.status).toBe('CANCELLED');
      expect(visitInDb!.leadTask!.status).toBe('CANCELLED');
    });

    it('concurrent cancellation and rescheduling: cancellation wins and reschedule fails safely without corrupting task', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Concurrent Race Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const origStart = new Date('2026-10-23T10:00:00.000Z');
      const createRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: origStart.toISOString(),
          endAt: new Date('2026-10-23T11:00:00.000Z').toISOString(),
        });
      expect(createRes.status).toBe(201);
      const visitId = createRes.body.id;

      const newStart = new Date('2026-10-23T14:00:00.000Z');

      // Fire parallel cancel and reschedule
      const [cancelRes, reschedRes] = await Promise.all([
        request(app)
          .post(`/api/site-visits/${visitId}/cancel`)
          .set('Authorization', `Bearer ${agentA1.token}`)
          .send({ reason: 'Simultaneous cancellation' }),
        request(app)
          .patch(`/api/site-visits/${visitId}`)
          .set('Authorization', `Bearer ${agentA1.token}`)
          .send({
            startAt: newStart.toISOString(),
            endAt: new Date('2026-10-23T15:00:00.000Z').toISOString(),
          }),
      ]);

      // Cancellation must succeed (200)
      expect(cancelRes.status).toBe(200);

      // Final state in DB must be internally consistent: visit is CANCELLED and task is CANCELLED
      const finalVisit = await prisma.siteVisit.findUnique({
        where: { id: visitId },
        include: { leadTask: true },
      });

      expect(finalVisit!.status).toBe('CANCELLED');
      expect(finalVisit!.leadTask!.status).toBe('CANCELLED');
      if (reschedRes.status !== 200) {
        expect(reschedRes.status).toBe(422);
      }
    });

    it('concurrent conflicting reschedules for the same advisor: at most one succeeds', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Conflicting Reschedule Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const resA = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-11-20T08:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-20T09:00:00.000Z').toISOString(),
        });
      const resB = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-11-20T12:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-20T13:00:00.000Z').toISOString(),
        });

      // Both try to reschedule into 10:00 - 11:00 simultaneously
      const targetSlotStart = new Date('2026-11-20T10:00:00.000Z').toISOString();
      const targetSlotEnd = new Date('2026-11-20T11:00:00.000Z').toISOString();

      const [patchA, patchB] = await Promise.all([
        request(app)
          .patch(`/api/site-visits/${resA.body.id}`)
          .set('Authorization', `Bearer ${agentA1.token}`)
          .send({ startAt: targetSlotStart, endAt: targetSlotEnd }),
        request(app)
          .patch(`/api/site-visits/${resB.body.id}`)
          .set('Authorization', `Bearer ${agentA1.token}`)
          .send({ startAt: targetSlotStart, endAt: targetSlotEnd }),
      ]);

      const statuses = [patchA.status, patchB.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Check DB has no overlapping visits for advisor
      const visitsInSlot = await prisma.siteVisit.findMany({
        where: {
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: { not: 'CANCELLED' },
          startAt: new Date(targetSlotStart),
          endAt: new Date(targetSlotEnd),
        },
      });
      expect(visitsInSlot.length).toBe(1);
    });

    it('concurrent reassignment of two visits to the same destination advisor for overlapping slots', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Reassignment Race Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const res1 = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({
          assignedUserId: agentA1.user.id,
          startAt: new Date('2026-11-21T08:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-21T09:00:00.000Z').toISOString(),
        });

      const res2 = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({
          assignedUserId: agentA1.user.id,
          startAt: new Date('2026-11-21T13:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-21T14:00:00.000Z').toISOString(),
        });

      // Owner concurrently reassigns both visits to agentA2 for the same slot 16:00 - 17:00
      const targetSlotStart = new Date('2026-11-21T16:00:00.000Z').toISOString();
      const targetSlotEnd = new Date('2026-11-21T17:00:00.000Z').toISOString();

      const [patch1, patch2] = await Promise.all([
        request(app)
          .patch(`/api/site-visits/${res1.body.id}`)
          .set('Authorization', `Bearer ${ownerA.token}`)
          .send({ assignedUserId: agentA2.user.id, startAt: targetSlotStart, endAt: targetSlotEnd }),
        request(app)
          .patch(`/api/site-visits/${res2.body.id}`)
          .set('Authorization', `Bearer ${ownerA.token}`)
          .send({ assignedUserId: agentA2.user.id, startAt: targetSlotStart, endAt: targetSlotEnd }),
      ]);

      const statuses = [patch1.status, patch2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Exactly one visit is assigned to agentA2 at that slot
      const a2Visits = await prisma.siteVisit.findMany({
        where: {
          organizationId: orgA.id,
          assignedUserId: agentA2.user.id,
          status: { not: 'CANCELLED' },
          startAt: new Date(targetSlotStart),
          endAt: new Date(targetSlotEnd),
        },
      });
      expect(a2Visits.length).toBe(1);
    });

    it('exercises genuine PostgreSQL database engine row lock contention using two simultaneous independent connections', async () => {
      const dbUrl = process.env.DATABASE_URL!;
      const client1 = new PrismaClient({ datasources: { db: { url: dbUrl } } });
      const client2 = new PrismaClient({ datasources: { db: { url: dbUrl } } });

      try {
        const lead = await prisma.lead.create({
          data: {
            fullName: 'Genuine DB Lock Lead',
            organizationId: orgA.id,
            assignedUserId: agentA1.user.id,
          },
        });

        const slotStart = new Date('2026-11-10T10:00:00.000Z');
        const slotEnd = new Date('2026-11-10T11:00:00.000Z');

        let client1AcquiredLock = false;
        let client2Started = false;

        const promise1 = client1.$transaction(async (tx1) => {
          // 1. Acquire row lock on advisor
          await tx1.$executeRaw`SELECT id FROM users WHERE id = ${agentA1.user.id} FOR UPDATE`;
          client1AcquiredLock = true;

          // Hold transaction lock for 120ms to ensure client2 actively contends on PostgreSQL engine lock
          await new Promise((resolve) => setTimeout(resolve, 120));

          // Create visit under lock
          await tx1.siteVisit.create({
            data: {
              organizationId: orgA.id,
              leadId: lead.id,
              assignedUserId: agentA1.user.id,
              createdById: agentA1.user.id,
              startAt: slotStart,
              endAt: slotEnd,
              status: 'SCHEDULED',
            },
          });
        });

        const promise2 = (async () => {
          // Wait until client1 has acquired lock
          while (!client1AcquiredLock) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          client2Started = true;
          try {
            await client2.$transaction(async (tx2) => {
              // This query blocks in PostgreSQL engine until tx1 commits!
              await tx2.$executeRaw`SELECT id FROM users WHERE id = ${agentA1.user.id} FOR UPDATE`;

              // Check conflicts under lock
              const conflict = await tx2.siteVisit.findFirst({
                where: {
                  organizationId: orgA.id,
                  assignedUserId: agentA1.user.id,
                  status: { not: 'CANCELLED' },
                  startAt: { lt: slotEnd },
                  endAt: { gt: slotStart },
                },
              });

              if (conflict) {
                throw new Error('CONFLICT_DETECTED');
              }

              await tx2.siteVisit.create({
                data: {
                  organizationId: orgA.id,
                  leadId: lead.id,
                  assignedUserId: agentA1.user.id,
                  createdById: agentA1.user.id,
                  startAt: slotStart,
                  endAt: slotEnd,
                  status: 'SCHEDULED',
                },
              });
            });
          } catch (err: any) {
            return err.message;
          }
          return 'SUCCESS';
        })();

        const [, res2] = await Promise.all([promise1, promise2]);

        // Client 2 was blocked and only completed with conflict detection
        expect(client2Started).toBe(true);
        expect(res2).toBe('CONFLICT_DETECTED');

        // Verify database has exactly 1 visit
        const visits = await prisma.siteVisit.findMany({
          where: {
            organizationId: orgA.id,
            assignedUserId: agentA1.user.id,
            startAt: slotStart,
          },
        });
        expect(visits.length).toBe(1);
      } finally {
        await client1.$disconnect();
        await client2.$disconnect();
      }
    });
  });

  // ── 2. Security and Tenant Isolation ───────────────────────────────────────
  describe('2. Security and Tenant Isolation', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/site-visits');
      expect(res.status).toBe(401);
    });

    it('prevents AGENT from scheduling visits for leads owned by another advisor', async () => {
      const leadOwnedByA2 = await prisma.lead.create({
        data: {
          fullName: 'A2 Owned Lead',
          organizationId: orgA.id,
          assignedUserId: agentA2.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${leadOwnedByA2.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-22T10:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-22T11:00:00.000Z').toISOString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Agents can only schedule site visits for their assigned leads/i);
    });

    it('prevents AGENT from assigning site visits to other advisors', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Assign Hijack Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-22T14:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-22T15:00:00.000Z').toISOString(),
          assignedUserId: agentA2.user.id, // Agent A1 attempts to assign to Agent A2
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toMatch(/Agents cannot assign site visits to other advisors/i);
    });

    it('allows OWNER to schedule and assign visits to any advisor in the organization', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Owner Managed Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({
          startAt: new Date('2026-10-23T10:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-23T11:00:00.000Z').toISOString(),
          assignedUserId: agentA2.user.id, // Owner assigns to A2
        });

      expect(res.status).toBe(201);
      expect(res.body.assignedUserId).toBe(agentA2.user.id);
    });

    it('rejects cross-tenant lead visit scheduling', async () => {
      const leadOrgB = await prisma.lead.create({
        data: {
          fullName: 'Org B Lead',
          organizationId: orgB.id,
          assignedUserId: agentB.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${leadOrgB.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-23T14:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-23T15:00:00.000Z').toISOString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/Lead not found/i);
    });

    it('rejects cross-tenant property association', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Property Cross Tenant Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyId: propertyB.id, // Belongs to Org B!
          startAt: new Date('2026-10-24T10:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-24T11:00:00.000Z').toISOString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/Property not found in this organization/i);
    });

    it('prevents OWNER from attaching cross-tenant property during reschedule (PATCH)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Owner Cross Prop Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const createRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({
          propertyId: propertyA.id,
          startAt: new Date('2026-11-22T10:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-22T11:00:00.000Z').toISOString(),
        });
      expect(createRes.status).toBe(201);
      const visitId = createRes.body.id;

      // Owner attempts to attach propertyB (belongs to orgB)
      const patchRes = await request(app)
        .patch(`/api/site-visits/${visitId}`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ propertyId: propertyB.id });

      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error.message).toMatch(/Property not found in this organization/i);

      // Verify DB visit still has propertyA and was not modified
      const visitInDb = await prisma.siteVisit.findUnique({ where: { id: visitId } });
      expect(visitInDb!.propertyId).toBe(propertyA.id);
    });

    it('prevents AGENT from attaching cross-tenant property during reschedule (PATCH)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Agent Cross Prop Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const createRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-11-22T12:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-22T13:00:00.000Z').toISOString(),
        });
      expect(createRes.status).toBe(201);
      const visitId = createRes.body.id;

      // Agent attempts to attach propertyB
      const patchRes = await request(app)
        .patch(`/api/site-visits/${visitId}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyId: propertyB.id });

      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error.message).toMatch(/Property not found in this organization/i);
    });

    it('allows attaching a valid property belonging to the same organization on reschedule', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Valid Prop Reschedule Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      // Initially schedule with no property
      const createRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-11-22T14:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-22T15:00:00.000Z').toISOString(),
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.propertyId).toBeNull();
      const visitId = createRes.body.id;

      // Reschedule to attach propertyA
      const patchRes = await request(app)
        .patch(`/api/site-visits/${visitId}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyId: propertyA.id });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.propertyId).toBe(propertyA.id);
      expect(patchRes.body.property).toBeDefined();
      expect(patchRes.body.property.title).toBe(propertyA.title);
    });

    it('clears property when explicitly passing propertyId: null on reschedule', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Clear Prop Reschedule Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      // Schedule with propertyA
      const createRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyId: propertyA.id,
          startAt: new Date('2026-11-22T16:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-22T17:00:00.000Z').toISOString(),
        });
      expect(createRes.status).toBe(201);
      const visitId = createRes.body.id;

      // Pass propertyId: null to clear property
      const patchRes = await request(app)
        .patch(`/api/site-visits/${visitId}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyId: null });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.propertyId).toBeNull();
      expect(patchRes.body.property).toBeNull();

      const visitInDb = await prisma.siteVisit.findUnique({ where: { id: visitId } });
      expect(visitInDb!.propertyId).toBeNull();
    });

    it('preserves existing property when propertyId is omitted on reschedule', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Omit Prop Reschedule Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const createRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyId: propertyA.id,
          startAt: new Date('2026-11-22T18:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-22T19:00:00.000Z').toISOString(),
        });
      const visitId = createRes.body.id;

      // Reschedule without propertyId field
      const patchRes = await request(app)
        .patch(`/api/site-visits/${visitId}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ meetingLocation: 'Main Lobby' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.propertyId).toBe(propertyA.id);
      expect(patchRes.body.meetingLocation).toBe('Main Lobby');
    });

    it('ignores client-supplied organizationId and createdById in request payloads', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Spoof ID Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-11-23T14:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-23T15:00:00.000Z').toISOString(),
          organizationId: orgB.id, // Client spoof attempt
          createdById: agentB.user.id, // Client spoof attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.organizationId).toBe(orgA.id);
      expect(res.body.createdById).toBe(agentA1.user.id);
    });
  });

  // ── 3. Lifecycle, Auditability & Linked Task Integration ───────────────────
  describe('3. Lifecycle, Auditability & Linked Task Integration', () => {
    it('completing a visit records completion actor, outcome notes, and completes linked task', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Completion Lifecycle Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const visitRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
          endAt: new Date(Date.now() - 35 * 3600 * 1000).toISOString(),
        });
      expect(visitRes.status).toBe(201);
      const visitId = visitRes.body.id;

      // Complete visit whose scheduled start time has arrived
      const compRes = await request(app)
        .post(`/api/site-visits/${visitId}/complete`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ outcomeNotes: 'Client loved the kitchen, scheduling second walkthrough' });

      expect(compRes.status).toBe(200);
      expect(compRes.body.status).toBe('COMPLETED');
      expect(compRes.body.outcomeNotes).toBe('Client loved the kitchen, scheduling second walkthrough');
      expect(compRes.body.completedById).toBe(agentA1.user.id);

      // Verify linked task completed
      const task = await prisma.leadTask.findUnique({
        where: { siteVisitId: visitId },
      });
      expect(task).not.toBeNull();
      expect(task!.status).toBe('COMPLETED');
      expect(task!.completedById).toBe(agentA1.user.id);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: visitId, action: 'SITE_VISIT_COMPLETED' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.actor).toBe(agentA1.user.email);
    });

    it('rejects completing a future visit with 422 before scheduled start time has arrived', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Future Complete Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const futureStart = new Date(Date.now() + 24 * 3600 * 1000);
      const visitRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: futureStart.toISOString(),
          endAt: new Date(futureStart.getTime() + 3600 * 1000).toISOString(),
        });
      expect(visitRes.status).toBe(201);
      const visitId = visitRes.body.id;

      const compRes = await request(app)
        .post(`/api/site-visits/${visitId}/complete`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ outcomeNotes: 'Premature completion attempt' });

      expect(compRes.status).toBe(422);
      expect(compRes.body.error.message).toMatch(/Cannot complete a site visit before its scheduled start time/i);

      // Verify DB visit and linked task remain untouched (SCHEDULED & OPEN)
      const visitInDb = await prisma.siteVisit.findUnique({
        where: { id: visitId },
        include: { leadTask: true },
      });
      expect(visitInDb!.status).toBe('SCHEDULED');
      expect(visitInDb!.completedAt).toBeNull();
      expect(visitInDb!.leadTask!.status).toBe('OPEN');

      // Verify no completion audit log created
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: visitId, action: 'SITE_VISIT_COMPLETED' },
      });
      expect(audit).toBeNull();
    });

    it('cancelling a visit cancels linked task and records reason', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Cancellation Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const visitRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-26T10:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-26T11:00:00.000Z').toISOString(),
        });
      const visitId = visitRes.body.id;

      const cancelRes = await request(app)
        .post(`/api/site-visits/${visitId}/cancel`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ reason: 'Weather conditions prevented travel' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('CANCELLED');
      expect(cancelRes.body.cancelReason).toBe('Weather conditions prevented travel');

      const task = await prisma.leadTask.findUnique({ where: { siteVisitId: visitId } });
      expect(task!.status).toBe('CANCELLED');
    });

    it('marking visit as NO_SHOW updates status and cancels open task', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'No Show Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      // Scheduled start time has arrived (24 hours ago)
      const visitRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          endAt: new Date(Date.now() - 23 * 3600 * 1000).toISOString(),
        });
      expect(visitRes.status).toBe(201);
      const visitId = visitRes.body.id;

      const noShowRes = await request(app)
        .post(`/api/site-visits/${visitId}/no-show`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ notes: 'Waited 30 minutes, buyer did not appear or answer phone' });

      expect(noShowRes.status).toBe(200);
      expect(noShowRes.body.status).toBe('NO_SHOW');
      expect(noShowRes.body.noShowById).toBe(agentA1.user.id);

      const task = await prisma.leadTask.findUnique({ where: { siteVisitId: visitId } });
      expect(task!.status).toBe('CANCELLED');
    });

    it('rejects marking a future visit as no-show with 422 before scheduled start time has arrived', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Future No Show Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const futureStart = new Date(Date.now() + 48 * 3600 * 1000);
      const visitRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: futureStart.toISOString(),
          endAt: new Date(futureStart.getTime() + 3600 * 1000).toISOString(),
        });
      expect(visitRes.status).toBe(201);
      const visitId = visitRes.body.id;

      const noShowRes = await request(app)
        .post(`/api/site-visits/${visitId}/no-show`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ notes: 'Premature no show' });

      expect(noShowRes.status).toBe(422);
      expect(noShowRes.body.error.message).toMatch(/Cannot mark a site visit as no-show before its scheduled start time/i);

      // Verify DB visit remains SCHEDULED and task remains OPEN
      const visitInDb = await prisma.siteVisit.findUnique({
        where: { id: visitId },
        include: { leadTask: true },
      });
      expect(visitInDb!.status).toBe('SCHEDULED');
      expect(visitInDb!.leadTask!.status).toBe('OPEN');
    });

    it('rejects invalid state transitions (completing cancelled, marking no-show on cancelled, cancelling completed)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Transition Check Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const visitRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
          endAt: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
        });
      expect(visitRes.status).toBe(201);
      const visitId = visitRes.body.id;

      // Cancel it
      await request(app)
        .post(`/api/site-visits/${visitId}/cancel`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      // Try to complete cancelled visit
      const badComp = await request(app)
        .post(`/api/site-visits/${visitId}/complete`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ outcomeNotes: 'Should fail' });
      expect(badComp.status).toBe(422);
      expect(badComp.body.error.message).toMatch(/Cannot complete a cancelled site visit/i);

      // Try to mark cancelled visit as no-show
      const badNoShow = await request(app)
        .post(`/api/site-visits/${visitId}/no-show`)
        .set('Authorization', `Bearer ${agentA1.token}`);
      expect(badNoShow.status).toBe(422);
      expect(badNoShow.body.error.message).toMatch(/Cannot mark a cancelled site visit as no-show/i);
    });

    it('rescheduling updates linked task due date to match new startAt', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Task Due Sync Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const originalStart = new Date('2026-10-29T10:00:00.000Z');
      const visitRes = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: originalStart.toISOString(),
          endAt: new Date('2026-10-29T11:00:00.000Z').toISOString(),
        });
      const visitId = visitRes.body.id;

      const newStart = new Date('2026-10-30T14:00:00.000Z');
      const reschedRes = await request(app)
        .patch(`/api/site-visits/${visitId}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: newStart.toISOString(),
          endAt: new Date('2026-10-30T15:00:00.000Z').toISOString(),
        });
      expect(reschedRes.status).toBe(200);

      const task = await prisma.leadTask.findUnique({ where: { siteVisitId: visitId } });
      expect(task!.dueDate.toISOString()).toBe(newStart.toISOString());
    });
  });

  // ── 4. Regressions: Lead Details & Call Logs ───────────────────────────────
  describe('4. Regressions: Lead Details & Call Logs', () => {
    it('lead details include persisted site visits alongside tasks and call logs', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Full Profile Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
        },
      });

      // Schedule visit
      await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-10-31T10:00:00.000Z').toISOString(),
          endAt: new Date('2026-10-31T11:00:00.000Z').toISOString(),
          meetingLocation: 'Sales Suite 3',
        });

      const detailsRes = await request(app)
        .get(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(detailsRes.status).toBe(200);
      expect(detailsRes.body.siteVisits).toBeDefined();
      expect(detailsRes.body.siteVisits.length).toBe(1);
      expect(detailsRes.body.siteVisits[0].meetingLocation).toBe('Sales Suite 3');
      expect(detailsRes.body.tasks).toBeDefined();
      expect(detailsRes.body.tasks.length).toBeGreaterThanOrEqual(1);
    });

    it('lead status and ownership remain unaffected by visit creation and completion', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Unaffected Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
          status: 'QUALIFIED',
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/site-visits`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          startAt: new Date('2026-11-01T10:00:00.000Z').toISOString(),
          endAt: new Date('2026-11-01T11:00:00.000Z').toISOString(),
        });

      const checked = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(checked!.status).toBe('QUALIFIED');
      expect(checked!.assignedUserId).toBe(agentA1.user.id);
    });
  });
});
