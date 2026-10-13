import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';
import { convertLeadToDeal } from '../../src/services/leadConversion.service.js';

const app = createApp();
const prisma = new PrismaClient();

function getErrorMessage(res: any): string {
  if (typeof res.body?.error === 'object' && res.body?.error?.message) {
    return res.body.error.message;
  }
  return res.body?.message || res.body?.error || '';
}

describe('Phase 3B: Production-Grade Lead-to-Deal Conversion Security Suite', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA1: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA2: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P3B Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P3B Org B' } });

    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA1 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentA2 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });
  });

  afterAll(async () => {
    // Clean up deals and notification settings first
    await prisma.notificationSetting.deleteMany({
      where: { deal: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.deal.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    // Clean up properties
    await prisma.property.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    // Clean up leads, tasks, visits, audit logs
    await prisma.leadTask.deleteMany({
      where: { lead: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.siteVisit.deleteMany({
      where: { lead: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.conversationThread.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.lead.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await deleteOrgUsers([orgA.id, orgB.id]);
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  });

  describe('1. Conversion Eligibility & Validation Rules', () => {
    it('successfully converts a QUALIFIED lead into an active deal', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Qualified Lead Alice',
          email: 'alice@example.com',
          phone: '+15551112222',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyAddress: '100 Ocean Drive, Miami, FL 33139',
          buyerName: 'Alice Buyer',
          sellerName: 'Bob Seller',
        });

      expect(res.status).toBe(201);
      expect(res.body.deal).toBeDefined();
      expect(res.body.deal.leadId).toBe(lead.id);
      expect(res.body.deal.propertyAddress).toBe('100 Ocean Drive, Miami, FL 33139');
      expect(res.body.deal.buyerName).toBe('Alice Buyer');
      expect(res.body.deal.sellerName).toBe('Bob Seller');
      expect(res.body.deal.status).toBe('ACTIVE');
      expect(res.body.lead.status).toBe('WON');
      expect(res.body.contingencyStatus).toBe('PENDING_DOCUMENT_UPLOAD');
      expect(res.body.initializedDeadlinesCount).toBe(0);

      // Verify DB state
      const updatedLead = await prisma.lead.findUnique({
        where: { id: lead.id },
        include: { deal: true },
      });
      expect(updatedLead?.status).toBe('WON');
      expect(updatedLead?.deal?.id).toBe(res.body.deal.id);

      // Verify notification settings were initialized
      const notifSetting = await prisma.notificationSetting.findUnique({
        where: { dealId: res.body.deal.id },
      });
      expect(notifSetting).toBeDefined();
      expect(notifSetting?.enabled).toBe(true);
    });

    it('successfully converts a PROPOSAL stage lead', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Proposal Lead Paul',
          email: 'paul@example.com',
          status: 'PROPOSAL',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyAddress: '200 Biscayne Blvd, Miami, FL 33132',
        });

      expect(res.status).toBe(201);
      expect(res.body.deal.propertyAddress).toBe('200 Biscayne Blvd, Miami, FL 33132');
      expect(res.body.lead.status).toBe('WON');
    });

    it('rejects an early-stage NEW lead without an explicit eligibility override (400)', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'New Lead Nancy',
          email: 'nancy@example.com',
          status: 'NEW',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyAddress: '300 Brickell Ave, Miami, FL 33131',
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toContain('not eligible for conversion');

      // Verify lead status is untouched
      const leadDb = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(leadDb?.status).toBe('NEW');
    });

    it('rejects an early-stage lead with override=true but missing overrideReason (400)', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Contacted Lead Carl',
          email: 'carl@example.com',
          status: 'CONTACTED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyAddress: '350 Brickell Ave, Miami, FL 33131',
          eligibilityOverride: true,
          // overrideReason omitted
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toContain('override');
    });

    it('allows converting an early-stage lead when eligibilityOverride and overrideReason are provided', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Early Buyer Evan',
          email: 'evan@example.com',
          status: 'CONTACTED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyAddress: '400 Lincoln Rd, Miami Beach, FL 33139',
          eligibilityOverride: true,
          overrideReason: 'Buyer brought verified cash purchase offer directly',
        });

      expect(res.status).toBe(201);
      expect(res.body.deal.propertyAddress).toBe('400 Lincoln Rd, Miami Beach, FL 33139');
      expect(res.body.lead.status).toBe('WON');
    });

    it('rejects conversion of a LOST terminal lead (400)', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Lost Lead Luke',
          email: 'luke@example.com',
          status: 'LOST',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyAddress: '500 Alton Rd, Miami Beach, FL 33139',
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toContain('Cannot convert a lost lead');
    });

    it('rejects request with missing propertyAddress (422)', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Valid Lead Victor',
          email: 'victor@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          // propertyAddress omitted
          buyerName: 'Victor Buyer',
        });

      expect(res.status).toBe(422);
    });
  });

  describe('2. Authentication & Server-Side Authorization', () => {
    it('rejects unauthenticated conversion requests (401)', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Anon Lead',
          email: 'anon@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .send({ propertyAddress: '123 Fake St' });

      expect(res.status).toBe(401);
    });

    it('enforces tenant isolation and returns 404 for cross-tenant lead conversion attempt', async () => {
      const leadB = await prisma.lead.create({
        data: {
          organizationId: orgB.id,
          fullName: 'Tenant B Lead',
          email: 'tb@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentB.user.id,
        },
      });

      // Agent in Org A attempts to convert lead belonging to Org B
      const res = await request(app)
        .post(`/api/leads/${leadB.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyAddress: '123 Fake St' });

      expect(res.status).toBe(404);
      expect(getErrorMessage(res)).toContain('Lead not found');
    });

    it('rejects unauthorized advisor attempting to convert an unassigned lead (403)', async () => {
      const unassignedLead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Pool Lead Unassigned',
          email: 'pool@example.com',
          status: 'QUALIFIED',
          assignedUserId: null,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${unassignedLead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyAddress: '100 Main St' });

      expect(res.status).toBe(403);
      expect(getErrorMessage(res)).toContain('Agents cannot convert unassigned leads');
    });

    it('rejects advisor attempting to convert another advisor’s assigned lead (403)', async () => {
      const leadAgent2 = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Lead Of Agent 2',
          email: 'la2@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA2.user.id,
        },
      });

      // Agent A1 tries to convert Agent A2's lead
      const res = await request(app)
        .post(`/api/leads/${leadAgent2.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyAddress: '100 Main St' });

      expect(res.status).toBe(403);
      expect(getErrorMessage(res)).toContain('Agents can only convert leads assigned to them');
    });

    it('allows organization OWNER to convert an unassigned lead', async () => {
      const unassignedLead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Owner Pool Lead',
          email: 'ownerpool@example.com',
          status: 'QUALIFIED',
          assignedUserId: null,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${unassignedLead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ propertyAddress: '777 Brickell Ave, Miami, FL' });

      expect(res.status).toBe(201);
      expect(res.body.deal.propertyAddress).toBe('777 Brickell Ave, Miami, FL');
    });

    it('allows organization OWNER to convert a lead assigned to any advisor', async () => {
      const agentLead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Agent Lead Converted By Owner',
          email: 'agentconv@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA2.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${agentLead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ propertyAddress: '888 Brickell Ave, Miami, FL' });

      expect(res.status).toBe(201);
      expect(res.body.deal.propertyAddress).toBe('888 Brickell Ave, Miami, FL');
    });
  });

  describe('3. Property Linking & Inventory Status Transitions', () => {
    it('links an available property and transitions its status to UNDER_CONTRACT', async () => {
      const property = await prisma.property.create({
        data: {
          organizationId: orgA.id,
          title: '900 Collins Ave Luxury Condo',
          address: '900 Collins Ave',
          city: 'Miami Beach',
          price: 950000,
          bedrooms: 2,
          bathrooms: 2,
          propertyType: 'CONDO',
          status: 'AVAILABLE',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Property Match Lead',
          email: 'pmatch@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyId: property.id,
          propertyAddress: `${property.address}, ${property.city}`,
        });

      expect(res.status).toBe(201);
      expect(res.body.deal.propertyId).toBe(property.id);

      // Verify property status in database is now UNDER_CONTRACT
      const updatedProp = await prisma.property.findUnique({
        where: { id: property.id },
      });
      expect(updatedProp?.status).toBe('UNDER_CONTRACT');
    });

    it('rejects linking a property that belongs to another organization (404)', async () => {
      const foreignProperty = await prisma.property.create({
        data: {
          organizationId: orgB.id,
          title: '100 Foreign Way Villa',
          address: '100 Foreign Way',
          city: 'Orlando',
          price: 500000,
          bedrooms: 3,
          bathrooms: 2,
          propertyType: 'SINGLE_FAMILY',
          status: 'AVAILABLE',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Cross Prop Lead',
          email: 'crossprop@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyId: foreignProperty.id,
          propertyAddress: '100 Foreign Way, Orlando, FL',
        });

      expect(res.status).toBe(404);
      expect(getErrorMessage(res)).toContain('Property not found');
    });

    it('rejects linking a property that is already SOLD or OFF_MARKET (400)', async () => {
      const soldProperty = await prisma.property.create({
        data: {
          organizationId: orgA.id,
          title: '999 Sold Lane Estate',
          address: '999 Sold Lane',
          city: 'Miami',
          price: 1200000,
          bedrooms: 4,
          bathrooms: 3,
          propertyType: 'SINGLE_FAMILY',
          status: 'SOLD',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Sold Prop Buyer',
          email: 'soldprop@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          propertyId: soldProperty.id,
          propertyAddress: '999 Sold Lane, Miami, FL',
        });

      expect(res.status).toBe(400);
      expect(getErrorMessage(res)).toContain('unavailable for deal conversion');
    });
  });

  describe('4. Idempotency, Concurrency & Duplicate Prevention', () => {
    it('returns 409 Conflict when attempting to re-convert an already converted lead', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Double Convert Lead',
          email: 'double@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      // First conversion
      const firstRes = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyAddress: '101 Idempotency Blvd' });
      expect(firstRes.status).toBe(201);
      const originalDealId = firstRes.body.deal.id;

      // Second conversion
      const secondRes = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyAddress: '101 Idempotency Blvd' });

      expect(secondRes.status).toBe(409);
      expect(getErrorMessage(secondRes)).toContain('already been converted into a deal');

      // Verify only 1 deal exists for this lead
      const deals = await prisma.deal.findMany({ where: { leadId: lead.id } });
      expect(deals.length).toBe(1);
      expect(deals[0].id).toBe(originalDealId);
    });

    it('enforces concurrency protection: parallel conversion requests result in exactly one deal and one 409 Conflict', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Race Condition Lead',
          email: 'race@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      // Fire 2 concurrent conversion requests
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/leads/${lead.id}/convert-to-deal`)
          .set('Authorization', `Bearer ${agentA1.token}`)
          .send({ propertyAddress: '555 Speed Way' }),
        request(app)
          .post(`/api/leads/${lead.id}/convert-to-deal`)
          .set('Authorization', `Bearer ${agentA1.token}`)
          .send({ propertyAddress: '555 Speed Way' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 409]);

      // Exactly one deal persisted
      const deals = await prisma.deal.findMany({ where: { leadId: lead.id } });
      expect(deals.length).toBe(1);
    });

    it('enforces database-level unique constraint on Deal.leadId', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'DB Unique Constraint Lead',
          email: 'dbunique@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      // Insert first deal directly
      await prisma.deal.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          propertyAddress: '1 Unique St',
          status: 'ACTIVE',
        },
      });

      // Attempt inserting second deal directly with same leadId
      await expect(
        prisma.deal.create({
          data: {
            organizationId: orgA.id,
            leadId: lead.id,
            propertyAddress: '2 Duplicate St',
            status: 'ACTIVE',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('5. Audit Logging, Data Integrity & Preserved Subsystems', () => {
    it('records DEAL_CREATED and LEAD_UPDATED audit logs with authenticated actor', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Audit Verify Lead',
          email: 'audit@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyAddress: '777 Audit Trail Way' });

      expect(res.status).toBe(201);
      const dealId = res.body.deal.id;

      // Check Deal audit log
      const dealLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA.id,
          entityId: dealId,
          action: 'DEAL_CREATED',
        },
      });
      expect(dealLog).toBeDefined();
      expect([agentA1.user.id, agentA1.user.email]).toContain(dealLog?.actor);

      // Check Lead audit log
      const leadLog = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA.id,
          entityId: lead.id,
          action: 'LEAD_UPDATED',
        },
      });
      expect(leadLog).toBeDefined();
      expect([agentA1.user.id, agentA1.user.email]).toContain(leadLog?.actor);
      expect(leadLog?.note).toMatch(/converted to deal/i);
    });

    it('preserves existing site visits, tasks, and conversation history on conversion', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Preservation Lead Penny',
          email: 'penny@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      // Attach task
      const task = await prisma.leadTask.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: 'Review pre-approval letter',
          dueDate: new Date(Date.now() + 86400000),
          status: 'OPEN',
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
        },
      });

      // Attach site visit
      const visit = await prisma.siteVisit.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          assignedUserId: agentA1.user.id,
          createdById: agentA1.user.id,
          startAt: new Date(Date.now() + 172800000),
          endAt: new Date(Date.now() + 176400000),
          status: 'SCHEDULED',
        },
      });

      // Attach thread
      const thread = await prisma.conversationThread.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          channel: 'EMAIL',
        },
      });

      // Convert lead
      const res = await request(app)
        .post(`/api/leads/${lead.id}/convert-to-deal`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ propertyAddress: '123 Site Visit Ave' });

      expect(res.status).toBe(201);

      // Verify all sub-entities remain intact
      const remainingTasks = await prisma.leadTask.findMany({ where: { leadId: lead.id } });
      expect(remainingTasks.length).toBe(1);
      expect(remainingTasks[0].id).toBe(task.id);

      const remainingVisits = await prisma.siteVisit.findMany({ where: { leadId: lead.id } });
      expect(remainingVisits.length).toBe(1);
      expect(remainingVisits[0].id).toBe(visit.id);

      const remainingThreads = await prisma.conversationThread.findMany({ where: { leadId: lead.id } });
      expect(remainingThreads.length).toBe(1);
      expect(remainingThreads[0].id).toBe(thread.id);
    });

    it('rolls back database transaction if an unhandled error occurs during deal creation', async () => {
      const lead = await prisma.lead.create({
        data: {
          organizationId: orgA.id,
          fullName: 'Rollback Lead Ray',
          email: 'ray@example.com',
          status: 'QUALIFIED',
          assignedUserId: agentA1.user.id,
        },
      });

      // Attempt conversion with an invalid propertyId that does not exist
      await expect(
        convertLeadToDeal({
          organizationId: orgA.id,
          callerId: agentA1.user.id,
          callerRole: 'AGENT',
          leadId: lead.id,
          propertyAddress: 'Rollback St',
          propertyId: 'non-existent-property-id',
        }),
      ).rejects.toThrow();

      // Lead status must remain QUALIFIED
      const leadDb = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(leadDb?.status).toBe('QUALIFIED');

      // No deal created
      const deals = await prisma.deal.findMany({ where: { leadId: lead.id } });
      expect(deals.length).toBe(0);
    });
  });
});
