// ─────────────────────────────────────────────────────────────────────────────
// Phase 2C — Site Visit Coordination & Booking Security & Concurrency Suite
// ─────────────────────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  AGENT_FUNCTION_DECLARATIONS,
  executeAgentTool,
  ALLOWED_TOOL_NAMES,
  type TrustedAgentContext,
} from '../../src/services/agent/agentTools.js';
import { runSalesAgentLoop, MAX_AGENT_ROUNDS } from '../../src/services/agent/agentRuntime.js';
import {
  handleCustomerMessage,
  getOrCreateLeadThread,
  toggleHumanTakeover,
} from '../../src/services/conversation.service.js';

const prisma = new PrismaClient();

describe('Phase 2C — Site Visit Coordination & Booking Suite', () => {
  let orgA: string;
  let orgB: string;
  let userA: string;
  let leadA: string;
  let leadB: string;
  let propA: string;
  let propB: string;
  let threadA: string;

  beforeAll(async () => {
    // 1. Setup Org A & Advisor A
    const createdOrgA = await prisma.organization.create({ data: { name: 'P2C Test Org A' } });
    orgA = createdOrgA.id;

    const createdUserA = await prisma.user.create({
      data: {
        organizationId: orgA,
        email: `advisor.p2c.${Date.now()}@example.com`,
        name: 'Advisor P2C',
        role: 'AGENT',
        googleId: `google-p2c-${Date.now()}`,
      },
    });
    userA = createdUserA.id;

    // 2. Setup Foreign Org B
    const createdOrgB = await prisma.organization.create({ data: { name: 'P2C Foreign Org B' } });
    orgB = createdOrgB.id;

    // 3. Lead in Org A
    const createdLeadA = await prisma.lead.create({
      data: {
        organizationId: orgA,
        fullName: 'Tour Buyer A',
        email: `buyer.p2c.a.${Date.now()}@example.com`,
        status: 'QUALIFIED',
        priority: 'HIGH',
        assignedUserId: userA,
      },
    });
    leadA = createdLeadA.id;

    // 4. Lead in Org B
    const createdLeadB = await prisma.lead.create({
      data: {
        organizationId: orgB,
        fullName: 'Foreign Buyer B',
        email: `foreign.p2c.b.${Date.now()}@example.com`,
        status: 'NEW',
        priority: 'LOW',
      },
    });
    leadB = createdLeadB.id;

    // 5. Properties in Org A
    const createdPropA = await prisma.property.create({
      data: {
        organizationId: orgA,
        title: 'Waterfront Penthouse Org A',
        address: '500 Harbor View Blvd',
        city: 'Bay City',
        price: 1100000,
        bedrooms: 3,
        bathrooms: 3,
        propertyType: 'CONDO',
        status: 'AVAILABLE',
      },
    });
    propA = createdPropA.id;

    // 6. Property in Org B
    const createdPropB = await prisma.property.create({
      data: {
        organizationId: orgB,
        title: 'Foreign Mansion Org B',
        address: '999 Palm Way',
        city: 'Desert Springs',
        price: 2400000,
        bedrooms: 5,
        bathrooms: 5,
        propertyType: 'SINGLE_FAMILY',
        status: 'AVAILABLE',
      },
    });
    propB = createdPropB.id;

    // 7. Conversation thread for Lead A
    const thread = await getOrCreateLeadThread(leadA, orgA, 'EMAIL');
    threadA = thread.id;

    // Seed authentic customer messages for site visit consent in threadA
    await prisma.conversationMessage.createMany({
      data: [
        {
          threadId: threadA,
          organizationId: orgA,
          senderType: 'CUSTOMER',
          content: 'Yes, Tuesday at 11am works perfectly for me! Let us visit Waterfront Penthouse.',
        },
        {
          threadId: threadA,
          organizationId: orgA,
          senderType: 'CUSTOMER',
          content: 'I want to see it at 11:15 on Tuesday please for the Waterfront Penthouse tour.',
        },
        {
          threadId: threadA,
          organizationId: orgA,
          senderType: 'CUSTOMER',
          content: 'Confirmed Wednesday at 4pm for the Waterfront Penthouse visit.',
        },
      ],
    });
  });

  afterAll(async () => {
    // Teardown test entities safely
    await prisma.leadTask.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.siteVisit.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.conversationMessage.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.conversationThread.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.lead.deleteMany({ where: { id: { in: [leadA, leadB] } } });
    await prisma.property.deleteMany({ where: { id: { in: [propA, propB] } } });
    await prisma.user.deleteMany({ where: { id: userA } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  const getContext = (): TrustedAgentContext => ({
    organizationId: orgA,
    leadId: leadA,
    userId: userA,
    callerRole: 'AGENT',
    callerEmail: 'advisor.p2c@example.com',
    threadId: threadA,
  });

  // ── 1. Tool Declaration Integrity ──────────────────────────────────────────

  describe('Tool Registration & Declarations', () => {
    it('registers propose_site_visit and book_site_visit in AGENT_FUNCTION_DECLARATIONS', () => {
      const names = AGENT_FUNCTION_DECLARATIONS.map((d) => d.name);
      expect(names).toContain('check_site_visit_availability');
      expect(names).toContain('propose_site_visit');
      expect(names).toContain('book_site_visit');
      expect(ALLOWED_TOOL_NAMES.has('propose_site_visit')).toBe(true);
      expect(ALLOWED_TOOL_NAMES.has('book_site_visit')).toBe(true);
    });
  });

  // ── 2. Real Scheduling Service Availability & Date Guards ──────────────────

  describe('check_site_visit_availability enhancements', () => {
    it('rejects past dates with strict error', async () => {
      const result = await executeAgentTool(
        'check_site_visit_availability',
        { date: '2020-01-01', advisorId: userA },
        getContext(),
      );
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Cannot check availability for past dates');
    });

    it('rejects foreign-tenant property when checking availability', async () => {
      const result = await executeAgentTool(
        'check_site_visit_availability',
        { date: '2026-10-25', propertyId: propB },
        getContext(),
      );
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Property not found in this organization');
    });

    it('returns actual available slots from real scheduling service for valid property and date', async () => {
      const result = await executeAgentTool(
        'check_site_visit_availability',
        { date: '2026-10-25', propertyId: propA },
        getContext(),
      );
      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.date).toBe('2026-10-25');
      expect(Array.isArray(data.availableSlots)).toBe(true);
      expect(data.availableSlots.length).toBeGreaterThan(0);
    });
  });

  // ── 3. Propose Site Visit Workflow (propose_site_visit) ────────────────────

  describe('propose_site_visit tool', () => {
    it('proposes a walkthrough tour without reserving slots or creating site_visits in DB', async () => {
      const countBefore = await prisma.siteVisit.count({ where: { organizationId: orgA } });

      const result = await executeAgentTool(
        'propose_site_visit',
        {
          leadId: leadA,
          propertyId: propA,
          date: '2026-10-26',
          preferredTime: '14:00',
          durationMinutes: 45,
          notes: 'Customer interested in balcony view',
        },
        getContext(),
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.proposed).toBe(true);
      expect(data.slotAvailable).toBe(true);
      expect(data.persisted).toBe(false);
      expect(data.requiresBuyerConfirmation).toBe(true);
      expect(data.property.id).toBe(propA);
      expect(data.advisor.id).toBe(userA);
      expect(data.slot.date).toBe('2026-10-26');
      expect(data.slot.time).toBe('14:00');

      // CRITICAL GUARANTEE: Zero site_visits rows created by proposal
      const countAfter = await prisma.siteVisit.count({ where: { organizationId: orgA } });
      expect(countAfter).toBe(countBefore);
    });

    it('rejects proposing a visit for dates in the past', async () => {
      const result = await executeAgentTool(
        'propose_site_visit',
        {
          leadId: leadA,
          propertyId: propA,
          date: '2021-05-10',
          preferredTime: '10:00',
        },
        getContext(),
      );
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('past');
    });

    it('rejects proposing a visit for a foreign tenant property', async () => {
      const result = await executeAgentTool(
        'propose_site_visit',
        {
          leadId: leadA,
          propertyId: propB,
          date: '2026-10-26',
          preferredTime: '10:00',
        },
        getContext(),
      );
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Property not found');
    });

    it('rejects cross-lead proposal', async () => {
      const result = await executeAgentTool(
        'propose_site_visit',
        {
          leadId: leadB,
          propertyId: propA,
          date: '2026-10-26',
          preferredTime: '10:00',
        },
        getContext(),
      );
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Access denied');
    });
  });

  // ── 4. Safe Site Visit Booking (book_site_visit) ───────────────────────────

  describe('book_site_visit tool', () => {
    it('rejects booking when explicit buyer consent is missing or too short', async () => {
      const result = await executeAgentTool(
        'book_site_visit',
        {
          leadId: leadA,
          propertyId: propA,
          date: '2026-10-27',
          time: '11:00',
          buyerConsentEvidence: 'ok', // too short (< 5 chars)
        },
        getContext(),
      );
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('consent evidence');
    });

    it('books an authorized site visit safely with linked task and audit log when consent is given', async () => {
      const result = await executeAgentTool(
        'book_site_visit',
        {
          leadId: leadA,
          propertyId: propA,
          date: '2026-10-27',
          time: '11:00',
          durationMinutes: 45,
          buyerConsentEvidence: 'Yes, Tuesday at 11am works perfectly for me!',
          notes: 'Customer requested viewing master bedroom and terrace',
        },
        getContext(),
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.booked).toBe(true);
      expect(data.visitId).toBeDefined();
      expect(data.status).toBe('SCHEDULED');
      expect(data.property.id).toBe(propA);
      expect(data.advisor.id).toBe(userA);
      expect(data.leadTaskId).toBeDefined();

      // Verify row persisted in database
      const visitInDb = await prisma.siteVisit.findUnique({
        where: { id: data.visitId },
        include: { leadTask: true },
      });
      expect(visitInDb).not.toBeNull();
      expect(visitInDb?.status).toBe('SCHEDULED');
      expect(visitInDb?.leadTask?.taskType).toBe('SITE_VISIT');
      expect(visitInDb?.leadTask?.priority).toBe('HIGH');

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA,
          entityId: data.visitId,
          action: 'SITE_VISIT_SCHEDULED',
        },
      });
      expect(audit).not.toBeNull();
    });

    it('prevents double-booking overlapping slots under concurrent requests', async () => {
      // First booking is at 2026-10-27T11:00 to 11:45.
      // Attempting to book an overlapping visit at 11:15 to 12:00 on the same date for the same advisor:
      const conflictResult = await executeAgentTool(
        'book_site_visit',
        {
          leadId: leadA,
          propertyId: propA,
          date: '2026-10-27',
          time: '11:15',
          durationMinutes: 45,
          buyerConsentEvidence: 'I want to see it at 11:15 on Tuesday please',
        },
        getContext(),
      );

      expect(conflictResult.status).toBe('ERROR');
      expect(conflictResult.error).toContain('conflicting site visit');
      expect((conflictResult.data as any)?.conflict).toBe(true);
    });

    it('rejects booking for foreign tenant property', async () => {
      const result = await executeAgentTool(
        'book_site_visit',
        {
          leadId: leadA,
          propertyId: propB, // Belongs to Org B
          date: '2026-10-28',
          time: '15:00',
          buyerConsentEvidence: 'I agree to the appointment on Wednesday',
        },
        getContext(),
      );
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Property not found');
    });

    it('rejects booking by unauthorized agent who does not own the lead', async () => {
      // Create another agent in Org A who does not own Lead A
      const otherAgent = await prisma.user.create({
        data: {
          organizationId: orgA,
          email: `other.agent.${Date.now()}@example.com`,
          name: 'Other Agent',
          role: 'AGENT',
          googleId: `google-other-${Date.now()}`,
        },
      });

      const unauthorizedContext: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: otherAgent.id,
        callerRole: 'AGENT',
        callerEmail: otherAgent.email,
        threadId: threadA,
      };

      const result = await executeAgentTool(
        'book_site_visit',
        {
          leadId: leadA,
          propertyId: propA,
          date: '2026-10-28',
          time: '16:00',
          buyerConsentEvidence: 'Confirmed Wednesday at 4pm',
        },
        unauthorizedContext,
      );

      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Agents can only schedule site visits for their assigned leads');

      await prisma.user.delete({ where: { id: otherAgent.id } });
    });
  });

  // ── 5. Agent Runtime Integration & Human Takeover ──────────────────────────

  describe('Agent Runtime Integration with Site Visit Metadata', () => {
    it('captures siteVisitProposal in runSalesAgentLoop when agent proposes a slot', async () => {
      const mockAiClient = {
        models: {
          generateContent: jest
            .fn<any>()
            .mockResolvedValueOnce({
              functionCalls: [
                {
                  name: 'propose_site_visit',
                  args: {
                    leadId: leadA,
                    propertyId: propA,
                    date: '2026-10-29',
                    preferredTime: '10:00',
                    durationMinutes: 45,
                  },
                },
              ],
            })
            .mockResolvedValueOnce({
              text: 'I have proposed a private walkthrough for the Waterfront Penthouse on Thursday, Oct 29 at 10:00 AM. Does that time work for you?',
            }),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Can I see the Waterfront Penthouse this Thursday morning?',
        aiClient: mockAiClient,
      });

      expect(result.executedTools.some((t) => t.toolName === 'propose_site_visit')).toBe(true);
      expect(result.siteVisitProposal).toBeDefined();
      expect((result.siteVisitProposal as any).proposed).toBe(true);
      expect((result.siteVisitProposal as any).requiresBuyerConfirmation).toBe(true);
      expect(result.response).toContain('Oct 29 at 10:00 AM');
    });

    it('preserves PENDING_APPROVAL status for AI customer messages containing site visit metadata', async () => {
      const result = await handleCustomerMessage({
        leadId: leadA,
        organizationId: orgA,
        content: 'When can I visit the property?',
      });

      expect(result.message.senderType).toBe('CUSTOMER');
      expect(result.aiReply).not.toBeNull();
      expect(result.aiReply?.approvalStatus).toBe('PENDING_APPROVAL');
      expect(result.aiReply?.suggestedAction).toBeDefined();
    });

    it('suppresses agent runtime immediately when human takeover is active', async () => {
      await toggleHumanTakeover(threadA, true, orgA, 'advisor.p2c@example.com');

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Book the tour please',
      });

      expect(result.suppressed).toBe(true);
      expect(result.suppressedReason).toContain('Human takeover is active');
      expect(result.executedTools).toHaveLength(0);

      // Revert takeover
      await toggleHumanTakeover(threadA, false, orgA, 'advisor.p2c@example.com');
    });
  });
});
