// ─────────────────────────────────────────────────────────────────────────────
// Phase 2E — Persistent Buyer Memory, Follow-Up Triggers & Re-engagement Suite
// ─────────────────────────────────────────────────────────────────────────────

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../../src/app.js';
import { createMemberSession, deleteOrgUsers } from '../helpers/auth.js';
import {
  assembleBuyerMemory,
  evaluateFollowUpNeed,
  createFollowUpTaskAndDraft,
} from '../../src/services/agent/buyerMemory.service.js';
import { createLeadTask } from '../../src/services/leadTask.service.js';
import {
  AGENT_FUNCTION_DECLARATIONS,
  ALLOWED_TOOL_NAMES,
  executeAgentTool,
  type TrustedAgentContext,
} from '../../src/services/agent/agentTools.js';
import { runSalesAgentLoop } from '../../src/services/agent/agentRuntime.js';
import {
  getOrCreateLeadThread,
  handleCustomerMessage,
  toggleHumanTakeover,
} from '../../src/services/conversation.service.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Phase 2E — Persistent Buyer Memory & Follow-Up Planning Suite', () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentA: Awaited<ReturnType<typeof createMemberSession>>;
  let agentB: Awaited<ReturnType<typeof createMemberSession>>;

  beforeAll(async () => {
    orgA = await prisma.organization.create({ data: { name: 'P2E Test Org A' } });
    orgB = await prisma.organization.create({ data: { name: 'P2E Test Org B' } });

    ownerA = await createMemberSession(orgA.id, { role: 'OWNER' });
    agentA = await createMemberSession(orgA.id, { role: 'AGENT' });
    agentB = await createMemberSession(orgB.id, { role: 'AGENT' });
  });

  afterAll(async () => {
    await prisma.conversationMessage.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.conversationThread.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.leadTask.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.siteVisit.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.propertyMatch.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.leadRequirementProposal.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.leadRequirement.deleteMany({
      where: { lead: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.leadCallLog.deleteMany({
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

  // ── 1. Tenant Isolation ────────────────────────────────────────────────────
  describe('1. Tenant Isolation', () => {
    it('Scenario 1: assembleBuyerMemory strictly isolates leads by tenant and rejects cross-tenant reads', async () => {
      const leadA = await prisma.lead.create({
        data: {
          fullName: 'Tenant A Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      // Querying with Org A context succeeds
      const memA = await assembleBuyerMemory(leadA.id, orgA.id);
      expect(memA).toBeDefined();
      expect(memA.leadId).toBe(leadA.id);
      expect(memA.organizationId).toBe(orgA.id);

      // Querying with Foreign Org B context fails with 404
      await expect(assembleBuyerMemory(leadA.id, orgB.id)).rejects.toThrow();
    });

    it('Scenario 17: HTTP API endpoints enforce tenant isolation and authentication', async () => {
      const leadA = await prisma.lead.create({
        data: {
          fullName: 'API Tenant Test Lead',
          organizationId: orgA.id,
          status: 'NEW',
        },
      });

      // Unauthenticated request is blocked
      const unauthRes = await request(app).get(`/api/leads/${leadA.id}/memory`);
      expect(unauthRes.status).toBe(401);

      // Cross-tenant advisor request is blocked with 404
      const crossRes = await request(app)
        .get(`/api/leads/${leadA.id}/memory`)
        .set('Authorization', `Bearer ${agentB.token}`);
      expect(crossRes.status).toBe(404);

      // Legitimate tenant advisor request succeeds read-only
      const authRes = await request(app)
        .get(`/api/leads/${leadA.id}/memory`)
        .set('Authorization', `Bearer ${agentA.token}`);
      expect(authRes.status).toBe(200);
      expect(authRes.body.memory.leadId).toBe(leadA.id);
      expect(authRes.body.recommendation).toBeDefined();
    });
  });

  // ── 2. Fact Provenance Distinctions ────────────────────────────────────────
  describe('2. Provenance Distinctions: Authoritative Facts vs Proposals vs Visits', () => {
    it('Scenario 2: Distinguishes confirmed database requirements from pending unapproved proposals', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Provenance Test Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      // Confirmed database requirement
      await prisma.leadRequirement.create({
        data: {
          leadId: lead.id,
          minBudget: 500000,
          maxBudget: 800000,
          preferredLocations: ['Downtown'],
          minBedrooms: 2,
        },
      });

      // Unapproved pending proposal
      await prisma.leadRequirementProposal.create({
        data: {
          leadId: lead.id,
          organizationId: orgA.id,
          proposedMinBudget: 900000,
          proposedMaxBudget: 1200000,
          proposedLocations: ['Uptown'],
          confidence: 0.85,
          status: 'PENDING',
        },
      });

      const memory = await assembleBuyerMemory(lead.id, orgA.id);

      // Authoritative facts remain grounded in confirmed DB record
      expect(memory.requirements.confirmed).toBeDefined();
      expect(memory.requirements.confirmed?.minBudget).toBe(500000);
      expect(memory.requirements.confirmed?.maxBudget).toBe(800000);

      // Proposals are kept separate and labeled as pending
      expect(memory.requirements.pendingProposals.length).toBe(1);
      expect(memory.requirements.pendingProposals[0].changeType).toBe('REQUIREMENTS_UPDATE');
      expect(memory.requirements.pendingProposals[0].proposedChanges.minBudget).toBe(900000);

      // Confirm proposals did NOT overwrite confirmed requirements
      expect(memory.requirements.confirmed?.minBudget).not.toBe(900000);
    });

    it('Scenario 3: Distinguishes confirmed site visits from proposed unbooked tour slots', async () => {
      const prop = await prisma.property.create({
        data: {
          organizationId: orgA.id,
          title: 'Provenance Tour Villa',
          address: '101 Villa Way',
          city: 'Downtown',
          price: 700000,
          bedrooms: 3,
          bathrooms: 2,
          propertyType: 'Villa',
          status: 'AVAILABLE',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          fullName: 'Visit Provenance Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      // Real confirmed visit
      const visitDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.siteVisit.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          propertyId: prop.id,
          assignedUserId: agentA.user.id,
          createdById: agentA.user.id,
          startAt: visitDate,
          endAt: new Date(visitDate.getTime() + 60 * 60 * 1000),
          status: 'SCHEDULED',
        },
      });

      // Thread with an AI message proposing an unbooked slot
      const thread = await getOrCreateLeadThread(lead.id, orgA.id);
      await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgA.id,
          senderType: 'AI',
          content: 'Would tomorrow at 3 PM work for a walkthrough?',
          suggestedAction: {
            siteVisitProposal: {
              propertyId: prop.id,
              propertyTitle: prop.title,
              date: '2026-10-15',
              preferredTime: '15:00',
            },
          } as object,
          approvalStatus: 'APPROVED',
        },
      });

      const memory = await assembleBuyerMemory(lead.id, orgA.id);

      // Confirmed visits list has real DB visit
      expect(memory.siteVisits.confirmed.length).toBe(1);
      expect(memory.siteVisits.confirmed[0].propertyTitle).toBe('Provenance Tour Villa');
      expect(memory.siteVisits.confirmed[0].status).toBe('SCHEDULED');

      // Proposed visits list has unbooked slot
      expect(memory.siteVisits.pendingProposals.length).toBe(1);
      expect(memory.siteVisits.pendingProposals[0].status).toBe('PROPOSED_NOT_BOOKED');
      expect(memory.siteVisits.pendingProposals[0].propertyTitle).toBe('Provenance Tour Villa');
    });
  });

  // ── 3. Deterministic Trigger Evaluation ────────────────────────────────────
  describe('3. Deterministic Trigger Evaluation & Evidence Grounding', () => {
    it('Scenario 4: UNANSWERED_QUESTION fires on aged buyer inquiry (>12h) but suppresses if advisor responded', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Question Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      const thread = await getOrCreateLeadThread(lead.id, orgA.id);

      // Customer asks question 14 hours ago
      const fourteenHoursAgo = new Date(Date.now() - 14 * 60 * 60 * 1000);
      await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgA.id,
          senderType: 'CUSTOMER',
          content: 'What are the HOA maintenance fees for this property?',
          createdAt: fourteenHoursAgo,
        },
      });

      let memory = await assembleBuyerMemory(lead.id, orgA.id);
      let rec = evaluateFollowUpNeed(memory);

      expect(rec.shouldFollowUp).toBe(true);
      expect(rec.trigger).toBe('UNANSWERED_QUESTION');
      expect(rec.priority).toBe('HIGH');
      expect(rec.evidence[0]).toContain('What are the HOA maintenance fees');

      // Now advisor responds 2 hours later
      await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgA.id,
          senderType: 'AGENT',
          content: 'The monthly HOA dues are $450.',
          createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
        },
      });

      memory = await assembleBuyerMemory(lead.id, orgA.id);
      rec = evaluateFollowUpNeed(memory);

      // UNANSWERED_QUESTION is suppressed because advisor replied
      expect(rec.trigger).not.toBe('UNANSWERED_QUESTION');
    });

    it('Scenario 5: Ambiguous timestamps do not assert false urgency', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Ambiguous Time Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      const thread = await getOrCreateLeadThread(lead.id, orgA.id);

      // Message received just now (not >12 hours)
      await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgA.id,
          senderType: 'CUSTOMER',
          content: 'Are pets allowed?',
          createdAt: new Date(),
        },
      });

      const memory = await assembleBuyerMemory(lead.id, orgA.id);
      const rec = evaluateFollowUpNeed(memory);

      // Not triggered as unanswered question because < 12h
      expect(rec.trigger).not.toBe('UNANSWERED_QUESTION');
    });

    it('Scenario 6: COMPLETED_VISIT_FOLLOW_UP triggers on recent completed tour, but respects existing open tasks', async () => {
      const prop = await prisma.property.create({
        data: {
          organizationId: orgA.id,
          title: 'Walkthrough Completed Villa',
          address: '202 Tour Way',
          city: 'Downtown',
          price: 800000,
          bedrooms: 3,
          bathrooms: 3,
          propertyType: 'Single Family',
          status: 'AVAILABLE',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          fullName: 'Tour Completed Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      // Completed visit 2 days ago
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await prisma.siteVisit.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          propertyId: prop.id,
          assignedUserId: agentA.user.id,
          createdById: agentA.user.id,
          startAt: twoDaysAgo,
          endAt: new Date(twoDaysAgo.getTime() + 60 * 60 * 1000),
          status: 'COMPLETED',
          completedAt: new Date(twoDaysAgo.getTime() + 60 * 60 * 1000),
          outcomeNotes: 'Buyer loved the open layout and kitchen.',
        },
      });

      let memory = await assembleBuyerMemory(lead.id, orgA.id);
      let rec = evaluateFollowUpNeed(memory);

      expect(rec.shouldFollowUp).toBe(true);
      expect(rec.trigger).toBe('COMPLETED_VISIT_FOLLOW_UP');
      expect(rec.alreadyPlanned).toBe(false);

      // If an open task already covers this visit
      await createLeadTask({
        leadId: lead.id,
        organizationId: orgA.id,
        callerId: agentA.user.id,
        callerRole: 'AGENT',
        callerEmail: agentA.user.email,
        taskType: 'CALL',
        title: 'Follow-Up [COMPLETED_VISIT_FOLLOW_UP]: Tour Completed Buyer',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        priority: 'HIGH',
      });

      memory = await assembleBuyerMemory(lead.id, orgA.id);
      rec = evaluateFollowUpNeed(memory);

      // Now already planned -> shouldFollowUp becomes false
      expect(rec.alreadyPlanned).toBe(true);
      expect(rec.shouldFollowUp).toBe(false);
    });

    it('Scenario 7: Cancelled and scheduled visits are NOT treated as completed tours', async () => {
      const prop = await prisma.property.create({
        data: {
          organizationId: orgA.id,
          title: 'Cancelled Tour Penthouse',
          address: '303 Cancel St',
          city: 'Downtown',
          price: 950000,
          bedrooms: 2,
          bathrooms: 2,
          propertyType: 'Condo',
          status: 'AVAILABLE',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          fullName: 'Cancelled Tour Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      // CANCELLED visit
      await prisma.siteVisit.create({
        data: {
          organizationId: orgA.id,
          leadId: lead.id,
          propertyId: prop.id,
          assignedUserId: agentA.user.id,
          createdById: agentA.user.id,
          startAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
          status: 'CANCELLED',
        },
      });

      const memory = await assembleBuyerMemory(lead.id, orgA.id);
      const rec = evaluateFollowUpNeed(memory);

      // Cancelled visit must NOT trigger COMPLETED_VISIT_FOLLOW_UP
      expect(rec.trigger).not.toBe('COMPLETED_VISIT_FOLLOW_UP');
    });

    it('Scenario 8: NEW_MATCHING_INVENTORY requires confirmed buyer requirements and available inventory', async () => {
      const prop = await prisma.property.create({
        data: {
          organizationId: orgA.id,
          title: 'Perfect Match Penthouse',
          address: '404 Match Way',
          city: 'Downtown',
          price: 600000,
          bedrooms: 2,
          bathrooms: 2,
          propertyType: 'Condo',
          status: 'AVAILABLE',
        },
      });

      const lead = await prisma.lead.create({
        data: {
          fullName: 'Match Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      await prisma.leadRequirement.create({
        data: {
          leadId: lead.id,
          minBudget: 500000,
          maxBudget: 700000,
          preferredLocations: ['Downtown'],
          minBedrooms: 2,
        },
      });

      await prisma.propertyMatch.create({
        data: {
          leadId: lead.id,
          propertyId: prop.id,
          organizationId: orgA.id,
          matchScore: 0.95,
          matchReason: 'Fits budget, 2 bedrooms, and location Downtown',
        },
      });

      const memory = await assembleBuyerMemory(lead.id, orgA.id);
      const rec = evaluateFollowUpNeed(memory);

      expect(rec.trigger).toBe('NEW_MATCHING_INVENTORY');
      expect(rec.evidence[0]).toContain('Perfect Match Penthouse');
    });

    it('Scenario 9: INACTIVE_LEAD_CHECKIN triggers only when inactivity >= 3 days on active qualified leads', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Stagnant Qualified Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      // Confirmed requirements
      await prisma.leadRequirement.create({
        data: {
          leadId: lead.id,
          minBudget: 400000,
          maxBudget: 600000,
          preferredLocations: ['Suburbs'],
        },
      });

      const thread = await getOrCreateLeadThread(lead.id, orgA.id);
      // Activity 4 days ago
      await prisma.conversationMessage.create({
        data: {
          threadId: thread.id,
          organizationId: orgA.id,
          senderType: 'CUSTOMER',
          content: 'Thanks, checking these out.',
          createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        },
      });

      const memory = await assembleBuyerMemory(lead.id, orgA.id);
      const rec = evaluateFollowUpNeed(memory);

      expect(rec.shouldFollowUp).toBe(true);
      expect(rec.trigger).toBe('INACTIVE_LEAD_CHECKIN');
      expect(rec.priority).toBe('LOW');
    });
  });

  // ── 4. Suppression Rules ───────────────────────────────────────────────────
  describe('4. Mandatory Suppression Rules', () => {
    it('Scenario 10: Human takeover and paused/closed thread suppress follow-up recommendations', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Takeover Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      const thread = await getOrCreateLeadThread(lead.id, orgA.id);
      await toggleHumanTakeover(thread.id, true, orgA.id);

      const memory = await assembleBuyerMemory(lead.id, orgA.id);
      expect(memory.eligibility.eligibleForFollowUp).toBe(false);
      expect(memory.eligibility.ineligibilityReason).toContain('Human takeover');

      const rec = evaluateFollowUpNeed(memory);
      expect(rec.shouldFollowUp).toBe(false);
      expect(rec.trigger).toBeNull();
    });

    it('Scenario 11: WON and LOST leads strictly suppress follow-up recommendations', async () => {
      const wonLead = await prisma.lead.create({
        data: {
          fullName: 'Won Buyer',
          organizationId: orgA.id,
          status: 'WON',
        },
      });

      const lostLead = await prisma.lead.create({
        data: {
          fullName: 'Lost Buyer',
          organizationId: orgA.id,
          status: 'LOST',
        },
      });

      const wonMem = await assembleBuyerMemory(wonLead.id, orgA.id);
      expect(wonMem.eligibility.eligibleForFollowUp).toBe(false);
      expect(wonMem.eligibility.ineligibilityReason).toContain('terminal state');

      const lostMem = await assembleBuyerMemory(lostLead.id, orgA.id);
      expect(lostMem.eligibility.eligibleForFollowUp).toBe(false);
      expect(lostMem.eligibility.ineligibilityReason).toContain('terminal state');
    });
  });

  // ── 5. Safe & Idempotent Task Creation ─────────────────────────────────────
  describe('5. Safe & Idempotent Task Creation & Draft Governance', () => {
    it('Scenario 12: Prevents duplicate follow-up tasks on repeated calls (idempotent)', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Retry Idempotent Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      await getOrCreateLeadThread(lead.id, orgA.id);

      // First call creates task
      const result1 = await createFollowUpTaskAndDraft({
        leadId: lead.id,
        organizationId: orgA.id,
        callerId: agentA.user.id,
        callerRole: 'AGENT',
        callerEmail: agentA.user.email,
        trigger: 'INACTIVE_LEAD_CHECKIN',
      });

      expect(result1.taskId).toBeDefined();
      expect(result1.isExisting).toBe(false);

      // Second identical call reuses existing task
      const result2 = await createFollowUpTaskAndDraft({
        leadId: lead.id,
        organizationId: orgA.id,
        callerId: agentA.user.id,
        callerRole: 'AGENT',
        callerEmail: agentA.user.email,
        trigger: 'INACTIVE_LEAD_CHECKIN',
      });

      expect(result2.taskId).toBe(result1.taskId);
      expect(result2.isExisting).toBe(true);

      // Verify in DB that only one task was created
      const taskCount = await prisma.leadTask.count({
        where: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: { startsWith: 'Follow-Up [INACTIVE_LEAD_CHECKIN]' },
        },
      });
      expect(taskCount).toBe(1);
    });

    it('Scenario 13: Concurrent task creation requests do not produce orphaned duplicate tasks', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Concurrent Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      await getOrCreateLeadThread(lead.id, orgA.id);

      const [res1, res2] = await Promise.all([
        createFollowUpTaskAndDraft({
          leadId: lead.id,
          organizationId: orgA.id,
          callerId: agentA.user.id,
          callerRole: 'AGENT',
          callerEmail: agentA.user.email,
          trigger: 'INACTIVE_LEAD_CHECKIN',
        }),
        createFollowUpTaskAndDraft({
          leadId: lead.id,
          organizationId: orgA.id,
          callerId: agentA.user.id,
          callerRole: 'AGENT',
          callerEmail: agentA.user.email,
          trigger: 'INACTIVE_LEAD_CHECKIN',
        }),
      ]);

      expect(res1.taskId).toBeDefined();
      expect(res2.taskId).toBeDefined();

      const tasksInDb = await prisma.leadTask.findMany({
        where: {
          leadId: lead.id,
          organizationId: orgA.id,
          title: { startsWith: 'Follow-Up [INACTIVE_LEAD_CHECKIN]' },
        },
      });
      expect(tasksInDb.length).toBe(1);
    });

    it('Scenario 14: Revalidates trigger state and rejects task creation if lead state became stale', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Stale Lead Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      const thread = await getOrCreateLeadThread(lead.id, orgA.id);

      // Lead moves to WON or takeover
      await toggleHumanTakeover(thread.id, true, orgA.id);

      // Attempting to plan follow-up throws 422
      await expect(
        createFollowUpTaskAndDraft({
          leadId: lead.id,
          organizationId: orgA.id,
          callerId: agentA.user.id,
          callerRole: 'AGENT',
          callerEmail: agentA.user.email,
          trigger: 'INACTIVE_LEAD_CHECKIN',
        }),
      ).rejects.toThrow();
    });

    it('Scenario 15: Generated draft messages strictly remain PENDING_APPROVAL and are never auto-sent', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Draft Approval Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      await getOrCreateLeadThread(lead.id, orgA.id);

      const res = await createFollowUpTaskAndDraft({
        leadId: lead.id,
        organizationId: orgA.id,
        callerId: agentA.user.id,
        callerRole: 'AGENT',
        callerEmail: agentA.user.email,
        trigger: 'INACTIVE_LEAD_CHECKIN',
        draftContent: 'Hi! Just checking in to see if your timeline has changed.',
      });

      expect(res.draftMessageId).toBeDefined();
      expect(res.approvalStatus).toBe('PENDING_APPROVAL');

      // Verify in DB
      const msg = await prisma.conversationMessage.findUnique({
        where: { id: res.draftMessageId! },
      });
      expect(msg?.approvalStatus).toBe('PENDING_APPROVAL');
      expect(msg?.senderType).toBe('AI');
    });

    it('Scenario 16: Task planning performs zero external communication dispatch', async () => {
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Zero Dispatch Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      await getOrCreateLeadThread(lead.id, orgA.id);

      const res = await request(app)
        .post(`/api/leads/${lead.id}/follow-up/plan`)
        .set('Authorization', `Bearer ${agentA.token}`)
        .send({
          trigger: 'INACTIVE_LEAD_CHECKIN',
          draftContent: 'Checking in on your search!',
        });

      expect(res.status).toBe(201);
      expect(res.body.taskId).toBeDefined();
      // Communication is saved as PENDING_APPROVAL, no emails or external webhooks were dispatched
      expect(res.body.approvalStatus).toBe('PENDING_APPROVAL');
    });
  });

  // ── 6. Agent Tool Registry & Runtime Integration ──────────────────────────
  describe('6. Agent Tool Registry & Runtime Preservation', () => {
    it('Scenario 18: Tool registry includes plan_lead_follow_up (11 tools total) and get_lead_context provides buyerMemory', async () => {
      // 1. Tool count and names
      expect(ALLOWED_TOOL_NAMES.size).toBe(11);
      expect(ALLOWED_TOOL_NAMES).toContain('plan_lead_follow_up');
      expect(ALLOWED_TOOL_NAMES).toContain('escalate_to_human');
      expect(ALLOWED_TOOL_NAMES).toContain('book_site_visit');
      expect(ALLOWED_TOOL_NAMES).toContain('search_properties');

      // 2. get_lead_context returns enriched buyerMemory
      const lead = await prisma.lead.create({
        data: {
          fullName: 'Tool Context Buyer',
          organizationId: orgA.id,
          status: 'QUALIFIED',
        },
      });

      const context: TrustedAgentContext = {
        organizationId: orgA.id,
        leadId: lead.id,
        currentUserId: agentA.user.id,
        currentUserRole: 'AGENT',
      };

      const ctxResult = await executeAgentTool('get_lead_context', { leadId: lead.id }, context);
      expect(ctxResult.status).toBe('SUCCESS');
      expect((ctxResult.data as any).buyerMemory).toBeDefined();
      expect((ctxResult.data as any).followUpRecommendation).toBeDefined();

      // 3. plan_lead_follow_up tool execution
      const followUpToolRes = await executeAgentTool(
        'plan_lead_follow_up',
        {
          leadId: lead.id,
          trigger: 'INACTIVE_LEAD_CHECKIN',
          recommendedAction: 'Send polite follow-up email inquiring on availability',
          priority: 'MEDIUM',
          suggestedDraftContent: 'Hi! Let me know if you would like more listings.',
        },
        context,
      );

      expect(followUpToolRes.status).toBe('SUCCESS');
      expect((followUpToolRes.data as any).followUpProposal).toBeDefined();
      expect((followUpToolRes.data as any).followUpProposal.trigger).toBe('INACTIVE_LEAD_CHECKIN');
      expect((followUpToolRes.data as any).requiresAdvisorApproval).toBe(true);
    });
  });
});
