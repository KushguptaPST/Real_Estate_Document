// ─────────────────────────────────────────────────────────────────────────────
// Phase 2B — Buyer Qualification & Requirement Sync Security & Functional Suite
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
import {
  applyApprovedRequirementProposal,
  updateLeadStatus,
  getLeadDetails,
} from '../../src/services/lead.service.js';

const prisma = new PrismaClient();

describe('Phase 2B — Buyer Qualification & Requirement Sync Suite', () => {
  let orgA: string;
  let orgB: string;
  let userA: string;
  let leadA: string;
  let leadB: string;
  let propA: string;
  let propB: string;
  let threadA: string;

  beforeAll(async () => {
    // 1. Setup Org A
    const createdOrgA = await prisma.organization.create({ data: { name: 'P2B Test Org A' } });
    orgA = createdOrgA.id;

    const createdUserA = await prisma.user.create({
      data: {
        organizationId: orgA,
        email: `advisor.p2b.${Date.now()}@example.com`,
        name: 'Advisor P2B',
        role: 'AGENT',
        googleId: `google-p2b-${Date.now()}`,
      },
    });
    userA = createdUserA.id;

    // 2. Setup Foreign Org B
    const createdOrgB = await prisma.organization.create({ data: { name: 'P2B Foreign Org B' } });
    orgB = createdOrgB.id;

    // 3. Lead in Org A
    const createdLeadA = await prisma.lead.create({
      data: {
        organizationId: orgA,
        fullName: 'Buyer Lead A',
        email: `buyer.p2b.a.${Date.now()}@example.com`,
        status: 'NEW',
        priority: 'MEDIUM',
        assignedUserId: userA,
      },
    });
    leadA = createdLeadA.id;

    // 4. Lead in Org B
    const createdLeadB = await prisma.lead.create({
      data: {
        organizationId: orgB,
        fullName: 'Foreign Buyer B',
        email: `foreign.p2b.b.${Date.now()}@example.com`,
        status: 'NEW',
        priority: 'LOW',
      },
    });
    leadB = createdLeadB.id;

    // 5. Properties in Org A
    const createdPropA = await prisma.property.create({
      data: {
        organizationId: orgA,
        title: 'Modern Highrise Condo',
        address: '200 Downtown Way',
        city: 'Downtown',
        price: 700000,
        bedrooms: 2,
        bathrooms: 2,
        propertyType: 'CONDO',
        status: 'AVAILABLE',
      },
    });
    propA = createdPropA.id;

    // 6. Property in Org B
    const createdPropB = await prisma.property.create({
      data: {
        organizationId: orgB,
        title: 'Foreign Luxury Villa',
        address: '500 Palm Grove',
        city: 'Suburb',
        price: 900000,
        bedrooms: 4,
        bathrooms: 4,
        propertyType: 'SINGLE_FAMILY',
        status: 'AVAILABLE',
      },
    });
    propB = createdPropB.id;

    // 7. Conversation thread for Lead A
    const thread = await getOrCreateLeadThread(leadA, orgA, 'EMAIL');
    threadA = thread.id;
  });

  afterAll(async () => {
    // Teardown test entities safely
    await prisma.propertyMatch.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.leadRequirementProposal.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.leadRequirement.deleteMany({ where: { leadId: { in: [leadA, leadB] } } });
    await prisma.conversationMessage.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.conversationThread.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.lead.deleteMany({ where: { id: { in: [leadA, leadB] } } });
    await prisma.property.deleteMany({ where: { id: { in: [propA, propB] } } });
    await prisma.user.deleteMany({ where: { id: userA } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  // ── 1. Tool Declaration & Registration Integrity ───────────────────────────

  describe('Tool Registry Registration', () => {
    it('registers all Phase 2A and Phase 2B tools in the runtime tool declarations', () => {
      const names = AGENT_FUNCTION_DECLARATIONS.map((d) => d.name);
      expect(names).toContain('search_properties');
      expect(names).toContain('get_lead_context');
      expect(names).toContain('check_site_visit_availability');
      expect(names).toContain('propose_follow_up_task');
      expect(names).toContain('propose_buyer_requirements');
      expect(names).toContain('evaluate_buyer_qualification');
      expect(names).toContain('refresh_property_matches');
      expect(ALLOWED_TOOL_NAMES.has('propose_buyer_requirements')).toBe(true);
      expect(ALLOWED_TOOL_NAMES.has('evaluate_buyer_qualification')).toBe(true);
      expect(ALLOWED_TOOL_NAMES.has('refresh_property_matches')).toBe(true);
    });
  });

  // ── 2. Extraction & Proposal Workflow (propose_buyer_requirements) ─────────

  describe('propose_buyer_requirements tool', () => {
    const getContext = (): TrustedAgentContext => ({
      organizationId: orgA,
      leadId: leadA,
      userId: userA,
      threadId: threadA,
    });

    it('creates a requirement proposal without mutating authoritative LeadRequirement directly', async () => {
      const result = await executeAgentTool(
        'propose_buyer_requirements',
        {
          leadId: leadA,
          minBudget: 500000,
          maxBudget: 800000,
          preferredLocations: ['Downtown', 'Midtown'],
          propertyType: 'CONDO',
          minBedrooms: 2,
          maxBedrooms: 3,
          possessionTimeline: '60_DAYS',
          changeType: 'NEW_PREFERENCE',
          sourceEvidence: 'Looking for a 2-3 bed condo in Downtown under 800k within 2 months',
          reason: 'Initial explicit buyer requirements extracted from inquiry',
        },
        getContext(),
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.proposalId).toBeDefined();
      expect(data.status).toBe('PENDING');
      expect(data.requiresApproval).toBe(true);
      expect(data.persisted).toBe(true);
      expect(data.changeType).toBe('NEW_PREFERENCE');
      expect(data.proposedValues.maxBudget).toBe(800000);
      expect(data.proposedValues.preferredLocations).toEqual(['Downtown', 'Midtown']);

      // CRITICAL VERIFICATION: Authoritative LeadRequirement must NOT be created/overwritten yet
      const reqInDb = await prisma.leadRequirement.findUnique({ where: { leadId: leadA } });
      expect(reqInDb).toBeNull();

      // Proposal must exist in database with PENDING status
      const propInDb = await prisma.leadRequirementProposal.findUnique({ where: { id: data.proposalId } });
      expect(propInDb).not.toBeNull();
      expect(propInDb?.status).toBe('PENDING');
      expect(propInDb?.proposedMaxBudget).toBe(800000);
    });

    it('handles conversational corrections accurately showing previous vs proposed diff', async () => {
      // First, establish an initial confirmed requirement
      await prisma.leadRequirement.create({
        data: {
          leadId: leadA,
          minBudget: 500000,
          maxBudget: 800000,
          preferredLocations: ['Downtown'],
          propertyType: 'CONDO',
          minBedrooms: 2,
          maxBedrooms: 2,
        },
      });

      // Buyer later states correction: "Actually, my max budget is 700k, not 800k"
      const result = await executeAgentTool(
        'propose_buyer_requirements',
        {
          leadId: leadA,
          maxBudget: 700000,
          changeType: 'CORRECTION',
          sourceEvidence: 'Actually, my max budget is 700k, not 800k',
          reason: 'Buyer explicitly corrected their maximum budget ceiling',
        },
        getContext(),
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.changeType).toBe('CORRECTION');
      expect(data.previousValues.maxBudget).toBe(800000);
      expect(data.proposedValues.maxBudget).toBe(700000);

      // Confirmed requirement remains intact until advisor review
      const reqInDb = await prisma.leadRequirement.findUnique({ where: { leadId: leadA } });
      expect(reqInDb?.maxBudget).toBe(800000);
    });

    it('rejects malformed and unsupported requirement fields', async () => {
      // Negative budget
      const negResult = await executeAgentTool(
        'propose_buyer_requirements',
        {
          leadId: leadA,
          minBudget: -100,
          sourceEvidence: 'test',
          reason: 'test',
        },
        getContext(),
      );
      expect(negResult.status).toBe('ERROR');
      expect(negResult.error).toContain('Invalid propose_buyer_requirements arguments');

      // minBudget > maxBudget
      const rangeResult = await executeAgentTool(
        'propose_buyer_requirements',
        {
          leadId: leadA,
          minBudget: 900000,
          maxBudget: 500000,
          sourceEvidence: 'test',
          reason: 'test',
        },
        getContext(),
      );
      expect(rangeResult.status).toBe('ERROR');
      expect(rangeResult.error).toContain('minBudget cannot exceed maxBudget');

      // minBedrooms > maxBedrooms
      const bedResult = await executeAgentTool(
        'propose_buyer_requirements',
        {
          leadId: leadA,
          minBedrooms: 4,
          maxBedrooms: 2,
          sourceEvidence: 'test',
          reason: 'test',
        },
        getContext(),
      );
      expect(bedResult.status).toBe('ERROR');
      expect(bedResult.error).toContain('minBedrooms cannot exceed maxBedrooms');
    });

    it('strictly forbids cross-tenant and cross-lead access', async () => {
      // Attempting to propose requirements for Lead B while in Lead A context
      const crossLeadResult = await executeAgentTool(
        'propose_buyer_requirements',
        {
          leadId: leadB,
          maxBudget: 600000,
          sourceEvidence: 'test',
          reason: 'test',
        },
        getContext(),
      );
      expect(crossLeadResult.status).toBe('ERROR');
      expect(crossLeadResult.error).toContain('Access denied');
    });
  });

  // ── 3. Authorized Persistence Path (applyApprovedRequirementProposal) ─────

  describe('Applying Approved Proposals', () => {
    it('applies proposal to authoritative LeadRequirement via authorized service with audit trail', async () => {
      // 1. Create a proposal for Lead A
      const proposal = await prisma.leadRequirementProposal.create({
        data: {
          leadId: leadA,
          organizationId: orgA,
          proposedMinBudget: 450000,
          proposedMaxBudget: 750000,
          proposedLocations: ['Downtown', 'West End'],
          proposedPropertyType: 'CONDO',
          proposedMinBedrooms: 2,
          proposedMaxBedrooms: 3,
          proposedTimeline: 'IMMEDIATE',
          status: 'PENDING',
        },
      });

      // 2. Human advisor approves proposal via authorized helper
      const applied = await applyApprovedRequirementProposal({
        leadId: leadA,
        proposalId: proposal.id,
        organizationId: orgA,
        reviewerEmail: 'advisor@example.com',
      });

      expect(applied.proposal.status).toBe('APPROVED');
      expect(applied.requirements.maxBudget).toBe(750000);
      expect(applied.requirements.preferredLocations).toEqual(['Downtown', 'West End']);
      expect(applied.requirements.possessionTimeline).toBe('IMMEDIATE');

      // 3. Lead priority recalculated deterministically (IMMEDIATE timeline -> URGENT)
      const lead = await prisma.lead.findUnique({ where: { id: leadA } });
      expect(lead?.priority).toBe('URGENT');

      // 4. Audit Log created
      const audit = await prisma.auditLog.findFirst({
        where: {
          organizationId: orgA,
          entityType: 'LeadRequirement',
          action: 'LEAD_UPDATED',
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(audit?.actor).toBe('advisor@example.com');
    });

    it('rejects cross-tenant proposal approval attempts', async () => {
      // Create a proposal in Org B
      const foreignProposal = await prisma.leadRequirementProposal.create({
        data: {
          leadId: leadB,
          organizationId: orgB,
          proposedMaxBudget: 900000,
          status: 'PENDING',
        },
      });

      // Attempt to approve Org B proposal using Org A tenant context
      await expect(
        applyApprovedRequirementProposal({
          leadId: leadB,
          proposalId: foreignProposal.id,
          organizationId: orgA,
          reviewerEmail: 'hacker@example.com',
        }),
      ).rejects.toThrow();
    });
  });

  // ── 4. Deterministic Buyer Qualification (evaluate_buyer_qualification) ───

  describe('evaluate_buyer_qualification tool', () => {
    const getContext = (): TrustedAgentContext => ({
      organizationId: orgA,
      leadId: leadA,
      userId: userA,
      threadId: threadA,
    });

    it('evaluates qualification with missing required criteria and recommends clarifying question', async () => {
      // Temporarily clear requirements to test missing criteria
      await prisma.leadRequirement.deleteMany({ where: { leadId: leadA } });
      await prisma.lead.update({ where: { id: leadA }, data: { status: 'NEW' } });

      const result = await executeAgentTool(
        'evaluate_buyer_qualification',
        {
          leadId: leadA,
          hasExpressedIntent: true,
          notes: 'Customer inquired about 2-bedroom listings',
        },
        getContext(),
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.isQualified).toBe(false);
      expect(data.missingFields).toContain('budget_range');
      expect(data.missingFields).toContain('preferred_locations');
      expect(data.recommendedClarificationQuestion).toBeTruthy();
      expect(data.currentStatus).toBe('CONTACTED'); // Transitions NEW -> CONTACTED
      expect(data.statusTransitioned).toBe(true);

      const leadInDb = await prisma.lead.findUnique({ where: { id: leadA } });
      expect(leadInDb?.status).toBe('CONTACTED');
    });

    it('qualifies lead deterministically when all criteria are satisfied and transitions status to QUALIFIED', async () => {
      // Provide complete confirmed requirements
      await prisma.leadRequirement.upsert({
        where: { leadId: leadA },
        create: {
          leadId: leadA,
          minBudget: 500000,
          maxBudget: 750000,
          preferredLocations: ['Downtown'],
          propertyType: 'CONDO',
          minBedrooms: 2,
        },
        update: {
          minBudget: 500000,
          maxBudget: 750000,
          preferredLocations: ['Downtown'],
          propertyType: 'CONDO',
          minBedrooms: 2,
        },
      });

      const result = await executeAgentTool(
        'evaluate_buyer_qualification',
        {
          leadId: leadA,
          hasExpressedIntent: true,
        },
        getContext(),
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.isQualified).toBe(true);
      expect(data.missingFields).toHaveLength(0);
      expect(data.currentStatus).toBe('QUALIFIED');
      expect(data.statusTransitioned).toBe(true);

      const leadInDb = await prisma.lead.findUnique({ where: { id: leadA } });
      expect(leadInDb?.status).toBe('QUALIFIED');
    });

    it('does not downgrade or overwrite lead status if already in PROPOSAL, WON, or LOST', async () => {
      // Set status to PROPOSAL
      await prisma.lead.update({ where: { id: leadA }, data: { status: 'PROPOSAL' } });

      const result = await executeAgentTool(
        'evaluate_buyer_qualification',
        {
          leadId: leadA,
          hasExpressedIntent: true,
        },
        getContext(),
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.isQualified).toBe(true);
      expect(data.currentStatus).toBe('PROPOSAL'); // Preserved!
      expect(data.statusTransitioned).toBe(false);

      const leadInDb = await prisma.lead.findUnique({ where: { id: leadA } });
      expect(leadInDb?.status).toBe('PROPOSAL');
    });

    it('rejects cross-lead evaluation', async () => {
      const result = await executeAgentTool(
        'evaluate_buyer_qualification',
        { leadId: leadB },
        getContext(),
      );
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Access denied');
    });
  });

  // ── 5. Property Matching Refresh (refresh_property_matches) ───────────────

  describe('refresh_property_matches tool', () => {
    const getContext = (): TrustedAgentContext => ({
      organizationId: orgA,
      leadId: leadA,
      userId: userA,
      threadId: threadA,
    });

    it('refreshes matches against verified inventory using confirmed requirements', async () => {
      // Ensure Lead A has confirmed requirements (Condo in Downtown under 750k)
      await prisma.leadRequirement.upsert({
        where: { leadId: leadA },
        create: {
          leadId: leadA,
          maxBudget: 750000,
          preferredLocations: ['Downtown'],
          propertyType: 'CONDO',
          minBedrooms: 2,
        },
        update: {
          maxBudget: 750000,
          preferredLocations: ['Downtown'],
          propertyType: 'CONDO',
          minBedrooms: 2,
        },
      });

      const result = await executeAgentTool('refresh_property_matches', { leadId: leadA }, getContext());

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.refreshed).toBe(true);
      expect(data.matches.length).toBeGreaterThanOrEqual(1);

      const topMatch = data.matches[0];
      expect(topMatch.propertyId).toBe(propA);
      expect(topMatch.title).toBe('Modern Highrise Condo');
      expect(topMatch.isConfirmedMatch).toBe(true);
      expect(topMatch.matchScore).toBeGreaterThanOrEqual(0.5);

      // Verify tenant isolation: Prop B (Org B) MUST NOT appear in matches
      const foreignMatches = data.matches.filter((m: any) => m.propertyId === propB);
      expect(foreignMatches).toHaveLength(0);
    });

    it('returns empty matches with clear message if lead has no confirmed requirements', async () => {
      // Delete requirements
      await prisma.leadRequirement.deleteMany({ where: { leadId: leadA } });

      const result = await executeAgentTool('refresh_property_matches', { leadId: leadA }, getContext());

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.refreshed).toBe(false);
      expect(data.totalMatches).toBe(0);
      expect(data.message).toContain('lead does not have confirmed requirements yet');
    });

    it('strictly isolates cross-lead match refresh', async () => {
      const result = await executeAgentTool('refresh_property_matches', { leadId: leadB }, getContext());
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Access denied');
    });
  });

  // ── 6. Agent Loop Integration & Human Oversight ────────────────────────────

  describe('Agent Loop Integration with Qualification Metadata', () => {
    it('captures requirement proposals and qualification metadata in runSalesAgentLoop', async () => {
      const mockAiClient = {
        models: {
          generateContent: jest
            .fn<any>()
            .mockResolvedValueOnce({
              functionCalls: [
                {
                  name: 'propose_buyer_requirements',
                  args: {
                    leadId: leadA,
                    minBudget: 500000,
                    maxBudget: 700000,
                    preferredLocations: ['Downtown'],
                    propertyType: 'CONDO',
                    minBedrooms: 2,
                    changeType: 'NEW_PREFERENCE',
                    sourceEvidence: 'I want a 2-bedroom condo in Downtown under 700k',
                    reason: 'Buyer stated specific target criteria',
                  },
                },
              ],
            })
            .mockResolvedValueOnce({
              text: 'I have recorded your preference for a 2-bedroom Downtown condo under $700k. I am reviewing the best options for you.',
            }),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'I want a 2-bedroom condo in Downtown under 700k',
        aiClient: mockAiClient,
      });

      expect(result.executedTools.some((t) => t.toolName === 'propose_buyer_requirements')).toBe(true);
      expect(result.requirementProposal).toBeDefined();
      expect((result.requirementProposal as any).proposedValues.maxBudget).toBe(700000);
      expect(result.response).toContain('Downtown condo under $700k');
    });

    it('preserves PENDING_APPROVAL status for AI messages containing requirement metadata', async () => {
      const result = await handleCustomerMessage({
        leadId: leadA,
        organizationId: orgA,
        content: 'What do you have available in Downtown for 2 bedrooms?',
      });

      expect(result.message.senderType).toBe('CUSTOMER');
      expect(result.aiReply).not.toBeNull();
      expect(result.aiReply?.approvalStatus).toBe('PENDING_APPROVAL');
      expect(result.aiReply?.suggestedAction).toBeDefined();
    });

    it('suppresses agent runtime immediately when human takeover is active', async () => {
      await toggleHumanTakeover(threadA, true, orgA, 'advisor@example.com');

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Hello, are you there?',
      });

      expect(result.suppressed).toBe(true);
      expect(result.suppressedReason).toContain('Human takeover is active');
      expect(result.executedTools).toHaveLength(0);

      // Revert takeover for subsequent tests
      await toggleHumanTakeover(threadA, false, orgA, 'advisor@example.com');
    });
  });
});
