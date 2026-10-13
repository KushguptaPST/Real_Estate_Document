// ─────────────────────────────────────────────────────────────────────────────
// Phase 2A Security & Bounded Runtime Tests
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
import { handleCustomerMessage, getOrCreateLeadThread, toggleHumanTakeover } from '../../src/services/conversation.service.js';

const prisma = new PrismaClient();

describe('Phase 2A — Agent Tools & Runtime Security Suite', () => {
  let orgA: string;
  let orgB: string;
  let userA: string;
  let leadA: string;
  let leadB: string;
  let propA: string;
  let propB: string;
  let threadA: string;

  beforeAll(async () => {
    // 1. Create Organization A & Advisor A
    const createdOrgA = await prisma.organization.create({ data: { name: 'P2A Test Org A' } });
    orgA = createdOrgA.id;

    const createdUserA = await prisma.user.create({
      data: {
        organizationId: orgA,
        email: `advisor.p2a.${Date.now()}@example.com`,
        name: 'Advisor P2A',
        role: 'AGENT',
        googleId: `google-p2a-${Date.now()}`,
      },
    });
    userA = createdUserA.id;

    // 2. Create Organization B
    const createdOrgB = await prisma.organization.create({ data: { name: 'P2A Test Org B' } });
    orgB = createdOrgB.id;

    // 3. Create Lead in Org A
    const createdLeadA = await prisma.lead.create({
      data: {
        organizationId: orgA,
        fullName: 'Buyer Lead A',
        email: `buyer.a.${Date.now()}@example.com`,
        status: 'NEW',
        priority: 'HIGH',
        assignedUserId: userA,
      },
    });
    leadA = createdLeadA.id;

    await prisma.leadRequirement.create({
      data: {
        leadId: leadA,
        minBudget: 400000,
        maxBudget: 650000,
        minBedrooms: 2,
        preferredLocations: ['Downtown'],
        propertyType: 'CONDO',
      },
    });

    // 4. Create Lead in Org B (Foreign Tenant)
    const createdLeadB = await prisma.lead.create({
      data: {
        organizationId: orgB,
        fullName: 'Foreign Buyer B',
        email: `foreign.b.${Date.now()}@example.com`,
        status: 'NEW',
        priority: 'MEDIUM',
      },
    });
    leadB = createdLeadB.id;

    // 5. Create Property in Org A
    const createdPropA = await prisma.property.create({
      data: {
        organizationId: orgA,
        title: 'Downtown Modern Condo',
        address: '100 Main St',
        city: 'Downtown',
        price: 550000,
        bedrooms: 2,
        bathrooms: 2,
        propertyType: 'CONDO',
        status: 'AVAILABLE',
      },
    });
    propA = createdPropA.id;

    // 6. Create Property in Org B
    const createdPropB = await prisma.property.create({
      data: {
        organizationId: orgB,
        title: 'Foreign Luxury Villa',
        address: '500 Palm Way',
        city: 'Uptown',
        price: 900000,
        bedrooms: 4,
        bathrooms: 4,
        propertyType: 'SINGLE_FAMILY',
        status: 'AVAILABLE',
      },
    });
    propB = createdPropB.id;

    // 7. Provision Thread in Org A
    const thread = await getOrCreateLeadThread(leadA, orgA, 'EMAIL');
    threadA = thread.id;
  });

  afterAll(async () => {
    // Teardown test entities
    if (threadA) await prisma.conversationThread.delete({ where: { id: threadA } }).catch(() => {});
    if (leadA) await prisma.lead.delete({ where: { id: leadA } }).catch(() => {});
    if (leadB) await prisma.lead.delete({ where: { id: leadB } }).catch(() => {});
    if (propA) await prisma.property.delete({ where: { id: propA } }).catch(() => {});
    if (propB) await prisma.property.delete({ where: { id: propB } }).catch(() => {});
    if (userA) await prisma.user.delete({ where: { id: userA } }).catch(() => {});
    if (orgA) await prisma.organization.delete({ where: { id: orgA } }).catch(() => {});
    if (orgB) await prisma.organization.delete({ where: { id: orgB } }).catch(() => {});
  });

  // ── 1. Tool Declaration & Schema Integrity ─────────────────────────────────

  describe('Agent Tool Declarations', () => {
    it('exposes approved tools with valid function declarations', () => {
      expect(AGENT_FUNCTION_DECLARATIONS.length).toBeGreaterThanOrEqual(4);
      const names = AGENT_FUNCTION_DECLARATIONS.map((d) => d.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'search_properties',
          'get_lead_context',
          'check_site_visit_availability',
          'propose_follow_up_task',
        ]),
      );

      for (const declaration of AGENT_FUNCTION_DECLARATIONS) {
        expect(declaration.name).toBeTruthy();
        expect(declaration.description).toBeTruthy();
        expect(declaration.parameters).toBeDefined();
        expect(declaration.parameters.type).toBe('OBJECT');
        expect(declaration.parameters.properties).toBeDefined();
      }
    });

    it('rejects unknown tool execution with strict error status', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const result = await executeAgentTool('delete_database', {}, context);
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Unknown tool "delete_database"');
    });
  });

  // ── 2. search_properties Security & Tenant Isolation ───────────────────────

  describe('search_properties', () => {
    it('searches inventory scoped strictly to caller organizationId', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const result = await executeAgentTool(
        'search_properties',
        { maxPrice: 600000, city: 'Downtown' },
        context,
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.properties.length).toBe(1);
      expect(data.properties[0].id).toBe(propA);
      expect(data.properties[0].title).toBe('Downtown Modern Condo');
    });

    it('never exposes properties belonging to foreign tenant Org B', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const result = await executeAgentTool(
        'search_properties',
        { minPrice: 800000 },
        context,
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      // Foreign property propB ($900k) belongs to orgB, must NOT appear in orgA search
      const foreignFound = data.properties.some((p: any) => p.id === propB);
      expect(foreignFound).toBe(false);
      expect(data.properties.length).toBe(0);
    });

    it('validates tool arguments and rejects negative price numbers', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const result = await executeAgentTool(
        'search_properties',
        { minPrice: -500 },
        context,
      );

      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Invalid search_properties arguments');
    });
  });

  // ── 3. get_lead_context Authorization & Boundaries ─────────────────────────

  describe('get_lead_context', () => {
    it('retrieves confirmed requirements for the authorized lead', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const result = await executeAgentTool('get_lead_context', { leadId: leadA }, context);

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.leadId).toBe(leadA);
      expect(data.fullName).toBe('Buyer Lead A');
      expect(data.requirements.minBudget).toBe(400000);
      expect(data.requirements.maxBudget).toBe(650000);
      expect(data.requirements.propertyType).toBe('CONDO');
    });

    it('strictly forbids cross-lead access even if model requests another lead ID', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      // Model attempts to access foreign lead B
      const result = await executeAgentTool('get_lead_context', { leadId: leadB }, context);

      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Access denied: Requested lead ID does not match active conversation context');
    });

    it('rejects invalid or empty leadId arguments', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const result = await executeAgentTool('get_lead_context', { leadId: '' }, context);
      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Invalid get_lead_context arguments');
    });
  });

  // ── 4. check_site_visit_availability Read-Only Guarantee ───────────────────

  describe('check_site_visit_availability', () => {
    it('checks 45-minute slots without modifying or creating any site visits', async () => {
      const initialCount = await prisma.siteVisit.count({ where: { organizationId: orgA } });

      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const result = await executeAgentTool(
        'check_site_visit_availability',
        { date: '2026-10-25', advisorId: userA },
        context,
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.date).toBe('2026-10-25');
      expect(data.advisorId).toBe(userA);
      expect(Array.isArray(data.availableSlots)).toBe(true);

      // Verify ZERO database mutations occurred
      const finalCount = await prisma.siteVisit.count({ where: { organizationId: orgA } });
      expect(finalCount).toBe(initialCount);
    });

    it('rejects invalid date formats', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const result = await executeAgentTool(
        'check_site_visit_availability',
        { date: 'tomorrow' },
        context,
      );

      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Invalid check_site_visit_availability arguments');
    });
  });

  // ── 5. propose_follow_up_task Unpersisted Proposal Guarantee ───────────────

  describe('propose_follow_up_task', () => {
    it('returns a structured proposal with persisted: false and creates NO rows in lead_tasks', async () => {
      const initialTaskCount = await prisma.leadTask.count({ where: { organizationId: orgA } });

      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const dueDate = new Date(Date.now() + 86400000).toISOString();
      const result = await executeAgentTool(
        'propose_follow_up_task',
        {
          leadId: leadA,
          title: 'Follow up on downtown condo tour availability',
          taskType: 'CALL',
          dueDate,
          priority: 'HIGH',
          reason: 'Buyer expressed interest in 2-bedroom units',
        },
        context,
      );

      expect(result.status).toBe('SUCCESS');
      const data = result.data as any;
      expect(data.status).toBe('PROPOSED');
      expect(data.persisted).toBe(false);
      expect(data.requiresApproval).toBe(true);
      expect(data.proposal.title).toBe('Follow up on downtown condo tour availability');
      expect(data.proposal.taskType).toBe('CALL');

      // Crucial Safety Guarantee: ZERO rows created in lead_tasks table!
      const finalTaskCount = await prisma.leadTask.count({ where: { organizationId: orgA } });
      expect(finalTaskCount).toBe(initialTaskCount);
    });

    it('rejects task proposal for a foreign lead', async () => {
      const context: TrustedAgentContext = {
        organizationId: orgA,
        leadId: leadA,
        userId: userA,
      };

      const dueDate = new Date(Date.now() + 86400000).toISOString();
      const result = await executeAgentTool(
        'propose_follow_up_task',
        {
          leadId: leadB, // Foreign lead!
          title: 'Unauthorized follow up',
          taskType: 'CALL',
          dueDate,
          reason: 'Testing foreign tenant rejection',
        },
        context,
      );

      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Access denied: Cannot propose task for a lead outside active conversation context');
    });
  });

  // ── 6. Bounded Agent Runtime & Takeover Guards ─────────────────────────────

  describe('Agent Runtime Loop & Human Takeover', () => {
    it('suppresses runtime execution immediately when human takeover is active', async () => {
      // 1. Enable human takeover on thread
      await toggleHumanTakeover(threadA, true, orgA, 'advisor@example.com');

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Are there any new price reductions?',
      });

      expect(result.suppressed).toBe(true);
      expect(result.suppressedReason).toContain('Human takeover is active');
      expect(result.executedTools.length).toBe(0);

      // Reset takeover OFF for subsequent tests
      await toggleHumanTakeover(threadA, false, orgA, 'advisor@example.com');
    });

    it('returns deterministic fallback when GEMINI_API_KEY is not configured', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = '';

      try {
        const result = await runSalesAgentLoop({
          leadId: leadA,
          organizationId: orgA,
          threadId: threadA,
          customerMessage: 'Can you show me 2 bedroom condos under $600k?',
        });

        expect(result.suppressed).toBeFalsy();
        expect(result.response).toContain('Thank you for reaching out');
        expect(result.reasoning).toContain('API key missing');
        expect(result.executedTools.length).toBe(0);
      } finally {
        process.env.GEMINI_API_KEY = originalKey;
      }
    });

    it('integrates with handleCustomerMessage preserving PENDING_APPROVAL status', async () => {
      const msgResult = await handleCustomerMessage({
        leadId: leadA,
        organizationId: orgA,
        content: 'Hi, I would like to tour the Downtown condo this weekend.',
      });

      expect(msgResult.message).toBeDefined();
      expect(msgResult.message.senderType).toBe('CUSTOMER');
      expect(msgResult.aiReply).toBeDefined();
      // Crucial: AI reply must remain in approval mode!
      expect(msgResult.aiReply?.approvalStatus).toBe('PENDING_APPROVAL');
      expect(msgResult.aiReply?.senderType).toBe('AI');
    });

    it('executes multi-turn tool calling loop and observes results before generating final answer', async () => {
      let callCount = 0;
      const mockAiClient = {
        models: {
          generateContent: jest.fn().mockImplementation(async (params: any) => {
            callCount++;
            if (callCount === 1) {
              return {
                functionCalls: [
                  {
                    name: 'search_properties',
                    args: { city: 'Downtown', maxPrice: 600000 },
                  },
                ],
              };
            } else {
              const lastContent = params.contents[params.contents.length - 1];
              expect(lastContent.parts[0].functionResponse.name).toBe('search_properties');
              expect(lastContent.parts[0].functionResponse.response.output.properties.length).toBe(1);

              return {
                text: 'I found 1 great condo in Downtown for $550,000 at 100 Main St!',
              };
            }
          }),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Show me condos in Downtown under $600k',
        aiClient: mockAiClient,
      });

      expect(callCount).toBe(2);
      expect(result.executedTools.length).toBe(1);
      expect(result.executedTools[0].toolName).toBe('search_properties');
      expect(result.executedTools[0].status).toBe('SUCCESS');
      expect(result.response).toContain('Downtown for $550,000');
      expect(result.exhaustedLimit).toBe(false);
    });

    it('terminates loop at MAX_AGENT_ROUNDS (5) when model endlessly requests tool calls', async () => {
      let callCount = 0;
      const mockAiClient = {
        models: {
          generateContent: jest.fn().mockImplementation(async () => {
            callCount++;
            return {
              functionCalls: [
                {
                  name: 'search_properties',
                  args: { city: 'Downtown' },
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
        customerMessage: 'Keep searching endlessly',
        aiClient: mockAiClient,
      });

      expect(callCount).toBe(MAX_AGENT_ROUNDS); // 5
      expect(result.executedTools.length).toBe(MAX_AGENT_ROUNDS);
      expect(result.exhaustedLimit).toBe(true);
      expect(result.response).toBeTruthy();
    });

    it('handles model runtime errors gracefully and preserves fallback response', async () => {
      const mockAiClient = {
        models: {
          generateContent: jest.fn().mockRejectedValue(new Error('Rate limit exceeded (503)')),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'What properties are available?',
        aiClient: mockAiClient,
      });

      expect(result.response).toContain('Thank you for your message');
      expect(result.reasoning).toContain('Rate limit exceeded');
      expect(result.executedTools.length).toBe(0);
    });

    it('returns tool error payload back to model when tool receives invalid arguments', async () => {
      let callCount = 0;
      const mockAiClient = {
        models: {
          generateContent: jest.fn().mockImplementation(async (params: any) => {
            callCount++;
            if (callCount === 1) {
              return {
                functionCalls: [
                  {
                    name: 'search_properties',
                    args: { minPrice: -999 }, // Invalid negative price
                  },
                ],
              };
            } else {
              const lastContent = params.contents[params.contents.length - 1];
              expect(lastContent.parts[0].functionResponse.response.error).toContain('Invalid search_properties arguments');
              return {
                text: 'Please provide a valid price range.',
              };
            }
          }),
        },
      };

      const result = await runSalesAgentLoop({
        leadId: leadA,
        organizationId: orgA,
        threadId: threadA,
        customerMessage: 'Find properties with negative price',
        aiClient: mockAiClient,
      });

      expect(callCount).toBe(2);
      expect(result.executedTools[0].status).toBe('ERROR');
      expect(result.response).toBe('Please provide a valid price range.');
    });
  });
});
