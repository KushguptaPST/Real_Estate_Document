import { handleCustomerMessage, toggleHumanTakeover, getOrCreateLeadThread } from '../src/services/conversation.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Conversation Service & Human Takeover Safeguards', () => {
  let testLeadId: string;
  let orgId: string;
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeAll(async () => {
    // Disable external API calls during unit tests for fast deterministic execution
    process.env.GEMINI_API_KEY = '';

    orgId = (await prisma.organization.create({ data: { name: 'Conversation Test Org' } })).id;
    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        fullName: 'Test Customer Takeover',
        email: `test.takeover.${Date.now()}@example.com`,
        status: 'NEW',
        priority: 'MEDIUM',
      },
    });
    testLeadId = lead.id;
  });

  afterAll(async () => {
    process.env.GEMINI_API_KEY = originalApiKey;
    if (testLeadId) {
      await prisma.lead.delete({ where: { id: testLeadId } }).catch(() => {});
    }
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  });

  it('creates conversation thread and handles customer message with fallback', async () => {
    const thread = await getOrCreateLeadThread(testLeadId, orgId, 'EMAIL');
    expect(thread).toBeDefined();
    expect(thread.isHumanTakeover).toBe(false);

    const result = await handleCustomerMessage({
      leadId: testLeadId,
      organizationId: orgId,
      content: 'I am interested in buying a 3 bedroom condo under $600k in Downtown.',
    });

    expect(result.message).toBeDefined();
    expect(result.message.senderType).toBe('CUSTOMER');
    expect(result.aiReply).toBeDefined();
    expect(result.aiReply?.approvalStatus).toBe('PENDING_APPROVAL');
  });

  it('ENFORCES Human Takeover on backend and suppresses AI automated replies', async () => {
    const thread = await getOrCreateLeadThread(testLeadId, orgId, 'EMAIL');

    // Toggle Human Takeover ON
    await toggleHumanTakeover(thread.id, true, orgId, 'agent@example.com');

    const result = await handleCustomerMessage({
      leadId: testLeadId,
      organizationId: orgId,
      content: 'Can someone call me today?',
    });

    expect(result.message).toBeDefined();
    expect(result.aiReply).toBeNull(); // AI reply MUST be null when takeover is active!
    expect(result.suppressedReason).toContain('Human takeover is active');
  });

  it('resumes AI automated replies when Human Takeover is toggled OFF', async () => {
    const thread = await getOrCreateLeadThread(testLeadId, orgId, 'EMAIL');

    // Toggle Human Takeover OFF
    await toggleHumanTakeover(thread.id, false, orgId, 'agent@example.com');

    const result = await handleCustomerMessage({
      leadId: testLeadId,
      organizationId: orgId,
      content: 'What properties do you have in Westside?',
    });

    expect(result.message).toBeDefined();
    expect(result.aiReply).not.toBeNull();
  });
});
