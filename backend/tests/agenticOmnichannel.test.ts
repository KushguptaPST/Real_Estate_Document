import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';
import { runSalesAgentLoop } from '../src/services/agent/agentRuntime.js';
import { routeToSpecialist, verifyAgentOutput, isOptOutOrDnd } from '../src/services/agent/orchestrator.js';
import { executeAgentTool } from '../src/services/agent/agentTools.js';
import { plivoService } from '../src/services/telephony/plivo.service.js';
import { signSessionToken, completeSignIn } from '../src/services/auth.service.js';
import { walletService } from '../src/services/billing/wallet.service.js';

describe('Redesigned Startup-Grade Agentic AI, Omnichannel & Plivo Voice Architecture', () => {
  const app = createApp();
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userAToken: string;
  let widgetKeyA: string;
  let propertyAId: string;
  let leadAId: string;
  let threadAId: string;

  beforeAll(async () => {
    const orgA = await prisma.organization.create({
      data: { name: 'Alpha Realty Channel Partner' },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Beta Realty Channel Partner' },
    });
    orgAId = orgA.id;
    orgBId = orgB.id;

    const userA = await prisma.user.create({
      data: {
        email: `owner-${Date.now()}@alpharealty.test`,
        name: 'Vikram Advisor',
        organizationId: orgAId,
        role: 'OWNER',
      },
    });
    userAId = userA.id;
    userAToken = signSessionToken(userA).token;

    const channelA = await prisma.organizationChannel.create({
      data: {
        organizationId: orgAId,
        whatsappPhoneNumberId: `wa_phone_${Date.now()}_a`,
        widgetAllowedOrigins: ['https://alpharealty.com'],
        widgetTitle: 'Alpha AI Advisor',
        defaultCurrency: 'INR',
      },
    });
    widgetKeyA = channelA.widgetPublicKey;

    await prisma.plivoNumber.create({
      data: {
        organizationId: orgAId,
        phoneNumber: '+918045689901',
        city: 'Bengaluru',
        isPrimary: true,
      },
    });

    const propA = await prisma.property.create({
      data: {
        organizationId: orgAId,
        title: 'Emerald Horizon Residences',
        address: '12th Main, Indiranagar',
        city: 'Bengaluru',
        microMarket: 'Indiranagar',
        builderName: 'Emerald Builders',
        reraNumber: 'PRM/KA/RERA/1251/446/PR/999',
        possessionStatus: 'READY_TO_MOVE',
        price: 18500000,
        bedrooms: 3,
        bathrooms: 3,
        propertyType: 'APARTMENT',
        status: 'AVAILABLE',
        brochureUrl: 'https://cdn.example.com/emerald-brochure.pdf',
        mapsUrl: 'https://maps.google.com/?q=12.9716,77.6412',
        latitude: 12.9716,
        longitude: 77.6412,
      },
    });
    propertyAId = propA.id;

    const leadA = await prisma.lead.create({
      data: {
        organizationId: orgAId,
        fullName: 'Riya Kapoor',
        phone: '+919988776655',
        source: 'WHATSAPP',
      },
    });
    leadAId = leadA.id;

    const threadA = await prisma.conversationThread.create({
      data: {
        organizationId: orgAId,
        leadId: leadA.id,
        channel: 'WHATSAPP',
        state: 'AUTOPILOT',
        autoReplyEnabled: true,
      },
    });
    threadAId = threadA.id;
  });

  afterAll(async () => {
    await prisma.agentRunTrace.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.voiceCallSession.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.campaignEnrollment.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.campaign.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.conversationMessage.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.conversationThread.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.lead.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.plivoNumber.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organizationChannel.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await prisma.$disconnect();
  });

  it('routes buyer intents to the correct specialist and enforces voice/commercial guardrails', () => {
    expect(isOptOutOrDnd('Please stop calling me, put me on DND')).toBe(true);

    const closerDirective = routeToSpecialist({
      organizationId: orgAId,
      leadId: leadAId,
      threadId: threadAId,
      channel: 'VOICE_CALL',
      currentStage: 'MATCHED',
      customerMessage: 'Can we book a site visit this Saturday at 11am?',
      hasRequirements: true,
      matchedCount: 1,
    });
    expect(closerDirective.specialist).toBe('CLOSER');
    expect(closerDirective.intent).toBe('SCHEDULING_VISIT');

    const guardrail = verifyAgentOutput({
      draftText: '**Great!** We guarantee 10% discount on this unit.',
      verifiedPropertyTitles: ['Emerald Horizon Residences'],
      hasCollateralToolSuccess: false,
      channel: 'VOICE_CALL',
    });
    expect(guardrail.flags).toContain('COMMERCIAL_POLICY_SOFTENED');
    expect(guardrail.flags).toContain('VOICE_FORMAT_NORMALIZED');
    expect(guardrail.finalText).not.toContain('**');
    expect(guardrail.finalText).not.toContain('guarantee 10% discount');
  });

  it('grounds DB fallback strictly in the tenant database with zero hardcoded Bengaluru projects', async () => {
    // Org B has zero properties: must not mention Prestige/Brigade/Godrej
    const leadB = await prisma.lead.create({
      data: { organizationId: orgBId, fullName: 'Test Buyer B', phone: '+919900001111' },
    });
    const threadB = await prisma.conversationThread.create({
      data: { organizationId: orgBId, leadId: leadB.id, channel: 'WEB_WIDGET', state: 'AUTOPILOT', autoReplyEnabled: true },
    });

    const emptyOrgRes = await runSalesAgentLoop({
      leadId: leadB.id,
      organizationId: orgBId,
      threadId: threadB.id,
      customerMessage: 'Looking for 3BHK in Whitefield under 2 Cr',
      channel: 'WEB_WIDGET',
    });
    expect(emptyOrgRes.response).not.toMatch(/Prestige|Brigade|Godrej|Sobha/i);
    expect(emptyOrgRes.matchedProperties).toHaveLength(0);

    // Org A has Emerald Horizon Residences: must surface only Org A's DB listing
    const orgARes = await runSalesAgentLoop({
      leadId: leadAId,
      organizationId: orgAId,
      threadId: threadAId,
      customerMessage: 'Looking for a 3BHK flat',
      channel: 'WHATSAPP',
    });
    expect(orgARes.response).toContain('Emerald Horizon Residences');
    expect(orgARes.response).not.toMatch(/Prestige|Brigade/i);
  });

  it('executes send_property_collateral and query_project_knowledge tools safely', async () => {
    const colRes = await executeAgentTool(
      'send_property_collateral',
      { leadId: leadAId, propertyId: propertyAId, includeBrochure: true, includeLocationPin: true },
      { organizationId: orgAId, leadId: leadAId, threadId: threadAId },
    );
    expect(colRes.status).toBe('SUCCESS');
    expect((colRes.data as any).sent).toBe(true);
    expect((colRes.data as any).dispatchedItems).toContain('brochure_pdf');
    expect((colRes.data as any).dispatchedItems).toContain('whatsapp_location_pin');

    const kbRes = await executeAgentTool(
      'query_project_knowledge',
      { query: 'RERA possession status Emerald', propertyId: propertyAId },
      { organizationId: orgAId, leadId: leadAId, threadId: threadAId },
    );
    expect(kbRes.status).toBe('SUCCESS');
    expect((kbRes.data as any).propertiesKnowledge[0].reraNumber).toBe('PRM/KA/RERA/1251/446/PR/999');
  });

  it('routes WhatsApp inbound messages dynamically to the matching OrganizationChannel', async () => {
    const channelA = await prisma.organizationChannel.findUnique({ where: { organizationId: orgAId } });
    const waPhone = '919811122233';
    const msgId = `wamid.mt.${Date.now()}`;

    const res = await request(app).post('/api/inbound/whatsapp').send({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: channelA!.whatsappPhoneNumberId },
                contacts: [{ profile: { name: 'Karan Mehta' }, wa_id: waPhone }],
                messages: [
                  {
                    from: waPhone,
                    id: msgId,
                    type: 'text',
                    text: { body: 'Hi, is 3BHK in Indiranagar available?' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(res.status).toBe(200);

    let createdLead = null;
    for (let i = 0; i < 20; i++) {
      createdLead = await prisma.lead.findFirst({
        where: { organizationId: orgAId, phone: waPhone },
      });
      if (createdLead) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(createdLead).not.toBeNull();
    expect(createdLead?.fullName).toBe('Karan Mehta');

    const wrongOrgLead = await prisma.lead.findFirst({
      where: { organizationId: orgBId, phone: waPhone },
    });
    expect(wrongOrgLead).toBeNull();
  });

  it('serves embeddable website widget SDK, enforces Origin allowlist, and captures visitor chat', async () => {
    const blockedRes = await request(app)
      .post('/api/public/widget/session')
      .set('Origin', 'https://evil-site.example')
      .send({ widgetKey: widgetKeyA });
    expect(blockedRes.status).toBe(403);

    const sessionRes = await request(app)
      .post('/api/public/widget/session')
      .set('Origin', 'https://alpharealty.com')
      .send({ widgetKey: widgetKeyA, pageUrl: 'https://alpharealty.com/listings' });
    expect(sessionRes.status).toBe(201);
    expect(sessionRes.body.token).toBeTruthy();

    const msgRes = await request(app)
      .post('/api/public/widget/messages')
      .set('Authorization', `Bearer ${sessionRes.body.token}`)
      .send({ content: 'Looking for a 3BHK apartment' });
    expect(msgRes.status).toBe(201);
    expect(msgRes.body.reply).toContain('Emerald Horizon Residences');

    const jsRes = await request(app).get('/api/public/widget/widget.js');
    expect(jsRes.status).toBe(200);
    expect(jsRes.text).toContain('attachShadow');
  });

  it('handles Plivo inbound calls, AMD voicemail drop, warm transfer XML, and DB-backed campaigns', async () => {
    const inboundRes = await request(app)
      .post('/api/webhooks/plivo/inbound')
      .send({ From: '+919822334455', To: '+918045689901', CallUUID: `plivo-in-test-${Date.now()}` });
    expect(inboundRes.status).toBe(200);
    expect(inboundRes.headers['content-type']).toContain('xml');
    expect(inboundRes.text).toContain('<Stream bidirectional="true"');
    expect(inboundRes.text).toContain('/ws/plivo/');

    const transferXml = plivoService.buildWarmTransferXml({
      advisorPhone: '+919800011122',
      callerId: '+918045689901',
      whisperUrl: 'https://api.example.com/whisper',
      fallbackUrl: 'https://api.example.com/fallback',
    });
    expect(transferXml).toContain('<Dial');
    expect(transferXml).toContain('confirmSound=');

    const importRes = await request(app)
      .post('/api/campaigns/import')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        leads: [{ fullName: 'Suresh Raina', phone: '9876543219', preferredLocation: 'Indiranagar' }],
      });
    expect(importRes.status).toBe(200);
    expect(importRes.body.importedCount).toBe(1);

    await walletService.depositCredits(orgAId, 500);

    const startRes = await request(app)
      .post('/api/campaigns/start')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ concurrencyTrunks: 5 });
    expect(startRes.status).toBe(200);
    expect(startRes.body.dispatched.dialed).toBeGreaterThanOrEqual(1);
  });

  it('auto-provisions zero-balance wallet, channel registry, Plivo KYC/DID, and Coexistence echo takeover on onboarding', async () => {
    const uniqueEmail = `cp-owner-${Date.now()}@brokerage.test`;
    const regRes = await request(app)
      .post('/api/auth/register-org')
      .send({
        ownerName: 'Arjun Nair',
        email: uniqueEmail,
        password: 'Password123!',
        ownerPhone: '+919845099887',
        organizationName: 'Skyline Channel Partners',
        stateJurisdiction: 'KA',
        planTier: 'TEAM',
      });
    expect(regRes.status).toBe(201);
    const newToken = regRes.body.token as string;
    const newOrgId = regRes.body.organization.id as string;
    const newUserId = regRes.body.user.id as string;

    try {
      // 1. Wallet starts at $0 (no free $500 leak)
      const onbRes = await request(app)
        .get('/api/org/onboarding')
        .set('Authorization', `Bearer ${newToken}`);
      expect(onbRes.status).toBe(200);
      expect(onbRes.body.walletBalance).toBe(0);
      expect(onbRes.body.checklist.hasAdvisorPhone).toBe(true);

      // 2. Branding & advisor phone update persist cleanly
      const brandRes = await request(app)
        .patch('/api/org/branding')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ organizationName: 'Skyline Realty Pro', defaultCurrency: 'INR' });
      expect(brandRes.status).toBe(200);
      expect(brandRes.body.organizationName).toBe('Skyline Realty Pro');

      const phoneRes = await request(app)
        .patch(`/api/org/members/${newUserId}/phone`)
        .set('Authorization', `Bearer ${newToken}`)
        .send({ phone: '9845011223' });
      expect(phoneRes.status).toBe(200);
      expect(phoneRes.body.phone).toBe('+919845011223');

      // 3. Plivo India KYC + DID provisioning
      const kycRes = await request(app)
        .post('/api/org/plivo/compliance')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          legalEntityName: 'Skyline Realty Pvt Ltd',
          documentType: 'GST_CERTIFICATE',
          registrationNumber: '29AABCU9603R1ZM',
          authorizedSignatoryName: 'Arjun Nair',
          businessAddress: 'MG Road, Bengaluru',
          city: 'Bengaluru',
        });
      expect(kycRes.status).toBe(200);
      expect(kycRes.body.status).toBe('ACCEPTED');

      const didRes = await request(app)
        .post('/api/org/plivo/provision-number')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ city: 'Bengaluru' });
      expect(didRes.status).toBe(200);
      expect(didRes.body.number.phoneNumber).toMatch(/^\+91/);
      expect(didRes.body.callForwardingCode).toContain('*21*');

      // 4. WhatsApp Embedded Signup + Coexistence mobile-app echo auto-takeover
      const waPhoneId = `wa_coex_${Date.now()}`;
      const waConnectRes = await request(app)
        .post('/api/org/whatsapp/embedded-signup')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          phoneNumberId: waPhoneId,
          wabaId: `waba_${Date.now()}`,
          whatsappProvider: 'COEXISTENCE',
        });
      expect(waConnectRes.status).toBe(200);
      expect(waConnectRes.body.whatsappProvider).toBe('COEXISTENCE');

      const buyerPhone = '919800055443';
      const lead = await prisma.lead.create({
        data: {
          organizationId: newOrgId,
          fullName: 'Neha Verma',
          phone: buyerPhone,
          source: 'WHATSAPP',
        },
      });
      await prisma.conversationThread.create({
        data: {
          organizationId: newOrgId,
          leadId: lead.id,
          channel: 'WHATSAPP',
          state: 'AUTOPILOT',
          autoReplyEnabled: true,
        },
      });

      const echoRes = await request(app).post('/api/webhooks/whatsapp').send({
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'smb_message_echoes',
                value: {
                  metadata: { phone_number_id: waPhoneId },
                  message_echoes: [
                    {
                      id: `wamid.echo.${Date.now()}`,
                      to: buyerPhone,
                      type: 'text',
                      text: { body: 'Hey Neha, Arjun here—calling you in 5 mins.' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
      expect(echoRes.status).toBe(200);

      let updatedThread = null;
      for (let i = 0; i < 20; i++) {
        updatedThread = await prisma.conversationThread.findFirst({
          where: { leadId: lead.id, organizationId: newOrgId },
        });
        if (updatedThread?.isHumanTakeover) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(updatedThread?.isHumanTakeover).toBe(true);
      expect(updatedThread?.state).toBe('HUMAN_TAKEOVER');

      // 5. Razorpay Subscription Order (auto-crediting included plan wallet credits) + Wallet Top-up
      const planOrderRes = await request(app)
        .post('/api/billing/razorpay/create-order')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ type: 'SUBSCRIPTION_PLAN', plan: 'TEAM', isAnnual: false });
      expect(planOrderRes.status).toBe(201);
      expect(planOrderRes.body.amountPaise).toBe(2199900);

      const planVerifyRes = await request(app)
        .post('/api/billing/razorpay/verify')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          razorpay_order_id: planOrderRes.body.orderId,
          razorpay_payment_id: 'pay_plan_team_123',
          razorpay_signature: 'sim_sig',
          type: 'SUBSCRIPTION_PLAN',
          plan: 'TEAM',
          isAnnual: false,
        });
      expect(planVerifyRes.status).toBe(200);
      expect(planVerifyRes.body.verified).toBe(true);
      expect(planVerifyRes.body.subscriptionTier).toBe('TEAM');
      expect(planVerifyRes.body.subscriptionStatus).toBe('ACTIVE');
      expect(planVerifyRes.body.includedCreditsInr).toBe(19200);
      expect(planVerifyRes.body.newBalance).toBe(19200);

      // Re-verifying the same plan payment must be idempotent for wallet credits
      const duplicatePlanVerify = await request(app)
        .post('/api/billing/razorpay/verify')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          razorpay_order_id: planOrderRes.body.orderId,
          razorpay_payment_id: 'pay_plan_team_123',
          razorpay_signature: 'sim_sig',
          type: 'SUBSCRIPTION_PLAN',
          plan: 'TEAM',
          isAnnual: false,
        });
      expect(duplicatePlanVerify.status).toBe(200);
      expect(duplicatePlanVerify.body.newBalance).toBe(19200);

      const orderRes = await request(app)
        .post('/api/billing/razorpay/create-order')
        .set('Authorization', `Bearer ${newToken}`)
        .send({ type: 'WALLET_TOPUP', amountInr: 2500 });
      expect(orderRes.status).toBe(201);
      expect(orderRes.body.amountPaise).toBe(250000);
      expect(orderRes.body.currency).toBe('INR');

      const badVerify = await request(app)
        .post('/api/billing/razorpay/verify')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          razorpay_order_id: orderRes.body.orderId,
          razorpay_payment_id: 'pay_test_123',
          razorpay_signature: 'invalid_sig',
          type: 'WALLET_TOPUP',
          amountInr: 2500,
        });
      expect(badVerify.status).toBe(400);

      const goodVerify = await request(app)
        .post('/api/billing/razorpay/verify')
        .set('Authorization', `Bearer ${newToken}`)
        .send({
          razorpay_order_id: orderRes.body.orderId,
          razorpay_payment_id: 'pay_test_123',
          razorpay_signature: 'sim_sig',
          type: 'WALLET_TOPUP',
          amountInr: 2500,
        });
      expect(goodVerify.status).toBe(200);
      expect(goodVerify.body.verified).toBe(true);
      expect(goodVerify.body.newBalance).toBe(21700);
    } finally {
      await prisma.walletLedgerEntry.deleteMany({ where: { wallet: { organizationId: newOrgId } } });
      await prisma.conversationMessage.deleteMany({ where: { organizationId: newOrgId } });
      await prisma.conversationThread.deleteMany({ where: { organizationId: newOrgId } });
      await prisma.lead.deleteMany({ where: { organizationId: newOrgId } });
      await prisma.plivoNumber.deleteMany({ where: { organizationId: newOrgId } });
      await prisma.organizationWallet.deleteMany({ where: { organizationId: newOrgId } });
      await prisma.organizationChannel.deleteMany({ where: { organizationId: newOrgId } });
      await prisma.user.deleteMany({ where: { organizationId: newOrgId } });
      await prisma.organization.deleteMany({ where: { id: newOrgId } });
    }
  });

  it('provisions PENDING_PAYMENT workspace on first Google sign-in and activates it via workspace-profile + Razorpay', async () => {
    const email = `google-owner-${Date.now()}@gmail.com`;
    const session = await completeSignIn({
      googleId: `google-sub-${Date.now()}`,
      email,
      name: 'Rohan Mehta',
      pictureUrl: null,
    });
    const orgId = session.user.organizationId;

    try {
      expect(session.isNewWorkspace).toBe(true);
      expect(session.user.role).toBe('OWNER');
      expect(session.user.subscriptionStatus).toBe('PENDING_PAYMENT');

      const profileRes = await request(app)
        .patch('/api/org/workspace-profile')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ organizationName: 'Mehta Estates', stateJurisdiction: 'MH', planTier: 'SOLO' });
      expect(profileRes.status).toBe(200);
      expect(profileRes.body.organization.name).toBe('Mehta Estates');
      expect(profileRes.body.organization.stateJurisdiction).toBe('MH');
      expect(profileRes.body.organization.subscriptionTier).toBe('SOLO');

      const orderRes = await request(app)
        .post('/api/billing/razorpay/create-order')
        .set('Authorization', `Bearer ${session.token}`)
        .send({ type: 'SUBSCRIPTION_PLAN', plan: 'SOLO', isAnnual: false });
      expect(orderRes.status).toBe(201);

      const verifyRes = await request(app)
        .post('/api/billing/razorpay/verify')
        .set('Authorization', `Bearer ${session.token}`)
        .send({
          razorpay_order_id: orderRes.body.orderId,
          razorpay_payment_id: `pay_solo_${Date.now()}`,
          razorpay_signature: 'sim_sig',
          type: 'SUBSCRIPTION_PLAN',
          plan: 'SOLO',
          isAnnual: false,
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.subscriptionStatus).toBe('ACTIVE');
      expect(verifyRes.body.includedCreditsInr).toBe(6000);
      expect(verifyRes.body.newBalance).toBe(6000);

      // Verify fair 30s pulse billing (25s connected call -> ₹7.50 at ₹15/min)
      const pulseTx = await walletService.deductVoiceCall(orgId, 25, { leadName: 'Pulse Check' });
      expect(pulseTx?.amount).toBe(-7.5);
      expect(pulseTx?.balanceAfter).toBe(5992.5);
    } finally {
      await prisma.walletLedgerEntry.deleteMany({ where: { wallet: { organizationId: orgId } } });
      await prisma.organizationWallet.deleteMany({ where: { organizationId: orgId } });
      await prisma.organizationChannel.deleteMany({ where: { organizationId: orgId } });
      await prisma.user.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
  });
});
