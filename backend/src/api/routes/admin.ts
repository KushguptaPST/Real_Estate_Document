// ─────────────────────────────────────────────────────────────────────────────
// Eigen Estate Super-Admin Mission Control API
// Real PostgreSQL Telemetry, COGS & Profit Economics, Tenant Intervention,
// India Plivo KYC Approvals, and Persistent Platform AI Switchboard.
// Guarded strictly by requireAuth + requirePlatformAdmin (PLATFORM_ADMIN_EMAILS).
// ─────────────────────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../utils/prisma.js';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth, requirePlatformAdmin } from '../../middleware/auth.js';
import { PLAN_CONFIGS, type PlanTier } from '../../services/billing.service.js';
import { walletService } from '../../services/billing/wallet.service.js';
import { getPlatformConfig, updatePlatformConfig } from '../../services/platformConfig.service.js';

const router = Router();
router.use(requireAuth, requirePlatformAdmin);

function percentile(sortedAsc: number[], pct: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((pct / 100) * sortedAsc.length) - 1));
  return Math.round(sortedAsc[idx] ?? 0);
}

// ── 1. GET /api/admin/overview ────────────────────────────────────────────────
router.get(
  '/overview',
  asyncHandler(async (_req: Request, res: Response) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      orgs,
      totalUsers,
      activeDids,
      activeCallsNow,
      pendingKycCount,
      wallets,
      depositEntries30d,
      costByProviderRows,
      callStats30d,
      agentTraces30d,
      platformConfig,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.organization.findMany({
        select: { id: true, subscriptionTier: true, subscriptionStatus: true, isSuspended: true },
      }),
      prisma.user.count(),
      prisma.plivoNumber.count({ where: { isActive: true } }),
      prisma.voiceCallSession.count({ where: { status: { in: ['INITIATED', 'RINGING', 'IN_PROGRESS'] } } }),
      prisma.organizationChannel.count({ where: { plivoComplianceStatus: 'SUBMITTED' } }),
      prisma.organizationWallet.aggregate({ _sum: { balance: true } }),
      prisma.walletLedgerEntry.findMany({
        where: {
          type: 'CREDIT',
          category: { in: ['DEPOSIT', 'AUTO_RECHARGE'] },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { amount: true, metadata: true },
      }),
      prisma.providerCostEvent.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { costInr: true, units: true },
        _count: { id: true },
      }),
      prisma.voiceCallSession.aggregate({
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { durationSeconds: true },
        _count: { id: true },
      }),
      prisma.agentRunTrace.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { latencyMs: true, modelUsed: true },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      getPlatformConfig(),
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: { organization: { select: { name: true } } },
      }),
    ]);

    const commercialOrgs = orgs.filter((o) => o.id !== 'demo-sandbox-org');
    const activePaidOrgs = commercialOrgs.filter((o) => !o.isSuspended && o.subscriptionStatus === 'ACTIVE');
    const suspendedOrgs = orgs.filter((o) => o.isSuspended).length;

    const monthlySubscriptionMrrInr = activePaidOrgs.reduce((acc, org) => {
      const plan = PLAN_CONFIGS[(org.subscriptionTier as PlanTier) || 'SOLO'] || PLAN_CONFIGS.SOLO;
      return acc + plan.monthlyPrice;
    }, 0);

    const extraTopups30dInr = Math.round(
      depositEntries30d.reduce((acc, entry) => {
        const meta = (entry.metadata || {}) as Record<string, unknown>;
        const paymentId = String(meta['razorpayPaymentId'] || '');
        const isPlanCredit = paymentId.endsWith('_plan_credit') || meta['source'] === 'ADMIN_ADJUSTMENT';
        return isPlanCredit ? acc : acc + entry.amount;
      }, 0),
    );

    const grossRevenue30dInr = monthlySubscriptionMrrInr + extraTopups30dInr;

    const providerBreakdown = costByProviderRows.map((row) => ({
      provider: row.provider,
      costInr: Math.round((row._sum.costInr || 0) * 100) / 100,
      eventsCount: row._count.id,
      totalUnits: Math.round((row._sum.units || 0) * 100) / 100,
    }));

    const totalCogs30dInr =
      Math.round(providerBreakdown.reduce((sum, p) => sum + p.costInr, 0) * 100) / 100;
    const netProfit30dInr = Math.round((grossRevenue30dInr - totalCogs30dInr) * 100) / 100;
    const grossMarginPct =
      grossRevenue30dInr > 0 ? Math.round(((netProfit30dInr / grossRevenue30dInr) * 100) * 10) / 10 : 0;

    const latencies = agentTraces30d.map((t) => t.latencyMs).filter((n) => n > 0).sort((a, b) => a - b);

    res.json({
      kpis: {
        totalOrgs: orgs.length,
        activePaidOrgs: activePaidOrgs.length,
        suspendedOrgs,
        totalUsers,
        activeDids,
        activeCallsNow,
        pendingKycCount,
        totalWalletLiabilityInr: Math.round((wallets._sum.balance || 0) * 100) / 100,
        monthlySubscriptionMrrInr,
        extraTopups30dInr,
        grossRevenue30dInr,
        totalCogs30dInr,
        netProfit30dInr,
        grossMarginPct,
        totalCallMinutes30d: Math.round(((callStats30d._sum.durationSeconds || 0) / 60) * 10) / 10,
        totalCalls30d: callStats30d._count.id,
        totalAgentRuns30d: agentTraces30d.length,
        aiLatencyP50Ms: percentile(latencies, 50),
        aiLatencyP95Ms: percentile(latencies, 95),
      },
      providerBreakdown,
      config: platformConfig,
      auditLogs: recentAuditLogs,
    });
  }),
);

// ── 2. GET /api/admin/tenants ─────────────────────────────────────────────────
router.get(
  '/tenants',
  asyncHandler(async (req: Request, res: Response) => {
    const search = String(req.query['search'] || '').trim().toLowerCase();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [orgs, cogsRows, callRows] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, email: true, phone: true, role: true },
          },
          channels: {
            select: {
              plivoSubaccountId: true,
              plivoComplianceStatus: true,
              whatsappPhoneNumberId: true,
            },
          },
          wallet: { select: { balance: true, totalDeposited: true, totalSpent: true } },
          _count: { select: { deals: true, leads: true } },
          plivoNumbers: { where: { isActive: true }, select: { id: true, phoneNumber: true } },
          campaigns: { where: { status: 'RUNNING' }, select: { id: true } },
        },
      }),
      prisma.providerCostEvent.groupBy({
        by: ['organizationId'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { costInr: true },
      }),
      prisma.voiceCallSession.groupBy({
        by: ['organizationId'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { durationSeconds: true },
      }),
    ]);

    const cogsMap = new Map(cogsRows.map((r) => [r.organizationId, r._sum.costInr || 0]));
    const callMinMap = new Map(
      callRows.map((r) => [r.organizationId, Math.round(((r._sum.durationSeconds || 0) / 60) * 10) / 10]),
    );

    const rows = orgs
      .filter((org) => {
        if (!search) return true;
        const ownerEmail = org.users.find((u) => u.role === 'OWNER')?.email || '';
        return (
          org.name.toLowerCase().includes(search) ||
          org.id.toLowerCase().includes(search) ||
          ownerEmail.toLowerCase().includes(search)
        );
      })
      .map((org) => {
        const tier = (org.subscriptionTier as PlanTier) || 'SOLO';
        const plan = PLAN_CONFIGS[tier] || PLAN_CONFIGS.SOLO;
        const owner = org.users.find((u) => u.role === 'OWNER') || org.users[0] || null;
        const monthlyRevenueInr =
          org.id !== 'demo-sandbox-org' && org.subscriptionStatus === 'ACTIVE' && !org.isSuspended
            ? plan.monthlyPrice
            : 0;
        const cogs30dInr = Math.round((cogsMap.get(org.id) || 0) * 100) / 100;

        return {
          id: org.id,
          name: org.name,
          subscriptionTier: org.subscriptionTier,
          subscriptionStatus: org.subscriptionStatus,
          isSuspended: org.isSuspended,
          suspendedReason: org.suspendedReason,
          stateJurisdiction: org.stateJurisdiction,
          createdAt: org.createdAt,
          planExpiresAt: org.planExpiresAt,
          owner: owner ? { name: owner.name, email: owner.email, phone: owner.phone } : null,
          seatsUsed: org.users.length,
          maxSeats: plan.maxAgents,
          dealsCount: org._count.deals,
          leadsCount: org._count.leads,
          activeDids: org.plivoNumbers.length,
          plivoSubaccountId: org.channels?.plivoSubaccountId || null,
          plivoComplianceStatus: org.channels?.plivoComplianceStatus || 'PENDING',
          whatsappConnected: Boolean(org.channels?.whatsappPhoneNumberId),
          walletBalance: Math.round((org.wallet?.balance || 0) * 100) / 100,
          totalSpent: Math.round((org.wallet?.totalSpent || 0) * 100) / 100,
          monthlyRevenueInr,
          cogs30dInr,
          profit30dInr: Math.round((monthlyRevenueInr - cogs30dInr) * 100) / 100,
          callMinutes30d: callMinMap.get(org.id) || 0,
          runningCampaigns: org.campaigns.length,
        };
      });

    res.json({ tenants: rows });
  }),
);

// ── 3. GET /api/admin/tenants/:orgId ──────────────────────────────────────────
router.get(
  '/tenants/:orgId',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params['orgId']!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [org, costRows, recentCalls, recentTraces, auditLogs] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          users: {
            select: { id: true, name: true, email: true, role: true, phone: true, lastLoginAt: true },
            orderBy: { createdAt: 'asc' },
          },
          channels: {
            select: {
              plivoSubaccountId: true,
              plivoComplianceAppId: true,
              plivoComplianceStatus: true,
              whatsappPhoneNumberId: true,
              whatsappWabaId: true,
              callingWindowStart: true,
              callingWindowEnd: true,
              defaultTimezone: true,
            },
          },
          wallet: {
            include: {
              entries: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
          },
          plivoNumbers: { orderBy: { createdAt: 'desc' } },
          campaigns: { orderBy: { createdAt: 'desc' }, take: 10 },
          _count: { select: { deals: true, leads: true } },
        },
      }),
      prisma.providerCostEvent.groupBy({
        by: ['provider'],
        where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } },
        _sum: { costInr: true, units: true },
        _count: { id: true },
      }),
      prisma.voiceCallSession.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          callUuid: true,
          direction: true,
          toNumber: true,
          status: true,
          outcome: true,
          durationSeconds: true,
          createdAt: true,
        },
      }),
      prisma.agentRunTrace.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          channel: true,
          specialist: true,
          intent: true,
          latencyMs: true,
          modelUsed: true,
          guardrailFlags: true,
          createdAt: true,
        },
      }),
      prisma.adminAuditLog.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    if (!org) throw createError('Organization not found', 404);

    res.json({
      organization: org,
      costByProvider30d: costRows.map((c) => ({
        provider: c.provider,
        costInr: Math.round((c._sum.costInr || 0) * 100) / 100,
        eventsCount: c._count.id,
      })),
      recentCalls,
      recentTraces,
      auditLogs,
    });
  }),
);

// ── 4. PATCH /api/admin/tenants/:orgId/kyc ────────────────────────────────────
const KycUpdateSchema = z.object({
  status: z.enum(['PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED']),
  note: z.string().max(300).optional(),
});

router.patch(
  '/tenants/:orgId/kyc',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params['orgId']!;
    const parsed = KycUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) throw createError('Organization not found', 404);

    const updatedChannel = await prisma.organizationChannel.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, plivoComplianceStatus: parsed.data.status },
      update: { plivoComplianceStatus: parsed.data.status },
      select: { plivoComplianceStatus: true, plivoSubaccountId: true },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminEmail: req.user!.email,
        organizationId: orgId,
        action: 'PLIVO_KYC_UPDATED',
        note: parsed.data.note || `Set Plivo India KYC status to ${parsed.data.status}`,
        metadata: { status: parsed.data.status } as object,
      },
    });

    res.json({ success: true, channel: updatedChannel });
  }),
);

// ── 5. POST /api/admin/tenants/:orgId/wallet ──────────────────────────────────
const WalletAdjustSchema = z.object({
  amountInr: z.number().min(-50000).max(100000).refine((v) => v !== 0, 'Amount must be non-zero'),
  reason: z.string().min(3).max(300),
});

router.post(
  '/tenants/:orgId/wallet',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params['orgId']!;
    const parsed = WalletAdjustSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
    if (!org) throw createError('Organization not found', 404);

    const { amountInr, reason } = parsed.data;
    let newBalance = 0;

    if (amountInr > 0) {
      const creditRes = await walletService.depositCredits(orgId, amountInr, {
        userEmail: req.user!.email,
        razorpayPaymentId: `admin_adj_${Date.now()}`,
      });
      newBalance = creditRes.newBalance;
    } else {
      const debitAbs = Math.abs(amountInr);
      const wallet = await prisma.organizationWallet.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, balance: 0 },
        update: {},
      });
      const updated = await prisma.$transaction(async (tx) => {
        const w = await tx.organizationWallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: debitAbs } },
        });
        await tx.walletLedgerEntry.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            category: 'REFUND',
            description: `Admin adjustment by ${req.user!.email}: ${reason}`,
            amount: -debitAbs,
            balanceAfter: Math.round(w.balance * 100) / 100,
            metadata: { source: 'ADMIN_ADJUSTMENT', reason } as object,
          },
        });
        return w;
      });
      newBalance = Math.round(updated.balance * 100) / 100;
    }

    await prisma.adminAuditLog.create({
      data: {
        adminEmail: req.user!.email,
        organizationId: orgId,
        action: 'WALLET_ADJUSTED',
        note: `${amountInr > 0 ? 'Credited' : 'Debited'} ₹${Math.abs(amountInr)} — ${reason}`,
        metadata: { amountInr, newBalance, reason } as object,
      },
    });

    res.json({ success: true, newBalance });
  }),
);

// ── 6. PATCH /api/admin/tenants/:orgId/status ─────────────────────────────────
const OrgStatusSchema = z.object({
  isSuspended: z.boolean(),
  reason: z.string().max(300).optional(),
});

router.patch(
  '/tenants/:orgId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params['orgId']!;
    const parsed = OrgStatusSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        isSuspended: parsed.data.isSuspended,
        suspendedReason: parsed.data.isSuspended ? parsed.data.reason || 'Suspended by platform admin' : null,
      },
      select: { id: true, name: true, isSuspended: true, suspendedReason: true },
    });

    if (parsed.data.isSuspended) {
      await prisma.campaign.updateMany({
        where: { organizationId: orgId, status: 'RUNNING' },
        data: { status: 'PAUSED', pauseReason: 'ORG_SUSPENDED' },
      });
    }

    await prisma.adminAuditLog.create({
      data: {
        adminEmail: req.user!.email,
        organizationId: orgId,
        action: parsed.data.isSuspended ? 'ORG_SUSPENDED' : 'ORG_REACTIVATED',
        note:
          parsed.data.reason ||
          (parsed.data.isSuspended ? 'Organization suspended' : 'Organization reactivated'),
      },
    });

    res.json({ success: true, organization: updated });
  }),
);

// ── 7. POST /api/admin/tenants/:orgId/pause-campaigns ─────────────────────────
router.post(
  '/tenants/:orgId/pause-campaigns',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.params['orgId']!;
    const result = await prisma.campaign.updateMany({
      where: { organizationId: orgId, status: 'RUNNING' },
      data: { status: 'PAUSED', pauseReason: 'ADMIN_PAUSED' },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminEmail: req.user!.email,
        organizationId: orgId,
        action: 'CAMPAIGNS_PAUSED',
        note: `Force-paused ${result.count} running campaign(s)`,
      },
    });

    res.json({ success: true, pausedCount: result.count });
  }),
);

// ── 8. POST /api/admin/config (Persistent AI Switchboard & Kill Switch) ────────
const PlatformConfigSchema = z.object({
  primaryTtsEngine: z.enum(['eleven_flash_v2_5', 'cartesia_sonic', 'edge_neural']).optional(),
  primaryLlmModel: z.string().min(2).max(80).optional(),
  outboundDialerPaused: z.boolean().optional(),
  maxPlatformConcurrency: z.number().int().min(1).max(500).optional(),
  autoFailoverEnabled: z.boolean().optional(),
  note: z.string().max(300).optional(),
});

router.post(
  '/config',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = PlatformConfigSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const { note, ...updates } = parsed.data;
    const config = await updatePlatformConfig(updates, req.user!.email, note);

    res.json({ success: true, config });
  }),
);

export default router;
