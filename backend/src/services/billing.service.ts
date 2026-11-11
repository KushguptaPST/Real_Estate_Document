import Stripe from 'stripe';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { createError } from '../middleware/errorHandler.js';

const stripeSecretKey = process.env['STRIPE_SECRET_KEY'];
const stripeWebhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    })
  : null;

export type PlanTier = 'SOLO' | 'TEAM' | 'ENTERPRISE';

export interface PlanDetails {
  id: PlanTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  maxAgents: number;
  maxDeals: number | null; // null = unlimited
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanTier, PlanDetails> = {
  SOLO: {
    id: 'SOLO',
    name: 'Solo Channel Partner',
    monthlyPrice: 4999,
    annualPrice: 49999,
    maxAgents: 1,
    maxDeals: 15,
    features: [
      'Up to 15 Active Buyer Deals',
      'Sub-15s WhatsApp Speed-to-Lead Auto-Reply',
      'Digital Brochure PDF & Floor Plan Dispatch',
      'Site Visit Walk-in Scheduler & Google Maps Pin',
      'Indian Rupee (₹ Lakhs & Crores) Tracking',
    ],
  },
  TEAM: {
    id: 'TEAM',
    name: 'Brokerage Team',
    monthlyPrice: 14999,
    annualPrice: 149999,
    maxAgents: 10,
    maxDeals: null,
    features: [
      'Unlimited Active Deals & Walkthroughs',
      'Up to 10 Licensed Agent / Telecaller seats',
      'Omnichannel WhatsApp Business & Voice Notes',
      'Meta (FB/IG) Lead Ads & 99acres Sync',
      'Plivo Speed-to-Lead Outbound AI Calling',
      '45-Day Lead Protection & Claim Lock for Agents',
    ],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Developer / Builder Enterprise',
    monthlyPrice: 39999,
    annualPrice: 399999,
    maxAgents: 100,
    maxDeals: null,
    features: [
      'Unlimited Calling Seats & In-House Telecallers',
      'Multi-Project Inventory & Master Stacking',
      'Custom Agent Hinglish Voice Cloning Digital Twin',
      'High-Scale Batch Campaign Dialing Center',
      'Dedicated Account Manager & 24/7 Setup Support',
    ],
  },
};

export interface CreateCheckoutParams {
  organizationId: string;
  userEmail: string;
  plan: PlanTier;
  isAnnual?: boolean;
  successUrl?: string;
  cancelUrl?: string;
}

export async function createCheckoutSession(params: CreateCheckoutParams): Promise<{ url: string; mock: boolean }> {
  const { organizationId, userEmail, plan, isAnnual = false, successUrl, cancelUrl } = params;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) {
    throw createError('Organization not found', 404);
  }

  const defaultSuccess = successUrl || `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const defaultCancel = cancelUrl || `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/pricing?checkout=cancelled`;

  // If Stripe is not configured or in local sandbox development, simulate instantaneous checkout
  if (!stripe) {
    logger.warn(`[Billing] Stripe not configured (STRIPE_SECRET_KEY missing). Simulating checkout session for org ${organizationId}`);
    
    // Auto-update org tier in development mode for instantaneous gratification
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionTier: plan,
        subscriptionStatus: 'ACTIVE',
        planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const mockUrl = defaultSuccess.replace('{CHECKOUT_SESSION_ID}', `mock_cs_${Date.now()}`);
    return { url: mockUrl, mock: true };
  }

  const planInfo = PLAN_CONFIGS[plan] || PLAN_CONFIGS.SOLO;
  const unitAmount = (isAnnual ? planInfo.annualPrice : planInfo.monthlyPrice) * 100;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: userEmail,
    client_reference_id: organizationId,
    metadata: {
      organizationId,
      planTier: plan,
      isAnnual: String(isAnnual),
    },
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: {
            name: `Eigen Estate — ${planInfo.name}`,
            description: `${planInfo.features[0]} • ${planInfo.features[1]}`,
          },
          unit_amount: unitAmount,
          recurring: {
            interval: isAnnual ? 'year' : 'month',
          },
        },
        quantity: 1,
      },
    ],
    success_url: defaultSuccess,
    cancel_url: defaultCancel,
  });

  return { url: session.url || defaultSuccess, mock: false };
}

export async function createCustomerPortalSession(organizationId: string, returnUrl?: string): Promise<{ url: string; mock: boolean }> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!org) {
    throw createError('Organization not found', 404);
  }

  const defaultReturn = returnUrl || `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/pricing`;

  if (!stripe || !org.stripeCustomerId) {
    logger.info(`[Billing] Customer portal fallback for org ${organizationId}`);
    return { url: defaultReturn, mock: true };
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: defaultReturn,
  });

  return { url: portalSession.url, mock: false };
}

export async function getSubscriptionStatus(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: { select: { id: true, role: true } },
      deals: { select: { id: true } },
    },
  });

  if (!org) {
    throw createError('Organization not found', 404);
  }

  const tier = (org.subscriptionTier as PlanTier) || 'SOLO';
  const planInfo = PLAN_CONFIGS[tier] || PLAN_CONFIGS.SOLO;

  return {
    organizationId: org.id,
    organizationName: org.name,
    tier,
    status: org.subscriptionStatus || 'ACTIVE',
    stateJurisdiction: org.stateJurisdiction || 'CA',
    planExpiresAt: org.planExpiresAt,
    hasStripeCustomer: Boolean(org.stripeCustomerId),
    planDetails: planInfo,
    usage: {
      activeDeals: org.deals.length,
      maxDeals: planInfo.maxDeals,
      seatsUsed: org.users.length,
      maxSeats: planInfo.maxAgents,
    },
  };
}

export async function handleWebhookEvent(payload: Buffer | string, signature: string): Promise<{ received: boolean }> {
  if (!stripe || !stripeWebhookSecret) {
    logger.warn('[Billing Webhook] Stripe or STRIPE_WEBHOOK_SECRET not configured.');
    return { received: true };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    logger.error(`[Billing Webhook] Signature verification failed: ${message}`);
    throw createError(`Webhook signature verification failed: ${message}`, 400);
  }

  logger.info(`[Billing Webhook] Received Stripe event: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.client_reference_id || session.metadata?.['organizationId'];
      const planTier = (session.metadata?.['planTier'] as PlanTier) || 'SOLO';
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (orgId) {
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            subscriptionTier: planTier,
            subscriptionStatus: 'ACTIVE',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            planExpiresAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
          },
        });
        logger.info(`[Billing Webhook] Organization ${orgId} upgraded to ${planTier}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const status = subscription.status === 'active' ? 'ACTIVE' : subscription.status === 'past_due' ? 'PAST_DUE' : 'CANCELED';

      await prisma.organization.updateMany({
        where: { stripeCustomerId: customerId },
        data: { subscriptionStatus: status },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await prisma.organization.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          subscriptionTier: 'SOLO',
          subscriptionStatus: 'CANCELED',
        },
      });
      logger.info(`[Billing Webhook] Subscription deleted for customer ${customerId}`);
      break;
    }

    default:
      logger.debug(`[Billing Webhook] Unhandled event type: ${event.type}`);
  }

  return { received: true };
}
