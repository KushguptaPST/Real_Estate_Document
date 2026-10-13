import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession } from '../helpers/auth.js';
import { maskEmail } from '../../src/utils/audit.js';
import { extractAndPersistRequirements } from '../../src/services/lead.service.js';

const app = createApp();
const prisma = new PrismaClient();

describe('P0 Security & Business Logic Regression Suite', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA1: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA2: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P0 Regression Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P0 Regression Org B' } });

    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA1 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentA2 = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });
  });

  afterAll(async () => {
    const orgIds = [orgA.id, orgB.id];
    await prisma.emailLog.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.notificationSetting.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.deal.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.conversationMessage.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.conversationThread.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.leadRequirementProposal.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.leadRequirement.deleteMany({ where: { lead: { organizationId: { in: orgIds } } } });
    await prisma.lead.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.$disconnect();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Lead Reassignment Authorization Policy
  // ───────────────────────────────────────────────────────────────────────────
  describe('Lead Reassignment Authorization Policy', () => {
    it('prevents an advisor (AGENT) from stealing a lead assigned to another advisor', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Advisor A2 Lead',
          organizationId: orgA.id,
          assignedUserId: agentA2.user.id,
        },
      });

      const res = await request(app)
        .patch(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ assignedUserId: agentA1.user.id });

      expect(res.status).toBe(403);
      expect(res.body.error?.message ?? res.body.error).toMatch(/Agents cannot reassign leads owned by another advisor/i);

      // Verify assignment was NOT changed in DB
      const unchanged = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(unchanged?.assignedUserId).toBe(agentA2.user.id);
    });

    it('prevents an advisor (AGENT) from reassigning an unassigned lead to another agent', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Unassigned Pool Lead',
          organizationId: orgA.id,
          assignedUserId: null,
        },
      });

      const res = await request(app)
        .patch(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ assignedUserId: agentA2.user.id });

      expect(res.status).toBe(403);
      expect(res.body.error?.message ?? res.body.error).toMatch(/Agents can only assign leads to themselves/i);
    });

    it('allows an advisor (AGENT) to claim an unassigned lead for themselves', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Unassigned Claimable Lead',
          organizationId: orgA.id,
          assignedUserId: null,
        },
      });

      const res = await request(app)
        .patch(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({ assignedUserId: agentA1.user.id });

      expect(res.status).toBe(200);
      expect(res.body.assignedUserId).toBe(agentA1.user.id);

      const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(updated?.assignedUserId).toBe(agentA1.user.id);
    });

    it('allows an OWNER to reassign any lead in their organization to any advisor', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Owner Managed Lead',
          organizationId: orgA.id,
          assignedUserId: agentA1.user.id,
        },
      });

      const res = await request(app)
        .patch(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ assignedUserId: agentA2.user.id });

      expect(res.status).toBe(200);
      expect(res.body.assignedUserId).toBe(agentA2.user.id);
    });

    it('rejects assignment to an advisor belonging to another organization (422)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Cross Org Test Lead',
          organizationId: orgA.id,
        },
      });

      const res = await request(app)
        .patch(`/api/leads/${lead.id}`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ assignedUserId: agentB.user.id });

      expect(res.status).toBe(422);
      expect(res.body.error?.message ?? res.body.error).toMatch(/Assigned user is not a member of this organization/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. AI Requirement Extraction: Proposal Pattern & Advisor Review
  // ───────────────────────────────────────────────────────────────────────────
  describe('AI Requirement Extraction Proposals & Advisor Review', () => {
    it('creates a proposal in PENDING status without overwriting existing LeadRequirement', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Requirement Test Lead',
          organizationId: orgA.id,
          requirements: {
            create: {
              minBudget: 5000000,
              maxBudget: 10000000,
              propertyType: 'Villa',
              preferredLocations: ['Indiranagar'],
            },
          },
        },
      });

      // Call extraction service
      const proposal = await extractAndPersistRequirements(
        lead.id,
        'Looking for 3BHK apartment in Whitefield within 1.5 Cr',
        orgA.id,
      );

      expect(proposal).toBeDefined();
      expect(proposal.id).toBeDefined();

      // Verify the proposal is PENDING in the DB
      const storedProposal = await prisma.leadRequirementProposal.findUnique({
        where: { id: proposal.id },
      });
      expect(storedProposal?.status).toBe('PENDING');

      // Verify the existing LeadRequirement was NOT overwritten
      const currentReqs = await prisma.leadRequirement.findUnique({
        where: { leadId: lead.id },
      });
      expect(currentReqs?.propertyType).toBe('Villa');
      expect(currentReqs?.minBudget).toBe(5000000);
      expect(currentReqs?.preferredLocations).toEqual(['Indiranagar']);
    });

    it('provides proposal listing and enforces tenant isolation on proposals', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Org A Isolation Lead',
          organizationId: orgA.id,
        },
      });

      const proposal = await prisma.leadRequirementProposal.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          proposedMinBudget: 8000000,
          proposedMaxBudget: 15000000,
          proposedLocations: ['Whitefield', 'Sarjapur'],
          proposedPropertyType: 'Apartment',
          status: 'PENDING',
        },
      });

      // Org A agent can view the proposal
      const resA = await request(app)
        .get(`/api/leads/${lead.id}/proposals`)
        .set('Authorization', `Bearer ${agentA1.token}`);
      expect(resA.status).toBe(200);
      expect(resA.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: proposal.id })]),
      );

      // Org B agent cannot view proposals for Org A lead (404)
      const resB = await request(app)
        .get(`/api/leads/${lead.id}/proposals`)
        .set('Authorization', `Bearer ${agentB.token}`);
      expect(resB.status).toBe(404);
    });

    it('allows an advisor to modify a proposal (PATCH) before accepting', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Proposal Modify Lead',
          organizationId: orgA.id,
        },
      });

      const proposal = await prisma.leadRequirementProposal.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          proposedMinBudget: 5000000,
          proposedMaxBudget: 9000000,
          proposedLocations: ['Koramangala'],
          status: 'PENDING',
        },
      });

      const patchRes = await request(app)
        .patch(`/api/leads/${lead.id}/proposals/${proposal.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          action: 'MODIFY',
          maxBudget: 12000000,
          preferredLocations: ['Koramangala', 'HSR Layout'],
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.proposal.status).toBe('MODIFIED');
      expect(patchRes.body.requirements.maxBudget).toBe(12000000);
      expect(patchRes.body.requirements.preferredLocations).toEqual(['Koramangala', 'HSR Layout']);
    });

    it('allows an advisor to accept a proposal, updating LeadRequirement and recording audit log', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Proposal Accept Lead',
          organizationId: orgA.id,
        },
      });

      const proposal = await prisma.leadRequirementProposal.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          proposedMinBudget: 6000000,
          proposedMaxBudget: 11000000,
          proposedLocations: ['Bellandur'],
          proposedPropertyType: 'Condo',
          status: 'PENDING',
        },
      });

      const acceptRes = await request(app)
        .post(`/api/leads/${lead.id}/proposals/${proposal.id}/accept`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.proposal.status).toBe('APPROVED');

      // Verify LeadRequirement was updated with approved values
      const requirement = await prisma.leadRequirement.findUnique({
        where: { leadId: lead.id },
      });
      expect(requirement?.minBudget).toBe(6000000);
      expect(requirement?.maxBudget).toBe(11000000);
      expect(requirement?.propertyType).toBe('Condo');
      expect(requirement?.preferredLocations).toEqual(['Bellandur']);

      // Verify audit log exists
      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA.id,
          action: 'LEAD_UPDATED',
          note: { contains: 'applied to lead requirements' },
        },
      });
      expect(audit).toBeDefined();
    });

    it('allows an advisor to reject a proposal without changing LeadRequirement', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Proposal Reject Lead',
          organizationId: orgA.id,
          requirements: {
            create: {
              propertyType: 'Penthouse',
              minBudget: 20000000,
            },
          },
        },
      });

      const proposal = await prisma.leadRequirementProposal.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          proposedPropertyType: 'Studio',
          status: 'PENDING',
        },
      });

      const rejectRes = await request(app)
        .post(`/api/leads/${lead.id}/proposals/${proposal.id}/reject`)
        .set('Authorization', `Bearer ${agentA1.token}`);

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.proposal.status).toBe('REJECTED');

      // Requirement unchanged
      const req = await prisma.leadRequirement.findUnique({ where: { leadId: lead.id } });
      expect(req?.propertyType).toBe('Penthouse');
      expect(req?.minBudget).toBe(20000000);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Customer Message Immutability in AI Review
  // ───────────────────────────────────────────────────────────────────────────
  describe('Customer Message Immutability', () => {
    it('rejects attempt to review/edit a customer-authored message (400)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Message Immutability Lead',
          organizationId: orgA.id,
        },
      });

      const thread = await prisma.conversationThread.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          channel: 'WHATSAPP',
        },
      });

      const customerMsg = await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgA.id,
          senderType: 'CUSTOMER',
          content: 'Original customer inquiry text: is this property still available?',
        },
      });

      const res = await request(app)
        .patch(`/api/leads/${lead.id}/conversations/messages/${customerMsg.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          status: 'APPROVED',
          editedContent: 'Tampered message text',
        });

      expect(res.status).toBe(400);
      expect(res.body.error?.message ?? res.body.error).toMatch(/Customer-authored messages cannot be modified or reviewed/i);

      // Verify the content was unchanged
      const msgAfter = await prisma.conversationMessage.findUnique({
        where: { id: customerMsg.id },
      });
      expect(msgAfter?.content).toBe(customerMsg.content);
      expect(msgAfter?.senderType).toBe('CUSTOMER');
    });

    it('allows reviewing an AI-generated draft message', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'AI Draft Review Lead',
          organizationId: orgA.id,
        },
      });

      const thread = await prisma.conversationThread.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          channel: 'WHATSAPP',
        },
      });

      const aiMsg = await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgA.id,
          senderType: 'AI',
          approvalStatus: 'PENDING_APPROVAL',
          content: 'Hello, this is an AI suggested follow-up.',
        },
      });

      const res = await request(app)
        .patch(`/api/leads/${lead.id}/conversations/messages/${aiMsg.id}`)
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          status: 'APPROVED',
        });

      expect(res.status).toBe(200);
      expect(res.body.approvalStatus).toBe('APPROVED');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Property Inventory Write Authorization
  // ───────────────────────────────────────────────────────────────────────────
  describe('Property Inventory Write Authorization', () => {
    it('forbids an advisor (AGENT) from adding inventory properties (403)', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${agentA1.token}`)
        .send({
          title: 'Unauthorized Luxury Villa',
          address: '45 Palm Grove Road',
          city: 'Bengaluru',
          price: 25000000,
          bedrooms: 4,
          bathrooms: 4,
          propertyType: 'Villa',
        });

      expect(res.status).toBe(403);
    });

    it('allows an OWNER to add inventory properties (201)', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({
          title: 'Authorized Luxury Villa',
          address: '45 Palm Grove Road',
          city: 'Bengaluru',
          price: 25000000,
          bedrooms: 4,
          bathrooms: 4,
          propertyType: 'Villa',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Authorized Luxury Villa');
      expect(res.body.organizationId).toBe(orgA.id);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PII Masking in Diagnostics and Email Logs
  // ───────────────────────────────────────────────────────────────────────────
  describe('PII Masking', () => {
    it('correctly masks emails of varying lengths and shapes', () => {
      expect(maskEmail('advisor@brokerage.com')).toBe('a***r@brokerage.com');
      expect(maskEmail('john.doe@example.org')).toBe('j***e@example.org');
      expect(maskEmail('ab@domain.com')).toBe('a*@domain.com');
      expect(maskEmail('a@domain.com')).toBe('a*@domain.com');
      expect(maskEmail('not-an-email')).toBe('[redacted]');
      expect(maskEmail('')).toBe('[redacted]');
      expect(maskEmail(null as unknown as string)).toBe('[redacted]');
    });

    it('masks recipient email in audit log and response when sending test emails', async () => {
      const deal = await prisma.deal.create({
        data: {
          propertyAddress: '100 Residency Road, Bengaluru',
          organizationId: orgA.id,
        },
      });

      const recipientEmail = agentA1.user.email;

      const res = await request(app)
        .post(`/api/deals/${deal.id}/notifications/test`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .send({ to: recipientEmail });

      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(true);

      const expectedMasked = maskEmail(recipientEmail);
      expect(res.body.message).toContain(expectedMasked);
      expect(res.body.message).not.toContain(recipientEmail);

      // Verify audit log has masked email
      const audit = await prisma.auditLog.findFirst({
        where: {
          dealId: deal.id,
          action: 'EMAIL_SENT_TEST',
        },
      });
      expect(audit?.note).toContain(expectedMasked);
      expect(audit?.note).not.toContain(recipientEmail);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Public Auth Config Flag
  // ───────────────────────────────────────────────────────────────────────────
  describe('Public Auth Config', () => {
    it('returns demoLoginEnabled boolean flag without requiring authentication', async () => {
      const res = await request(app).get('/api/auth/config');
      expect(res.status).toBe(200);
      expect(typeof res.body.demoLoginEnabled).toBe('boolean');
    });
  });
});
