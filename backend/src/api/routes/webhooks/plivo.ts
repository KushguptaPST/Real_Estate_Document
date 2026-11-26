// ─────────────────────────────────────────────────────────────────────────────
// /api/webhooks/plivo — Inbound & Outbound Plivo Voice Call Lifecycle Webhooks
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../../utils/prisma.js';
import { logger } from '../../../utils/logger.js';
import { plivoService, sanitizeE164Phone } from '../../../services/telephony/plivo.service.js';
import { resolveOrgByPlivoNumber } from '../../../services/channelRegistry.service.js';
import { whatsAppService } from '../../../services/messaging/whatsapp.service.js';

const router = Router();

function buildStreamWsUrl(req: Request, sessionId: string): string {
  const configuredBase = process.env['PLIVO_STREAM_BASE_URL'];
  if (configuredBase) {
    return `${configuredBase.replace(/\/$/, '')}/ws/plivo/${sessionId}`;
  }
  const proto = (req.header('x-forwarded-proto') || req.protocol) === 'https' ? 'wss' : 'ws';
  const host = req.header('x-forwarded-host') || req.get('host') || 'localhost:3001';
  return `${proto}://${host}/ws/plivo/${sessionId}`;
}

function buildPublicHttpBase(req: Request): string {
  const proto = req.header('x-forwarded-proto') || req.protocol || 'http';
  const host = req.header('x-forwarded-host') || req.get('host') || 'localhost:3001';
  return `${proto}://${host}`;
}

// ── 1. POST /api/webhooks/plivo/inbound — AI answers incoming buyer calls ─────
router.post('/inbound', async (req: Request, res: Response) => {
  const fromRaw = String(req.body?.From || req.query['From'] || '');
  const toRaw = String(req.body?.To || req.query['To'] || '');
  const callUuid = String(req.body?.CallUUID || req.query['CallUUID'] || `plivo-in-${Date.now()}`);

  const callerPhone = sanitizeE164Phone(fromRaw);
  const dialedPhone = sanitizeE164Phone(toRaw);

  const resolvedOrg = await resolveOrgByPlivoNumber(dialedPhone);
  if (!resolvedOrg) {
    res.type('application/xml').send(
      plivoService.buildVoicemailDropXml('Thank you for calling. Our advisors are currently unavailable.'),
    );
    return;
  }

  const orgId = resolvedOrg.organizationId;
  const phoneDigits = callerPhone.replace(/[^\d]/g, '');

  let lead = await prisma.lead.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ phone: callerPhone }, ...(phoneDigits ? [{ phone: phoneDigits }] : [])],
    },
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        fullName: `Caller ${callerPhone.slice(-4) || 'Unknown'}`,
        phone: callerPhone || phoneDigits,
        source: 'VOICE_CALL',
        status: 'NEW',
        stage: 'NEW_INBOUND',
        priority: 'HIGH',
      },
    });
  }

  const session = await prisma.voiceCallSession.upsert({
    where: { callUuid },
    create: {
      organizationId: orgId,
      leadId: lead.id,
      callUuid,
      direction: 'INBOUND',
      fromNumber: callerPhone,
      toNumber: dialedPhone,
      status: 'RINGING',
    },
    update: { status: 'RINGING' },
  });

  const firstName = lead.fullName.split(' ')[0];
  const greeting =
    firstName && !lead.fullName.startsWith('Caller ')
      ? `Hi ${firstName}, thanks for calling back! How can I help with your property search today?`
      : 'Hi, thanks for calling! I am the AI property advisor. Which location and budget are you looking at?';

  const xml = plivoService.buildStreamAnswerXml({
    streamWsUrl: buildStreamWsUrl(req, session.id),
    greetingText: greeting,
  });

  logger.info(`[Plivo Inbound] Connected call ${callUuid} -> session ${session.id} (org ${orgId})`);
  res.type('application/xml').send(xml);
});

// ── 2. POST /api/webhooks/plivo/answer/:sessionId — Outbound call answered ────
router.post('/answer/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params['sessionId'];
  const machineDetection = String(req.body?.Machine || req.query['Machine'] || '').toLowerCase();

  const session = await prisma.voiceCallSession.findUnique({
    where: { id: sessionId },
    include: { lead: true },
  });

  if (!session) {
    res.type('application/xml').send(plivoService.buildVoicemailDropXml('Thank you, goodbye.'));
    return;
  }

  // Handle Answering Machine Detection (AMD)
  if (machineDetection === 'true' || machineDetection === 'machine') {
    await prisma.voiceCallSession.update({
      where: { id: session.id },
      data: { amdResult: 'MACHINE', outcome: 'VOICEMAIL', status: 'COMPLETED' },
    });

    if (session.campaignId && session.leadId) {
      await prisma.campaignEnrollment.updateMany({
        where: { campaignId: session.campaignId, leadId: session.leadId },
        data: { status: 'VOICEMAIL', lastAmdResult: 'MACHINE' },
      });
      await prisma.campaign.update({
        where: { id: session.campaignId },
        data: { voicemailsDetected: { increment: 1 } },
      }).catch(() => {});
    }

    const leadName = session.lead?.fullName?.split(' ')[0] || 'there';
    if (session.lead?.phone) {
      whatsAppService
        .sendTextMessage(
          session.lead.phone,
          `Hi ${leadName}, tried calling regarding your property inquiry. Let me know your preferred area & budget here on WhatsApp and I can send brochures right away!`,
        )
        .catch(() => {});
    }

    res.type('application/xml').send(
      plivoService.buildVoicemailDropXml(
        `Hi ${leadName}, calling regarding your property inquiry. I have dropped a quick message on your WhatsApp as well. Talk soon!`,
      ),
    );
    return;
  }

  await prisma.voiceCallSession.update({
    where: { id: session.id },
    data: { amdResult: 'HUMAN', status: 'IN_PROGRESS' },
  });

  if (session.campaignId && session.leadId) {
    await prisma.campaignEnrollment.updateMany({
      where: { campaignId: session.campaignId, leadId: session.leadId },
      data: { status: 'CONNECTED', lastAmdResult: 'HUMAN' },
    });
    await prisma.campaign.update({
      where: { id: session.campaignId },
      data: { liveHumansConnected: { increment: 1 } },
    }).catch(() => {});
  }

  const firstName = session.lead?.fullName?.split(' ')[0] || 'there';
  const greeting = `Hi ${firstName}, calling regarding your property inquiry. Could you share which micro-market, budget, and configuration you are looking for?`;

  const xml = plivoService.buildStreamAnswerXml({
    streamWsUrl: buildStreamWsUrl(req, session.id),
    greetingText: greeting,
  });

  res.type('application/xml').send(xml);
});

// ── 3. POST /api/webhooks/plivo/hangup/:sessionId ────────────────────────────
router.post('/hangup/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params['sessionId'];
  const duration = Number(req.body?.Duration || req.body?.BillDuration || 0);
  const hangupCause = String(req.body?.HangupCause || '');
  const recordingUrl = req.body?.RecordUrl ? String(req.body.RecordUrl) : undefined;

  const session = await prisma.voiceCallSession.findUnique({ where: { id: sessionId } });
  if (session) {
    const mappedStatus =
      hangupCause === 'NO_ANSWER' || hangupCause === 'ORIGINATOR_CANCEL'
        ? 'NO_ANSWER'
        : hangupCause === 'USER_BUSY'
        ? 'BUSY'
        : 'COMPLETED';

    await prisma.voiceCallSession.update({
      where: { id: session.id },
      data: {
        status: session.status === 'TRANSFERRED' ? 'TRANSFERRED' : mappedStatus,
        durationSeconds: Math.max(session.durationSeconds, duration),
        ...(recordingUrl ? { recordingUrl } : {}),
        endedAt: new Date(),
      },
    });
  }

  res.status(200).json({ ok: true });
});

// ── 4. GET/POST /api/webhooks/plivo/whisper — 5s Advisor Whisper ─────────────
router.all('/whisper', (req: Request, res: Response) => {
  const text = String(req.query['text'] || req.body?.text || 'Incoming warm transfer from AI sales advisor.');
  res.type('application/xml').send(plivoService.buildWhisperXml(text));
});

// ── 4b. POST /api/webhooks/plivo/transfer/:sessionId — Warm Transfer <Dial> ───
router.post('/transfer/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params['sessionId']!;
  const advisorPhone = String(req.query['advisorPhone'] || req.body?.advisorPhone || '');
  const callerId = String(req.query['callerId'] || process.env['PLIVO_FROM_NUMBER'] || '+918000000000');
  const whisper = String(req.query['whisper'] || 'Incoming warm transfer from AI sales advisor.');

  if (!advisorPhone) {
    res.type('application/xml').send(
      plivoService.buildStreamAnswerXml({
        streamWsUrl: buildStreamWsUrl(req, sessionId),
        greetingText: 'Let me take your callback details for our senior advisor.',
      }),
    );
    return;
  }

  const base = buildPublicHttpBase(req);
  const xml = plivoService.buildWarmTransferXml({
    advisorPhone,
    callerId,
    whisperUrl: `${base}/api/webhooks/plivo/whisper?text=${encodeURIComponent(whisper)}`,
    fallbackUrl: `${base}/api/webhooks/plivo/transfer-fallback/${sessionId}`,
  });
  res.type('application/xml').send(xml);
});

// ── 5. POST /api/webhooks/plivo/transfer-fallback/:sessionId ─────────────────
router.post('/transfer-fallback/:sessionId', (req: Request, res: Response) => {
  const sessionId = req.params['sessionId']!;
  const dialStatus = String(req.body?.DialBLegStatus || '');
  if (dialStatus === 'completed' || dialStatus === 'answer') {
    res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>');
    return;
  }

  const xml = plivoService.buildStreamAnswerXml({
    streamWsUrl: buildStreamWsUrl(req, sessionId),
    greetingText:
      'Our senior advisor is currently on site with another client. Would you like me to lock a callback slot or a weekend walkthrough for you?',
    statusCallbackUrl: `${buildPublicHttpBase(req)}/api/webhooks/plivo/hangup/${sessionId}`,
  });
  res.type('application/xml').send(xml);
});

export default router;
