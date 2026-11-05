import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, createError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getSubscriptionStatus,
  handleWebhookEvent,
  PLAN_CONFIGS,
  type PlanTier,
} from '../../services/billing.service.js';
import { walletService } from '../../services/billing/wallet.service.js';
import { prisma } from '../../utils/prisma.js';

const router = Router();

const CheckoutSessionSchema = z.object({
  plan: z.enum(['SOLO', 'TEAM', 'ENTERPRISE']),
  isAnnual: z.boolean().optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const WalletDepositSchema = z.object({
  amount: z.number().min(10).max(50000),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const AutoRechargeSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().min(10).max(1000).optional(),
  rechargeAmount: z.number().min(50).max(5000).optional(),
});

const SimulateDeductionSchema = z.object({
  type: z.enum(['VOICE_CALL', 'WHATSAPP_QUALIFICATION']),
  durationSeconds: z.number().optional(),
  leadName: z.string().optional(),
});

// GET /api/billing/subscription — get current organization's subscription and usage
router.get(
  '/subscription',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const subscription = await getSubscriptionStatus(orgId);
    res.json(subscription);
  }),
);

// GET /api/billing/plans — public plan metadata
router.get('/plans', (_req, res) => {
  res.json({
    plans: Object.values(PLAN_CONFIGS),
  });
});

// =========================================================================
// PRE-PAID METERED WALLET & USAGE BILLING (Section 11.6)
// =========================================================================

// GET /api/billing/wallet — get pre-paid wallet balance, rates, auto-recharge and ledger
router.get(
  '/wallet',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const wallet = await walletService.getWallet(orgId);
    res.json(wallet);
  }),
);

// POST /api/billing/wallet/deposit — deposit credits via Stripe or instant sandbox
router.post(
  '/wallet/deposit',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const parsed = WalletDepositSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid deposit amount ($10 minimum)', 400);
    }

    const result = await walletService.depositCredits(orgId, parsed.data.amount, {
      userEmail: user.email,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
    });

    res.json(result);
  }),
);

// POST /api/billing/wallet/auto-recharge — update threshold & recharge settings
router.post(
  '/wallet/auto-recharge',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const parsed = AutoRechargeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid auto-recharge settings', 400);
    }

    const updated = await walletService.updateAutoRecharge(orgId, parsed.data);
    res.json({ success: true, autoRecharge: updated });
  }),
);

// POST /api/billing/wallet/simulate-deduction — dev testing endpoint to trigger call/WA debit
router.post(
  '/wallet/simulate-deduction',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const parsed = SimulateDeductionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError('Invalid simulation payload', 400);
    }

    let transaction;
    if (parsed.data.type === 'VOICE_CALL') {
      transaction = await walletService.deductVoiceCall(orgId, parsed.data.durationSeconds || 180, {
        leadName: parsed.data.leadName || 'Sandbox Buyer',
      });
    } else {
      transaction = await walletService.deductWhatsAppQualification(orgId, {
        leadName: parsed.data.leadName || 'Sandbox Buyer',
      });
    }

    const wallet = await walletService.getWallet(orgId);
    res.json({ success: true, transaction, currentBalance: wallet.balance });
  }),
);

// POST /api/billing/create-checkout-session — create a Stripe Checkout session
router.post(
  '/create-checkout-session',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const parsed = CheckoutSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid plan parameters', 400);
    }

    const session = await createCheckoutSession({
      organizationId: orgId,
      userEmail: user.email,
      plan: parsed.data.plan as PlanTier,
      isAnnual: parsed.data.isAnnual,
      successUrl: parsed.data.successUrl,
      cancelUrl: parsed.data.cancelUrl,
    });

    res.json(session);
  }),
);

// POST /api/billing/portal — open Stripe Customer Portal
router.post(
  '/portal',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const returnUrl = typeof req.body?.returnUrl === 'string' ? req.body.returnUrl : undefined;
    const portal = await createCustomerPortalSession(orgId, returnUrl);
    res.json(portal);
  }),
);

// POST /api/billing/dev-upgrade — dev-mode 1-click tier switcher for demo testing
router.post(
  '/dev-upgrade',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const plan = req.body?.plan as PlanTier;
    if (!plan || !PLAN_CONFIGS[plan]) {
      throw createError('Invalid plan tier', 400);
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        subscriptionTier: plan,
        subscriptionStatus: 'ACTIVE',
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      subscriptionTier: updated.subscriptionTier,
      subscriptionStatus: updated.subscriptionStatus,
    });
  }),
);

// POST /api/billing/webhook — Stripe webhook endpoint
router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      throw createError('Missing stripe-signature header', 400);
    }

    const payload = req.rawBody || req.body;
    const result = await handleWebhookEvent(payload, signature);
    res.json(result);
  }),
);

export default router;

