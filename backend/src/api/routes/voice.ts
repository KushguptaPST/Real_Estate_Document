import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { walletService } from '../../services/billing/wallet.service.js';
import { plivoService, sanitizeE164Phone } from '../../services/telephony/plivo.service.js';

const router = Router();
router.use(requireAuth);

const TestCallSchema = z.object({
  phone: z.string().min(8, 'Valid phone number is required'),
});

const OutboundCallSchema = z.object({
  leadId: z.string().min(1, 'Lead ID is required'),
  phone: z.string().min(8, 'Phone number is required'),
  fromNumber: z.string().optional(),
});

const TransferCallSchema = z.object({
  callUuid: z.string().min(1, 'Call UUID is required'),
  leadId: z.string().min(1, 'Lead ID is required'),
  advisorPhone: z.string().min(8, 'Advisor phone number is required'),
  advisorName: z.string().optional(),
});

const VoicePreviewSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  advisorName: z.string().optional(),
  leadName: z.string().optional(),
});

function getPublicBase(req: Request): string {
  const configured = process.env['APP_PUBLIC_URL'] || process.env['API_PUBLIC_URL'];
  if (configured) return configured.replace(/\/$/, '');
  const proto = req.header('x-forwarded-proto') || req.protocol || 'http';
  const host = req.header('x-forwarded-host') || req.get('host') || 'localhost:3001';
  return `${proto}://${host}`;
}

// POST /api/voice/plivo/test-call — live or simulated Plivo test dialer
router.post(
  '/plivo/test-call',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = TestCallSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid phone number', 400);
    }

    const cleanPhone = sanitizeE164Phone(parsed.data.phone);
    const orgId = req.user!.organizationId;
    const plivoNum = await prisma.plivoNumber.findFirst({
      where: { organizationId: orgId, isActive: true },
      orderBy: { isPrimary: 'desc' },
    });
    const fromNumber = plivoNum?.phoneNumber || process.env['PLIVO_FROM_NUMBER'] || '+918000000000';

    const session = await prisma.voiceCallSession.create({
      data: {
        organizationId: orgId,
        callUuid: `plivo-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        direction: 'OUTBOUND',
        fromNumber,
        toNumber: cleanPhone,
        status: 'INITIATED',
      },
    });

    const baseUrl = getPublicBase(req);
    const plivoRes = await plivoService.originateCall({
      from: fromNumber,
      to: cleanPhone,
      answerUrl: `${baseUrl}/api/webhooks/plivo/answer/${session.id}`,
      hangupUrl: `${baseUrl}/api/webhooks/plivo/hangup/${session.id}`,
      machineDetectionUrl: `${baseUrl}/api/webhooks/plivo/answer/${session.id}`,
    });

    if (!plivoRes.success) {
      await prisma.voiceCallSession.update({
        where: { id: session.id },
        data: { status: 'FAILED', summary: plivoRes.error },
      });
      throw createError(plivoRes.error || 'Plivo call origination failed', 502);
    }

    const callUuid = plivoRes.callUuid || session.callUuid;
    await prisma.voiceCallSession.update({
      where: { id: session.id },
      data: { callUuid, status: plivoRes.isSimulated ? 'COMPLETED' : 'RINGING' },
    });

    if (plivoRes.isSimulated) {
      await walletService.deductVoiceCall(orgId, 60, { leadName: 'Sandbox Test Dialer' }).catch(() => {});
    }

    res.json({
      success: true,
      sessionId: session.id,
      callUuid,
      isSimulated: Boolean(plivoRes.isSimulated),
      message: plivoRes.isSimulated
        ? `Simulated Plivo call created (${cleanPhone}). Configure PLIVO_AUTH_ID & PLIVO_AUTH_TOKEN to ring real phones.`
        : `Live Plivo call initiated! ${cleanPhone} will ring shortly.`,
    });
  }),
);

// POST /api/voice/plivo/outbound — speed-to-lead outbound call
router.post(
  '/plivo/outbound',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = OutboundCallSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid call parameters', 400);
    }

    const { leadId, phone, fromNumber: requestedFrom } = parsed.data;
    const cleanPhone = sanitizeE164Phone(phone);
    const orgId = req.user!.organizationId;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
    });
    if (!lead) {
      throw createError('Lead not found', 404);
    }
    if (lead.doNotCall) {
      throw createError('Lead is marked Do Not Call (DND)', 409);
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { isSuspended: true },
    });
    if (org?.isSuspended) {
      throw createError('Workspace is suspended; outbound calls are disabled', 403);
    }
    await walletService.ensureSufficientBalance(orgId, 12);

    const plivoNum = await prisma.plivoNumber.findFirst({
      where: { organizationId: orgId, isActive: true },
      orderBy: { isPrimary: 'desc' },
    });
    const fromNumber = requestedFrom || plivoNum?.phoneNumber || process.env['PLIVO_FROM_NUMBER'] || '+918000000000';

    const session = await prisma.voiceCallSession.create({
      data: {
        organizationId: orgId,
        leadId: lead.id,
        callUuid: `plivo-out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        direction: 'OUTBOUND',
        fromNumber,
        toNumber: cleanPhone,
        status: 'INITIATED',
      },
    });

    const baseUrl = getPublicBase(req);
    const plivoRes = await plivoService.originateCall({
      from: fromNumber,
      to: cleanPhone,
      answerUrl: `${baseUrl}/api/webhooks/plivo/answer/${session.id}`,
      hangupUrl: `${baseUrl}/api/webhooks/plivo/hangup/${session.id}`,
      machineDetectionUrl: `${baseUrl}/api/webhooks/plivo/answer/${session.id}`,
    });

    if (!plivoRes.success) {
      await prisma.voiceCallSession.update({
        where: { id: session.id },
        data: { status: 'FAILED', summary: plivoRes.error },
      });
      throw createError(plivoRes.error || 'Plivo outbound call failed', 502);
    }

    const callUuid = plivoRes.callUuid || session.callUuid;
    await prisma.voiceCallSession.update({
      where: { id: session.id },
      data: { callUuid, status: plivoRes.isSimulated ? 'COMPLETED' : 'RINGING' },
    });

    await prisma.leadCallLog.create({
      data: {
        leadId: lead.id,
        organizationId: orgId,
        userId: req.user!.id,
        direction: 'OUTBOUND',
        outcome: 'CONNECTED',
        durationSeconds: plivoRes.isSimulated ? 60 : 0,
        notes: `Plivo AI Speed-to-Lead call (${callUuid}) ${plivoRes.isSimulated ? '[simulated]' : '[live]'}.`,
      },
    });

    res.json({
      success: true,
      sessionId: session.id,
      callUuid,
      isSimulated: Boolean(plivoRes.isSimulated),
      message: `Plivo AI call initiated to ${lead.fullName} (${cleanPhone})`,
    });
  }),
);

// POST /api/voice/plivo/transfer — live warm transfer to human broker
router.post(
  '/plivo/transfer',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = TransferCallSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid transfer parameters', 400);
    }

    const { callUuid, leadId, advisorPhone, advisorName } = parsed.data;
    const orgId = req.user!.organizationId;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId: orgId },
      include: { requirements: true },
    });
    if (!lead) throw createError('Lead not found', 404);

    const session = await prisma.voiceCallSession.findFirst({
      where: { callUuid, organizationId: orgId },
    });

    const baseUrl = getPublicBase(req);
    const whisperText = `Warm transfer for ${lead.fullName}. Preferred areas: ${lead.requirements?.preferredLocations?.join(', ') || 'TBD'}.`;
    const transferXmlUrl = `${baseUrl}/api/webhooks/plivo/transfer/${session?.id || 'live'}?advisorPhone=${encodeURIComponent(advisorPhone)}&whisper=${encodeURIComponent(whisperText)}`;

    const transferRes = await plivoService.transferActiveCall(callUuid, transferXmlUrl);
    if (!transferRes.success) {
      throw createError(transferRes.error || 'Plivo call transfer failed', 502);
    }

    if (session) {
      await prisma.voiceCallSession.update({
        where: { id: session.id },
        data: { status: 'TRANSFERRED', outcome: 'WARM_TRANSFER' },
      });
    }

    await prisma.leadCallLog.create({
      data: {
        leadId,
        organizationId: orgId,
        userId: req.user!.id,
        direction: 'OUTBOUND',
        outcome: 'CONNECTED',
        durationSeconds: 180,
        notes: `Plivo live warm transfer to advisor ${advisorName || advisorPhone} (${callUuid}).`,
      },
    });

    res.json({
      success: true,
      isSimulated: Boolean(transferRes.isSimulated),
      message: `Warm transfer initiated to ${advisorName || advisorPhone}.`,
    });
  }),
);

// GET /api/voice/sessions — list recent Plivo call sessions for organization
router.get(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    const sessions = await prisma.voiceCallSession.findMany({
      where: { organizationId: req.user!.organizationId },
      include: { lead: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(sessions);
  }),
);

// POST /api/voice/notes/preview — Neural speech synthesis preview for voice notes
router.post(
  '/notes/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = VoicePreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid voice preview payload', 400);
    }

    const { text } = parsed.data;
    const cleanText = text
      .replace(/[*_#`~>]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1000);

    if (!cleanText) {
      throw createError('No speakable text provided', 400);
    }

    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata('en-IN-NeerjaExpressiveNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(cleanText);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        audioStream.on('data', (c: any) => chunks.push(Buffer.from(c)));
        audioStream.on('end', () => resolve());
        audioStream.on('error', (err: any) => reject(err));
      });

      if (chunks.length > 0) {
        const audioBuffer = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(audioBuffer);
        return;
      }
    } catch (err: any) {
      logger.warn(`[Voice Preview] MsEdgeTTS notice: ${err.message}. Trying Google TTS fallback.`);
    }

    try {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText.slice(0, 200))}&tl=en&client=tw-ob`;
      const ttsRes = await fetch(ttsUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
      if (ttsRes.ok) {
        const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        res.send(audioBuffer);
        return;
      }
    } catch (e: any) {
      logger.warn(`[Voice Preview] Google TTS fallback failed: ${e.message}`);
    }

    throw createError('Speech synthesis service unavailable', 503);
  }),
);

export default router;
