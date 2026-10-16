/**
 * /api/deals/:id/notifications — Notification preferences, templates, test emails, and audit delivery logs with Tenant Isolation.
 */

import crypto from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { sendEmail, generateTemplate } from '../../services/email.service.js';
import { maskEmail } from '../../utils/audit.js';

const router = Router({ mergeParams: true });


const UpdateSettingsSchema = z.object({
  recipients: z.array(z.string().trim().toLowerCase().email()),
  windows: z.object({
    d3: z.boolean(),
    d1: z.boolean(),
    dayOf: z.boolean(),
    missed: z.boolean(),
  }),
  enabled: z.boolean(),
  timezone: z.string().min(1),
});

const SendTestSchema = z.object({
  to: z.string().trim().toLowerCase().email(),
});

const SendSummarySchema = z.object({
  to: z.array(z.string().trim().toLowerCase().email()).min(1),
});

const PreviewSchema = z.object({
  template: z.enum(['3d', '1d', 'dayOf', 'missed', 'summary', 'docs_received']),
  deadlineId: z.string().optional(),
});

// Outbound mail from these endpoints may only go to people already associated with
// the deal or organization — never to arbitrary addresses (prevents open-relay abuse).
async function assertAllowedRecipients(dealId: string, organizationId: string, recipients: string[]) {
  const [settings, members] = await Promise.all([
    prisma.notificationSetting.findFirst({ where: { dealId, organizationId } }),
    prisma.user.findMany({ where: { organizationId }, select: { email: true } }),
  ]);
  const allowed = new Set<string>(members.map((m) => m.email.toLowerCase()));
  if (Array.isArray(settings?.recipients)) {
    for (const r of settings.recipients) if (typeof r === 'string') allowed.add(r.toLowerCase().trim());
  }
  const rejected = recipients.filter((r) => !allowed.has(r.toLowerCase().trim()));
  if (rejected.length > 0) {
    throw createError('Recipients must be organization members or this deal\'s configured notification recipients', 422);
  }
}

// Helper: Ensure deal belongs to organization
async function getDealForTenant(dealId: string, organizationId: string) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, organizationId },
  });
  if (!deal) throw createError('Deal not found or access denied', 404);
  return deal;
}

// ── GET /settings ─────────────────────────────────────────────────────────────
router.get(
  '/settings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    await getDealForTenant(dealId, orgId);

    let settings = await prisma.notificationSetting.findUnique({
      where: { dealId },
    });

    if (!settings) {
      const userEmail = req.user?.email ? [req.user.email] : [];
      settings = await prisma.notificationSetting.create({
        data: {
          dealId,
          organizationId: orgId,
          recipients: userEmail,
          window3d: true,
          window1d: true,
          windowDayOf: true,
          windowMissed: true,
          enabled: true,
          timezone: 'America/New_York',
        },
      });
    }

    res.json({
      id: settings.id,
      dealId: settings.dealId,
      recipients: (settings.recipients as string[]) || [],
      window3d: settings.window3d,
      window1d: settings.window1d,
      windowDayOf: settings.windowDayOf,
      windowMissed: settings.windowMissed,
      enabled: settings.enabled,
      timezone: settings.timezone,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    });
  }),
);

// ── PUT /settings ─────────────────────────────────────────────────────────────
router.put(
  '/settings',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    await getDealForTenant(dealId, orgId);

    const parsed = UpdateSettingsSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const { recipients, windows, enabled, timezone } = parsed.data;

    const settings = await prisma.notificationSetting.upsert({
      where: { dealId },
      create: {
        dealId,
        organizationId: orgId,
        recipients,
        window3d: windows.d3,
        window1d: windows.d1,
        windowDayOf: windows.dayOf,
        windowMissed: windows.missed,
        enabled,
        timezone,
      },
      update: {
        organizationId: orgId,
        recipients,
        window3d: windows.d3,
        window1d: windows.d1,
        windowDayOf: windows.dayOf,
        windowMissed: windows.missed,
        enabled,
        timezone,
      },
    });

    res.json({
      id: settings.id,
      dealId: settings.dealId,
      recipients: (settings.recipients as string[]) || [],
      window3d: settings.window3d,
      window1d: settings.window1d,
      windowDayOf: settings.windowDayOf,
      windowMissed: settings.windowMissed,
      enabled: settings.enabled,
      timezone: settings.timezone,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    });
  }),
);

// ── POST /test ────────────────────────────────────────────────────────────────
router.post(
  '/test',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const deal = await getDealForTenant(dealId, orgId);

    const parsed = SendTestSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);
    await assertAllowedRecipients(dealId, orgId, [parsed.data.to]);

    const address = deal.propertyAddress;
    const testTpl = generateTemplate('3d', {
      dealAddress: address,
      deadlineLabel: 'Inspection Contingency (Test Alert)',
      dueDate: new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      dealId,
    });

    const result = await sendEmail({
      to: parsed.data.to,
      subject: `[Test Verification] ${testTpl.subject}`,
      html: testTpl.html,
      text: testTpl.text,
    });

    await prisma.emailLog.create({
      data: {
        dealId,
        organizationId: orgId,
        recipient: parsed.data.to,
        template: '3d',
        status: result.success ? 'SENT' : 'BOUNCED',
        providerMessageId: result.messageId ?? null,
        errorMessage: result.error ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        dealId,
        organizationId: orgId,
        action: 'EMAIL_SENT_TEST',
        entityType: 'EmailLog',
        actor: req.user?.email ?? 'system',
        note: `Test email dispatched via Resend (recipient: ${maskEmail(parsed.data.to)})`,
      },
    });

    if (!result.success) {
      throw createError(result.error || 'Failed to dispatch test email', 500);
    }

    res.json({
      sent: true,
      message: `Test email dispatched successfully to ${maskEmail(parsed.data.to)}`,
      messageId: result.messageId,
    });
  }),
);

// ── POST /summary ─────────────────────────────────────────────────────────────
router.post(
  '/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const parsed = SendSummarySchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);
    await assertAllowedRecipients(dealId, orgId, parsed.data.to);

    const deal = await prisma.deal.findFirst({
      where: { id: dealId, organizationId: orgId },
      include: { deadlines: { orderBy: { computedDate: 'asc' } } },
    });
    if (!deal) throw createError('Deal not found or access denied', 404);

    const deadlines = deal.deadlines.map((d) => ({
      label: d.label,
      status: d.status,
      dueDate: (d.confirmedDate ?? d.computedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    }));

    const summaryTpl = generateTemplate('summary', {
      dealAddress: deal.propertyAddress,
      buyerName: deal.buyerName ?? undefined,
      sellerName: deal.sellerName ?? undefined,
      deadlines,
      dealId,
    });

    let sentCount = 0;
    for (const recipient of parsed.data.to) {
      const result = await sendEmail({
        to: recipient,
        subject: summaryTpl.subject,
        html: summaryTpl.html,
        text: summaryTpl.text,
      });

      await prisma.emailLog.create({
        data: {
          dealId,
          organizationId: orgId,
          recipient,
          template: 'summary',
          status: result.success ? 'SENT' : 'BOUNCED',
          providerMessageId: result.messageId ?? null,
          errorMessage: result.error ?? null,
        },
      });

      if (result.success) sentCount++;
    }

    res.json({ sent: true, count: sentCount });
  }),
);

// ── POST /preview ─────────────────────────────────────────────────────────────
router.post(
  '/preview',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const parsed = PreviewSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const deal = await prisma.deal.findFirst({
      where: { id: dealId, organizationId: orgId },
      include: { deadlines: true },
    });
    if (!deal) throw createError('Deal not found or access denied', 404);

    let targetDeadline = deal.deadlines[0];
    if (parsed.data.deadlineId) {
      const found = deal.deadlines.find((d) => d.id === parsed.data.deadlineId);
      if (found) targetDeadline = found;
    }

    const dueDateStr = targetDeadline
      ? (targetDeadline.confirmedDate ?? targetDeadline.computedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

    const preview = generateTemplate(parsed.data.template, {
      dealAddress: deal.propertyAddress,
      deadlineLabel: targetDeadline?.label ?? 'Inspection Contingency',
      dueDate: dueDateStr,
      buyerName: deal.buyerName ?? 'Jane Buyer',
      sellerName: deal.sellerName ?? 'John Seller',
      deadlines: deal.deadlines.map((d) => ({
        label: d.label,
        status: d.status,
        dueDate: (d.confirmedDate ?? d.computedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      })),
      dealId,
    });

    res.json(preview);
  }),
);

// ── GET /log ──────────────────────────────────────────────────────────────────
router.get(
  '/log',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];

    await getDealForTenant(dealId, orgId);

    const logs = await prisma.emailLog.findMany({
      where: { dealId, organizationId: orgId },
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    res.json(
      logs.map((log) => ({
        id: log.id,
        dealId: log.dealId,
        deadlineId: log.deadlineId,
        recipient: log.recipient,
        template: log.template,
        status: log.status,
        providerMessageId: log.providerMessageId,
        errorMessage: log.errorMessage,
        sentAt: log.sentAt.toISOString(),
      })),
    );
  }),
);

// ── GET /inbound-address ──────────────────────────────────────────────────────
router.get(
  '/inbound-address',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const dealId = req.params['id'];
    const deal = await getDealForTenant(dealId, orgId);

    const domain = process.env['INBOUND_EMAIL_DOMAIN'] ?? 'deals.contingencycopilot.com';
    // The alias is a capability: high-entropy, generated once, matched exactly by /api/inbound/email.
    let alias = deal.inboundAlias;
    if (!alias || !/^[a-z0-9]{16,64}$/.test(alias)) {
      const candidate = crypto.randomBytes(12).toString('hex');
      await prisma.deal.updateMany({
        where: { id: deal.id, organizationId: orgId, inboundAlias: deal.inboundAlias },
        data: { inboundAlias: candidate },
      });
      const fresh = await getDealForTenant(dealId, orgId);
      alias = fresh.inboundAlias!;
    }
    const inboundEmail = `deal-${alias}@${domain}`;

    res.json({
      inboundEmail,
      domain,
      dealId,
      dealAddress: deal.propertyAddress,
      instructions: `Forward signed counters, addenda, or inspection reports directly to ${inboundEmail} to auto-index them to this deal.`,
    });
  }),
);

export default router;
