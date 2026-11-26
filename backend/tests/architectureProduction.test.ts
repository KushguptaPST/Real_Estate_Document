import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/services/auth.service.js';
import { processCampaignDialerBatch } from '../src/services/campaignWorker.service.js';
import { executeAutoWarmTransfer } from '../src/services/telephony/plivoStreamGateway.js';
import {
  clearPlatformConfigCache,
  recordTtsOutcome,
} from '../src/services/platformConfig.service.js';
import {
  recordGeminiCost,
  recordPlivoVoiceCost,
  recordSttCost,
  recordTtsCost,
} from '../src/services/costTracker.service.js';
import { createMemberSession, deleteOrgUsers } from './helpers/auth.js';

const app = createApp();
const prisma = new PrismaClient();

describe('Streamlined Multi-Tenant Quotas, Lead Privacy, Wallet Breakers, Warm Transfer, COGS & Super-Admin', () => {
  const createdOrgIds: string[] = [];

  let soloOrg: { id: string };
  let soloOwner: Awaited<ReturnType<typeof createMemberSession>>;

  let teamOrg: { id: string };
  let teamOwner: Awaited<ReturnType<typeof createMemberSession>>;
  let agent1: Awaited<ReturnType<typeof createMemberSession>>;
  let agent2: Awaited<ReturnType<typeof createMemberSession>>;

  let adminUser: { id: string; email: string };
  let adminToken: string;

  beforeAll(async () => {
    soloOrg = await prisma.organization.create({
      data: {
        name: 'Arch Test Solo Brokerage',
        subscriptionTier: 'SOLO',
        subscriptionStatus: 'ACTIVE',
      },
    });
    teamOrg = await prisma.organization.create({
      data: {
        name: 'Arch Test Team Brokerage',
        subscriptionTier: 'TEAM',
        subscriptionStatus: 'ACTIVE',
      },
    });
    createdOrgIds.push(soloOrg.id, teamOrg.id);

    soloOwner = await createMemberSession(soloOrg.id, { role: 'OWNER' });
    teamOwner = await createMemberSession(teamOrg.id, { role: 'OWNER' });
    agent1 = await createMemberSession(teamOrg.id, { role: 'AGENT' });
    agent2 = await createMemberSession(teamOrg.id, { role: 'AGENT' });

    await prisma.user.update({
      where: { id: teamOwner.user.id },
      data: { phone: '+919800000001' },
    });
    await prisma.user.update({
      where: { id: agent1.user.id },
      data: { phone: '+919811111111' },
    });

    adminUser = await prisma.user.create({
      data: {
        googleId: `superadmin-google-${Date.now()}`,
        email: 'platform.admin@eigenestate.test',
        name: 'Platform Super Admin',
        organizationId: teamOrg.id,
        role: 'OWNER',
      },
    });
    adminToken = signSessionToken(adminUser).token;
  });

  afterAll(async () => {
    await prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {
        primaryTtsEngine: 'eleven_flash_v2_5',
        primaryLlmModel: 'gemini-2.5-flash',
        outboundDialerPaused: false,
        consecutiveTtsFailures: 0,
        failoverReason: null,
      },
    });
    clearPlatformConfigCache();

    await prisma.adminAuditLog.deleteMany({
      where: {
        OR: [{ organizationId: { in: createdOrgIds } }, { adminEmail: 'platform.admin@eigenestate.test' }, { adminEmail: 'system-auto-failover' }],
      },
    });
    await deleteOrgUsers(createdOrgIds);
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.$disconnect();
  });

  describe('1. Plan Quota Enforcement (maxAgents & maxDeals)', () => {
    it('blocks inviting a second user on SOLO tier (maxAgents=1) with 402, but allows inviting on TEAM tier', async () => {
      const soloRes = await request(app)
        .post('/api/org/invitations')
        .set('Authorization', `Bearer ${soloOwner.token}`)
        .send({ email: 'extra.advisor@example.com', role: 'AGENT' });

      expect(soloRes.status).toBe(402);

      const teamRes = await request(app)
        .post('/api/org/invitations')
        .set('Authorization', `Bearer ${teamOwner.token}`)
        .send({ email: 'team.advisor@example.com', role: 'AGENT' });

      expect(teamRes.status).toBe(201);
    });

    it('blocks creating a 51st deal on SOLO tier (maxDeals=50) with 402', async () => {
      await prisma.deal.createMany({
        data: Array.from({ length: 50 }).map((_, idx) => ({
          organizationId: soloOrg.id,
          propertyAddress: `Plot ${idx + 1}, Indiranagar, Bengaluru`,
        })),
      });

      const res = await request(app)
        .post('/api/deals')
        .set('Authorization', `Bearer ${soloOwner.token}`)
        .send({ propertyAddress: 'Plot 51, Over Quota Road' });

      expect(res.status).toBe(402);
    });
  });

  describe('2. Multi-Advisor Lead Visibility Isolation', () => {
    it('AGENT sees own + unassigned leads only, never another advisor private lead; OWNER sees all', async () => {
      const myLead = await prisma.lead.create({
        data: { fullName: 'Agent1 Private Lead', organizationId: teamOrg.id, assignedUserId: agent1.user.id },
      });
      const peerLead = await prisma.lead.create({
        data: { fullName: 'Agent2 Private Lead', organizationId: teamOrg.id, assignedUserId: agent2.user.id },
      });
      const poolLead = await prisma.lead.create({
        data: { fullName: 'Shared Pool Unassigned', organizationId: teamOrg.id, assignedUserId: null },
      });

      const agent1List = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${agent1.token}`);

      expect(agent1List.status).toBe(200);
      const ids1 = agent1List.body.map((l: any) => l.id);
      expect(ids1).toContain(myLead.id);
      expect(ids1).toContain(poolLead.id);
      expect(ids1).not.toContain(peerLead.id);

      const peerDetailAttempt = await request(app)
        .get(`/api/leads/${peerLead.id}`)
        .set('Authorization', `Bearer ${agent1.token}`);
      expect(peerDetailAttempt.status).toBe(403);

      const ownerList = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${teamOwner.token}`);
      expect(ownerList.status).toBe(200);
      const ownerIds = ownerList.body.map((l: any) => l.id);
      expect(ownerIds).toEqual(expect.arrayContaining([myLead.id, peerLead.id, poolLead.id]));
    });
  });

  describe('3. Zero-Balance Circuit Breakers & Auto Warm Transfer', () => {
    it('blocks outbound Plivo call and campaign start when wallet balance < ₹12, and auto-pauses low-balance running campaigns', async () => {
      const buyer = await prisma.lead.create({
        data: {
          fullName: 'Zero Balance Buyer',
          phone: '+919822222222',
          organizationId: soloOrg.id,
        },
      });

      const callRes = await request(app)
        .post('/api/voice/plivo/outbound')
        .set('Authorization', `Bearer ${soloOwner.token}`)
        .send({ leadId: buyer.id, phone: '+919822222222' });
      expect(callRes.status).toBe(402);

      const startRes = await request(app)
        .post('/api/campaigns/start')
        .set('Authorization', `Bearer ${soloOwner.token}`)
        .send({ concurrencyTrunks: 2 });
      expect(startRes.status).toBe(402);

      const campaign = await prisma.campaign.create({
        data: {
          organizationId: soloOrg.id,
          name: 'Depleted Wallet Campaign',
          status: 'RUNNING',
        },
      });

      await processCampaignDialerBatch({ maxPerCampaign: 2 });

      const refreshed = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      expect(refreshed.status).toBe('PAUSED');
      expect(refreshed.pauseReason).toBe('LOW_BALANCE');
    });

    it('executeAutoWarmTransfer routes to assigned advisor mobile first, falling back to Owner mobile, and marks session TRANSFERRED', async () => {
      const assignedLead = await prisma.lead.create({
        data: {
          fullName: 'VIP Assigned Buyer',
          phone: '+919833333333',
          organizationId: teamOrg.id,
          assignedUserId: agent1.user.id,
        },
      });
      const session1 = await prisma.voiceCallSession.create({
        data: {
          organizationId: teamOrg.id,
          leadId: assignedLead.id,
          callUuid: `sim-wt-assigned-${Date.now()}`,
          direction: 'OUTBOUND',
          fromNumber: '+918000000000',
          toNumber: '+919833333333',
          status: 'IN_PROGRESS',
        },
      });

      const res1 = await executeAutoWarmTransfer({
        sessionId: session1.id,
        callUuid: session1.callUuid,
        organizationId: teamOrg.id,
        leadId: assignedLead.id,
        reason: 'Requested site visit negotiation',
      });
      expect(res1.transferred).toBe(true);
      expect(res1.advisorPhone).toBe('+919811111111');

      const updated1 = await prisma.voiceCallSession.findUniqueOrThrow({ where: { id: session1.id } });
      expect(updated1.status).toBe('TRANSFERRED');
      expect(updated1.outcome).toBe('WARM_TRANSFER');

      // Unassigned lead falls back to TEAM Owner phone (+919800000001)
      const unassignedLead = await prisma.lead.create({
        data: {
          fullName: 'VIP Pool Buyer',
          phone: '+919844444444',
          organizationId: teamOrg.id,
          assignedUserId: null,
        },
      });
      const session2 = await prisma.voiceCallSession.create({
        data: {
          organizationId: teamOrg.id,
          leadId: unassignedLead.id,
          callUuid: `sim-wt-owner-${Date.now()}`,
          direction: 'OUTBOUND',
          fromNumber: '+918000000000',
          toNumber: '+919844444444',
          status: 'IN_PROGRESS',
        },
      });

      const res2 = await executeAutoWarmTransfer({
        sessionId: session2.id,
        callUuid: session2.callUuid,
        organizationId: teamOrg.id,
        leadId: unassignedLead.id,
        reason: 'Requested owner callback',
      });
      expect(res2.transferred).toBe(true);
      expect(res2.advisorPhone).toBe('+919800000001');
    });
  });

  describe('4. COGS Telemetry & Super-Admin Mission Control', () => {
    it('denies normal brokerage OWNER with 403 and serves real INR P&L + COGS to PLATFORM_ADMIN_EMAILS', async () => {
      const denied = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${soloOwner.token}`);
      expect(denied.status).toBe(403);

      await recordPlivoVoiceCost({ organizationId: teamOrg.id, durationSeconds: 120 }); // 2 min -> ₹2.60
      await recordTtsCost({ organizationId: teamOrg.id, provider: 'ELEVENLABS_TTS', chars: 500 }); // ₹2.10
      await recordSttCost({ organizationId: teamOrg.id, durationSeconds: 120 }); // ₹0.72
      await recordGeminiCost({
        organizationId: teamOrg.id,
        inputTokens: 10000,
        outputTokens: 2000,
        model: 'gemini-2.5-flash',
      });

      const ok = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(ok.status).toBe(200);
      expect(ok.body.kpis.monthlySubscriptionMrrInr).toBeGreaterThanOrEqual(7499 + 21999);
      expect(ok.body.kpis.totalCogs30dInr).toBeGreaterThan(5);
      expect(ok.body.kpis.netProfit30dInr).toBeLessThan(ok.body.kpis.grossRevenue30dInr);
      expect(ok.body.providerBreakdown.map((p: any) => p.provider)).toEqual(
        expect.arrayContaining(['PLIVO_VOICE', 'ELEVENLABS_TTS', 'DEEPGRAM_STT', 'GEMINI_LLM']),
      );
    });

    it('handles India Plivo KYC approval, wallet credit adjustment, org suspension, and persistent switchboard failover', async () => {
      // 1. Plivo KYC approval
      const kycRes = await request(app)
        .patch(`/api/admin/tenants/${soloOrg.id}/kyc`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACCEPTED', note: 'GST verified' });
      expect(kycRes.status).toBe(200);
      expect(kycRes.body.channel.plivoComplianceStatus).toBe('ACCEPTED');

      // 2. Manual wallet credit
      const walRes = await request(app)
        .post(`/api/admin/tenants/${soloOrg.id}/wallet`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amountInr: 2500, reason: 'Launch credit pack' });
      expect(walRes.status).toBe(200);
      expect(walRes.body.newBalance).toBeGreaterThanOrEqual(2500);

      // 3. Suspend org -> blocks soloOwner API requests, then reactivate
      const suspRes = await request(app)
        .patch(`/api/admin/tenants/${soloOrg.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isSuspended: true, reason: 'Compliance verification test' });
      expect(suspRes.status).toBe(200);
      expect(suspRes.body.organization.isSuspended).toBe(true);

      const blockedMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${soloOwner.token}`);
      expect(blockedMe.status).toBe(403);

      const reactivateRes = await request(app)
        .patch(`/api/admin/tenants/${soloOrg.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isSuspended: false });
      expect(reactivateRes.status).toBe(200);

      const restoredMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${soloOwner.token}`);
      expect(restoredMe.status).toBe(200);

      // 4. Persistent global kill-switch blocks campaign dialer
      const cfgRes = await request(app)
        .post('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outboundDialerPaused: true, note: 'Test emergency pause' });
      expect(cfgRes.status).toBe(200);
      expect(cfgRes.body.config.outboundDialerPaused).toBe(true);

      const blockedCampaignStart = await request(app)
        .post('/api/campaigns/start')
        .set('Authorization', `Bearer ${soloOwner.token}`)
        .send({ concurrencyTrunks: 2 });
      expect(blockedCampaignStart.status).toBe(503);

      await request(app)
        .post('/api/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outboundDialerPaused: false, primaryTtsEngine: 'eleven_flash_v2_5' });

      // 5. Auto-failover on 3 consecutive ElevenLabs failures
      await recordTtsOutcome('eleven_flash_v2_5', false, 'Simulated 503 #1');
      await recordTtsOutcome('eleven_flash_v2_5', false, 'Simulated 503 #2');
      const afterThird = await recordTtsOutcome('eleven_flash_v2_5', false, 'Simulated 503 #3');
      expect(afterThird.primaryTtsEngine).not.toBe('eleven_flash_v2_5');

      const auditTrail = await prisma.adminAuditLog.findMany({
        where: { action: 'TTS_AUTO_FAILOVER' },
      });
      expect(auditTrail.length).toBeGreaterThanOrEqual(1);
    });
  });
});
