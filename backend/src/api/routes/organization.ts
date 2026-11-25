// ─────────────────────────────────────────────────────────────────────────────
// /api/org — Organization membership, invitations, roles and API keys
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { prisma } from '../../utils/prisma.js';
import { sendInvitationEmail } from '../../services/email.service.js';
import {
  listMembers,
  changeMemberRole,
  removeMember,
  createInvitation,
  listInvitations,
  revokeInvitation,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../../services/organization.service.js';
import { getOrCreateOrgChannel } from '../../services/channelRegistry.service.js';
import {
  provisionSubaccountForOrg,
  submitIndiaComplianceKyc,
  provisionDidForOrg,
} from '../../services/telephony/plivoProvisioning.service.js';
import {
  completeWhatsAppEmbeddedSignup,
  assignPlatformWhatsAppNumber,
  connectTelegramBotForOrg,
} from '../../services/messaging/whatsappOnboarding.service.js';
import { walletService } from '../../services/billing/wallet.service.js';
import { sanitizeE164Phone } from '../../services/telephony/plivo.service.js';

const router = Router();
router.use(requireAuth);

const InviteSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(['OWNER', 'AGENT']).default('AGENT'),
});

const RoleSchema = z.object({ role: z.enum(['OWNER', 'AGENT']) });
const ApiKeySchema = z.object({ name: z.string().trim().min(1).max(100) });

function inviteUrl(token: string): string {
  const base = (process.env['APP_URL'] ?? process.env['CORS_ORIGIN'] ?? 'http://localhost:5173').split(',')[0]!.trim();
  return `${base.replace(/\/$/, '')}/login?invite=${encodeURIComponent(token)}`;
}

// ── Members ───────────────────────────────────────────────────────────────────
router.get(
  '/members',
  asyncHandler(async (req, res) => {
    res.json(await listMembers(req.user!.organizationId));
  }),
);

router.patch(
  '/members/:userId/role',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = RoleSchema.safeParse(req.body);
    if (!parsed.success) throw createError('Invalid role', 422);
    const updated = await changeMemberRole({
      organizationId: req.user!.organizationId,
      actorId: req.user!.id,
      userId: req.params['userId']!,
      role: parsed.data.role,
    });
    res.json(updated);
  }),
);

router.delete(
  '/members/:userId',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    await removeMember({ organizationId: req.user!.organizationId, userId: req.params['userId']! });
    res.status(204).end();
  }),
);

function requireOwnerOrDemo(req: any, _res: any, next: any): void {
  if (!req.user) {
    next(createError('Authentication required', 401));
    return;
  }
  if (req.user.role !== 'OWNER') {
    next(createError('You do not have permission to perform this action', 403));
    return;
  }
  next();
}

// ── Invitations ───────────────────────────────────────────────────────────────
router.get(
  '/invitations',
  requireOwnerOrDemo,
  asyncHandler(async (req, res) => {
    res.json(await listInvitations(req.user!.organizationId));
  }),
);

router.post(
  '/invitations',
  requireOwnerOrDemo,
  asyncHandler(async (req, res) => {
    const parsed = InviteSchema.safeParse(req.body);
    if (!parsed.success) throw createError('A valid email address is required', 422);

    // Look up organization name
    const org = await prisma.organization.findUnique({
      where: { id: req.user!.organizationId },
      select: { name: true },
    });

    const { invitation, token } = await createInvitation({
      organizationId: req.user!.organizationId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedById: req.user!.id,
    });

    const targetInviteUrl = inviteUrl(token);

    // Dispatch real email via sendInvitationEmail
    const emailResult = await sendInvitationEmail({
      to: parsed.data.email,
      role: parsed.data.role,
      inviterName: req.user!.name,
      inviterEmail: req.user!.email,
      organizationName: org?.name || 'Eigen Estate Brokerage Group',
      inviteUrl: targetInviteUrl,
    });

    res.status(201).json({
      invitation,
      inviteUrl: targetInviteUrl,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    });
  }),
);

router.delete(
  '/invitations/:invitationId',
  requireOwnerOrDemo,
  asyncHandler(async (req, res) => {
    await revokeInvitation(req.user!.organizationId, req.params['invitationId']!);
    res.status(204).end();
  }),
);

// ── Lead-intake API keys (OWNER only) ─────────────────────────────────────────
router.get(
  '/api-keys',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    res.json(await listApiKeys(req.user!.organizationId));
  }),
);

router.post(
  '/api-keys',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = ApiKeySchema.safeParse(req.body);
    if (!parsed.success) throw createError('A key name is required', 422);
    const { apiKey, key } = await createApiKey({
      organizationId: req.user!.organizationId,
      name: parsed.data.name,
      createdById: req.user!.id,
    });
    res.status(201).json({ apiKey, key });
  }),
);

router.delete(
  '/api-keys/:apiKeyId',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    await revokeApiKey(req.user!.organizationId, req.params['apiKeyId']!);
    res.status(204).end();
  }),
);

// ── Omnichannel & Website Widget Config ───────────────────────────────────────
const UpdateChannelSchema = z.object({
  whatsappPhoneNumberId: z.string().trim().max(100).nullable().optional(),
  whatsappWabaId: z.string().trim().max(100).nullable().optional(),
  whatsappAccessToken: z.string().trim().max(1000).nullable().optional(),
  whatsappVerifyToken: z.string().trim().max(200).nullable().optional(),
  telegramBotToken: z.string().trim().max(300).nullable().optional(),
  telegramBotUsername: z.string().trim().max(100).nullable().optional(),
  widgetAllowedOrigins: z.array(z.string().trim().max(300)).max(20).optional(),
  widgetTitle: z.string().trim().min(1).max(120).optional(),
  widgetGreeting: z.string().trim().min(1).max(500).optional(),
  widgetThemeColor: z.string().trim().max(30).optional(),
  defaultCurrency: z.enum(['INR', 'USD', 'AED', 'GBP']).optional(),
  defaultTimezone: z.string().trim().max(60).optional(),
  callingWindowStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  callingWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

router.get(
  '/channels',
  asyncHandler(async (req, res) => {
    const channel = await getOrCreateOrgChannel(req.user!.organizationId);
    const plivoNumbers = await prisma.plivoNumber.findMany({
      where: { organizationId: req.user!.organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      id: channel.id,
      organizationId: channel.organizationId,
      whatsappPhoneNumberId: channel.whatsappPhoneNumberId,
      whatsappWabaId: channel.whatsappWabaId,
      hasWhatsappToken: Boolean(channel.whatsappAccessToken),
      whatsappVerifyToken: channel.whatsappVerifyToken,
      telegramBotUsername: channel.telegramBotUsername,
      hasTelegramToken: Boolean(channel.telegramBotToken),
      telegramWebhookSecret: channel.telegramWebhookSecret,
      widgetPublicKey: channel.widgetPublicKey,
      widgetAllowedOrigins: channel.widgetAllowedOrigins,
      widgetTitle: channel.widgetTitle,
      widgetGreeting: channel.widgetGreeting,
      widgetThemeColor: channel.widgetThemeColor,
      defaultCurrency: channel.defaultCurrency,
      defaultTimezone: channel.defaultTimezone,
      callingWindowStart: channel.callingWindowStart,
      callingWindowEnd: channel.callingWindowEnd,
      plivoNumbers,
    });
  }),
);

router.put(
  '/channels',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = UpdateChannelSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    await getOrCreateOrgChannel(req.user!.organizationId);
    const updated = await prisma.organizationChannel.update({
      where: { organizationId: req.user!.organizationId },
      data: parsed.data,
    });

    res.json({
      updated: true,
      widgetPublicKey: updated.widgetPublicKey,
      widgetAllowedOrigins: updated.widgetAllowedOrigins,
      whatsappPhoneNumberId: updated.whatsappPhoneNumberId,
      telegramWebhookSecret: updated.telegramWebhookSecret,
    });
  }),
);

// ── Unified Onboarding Checklist, Branding, WhatsApp, Telegram & Plivo Setup ──

router.get(
  '/onboarding',
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    const [org, channel, wallet, plivoNumbers, propertyCount, advisorWithPhoneCount, totalAdvisors] =
      await Promise.all([
        prisma.organization.findUnique({ where: { id: orgId } }),
        getOrCreateOrgChannel(orgId),
        walletService.getWallet(orgId),
        prisma.plivoNumber.findMany({ where: { organizationId: orgId, isActive: true } }),
        prisma.property.count({ where: { organizationId: orgId } }),
        prisma.user.count({ where: { organizationId: orgId, phone: { not: null } } }),
        prisma.user.count({ where: { organizationId: orgId } }),
      ]);

    const whatsappConnected = Boolean(channel.whatsappPhoneNumberId);
    const plivoProvisioned = Boolean(channel.plivoSubaccountId && plivoNumbers.length > 0);
    const telegramConnected = Boolean(channel.telegramBotToken);
    const widgetConfigured = channel.widgetAllowedOrigins.length > 0;

    res.json({
      organizationId: orgId,
      organizationName: org?.name || 'Workspace',
      planTier: org?.subscriptionTier || 'SOLO',
      subscriptionStatus: org?.subscriptionStatus || 'ACTIVE',
      walletBalance: wallet.balance,
      onboardingCompleted: channel.onboardingCompleted,
      onboardingStep: channel.onboardingStep,
      checklist: {
        paymentActive: org?.subscriptionStatus === 'ACTIVE',
        walletFunded: wallet.balance > 0,
        whatsappConnected,
        plivoSubaccountReady: Boolean(channel.plivoSubaccountId),
        plivoDidAssigned: plivoNumbers.length > 0,
        plivoComplianceStatus: channel.plivoComplianceStatus || 'NOT_SUBMITTED',
        telegramConnected,
        widgetConfigured,
        hasInventory: propertyCount > 0,
        hasAdvisorPhone: advisorWithPhoneCount > 0,
      },
      details: {
        whatsappPhoneNumberId: channel.whatsappPhoneNumberId,
        whatsappProvider: channel.whatsappProvider,
        plivoSubaccountId: channel.plivoSubaccountId,
        plivoComplianceAppId: channel.plivoComplianceAppId,
        plivoNumbers,
        telegramBotUsername: channel.telegramBotUsername,
        telegramWebhookSecret: channel.telegramWebhookSecret,
        widgetPublicKey: channel.widgetPublicKey,
        widgetAllowedOrigins: channel.widgetAllowedOrigins,
        widgetTitle: channel.widgetTitle,
        widgetGreeting: channel.widgetGreeting,
        widgetThemeColor: channel.widgetThemeColor,
        propertyCount,
        advisorWithPhoneCount,
        totalAdvisors,
        metaAppId: process.env['META_APP_ID'] || null,
        metaConfigId: process.env['META_EMBEDDED_SIGNUP_CONFIG_ID'] || null,
      },
    });
  }),
);

router.post(
  '/onboarding/complete',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.organizationId;
    await getOrCreateOrgChannel(orgId);
    const updated = await prisma.organizationChannel.update({
      where: { organizationId: orgId },
      data: { onboardingCompleted: true, onboardingStep: 5 },
    });
    res.json({ onboardingCompleted: updated.onboardingCompleted });
  }),
);

const BrandingSchema = z.object({
  organizationName: z.string().trim().min(2).max(150).optional(),
  widgetTitle: z.string().trim().min(1).max(120).optional(),
  widgetGreeting: z.string().trim().min(1).max(500).optional(),
  widgetThemeColor: z.string().trim().max(30).optional(),
  defaultCurrency: z.enum(['INR', 'USD', 'AED', 'GBP']).optional(),
  defaultTimezone: z.string().trim().max(60).optional(),
});

const WorkspaceProfileSchema = z.object({
  organizationName: z.string().trim().min(2, 'Brokerage name must be at least 2 characters').max(160),
  stateJurisdiction: z.string().trim().min(2).max(10).optional(),
  planTier: z.enum(['SOLO', 'TEAM', 'ENTERPRISE']).optional(),
});

router.patch(
  '/workspace-profile',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = WorkspaceProfileSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.errors[0]?.message || 'Invalid workspace profile', 422);

    const org = await prisma.organization.update({
      where: { id: req.user!.organizationId },
      data: {
        name: parsed.data.organizationName,
        ...(parsed.data.stateJurisdiction ? { stateJurisdiction: parsed.data.stateJurisdiction } : {}),
        ...(parsed.data.planTier ? { subscriptionTier: parsed.data.planTier } : {}),
      },
      select: {
        id: true,
        name: true,
        stateJurisdiction: true,
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    res.json({ organization: org });
  }),
);

router.patch(
  '/branding',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = BrandingSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const orgId = req.user!.organizationId;
    await getOrCreateOrgChannel(orgId);

    const [org, channel] = await prisma.$transaction([
      parsed.data.organizationName
        ? prisma.organization.update({
            where: { id: orgId },
            data: { name: parsed.data.organizationName },
          })
        : prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
      prisma.organizationChannel.update({
        where: { organizationId: orgId },
        data: {
          ...(parsed.data.widgetTitle ? { widgetTitle: parsed.data.widgetTitle } : {}),
          ...(parsed.data.widgetGreeting ? { widgetGreeting: parsed.data.widgetGreeting } : {}),
          ...(parsed.data.widgetThemeColor ? { widgetThemeColor: parsed.data.widgetThemeColor } : {}),
          ...(parsed.data.defaultCurrency ? { defaultCurrency: parsed.data.defaultCurrency } : {}),
          ...(parsed.data.defaultTimezone ? { defaultTimezone: parsed.data.defaultTimezone } : {}),
        },
      }),
    ]);

    res.json({
      organizationName: org.name,
      widgetTitle: channel.widgetTitle,
      widgetThemeColor: channel.widgetThemeColor,
      defaultCurrency: channel.defaultCurrency,
    });
  }),
);

const MemberPhoneSchema = z.object({
  phone: z.string().trim().min(7).max(30),
});

router.patch(
  '/members/:userId/phone',
  asyncHandler(async (req, res) => {
    const parsed = MemberPhoneSchema.safeParse(req.body);
    if (!parsed.success) throw createError('Valid phone number is required', 422);

    const orgId = req.user!.organizationId;
    const targetUserId = req.params['userId']!;
    if (req.user!.role !== 'OWNER' && req.user!.id !== targetUserId) {
      throw createError('Agents can only update their own phone number', 403);
    }

    const member = await prisma.user.findFirst({
      where: { id: targetUserId, organizationId: orgId },
    });
    if (!member) throw createError('Member not found', 404);

    const updated = await prisma.user.update({
      where: { id: member.id },
      data: { phone: sanitizeE164Phone(parsed.data.phone) },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
    res.json(updated);
  }),
);

const WhatsAppEmbeddedSignupSchema = z.object({
  code: z.string().min(4).optional(),
  phoneNumberId: z.string().trim().min(4).max(100),
  wabaId: z.string().trim().min(4).max(100),
  accessTokenOverride: z.string().trim().max(1000).optional(),
  whatsappProvider: z.enum(['COEXISTENCE', 'DEDICATED', 'BSP_MANAGED']).optional(),
  bspAppId: z.string().trim().max(120).optional(),
});

router.post(
  '/whatsapp/embedded-signup',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = WhatsAppEmbeddedSignupSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);

    const result = await completeWhatsAppEmbeddedSignup(req.user!.organizationId, parsed.data);
    res.json(result);
  }),
);

router.post(
  '/whatsapp/assign-platform-number',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const result = await assignPlatformWhatsAppNumber(req.user!.organizationId);
    res.json(result);
  }),
);

const TelegramConnectSchema = z.object({
  botToken: z.string().trim().min(10).max(200),
});

router.post(
  '/telegram/connect',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = TelegramConnectSchema.safeParse(req.body);
    if (!parsed.success) throw createError('Valid Telegram bot token is required', 422);

    const proto = req.header('x-forwarded-proto') || req.protocol || 'http';
    const host = req.header('x-forwarded-host') || req.get('host') || 'localhost:3001';
    const result = await connectTelegramBotForOrg(req.user!.organizationId, {
      botToken: parsed.data.botToken,
      publicBaseUrl: `${proto}://${host}`,
    });
    res.json(result);
  }),
);

router.post(
  '/plivo/subaccount',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const org = await prisma.organization.findUnique({ where: { id: req.user!.organizationId } });
    if (!org) throw createError('Organization not found', 404);
    const result = await provisionSubaccountForOrg(org.id, org.name);
    res.json(result);
  }),
);

const PlivoComplianceSchema = z.object({
  legalEntityName: z.string().trim().min(2).max(200),
  documentType: z.enum(['GST_CERTIFICATE', 'COI', 'UDYAM']),
  registrationNumber: z.string().trim().min(5).max(80),
  authorizedSignatoryName: z.string().trim().min(2).max(120),
  businessAddress: z.string().trim().min(5).max(400),
  city: z.string().trim().min(2).max(80),
  documentUrl: z.string().url().optional(),
});

router.post(
  '/plivo/compliance',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = PlivoComplianceSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);
    const result = await submitIndiaComplianceKyc(req.user!.organizationId, parsed.data);
    res.json(result);
  }),
);

const PlivoDidSchema = z.object({
  phoneNumber: z.string().trim().min(7).max(20).optional(),
  city: z.string().trim().min(2).max(80).default('Bengaluru'),
  alias: z.string().trim().max(120).optional(),
});

router.post(
  '/plivo/provision-number',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const parsed = PlivoDidSchema.safeParse(req.body);
    if (!parsed.success) throw createError(parsed.error.message, 422);
    const result = await provisionDidForOrg(req.user!.organizationId, parsed.data);
    res.json(result);
  }),
);

export default router;
