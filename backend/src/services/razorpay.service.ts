// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Orders & Signature Verification Service (Zero External SDK)
// Uses Razorpay REST API v1 + HMAC-SHA256 verification for INR Subscriptions
// and Prepaid AI/Telephony Wallet Top-Ups.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

export interface CreateRazorpayOrderParams {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  orderId: string;
  amountPaise: number;
  amountInr: number;
  currency: 'INR';
  keyId: string;
  isSimulated: boolean;
}

export function getRazorpayCredentials(): { keyId?: string; keySecret?: string; webhookSecret?: string } {
  return {
    keyId: process.env['RAZORPAY_KEY_ID'] || undefined,
    keySecret: process.env['RAZORPAY_KEY_SECRET'] || undefined,
    webhookSecret: process.env['RAZORPAY_WEBHOOK_SECRET'] || undefined,
  };
}

export function isRazorpayConfigured(): boolean {
  const { keyId, keySecret } = getRazorpayCredentials();
  return Boolean(keyId && keySecret);
}

/**
 * Creates a Razorpay Order via REST API v1 (or deterministic test order when keys are unset).
 */
export async function createRazorpayOrder(params: CreateRazorpayOrderParams): Promise<RazorpayOrderResult> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const amountInr = Math.max(1, Math.round(params.amountInr));
  const amountPaise = amountInr * 100;

  if (!keyId || !keySecret) {
    const simOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    logger.info(`[Razorpay Simulated Order] ${simOrderId} for ₹${amountInr}`);
    return {
      orderId: simOrderId,
      amountPaise,
      amountInr,
      currency: 'INR',
      keyId: 'rzp_test_simulated',
      isSimulated: true,
    };
  }

  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt: params.receipt.slice(0, 40),
      notes: params.notes || {},
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = (await res.json()) as {
    id?: string;
    amount?: number;
    currency?: string;
    error?: { description?: string; code?: string };
  };

  if (!res.ok || !data.id) {
    const errMsg = data.error?.description || `Razorpay order creation failed (${res.status})`;
    logger.error(`[Razorpay API Error] ${errMsg}`);
    throw new Error(errMsg);
  }

  return {
    orderId: data.id,
    amountPaise: data.amount ?? amountPaise,
    amountInr,
    currency: 'INR',
    keyId,
    isSimulated: false,
  };
}

/**
 * Verifies Razorpay Checkout payment signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 */
export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = getRazorpayCredentials();
  if (!keySecret) {
    // Allow simulated order verification only in non-production when keys are unset
    return (
      params.orderId.startsWith('order_sim_') &&
      params.signature === 'sim_sig' &&
      process.env['NODE_ENV'] !== 'production'
    );
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
  } catch {
    return false;
  }
}

/**
 * Verifies Razorpay webhook signature (`X-Razorpay-Signature`) over raw request body.
 */
export function verifyRazorpayWebhookSignature(rawBody: Buffer | string, signatureHeader: string): boolean {
  const { webhookSecret } = getRazorpayCredentials();
  if (!webhookSecret) return false;

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}
