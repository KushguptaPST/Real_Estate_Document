// ─────────────────────────────────────────────────────────────────────────────
// DB-Backed Outbound Plivo Campaign Dialer Worker
// Replaces in-memory campaign arrays with atomic PostgreSQL row claims,
// calling-window enforcement, DND checks, and Plivo call origination.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { plivoService, sanitizeE164Phone } from './telephony/plivo.service.js';
import { walletService } from './billing/wallet.service.js';
import { getPlatformConfig } from './platformConfig.service.js';

function isWithinCallingWindow(start = '09:30', end = '19:30', timezone = 'Asia/Kolkata'): boolean {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
    return parts >= start && parts <= end;
  } catch {
    return true;
  }
}

export async function processCampaignDialerBatch(options: {
  publicBaseUrl?: string;
  maxPerCampaign?: number;
} = {}): Promise<{ dialed: number; skipped: number }> {
  const maxPerCampaign = options.maxPerCampaign ?? 5;
  const publicBase = (
    options.publicBaseUrl ||
    process.env['APP_PUBLIC_URL'] ||
    process.env['API_PUBLIC_URL'] ||
    'http://localhost:3001'
  ).replace(/\/$/, '');

  const platformConfig = await getPlatformConfig();
  if (platformConfig.outboundDialerPaused) {
    logger.warn('[Campaign Dialer] Global outbound dialer kill-switch is active; skipping batch.');
    return { dialed: 0, skipped: 0 };
  }

  const runningCampaigns = await prisma.campaign.findMany({
    where: { status: 'RUNNING' },
    include: {
      organization: {
        include: {
          channels: true,
          plivoNumbers: { where: { isActive: true }, orderBy: { isPrimary: 'desc' }, take: 1 },
        },
      },
    },
  });

  let totalDialed = 0;
  let totalSkipped = 0;

  for (const campaign of runningCampaigns) {
    if (campaign.organization.isSuspended) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'PAUSED', pauseReason: 'ORG_SUSPENDED' },
      });
      totalSkipped++;
      continue;
    }

    const walletCheck = await walletService.hasSufficientBalance(campaign.organizationId, 12);
    if (!walletCheck.ok) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'PAUSED', pauseReason: 'LOW_BALANCE' },
      });
      logger.warn(
        `[Campaign Dialer] Auto-paused campaign ${campaign.id} (org ${campaign.organizationId}) due to low balance (₹${walletCheck.balance})`,
      );
      totalSkipped++;
      continue;
    }

    const orgChannel = campaign.organization.channels;
    const tz = orgChannel?.defaultTimezone || 'Asia/Kolkata';
    const startWin = orgChannel?.callingWindowStart || '09:30';
    const endWin = orgChannel?.callingWindowEnd || '19:30';

    if (process.env['NODE_ENV'] === 'production' && !isWithinCallingWindow(startWin, endWin, tz)) {
      logger.info(`[Campaign Dialer] Skipping campaign ${campaign.id}: outside ${startWin}-${endWin} ${tz}`);
      continue;
    }

    const activeDialingCount = await prisma.campaignEnrollment.count({
      where: { campaignId: campaign.id, status: 'DIALING' },
    });
    const availableSlots = Math.max(0, Math.min(maxPerCampaign, campaign.concurrencyTrunks - activeDialingCount));
    if (availableSlots === 0) continue;

    const candidates = await prisma.campaignEnrollment.findMany({
      where: {
        campaignId: campaign.id,
        status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        nextAttemptAt: { lte: new Date() },
        OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 3 * 60 * 1000) } }],
      },
      include: { lead: true },
      orderBy: { nextAttemptAt: 'asc' },
      take: availableSlots,
    });

    const fromNumber =
      campaign.organization.plivoNumbers[0]?.phoneNumber ||
      process.env['PLIVO_FROM_NUMBER'] ||
      '+918000000000';

    for (const enrollment of candidates) {
      if (enrollment.lead.doNotCall) {
        await prisma.campaignEnrollment.update({
          where: { id: enrollment.id },
          data: { status: 'DND_SKIPPED', notes: 'Lead marked doNotCall' },
        });
        totalSkipped++;
        continue;
      }

      const workerLock = `dialer-${Date.now()}`;
      const claimed = await prisma.campaignEnrollment.updateMany({
        where: {
          id: enrollment.id,
          status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        },
        data: {
          status: 'DIALING',
          lockedAt: new Date(),
          lockedBy: workerLock,
          attempts: { increment: 1 },
        },
      });

      if (claimed.count === 0) continue;

      const toPhone = sanitizeE164Phone(enrollment.phone);
      const callSession = await prisma.voiceCallSession.create({
        data: {
          organizationId: campaign.organizationId,
          leadId: enrollment.leadId,
          campaignId: campaign.id,
          callUuid: `pending-${enrollment.id}-${Date.now()}`,
          direction: 'OUTBOUND',
          fromNumber,
          toNumber: toPhone,
          status: 'INITIATED',
        },
      });

      const plivoRes = await plivoService.originateCall({
        from: fromNumber,
        to: toPhone,
        answerUrl: `${publicBase}/api/webhooks/plivo/answer/${callSession.id}`,
        hangupUrl: `${publicBase}/api/webhooks/plivo/hangup/${callSession.id}`,
        machineDetectionUrl: `${publicBase}/api/webhooks/plivo/answer/${callSession.id}`,
      });

      if (plivoRes.success && plivoRes.callUuid) {
        await prisma.$transaction([
          prisma.voiceCallSession.update({
            where: { id: callSession.id },
            data: { callUuid: plivoRes.callUuid, status: plivoRes.isSimulated ? 'COMPLETED' : 'RINGING' },
          }),
          prisma.campaignEnrollment.update({
            where: { id: enrollment.id },
            data: {
              lastCallUuid: plivoRes.callUuid,
              status: plivoRes.isSimulated ? 'CONNECTED' : 'DIALING',
              notes: plivoRes.isSimulated
                ? 'Plivo credentials not set; simulated outbound dispatch recorded.'
                : 'Plivo outbound call dispatched.',
            },
          }),
          prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              callsDialed: { increment: 1 },
              ...(plivoRes.isSimulated ? { liveHumansConnected: { increment: 1 } } : {}),
            },
          }),
        ]);
        totalDialed++;
      } else {
        const canRetry = enrollment.attempts + 1 < enrollment.maxAttempts;
        await prisma.$transaction([
          prisma.voiceCallSession.update({
            where: { id: callSession.id },
            data: { status: 'FAILED', summary: plivoRes.error || 'Originate failed' },
          }),
          prisma.campaignEnrollment.update({
            where: { id: enrollment.id },
            data: {
              status: canRetry ? 'RETRY_SCHEDULED' : 'FAILED',
              nextAttemptAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
              notes: plivoRes.error || 'Plivo call origination failed',
            },
          }),
          prisma.campaign.update({
            where: { id: campaign.id },
            data: { busyOrNoAnswer: { increment: 1 } },
          }),
        ]);
      }
    }

    // Mark campaign COMPLETED if no remaining pending/dialing/retrying enrollments exist
    const remaining = await prisma.campaignEnrollment.count({
      where: {
        campaignId: campaign.id,
        status: { in: ['PENDING', 'DIALING', 'RETRY_SCHEDULED'] },
      },
    });
    if (remaining === 0 && campaign.totalLeads > 0) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }
  }

  return { dialed: totalDialed, skipped: totalSkipped };
}
