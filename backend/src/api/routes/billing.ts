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
import { recordRazorpayFee } from '../../services/costTracker.service.js';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from '../../services/razorpay.service.js';

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
  threshold: z.number().min(10).max(25000).optional(),
  rechargeAmount: z.number().min(50).max(50000).optional(),
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

// =========================================================================
// RAZORPAY ORDERS, PAYMENT VERIFICATION & WEBHOOKS (INR)
// =========================================================================

const RazorpayCreateOrderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('WALLET_TOPUP'),
    amountInr: z.number().min(100, 'Minimum wallet top-up is ₹100').max(500000),
  }),
  z.object({
    type: z.literal('SUBSCRIPTION_PLAN'),
    plan: z.enum(['SOLO', 'TEAM', 'ENTERPRISE']),
    isAnnual: z.boolean().default(false),
  }),
]);

const RazorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  type: z.enum(['WALLET_TOPUP', 'SUBSCRIPTION_PLAN']),
  amountInr: z.number().optional(),
  plan: z.enum(['SOLO', 'TEAM', 'ENTERPRISE']).optional(),
  isAnnual: z.boolean().optional(),
});

// GET /api/billing/razorpay/config — check if Razorpay Checkout is configured
router.get('/razorpay/config', requireAuth, (_req, res) => {
  res.json({
    configured: isRazorpayConfigured(),
    keyId: process.env['RAZORPAY_KEY_ID'] || null,
    currency: 'INR',
  });
});

// POST /api/billing/razorpay/create-order — creates authoritative Razorpay Order in INR
router.post(
  '/razorpay/create-order',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const parsed = RazorpayCreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid Razorpay order request', 422);
    }

    let amountInr = 0;
    let description = '';
    const notes: Record<string, string> = {
      organizationId: orgId,
      type: parsed.data.type,
    };

    if (parsed.data.type === 'WALLET_TOPUP') {
      amountInr = Math.round(parsed.data.amountInr);
      description = `AI Voice & WhatsApp Prepaid Wallet (₹${amountInr.toLocaleString('en-IN')})`;
      notes['amountInr'] = String(amountInr);
    } else {
      const planInfo = PLAN_CONFIGS[parsed.data.plan];
      amountInr = parsed.data.isAnnual ? planInfo.annualPrice : planInfo.monthlyPrice;
      description = `${planInfo.name} (${parsed.data.isAnnual ? 'Annual' : 'Monthly'})`;
      notes['plan'] = parsed.data.plan;
      notes['isAnnual'] = String(parsed.data.isAnnual);
    }

    const receipt = `rcpt_${orgId.slice(-8)}_${Date.now()}`;
    const order = await createRazorpayOrder({ amountInr, receipt, notes });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    res.status(201).json({
      ...order,
      description,
      organizationName: org?.name || 'Eigen Estate Brokerage',
      prefill: {
        name: user.name || '',
        email: user.email,
      },
    });
  }),
);

// POST /api/billing/razorpay/verify — verifies HMAC-SHA256 signature & activates wallet/plan
router.post(
  '/razorpay/verify',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user?.organizationId) throw createError('No organization associated with user', 400);
    const orgId = user.organizationId;

    const parsed = RazorpayVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(parsed.error.errors[0]?.message || 'Invalid Razorpay verification payload', 422);
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, type } = parsed.data;
    const isValid = verifyRazorpayPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      throw createError('Invalid Razorpay payment signature', 400);
    }

    if (type === 'WALLET_TOPUP') {
      const creditAmount = Math.max(100, Math.round(parsed.data.amountInr || 1000));
      const walletRes = await walletService.depositCredits(orgId, creditAmount, {
        userEmail: user.email,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
      });
      if (!walletRes.duplicate) {
        await recordRazorpayFee({
          organizationId: orgId,
          grossAmountInr: creditAmount,
          paymentId: razorpay_payment_id,
        });
      }

      res.json({
        verified: true,
        type: 'WALLET_TOPUP',
        newBalance: walletRes.newBalance,
        transaction: walletRes.transaction,
      });
      return;
    }

    const plan = parsed.data.plan || 'TEAM';
    const planInfo = PLAN_CONFIGS[plan];
    const durationDays = parsed.data.isAnnual ? 365 : 30;
    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: {
        subscriptionTier: plan,
        subscriptionStatus: 'ACTIVE',
        planExpiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      },
    });

    const walletRes = await walletService.depositCredits(orgId, planInfo.includedCreditsInr, {
      userEmail: user.email,
      razorpayPaymentId: `${razorpay_payment_id}_plan_credit`,
      razorpayOrderId: razorpay_order_id,
    });
    if (!walletRes.duplicate) {
      await recordRazorpayFee({
        organizationId: orgId,
        grossAmountInr: parsed.data.isAnnual ? planInfo.annualPrice : planInfo.monthlyPrice,
        paymentId: razorpay_payment_id,
      });
    }

    res.json({
      verified: true,
      type: 'SUBSCRIPTION_PLAN',
      subscriptionTier: updatedOrg.subscriptionTier,
      subscriptionStatus: updatedOrg.subscriptionStatus,
      planExpiresAt: updatedOrg.planExpiresAt,
      newBalance: walletRes.newBalance,
      includedCreditsInr: planInfo.includedCreditsInr,
    });
  }),
);

// POST /api/billing/razorpay/webhook — async Razorpay webhook processor
router.post(
  '/razorpay/webhook',
  asyncHandler(async (req, res) => {
    const signature = req.header('x-razorpay-signature');
    if (!signature || !req.rawBody) {
      throw createError('Missing x-razorpay-signature header', 400);
    }

    if (!verifyRazorpayWebhookSignature(req.rawBody, signature)) {
      throw createError('Invalid Razorpay webhook signature', 401);
    }

    const event = req.body as any;
    const eventType = event?.event;
    const payment = event?.payload?.payment?.entity;

    if ((eventType === 'payment.captured' || eventType === 'order.paid') && payment) {
      const notes = payment.notes || {};
      const orgId = notes.organizationId;
      const type = notes.type;
      const paymentId = payment.id;
      const orderId = payment.order_id;
      const amountInr = Math.round((payment.amount || 0) / 100);

      if (orgId && type === 'WALLET_TOPUP' && amountInr > 0) {
        const walletRes = await walletService.depositCredits(orgId, amountInr, {
          razorpayPaymentId: paymentId,
          razorpayOrderId: orderId,
        });
        if (!walletRes.duplicate) {
          await recordRazorpayFee({ organizationId: orgId, grossAmountInr: amountInr, paymentId });
        }
      } else if (orgId && type === 'SUBSCRIPTION_PLAN') {
        const plan = (notes.plan as PlanTier) || 'TEAM';
        const planInfo = PLAN_CONFIGS[plan];
        const isAnnual = notes.isAnnual === 'true';
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionTier: plan,
            subscriptionStatus: 'ACTIVE',
            planExpiresAt: new Date(Date.now() + (isAnnual ? 365 : 30) * 24 * 60 * 60 * 1000),
          },
        });
        const walletRes = await walletService.depositCredits(orgId, planInfo.includedCreditsInr, {
          razorpayPaymentId: `${paymentId}_plan_credit`,
          razorpayOrderId: orderId,
        });
        if (!walletRes.duplicate) {
          await recordRazorpayFee({
            organizationId: orgId,
            grossAmountInr: amountInr || (isAnnual ? planInfo.annualPrice : planInfo.monthlyPrice),
            paymentId,
          });
        }
      }
    }

    res.json({ received: true });
  }),
);

export default router;

