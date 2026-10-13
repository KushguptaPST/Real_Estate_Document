// ─────────────────────────────────────────────────────────────────────────────
// Phase 2D — Intelligent Human Handoff, Escalation & Advisor Copilot Security Suite
// ─────────────────────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  AGENT_FUNCTION_DECLARATIONS,
  executeAgentTool,
  ALLOWED_TOOL_NAMES,
  type TrustedAgentContext,
} from '../../src/services/agent/agentTools.js';
import {
  runSalesAgentLoop,
  isExplicitHumanRequest,
  MAX_AGENT_ROUNDS,
} from '../../src/services/agent/agentRuntime.js';
import {
  handleCustomerMessage,
  getOrCreateLeadThread,
  toggleHumanTakeover,
} from '../../src/services/conversation.service.js';

const prisma = new PrismaClient();

describe('Phase 2D — Intelligent Human Handoff & Escalation Suite', () => {
  let orgA: string;
  let orgB: string;
  let userA: string;
  let leadA: string;
  let leadB: string;
  let propA: string;
  let threadA: string;

  beforeAll(async () => {
    // 1. Setup Org A & Advisor A
    const createdOrgA = await prisma.organization.create({ data: { name: 'P2D Test Org A' } });
    orgA = createdOrgA.id;

    const createdUserA = await prisma.user.create({
      data: {
        organizationId: orgA,
        email: `advisor.p2d.${Date.now()}@example.com`,
        name: 'Advisor P2D',
        role: 'AGENT',
        googleId: `google-p2d-${Date.now()}`,
      },
    });
    userA = createdUserA.id;

    // 2. Setup Foreign Org B
    const createdOrgB = await prisma.organization.create({ data: { name: 'P2D Foreign Org B' } });
    orgB = createdOrgB.id;

    // 3. Setup Lead in Org A with confirmed requirements
    const createdLeadA = await prisma.lead.create({
      data: {
        organizationId: orgA,
        fullName: 'Escalation Buyer A',
        email: `buyer.p2d.a.${Date.now()}@example.com`,
        status: 'QUALIFIED',
        priority: 'HIGH',
        assignedUserId: userA,
      },
    });
    leadA = createdLeadA.id;

    await prisma.leadRequirement.create({
      data: {
        leadId: leadA,
        minBudget: 500000,
        maxBudget: 750000,
        preferredLocations: ['Downtown', 'West End'],
        minBedrooms: 2,
        maxBedrooms: 3,
        propertyType: 'Condo',
        possessionTimeline: '3 months',
      },
    });

    // 4. Setup Lead in Foreign Org B
    const createdLeadB = await prisma.lead.create({
      data: {
        organizationId: orgB,
        fullName: 'Foreign Buyer B',
        email: `foreign.p2d.b.${Date.now()}@example.com`,
        status: 'NEW',
        priority: 'LOW',
      },
    });
    leadB = createdLeadB.id;

    // 5. Setup Property in Org A
    const createdPropA = await prisma.property.create({
      data: {
        organizationId: orgA,
        title: 'Emerald Luxury Suite',
        address: '100 Ocean Blvd',
        city: 'Downtown',
        price: 650000,
        bedrooms: 2,
        bathrooms: 2,
        propertyType: 'Condo',
        status: 'AVAILABLE',
      },
    });
    propA = createdPropA.id;

    // 6. Setup Confirmed Site Visit in Org A
    const visitDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const endDate = new Date(visitDate.getTime() + 45 * 60 * 1000);
    await prisma.siteVisit.create({
      data: {
        organizationId: orgA,
        leadId: leadA,
        propertyId: propA,
        assignedUserId: userA,
        createdById: userA,
        startAt: visitDate,
        endAt: endDate,
        status: 'SCHEDULED',
      },
    });

    // 7. Setup Thread in Org A
    const thread = await getOrCreateLeadThread(leadA, orgA);
    threadA = thread.id;
  });

  afterAll(async () => {
    // Teardown test records
    await prisma.leadTask.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.siteVisit.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.propertyMatch.deleteMany({ where: { leadId: { in: [leadA, leadB] } } });
    await prisma.leadRequirement.deleteMany({ where: { leadId: { in: [leadA, leadB] } } });
    await prisma.conversationMessage.deleteMany({ where: { threadId: threadA } });
    await prisma.conversationThread.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.lead.deleteMany({ where: { id: { in: [leadA, leadB] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  });

  describe('1. Tool Registry Verification', () => {
    it('registers escalate_to_human cleanly alongside existing tools (total 10 tools)', () => {
      expect(ALLOWED_TOOL_NAMES.has('escalate_to_human')).toBe(true);
      expect(ALLOWED_TOOL_NAMES.size).toBeGreaterThanOrEqual(10);

      const decl = AGENT_FUNCTION_DECLARATIONS.find((d) => d.name === 'escalate_to_human');
      expect(decl).toBeDefined();
      expect(decl?.parameters.required).toContain('leadId');
      expect(decl?.parameters.required).toContain('reason');
      expect(decl?.parameters.required).toContain('explanation');
      expect(decl?.parameters.required).toContain('recommendedAdvisorAction');
    });
  });

  describe('2. Explicit Human Request Fast-Path', () => {
    it('detects explicit human requests deterministically without false positives', () => {
      // True positives
      expect(isExplicitHumanRequest('I want to speak with a human advisor')).toBe(true);
      expect(isExplicitHumanRequest('Can I talk to a real person please?')).toBe(true);
      expect(isExplicitHumanRequest('Please connect me with an advisor')).toBe(true);
      expect(isExplicitHumanRequest('Transfer me to your manager')).toBe(true);
      expect(isExplicitHumanRequest('Human please, stop bot')).toBe(true);

      // False positives: routine questions or property search
      expect(isExplicitHumanRequest('Show me 2 bedroom apartments in Downtown')).toBe(false);
      expect(isExplicitHumanRequest('Is the price negotiable?')).toBe(false);
      expect(isExplicitHumanRequest('Can we do a walkthrough on Friday?')).toBe(false);
      expect(isExplicitHumanRequest('My budget is around 600k')).toBe(false);
    });

    it('fast-paths explicit human request without unnecessary Gemini calls and engages takeover', async () => {
      // Reset thread takeover state
      await prisma.conversationThread.update({
        where: { id: threadA },
        data: { isHumanTakeover: false, state: 'AUTOPILOT' },
      });

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'I need to speak to a human advisor right away.',
      });

      expect(result.executedTools.length).toBe(1);
      expect(result.executedTools[0].toolName).toBe('escalate_to_human');
      expect(result.executedTools[0].status).toBe('SUCCESS');
      expect(result.reasoning).toContain('Fast-path escalation');
      expect(result.response).toContain('alerted our advisor team');
      expect((result.escalation as any)?.escalated).toBe(true);
      expect((result.escalation as any)?.reason).toBe('BUYER_REQUESTED_HUMAN');

      // Verify thread state transitioned to HUMAN_TAKEOVER
      const updatedThread = await prisma.conversationThread.findUnique({ where: { id: threadA } });
      expect(updatedThread?.isHumanTakeover).toBe(true);
      expect(updatedThread?.state).toBe('HUMAN_TAKEOVER');
    });
  });

  describe('3. escalate_to_human Server-Side Validation & Boundaries', () => {
    const trustedCtx: TrustedAgentContext = {
      organizationId: '',
      leadId: '',
      threadId: '',
    };

    beforeEach(() => {
      trustedCtx.organizationId = orgA;
      trustedCtx.leadId = leadA;
      trustedCtx.threadId = threadA;
    });

    it('rejects cross-lead escalation where leadId does not match thread context', async () => {
      const res = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadB, // Mismatched lead
          reason: 'BUYER_REQUESTED_HUMAN',
          explanation: 'Buyer wants an agent',
          urgency: 'HIGH',
          recommendedAdvisorAction: 'Call buyer',
        },
        trustedCtx,
      );

      expect(res.status).toBe('ERROR');
      expect(res.error).toContain('Cross-lead escalation rejected');
    });

    it('rejects foreign-tenant leads', async () => {
      const foreignCtx: TrustedAgentContext = {
        organizationId: orgB,
        leadId: leadA, // Lead A belongs to Org A, not Org B
        threadId: threadA,
      };

      const res = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadA,
          reason: 'LOW_CONFIDENCE',
          explanation: 'Cannot verify information',
          urgency: 'MEDIUM',
          recommendedAdvisorAction: 'Verify lead status',
        },
        foreignCtx,
      );

      expect(res.status).toBe('ERROR');
      expect(res.error).toContain('Lead');
      expect(res.error).toContain('not found in organization');
    });

    it('rejects invalid or unapproved escalation reasons', async () => {
      const res = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadA,
          reason: 'UNAPPROVED_RANDOM_REASON',
          explanation: 'Test explanation',
          urgency: 'HIGH',
          recommendedAdvisorAction: 'Do something',
        },
        trustedCtx,
      );

      expect(res.status).toBe('ERROR');
      expect(res.error).toContain('Invalid escalate_to_human arguments');
    });

    it('rejects too-short explanation or missing recommended action', async () => {
      const res = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadA,
          reason: 'BUYER_COMPLAINT',
          explanation: 'Bad', // Less than 5 chars
          urgency: 'URGENT',
          recommendedAdvisorAction: 'Call', // Less than 5 chars
        },
        trustedCtx,
      );

      expect(res.status).toBe('ERROR');
      expect(res.error).toContain('Invalid escalate_to_human arguments');
    });
  });

  describe('4. Evidence-Grounded Advisor Handoff Brief', () => {
    it('constructs brief strictly distinguishing confirmed facts from proposals', async () => {
      const trustedCtx: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        threadId: threadA,
      };

      const res = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadA,
          reason: 'COMPLEX_NEGOTIATION',
          explanation: 'Buyer is requesting a 15% discount on the Emerald Suite purchase price.',
          urgency: 'HIGH',
          recommendedAdvisorAction: 'Evaluate seller flexibility and negotiate directly.',
        },
        trustedCtx,
      );

      expect(res.status).toBe('SUCCESS');
      const data = res.data as any;
      expect(data.escalated).toBe(true);
      expect(data.brief).toBeDefined();

      const brief = data.brief;
      // Confirmed facts from DB
      expect(brief.buyerName).toBe('Escalation Buyer A');
      expect(brief.confirmedRequirements).toBeDefined();
      expect(brief.confirmedRequirements.minBudget).toBe(500000);
      expect(brief.confirmedRequirements.maxBudget).toBe(750000);
      expect(brief.confirmedRequirements.preferredLocations).toContain('Downtown');

      // Confirmed site visit
      expect(brief.confirmedSiteVisits.length).toBeGreaterThanOrEqual(1);
      expect(brief.confirmedSiteVisits[0].propertyTitle).toBe('Emerald Luxury Suite');
      expect(brief.confirmedSiteVisits[0].status).toBe('SCHEDULED');

      // Distinguished pending proposals
      expect(brief.pendingRequirementProposal).toBeNull();
      expect(brief.pendingSiteVisitProposal).toBeNull();

      // Triggering context
      expect(brief.reason).toBe('COMPLEX_NEGOTIATION');
      expect(brief.urgency).toBe('HIGH');
      expect(brief.recommendedAdvisorAction).toBe(
        'Evaluate seller flexibility and negotiate directly.',
      );
    });
  });

  describe('5. Task Creation & Idempotency Safeguards', () => {
    it('creates an open LeadTask for the assigned advisor matching urgency', async () => {
      const trustedCtx: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        threadId: threadA,
      };

      const res = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadA,
          reason: 'LEGAL_OR_FINANCIAL_SENSITIVITY',
          explanation: 'Buyer is asking about foreign buyer stamp duty and mortgage escrow terms.',
          urgency: 'HIGH',
          recommendedAdvisorAction: 'Provide standard legal disclaimer and connect with legal counsel.',
        },
        trustedCtx,
      );

      expect(res.status).toBe('SUCCESS');
      const taskId = (res.data as any).taskId;
      expect(taskId).toBeDefined();

      const task = await prisma.leadTask.findUnique({ where: { id: taskId } });
      expect(task).toBeDefined();
      expect(task?.assignedUserId).toBe(userA);
      expect(task?.priority).toBe('HIGH');
      expect(task?.status).toBe('OPEN');
      expect(task?.title).toContain('Escalation [LEGAL_OR_FINANCIAL_SENSITIVITY]');
    });

    it('idempotently reuses existing open escalation task on retries without creating duplicates', async () => {
      const trustedCtx: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        threadId: threadA,
      };

      const run1 = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadA,
          reason: 'BUYER_COMPLAINT',
          explanation: 'Buyer is dissatisfied with delays in listing information.',
          urgency: 'URGENT',
          recommendedAdvisorAction: 'Senior advisor to call buyer immediately.',
        },
        trustedCtx,
      );
      const taskId1 = (run1.data as any).taskId;

      // Immediate retry with the same reason
      const run2 = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadA,
          reason: 'BUYER_COMPLAINT',
          explanation: 'Buyer is dissatisfied with delays in listing information.',
          urgency: 'URGENT',
          recommendedAdvisorAction: 'Senior advisor to call buyer immediately.',
        },
        trustedCtx,
      );
      const taskId2 = (run2.data as any).taskId;

      expect(taskId1).toBe(taskId2);

      const matchingTasks = await prisma.leadTask.findMany({
        where: {
          leadId: leadA,
          title: { startsWith: 'Escalation [BUYER_COMPLAINT]' },
          status: 'OPEN',
        },
      });
      expect(matchingTasks.length).toBe(1);
    });
  });

  describe('6. Model-Driven Escalation Scenarios & Bounded Loops', () => {
    beforeEach(async () => {
      await prisma.conversationThread.update({
        where: { id: threadA },
        data: { isHumanTakeover: false, state: 'AUTOPILOT' },
      });
    });

    it('escalates complex price negotiation and stops further tool calls', async () => {
      const mockAiClient = {
        models: {
          generateContent: jest.fn().mockImplementation(async () => {
            return {
              functionCalls: [
                {
                  name: 'escalate_to_human',
                  args: {
                    leadId: leadA,
                    reason: 'COMPLEX_NEGOTIATION',
                    explanation: 'Buyer demanded a $50k non-standard price reduction.',
                    urgency: 'HIGH',
                    recommendedAdvisorAction: 'Review pricing with seller.',
                  },
                },
              ],
            };
          }),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Can I get $50k off the price of Emerald Luxury Suite?',
        aiClient: mockAiClient,
      });

      expect(result.executedTools.length).toBe(1);
      expect(result.executedTools[0].toolName).toBe('escalate_to_human');
      expect((result.escalation as any)?.reason).toBe('COMPLEX_NEGOTIATION');
      expect(result.response).toContain('advisor team');
    });

    it('escalates when repeated tool failures occur (errorCount >= 2)', async () => {
      let callCount = 0;
      const mockAiClient = {
        models: {
          generateContent: jest.fn().mockImplementation(async () => {
            callCount++;
            return {
              functionCalls: [
                {
                  name: 'check_site_visit_availability',
                  args: { date: 'invalid-date-format' },
                },
              ],
            };
          }),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Search something invalid',
        aiClient: mockAiClient,
      });

      // After 2 tool errors, REPEATED_FAILURE is automatically triggered
      const escalatedTool = result.executedTools.find((t) => t.toolName === 'escalate_to_human');
      expect(escalatedTool).toBeDefined();
      expect((result.escalation as any)?.reason).toBe('REPEATED_FAILURE');
      expect(result.reasoning).toContain('repeated tool execution errors');
    });

    it('suppresses agent execution when human takeover is active', async () => {
      // Engage human takeover
      await toggleHumanTakeover(threadA, true, orgA, 'test@example.com');

      const mockAiClient = {
        models: {
          generateContent: jest.fn(),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Hello, are you there?',
        aiClient: mockAiClient,
      });

      expect(result.suppressed).toBe(true);
      expect(result.suppressedReason).toContain('Human takeover is active');
      expect(mockAiClient.models.generateContent).not.toHaveBeenCalled();
    });
  });

  describe('7. Conversation Service Integration & Customer Reply Safety', () => {
    beforeEach(async () => {
      await prisma.conversationThread.update({
        where: { id: threadA },
        data: { isHumanTakeover: false, state: 'AUTOPILOT' },
      });
    });

    it('keeps customer-facing reply draft in PENDING_APPROVAL and surfaces escalation in suggestedAction', async () => {
      const res = await handleCustomerMessage({
        leadId: leadA,
        organizationId: orgA,
        content: 'Please connect me with an advisor directly.',
      });

      expect(res.message.content).toBe('Please connect me with an advisor directly.');
      expect(res.aiReply).toBeDefined();
      expect(res.aiReply?.approvalStatus).toBe('PENDING_APPROVAL');

      const suggestedAction = res.aiReply?.suggestedAction as any;
      expect(suggestedAction).toBeDefined();
      expect(suggestedAction.escalation).toBeDefined();
      expect(suggestedAction.escalation.escalated).toBe(true);
      expect(suggestedAction.escalation.reason).toBe('BUYER_REQUESTED_HUMAN');
    });

    it('suppresses subsequent customer messages once human takeover is active', async () => {
      // Step 1: Thread is in HUMAN_TAKEOVER
      await prisma.conversationThread.update({
        where: { id: threadA },
        data: { isHumanTakeover: true, state: 'HUMAN_TAKEOVER' },
      });

      // Step 2: Next incoming customer message
      const res = await handleCustomerMessage({
        leadId: leadA,
        organizationId: orgA,
        content: 'I am waiting for your response.',
      });

      expect(res.message.content).toBe('I am waiting for your response.');
      expect(res.aiReply).toBeNull();
      expect(res.suppressedReason).toContain('Human takeover is active');
    });

    it('asks a clarifying question rather than escalating when buyer statement is simply ambiguous', async () => {
      const mockAiClient = {
        models: {
          generateContent: jest.fn().mockImplementation(async () => {
            return {
              text: 'Could you confirm whether you prefer a 2-bedroom or 3-bedroom home, and what your target budget is?',
            };
          }),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'I am looking for something nice around downtown.',
        aiClient: mockAiClient,
      });

      expect(result.response).toContain('Could you confirm');
      expect(result.escalation).toBeNull();
      expect(result.executedTools.length).toBe(0);
    });

    it('handles legal/financial-sensitive questions by escalating without giving unqualified advice', async () => {
      const mockAiClient = {
        models: {
          generateContent: jest.fn().mockImplementation(async () => {
            return {
              functionCalls: [
                {
                  name: 'escalate_to_human',
                  args: {
                    leadId: leadA,
                    reason: 'LEGAL_OR_FINANCIAL_SENSITIVITY',
                    explanation: 'Buyer asking about capital gains tax implications and seller financing legality.',
                    urgency: 'HIGH',
                    recommendedAdvisorAction: 'Provide legal disclaimer and advise consulting licensed tax/legal professional.',
                  },
                },
              ],
            };
          }),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Can you advise me on the tax implications and escrow legality of seller financing?',
        aiClient: mockAiClient,
      });

      expect(result.executedTools[0].toolName).toBe('escalate_to_human');
      expect((result.escalation as any)?.reason).toBe('LEGAL_OR_FINANCIAL_SENSITIVITY');
      expect(result.response).toContain('advisor team');
    });
  });

  describe('8. Safe Failure Handling on Persistence Error', () => {
    it('returns an error and does not claim handoff succeeded when database write fails', async () => {
      const invalidCtx: TrustedAgentContext = {
        organizationId: 'non-existent-org-uuid',
        leadId: leadA,
        threadId: threadA,
      };

      const res = await executeAgentTool(
        'escalate_to_human',
        {
          leadId: leadA,
          reason: 'POLICY_RESTRICTION',
          explanation: 'Buyer request violates policy.',
          urgency: 'MEDIUM',
          recommendedAdvisorAction: 'Review policy with buyer.',
        },
        invalidCtx,
      );

      expect(res.status).toBe('ERROR');
      expect(res.error).toBeDefined();
    });
  });
});
