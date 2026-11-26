/**
 * Persistent PostgreSQL-Backed Plivo Outbound Campaign Routes
 * Replaces in-memory mock arrays with Prisma Campaign, CampaignEnrollment,
 * and VoiceCallSession persistence + real Plivo dialing dispatch.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { sanitizeE164Phone } from '../../services/telephony/plivo.service.js';
import { processCampaignDialerBatch } from '../../services/campaignWorker.service.js';
import { walletService } from '../../services/billing/wallet.service.js';
import { getPlatformConfig } from '../../services/platformConfig.service.js';

const router = Router();

async function getOrCreateDefaultCampaign(organizationId: string) {
  let campaign = await prisma.campaign.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  if (!campaign) {
    campaign = await prisma.campaign.create({
      data: {
        organizationId,
        name: 'Inbound & Purchased Leads Outreach',
        status: 'IDLE',
        concurrencyTrunks: 10,
      },
    });
  }
  return campaign;
}

function mapEnrollmentOutcome(status: string): 'LIVE_HUMAN_ANSWERED' | 'AMD_VOICEMAIL_DROP' | 'BUSY_RETRY' | 'VISIT_CONFIRMED' | 'WARM_TRANSFER' {
  switch (status) {
    case 'VOICEMAIL':
      return 'AMD_VOICEMAIL_DROP';
    case 'RETRY_SCHEDULED':
    case 'FAILED':
    case 'DND_SKIPPED':
      return 'BUSY_RETRY';
    case 'COMPLETED':
      return 'VISIT_CONFIRMED';
    default:
      return 'LIVE_HUMAN_ANSWERED';
  }
}

// ── 1. GET /api/campaigns/stats ──────────────────────────────────────────────
router.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const campaign = await getOrCreateDefaultCampaign(orgId);

    const [enrollments, plivoCount, orgChannel] = await Promise.all([
      prisma.campaignEnrollment.findMany({
        where: { campaignId: campaign.id, organizationId: orgId },
        include: { lead: { select: { fullName: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      }),
      prisma.plivoNumber.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.organizationChannel.findUnique({ where: { organizationId: orgId } }),
    ]);

    const logs = enrollments.map((e) => ({
      id: e.id,
      leadName: e.lead.fullName,
      phone: e.phone,
      outcome: mapEnrollmentOutcome(e.status),
      timestamp: e.updatedAt.toISOString(),
      notes: e.notes || `Status: ${e.status} (attempts: ${e.attempts}/${e.maxAttempts})`,
    }));

    const startWin = orgChannel?.callingWindowStart || '09:30';
    const endWin = orgChannel?.callingWindowEnd || '19:30';
    const tz = orgChannel?.defaultTimezone || 'Asia/Kolkata';

    res.status(200).json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        concurrencyTrunks: campaign.concurrencyTrunks,
        totalLeads: campaign.totalLeads,
        callsDialed: campaign.callsDialed,
        liveHumansConnected: campaign.liveHumansConnected,
        voicemailsDetected: campaign.voicemailsDetected,
        busyOrNoAnswer: campaign.busyOrNoAnswer,
        siteVisitsLocked: campaign.siteVisitsLocked,
        warmTransfersRequested: campaign.warmTransfersRequested,
        startedAt: campaign.startedAt?.toISOString(),
        logs,
      },
      systemCapacity: {
        maxTrunksAllowed: 50,
        carrierDidsActive: Math.max(plivoCount, process.env['PLIVO_FROM_NUMBER'] ? 1 : 0),
        dndComplianceActive: true,
        callingWindow: `${startWin} – ${endWin} (${tz})`,
      },
    });
  }),
);

const StartCampaignSchema = z.object({
  concurrencyTrunks: z.number().min(1).max(50).default(10),
  campaignName: z.string().min(1).max(200).optional(),
});

// ── 2. POST /api/campaigns/start ─────────────────────────────────────────────
router.post(
  '/start',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const parsed = StartCampaignSchema.safeParse(req.body);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { isSuspended: true },
    });
    if (org?.isSuspended) {
      throw createError('Workspace is suspended; campaigns cannot start', 403);
    }
    const platformCfg = await getPlatformConfig();
    if (platformCfg.outboundDialerPaused) {
      throw createError('Outbound AI dialer is temporarily paused by platform operations', 503);
    }
    await walletService.ensureSufficientBalance(orgId, 12);

    const existing = await getOrCreateDefaultCampaign(orgId);

    const updated = await prisma.campaign.update({
      where: { id: existing.id },
      data: {
        status: 'RUNNING',
        pauseReason: null,
        startedAt: existing.startedAt ?? new Date(),
        ...(parsed.success ? { concurrencyTrunks: parsed.data.concurrencyTrunks } : {}),
        ...(parsed.success && parsed.data.campaignName ? { name: parsed.data.campaignName } : {}),
      },
    });

    const proto = req.header('x-forwarded-proto') || req.protocol || 'http';
    const host = req.header('x-forwarded-host') || req.get('host') || 'localhost:3001';
    const dialRes = await processCampaignDialerBatch({ publicBaseUrl: `${proto}://${host}` });

    logger.info(`[Campaign Engine] Started DB campaign ${updated.id} (dialed=${dialRes.dialed}, skipped=${dialRes.skipped})`);

    res.status(200).json({
      success: true,
      message: `Campaign "${updated.name}" running with ${updated.concurrencyTrunks} Plivo trunks (dispatched ${dialRes.dialed} call(s)).`,
      campaign: updated,
      dispatched: dialRes,
    });
  }),
);

// ── 3. POST /api/campaigns/pause ─────────────────────────────────────────────
router.post(
  '/pause',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const existing = await getOrCreateDefaultCampaign(orgId);

    const updated = await prisma.campaign.update({
      where: { id: existing.id },
      data: { status: 'PAUSED', pauseReason: 'MANUAL' },
    });

    res.status(200).json({
      success: true,
      message: 'Campaign paused successfully',
      campaign: updated,
    });
  }),
);

const ImportLeadsSchema = z.object({
  leads: z.array(
    z.object({
      fullName: z.string().min(1),
      phone: z.string().min(7),
      budget: z.string().optional(),
      preferredLocation: z.string().optional(),
    }),
  ),
});

// ── 4. POST /api/campaigns/import ────────────────────────────────────────────
router.post(
  '/import',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId;
    const parsed = ImportLeadsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError('Valid leads array with fullName and phone required', 422);
    }

    const campaign = await getOrCreateDefaultCampaign(orgId);
    let importedCount = 0;

    for (const item of parsed.data.leads) {
      const cleanPhone = sanitizeE164Phone(item.phone);
      if (!cleanPhone) continue;

      try {
        const lead = await prisma.lead.upsert({
          where: {
            organizationId_phone: {
              organizationId: orgId,
              phone: cleanPhone,
            },
          },
          update: {
            fullName: item.fullName,
          },
          create: {
            organizationId: orgId,
            fullName: item.fullName,
            phone: cleanPhone,
            source: 'CSV_CAMPAIGN',
            status: 'NEW',
            stage: 'NEW_INBOUND',
            priority: 'MEDIUM',
          },
        });

        if (item.preferredLocation || item.budget) {
          await prisma.leadRequirement.upsert({
            where: { leadId: lead.id },
            update: {},
            create: {
              leadId: lead.id,
              preferredLocations: item.preferredLocation ? [item.preferredLocation] : [],
              notes: [item.preferredLocation ? `Area: ${item.preferredLocation}` : '', item.budget ? `Budget: ${item.budget}` : '']
                .filter(Boolean)
                .join(' | '),
            },
          });
        }

        await prisma.campaignEnrollment.upsert({
          where: {
            campaignId_leadId: {
              campaignId: campaign.id,
              leadId: lead.id,
            },
          },
          update: { phone: cleanPhone },
          create: {
            campaignId: campaign.id,
            organizationId: orgId,
            leadId: lead.id,
            phone: cleanPhone,
            status: 'PENDING',
          },
        });

        importedCount += 1;
      } catch (err: any) {
        logger.warn(`[Campaign Import] Skipped row ${cleanPhone}: ${err.message}`);
      }
    }

    const totalEnrolled = await prisma.campaignEnrollment.count({
      where: { campaignId: campaign.id },
    });

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { totalLeads: totalEnrolled },
    });

    res.status(200).json({
      success: true,
      importedCount,
      totalCampaignLeads: totalEnrolled,
    });
  }),
);

export default router;
