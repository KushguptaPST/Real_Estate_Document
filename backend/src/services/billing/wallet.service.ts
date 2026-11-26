/**
 * Real Estate Autonomous Platform — Persistent PostgreSQL INR Prepaid Telephony & Messaging Wallet
 */

import { logger } from '../../utils/logger.js';
import { prisma } from '../../utils/prisma.js';
import { createError } from '../../middleware/errorHandler.js';

export type TransactionCategory =
  | 'VOICE_CALL'
  | 'WHATSAPP_QUALIFICATION'
  | 'VOICE_CLONE_PROFILE'
  | 'DEPOSIT'
  | 'AUTO_RECHARGE'
  | 'REFUND';

export interface WalletTransaction {
  id: string;
  timestamp: string;
  type: 'CREDIT' | 'DEBIT';
  category: TransactionCategory;
  description: string;
  amount: number;
  balanceAfter: number;
  metadata?: Record<string, any>;
}

export interface AutoRechargeConfig {
  enabled: boolean;
  threshold: number;
  rechargeAmount: number;
}

export interface UnitRates {
  voicePerMinute: number;
  whatsappPerLead: number;
  voiceCloneProfile: number;
}

export interface WalletState {
  organizationId: string;
  balance: number;
  currency: 'INR';
  autoRecharge: AutoRechargeConfig;
  unitRates: UnitRates;
  transactions: WalletTransaction[];
  stats: {
    totalSpent: number;
    voiceMinutesBilled: number;
    leadsQualified: number;
    totalDeposited: number;
  };
}

// Authoritative INR unit rates (Plivo + Deepgram + Gemini + ElevenLabs Flash v2.5 + WhatsApp)
const UNIT_RATES: UnitRates = {
  voicePerMinute: 15,
  whatsappPerLead: 3,
  voiceCloneProfile: 1200,
};

async function ensureDbWallet(orgId: string) {
  let wallet = await prisma.organizationWallet.findUnique({
    where: { organizationId: orgId },
  });

  if (!wallet) {
    wallet = await prisma.organizationWallet.create({
      data: {
        organizationId: orgId,
        balance: 0.0,
        currency: 'INR',
        totalDeposited: 0.0,
        autoRechargeEnabled: false,
        rechargeThreshold: 500,
        rechargeAmount: 2000,
      },
    });
  }

  return wallet;
}

export class WalletService {
  async hasSufficientBalance(orgId: string, minRequiredInr = UNIT_RATES.voicePerMinute): Promise<{
    ok: boolean;
    balance: number;
    currency: 'INR';
  }> {
    const dbWallet = await ensureDbWallet(orgId);
    const balance = Math.round(dbWallet.balance * 100) / 100;
    return { ok: balance >= minRequiredInr, balance, currency: 'INR' };
  }

  async ensureSufficientBalance(orgId: string, minRequiredInr = UNIT_RATES.voicePerMinute): Promise<number> {
    const check = await this.hasSufficientBalance(orgId, minRequiredInr);
    if (!check.ok) {
      throw createError(
        `Insufficient wallet balance (₹${check.balance.toFixed(2)}). Minimum ₹${minRequiredInr} required to place outbound AI calls. Please top up in Billing.`,
        402,
      );
    }
    return check.balance;
  }

  async getWallet(orgId: string): Promise<WalletState> {
    const dbWallet = await ensureDbWallet(orgId);
    const entries = await prisma.walletLedgerEntry.findMany({
      where: { walletId: dbWallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      organizationId: orgId,
      balance: dbWallet.balance,
      currency: 'INR',
      autoRecharge: {
        enabled: dbWallet.autoRechargeEnabled,
        threshold: dbWallet.rechargeThreshold,
        rechargeAmount: dbWallet.rechargeAmount,
      },
      unitRates: UNIT_RATES,
      transactions: entries.map((e) => ({
        id: e.id,
        timestamp: e.createdAt.toISOString(),
        type: e.type as 'CREDIT' | 'DEBIT',
        category: e.category as TransactionCategory,
        description: e.description,
        amount: e.amount,
        balanceAfter: e.balanceAfter,
        metadata: (e.metadata as Record<string, any>) ?? undefined,
      })),
      stats: {
        totalSpent: dbWallet.totalSpent,
        voiceMinutesBilled: dbWallet.voiceMinutesBilled,
        leadsQualified: dbWallet.leadsQualified,
        totalDeposited: dbWallet.totalDeposited,
      },
    };
  }

  async updateAutoRecharge(
    orgId: string,
    config: Partial<AutoRechargeConfig>,
  ): Promise<AutoRechargeConfig> {
    await ensureDbWallet(orgId);
    const updated = await prisma.organizationWallet.update({
      where: { organizationId: orgId },
      data: {
        ...(config.enabled !== undefined ? { autoRechargeEnabled: config.enabled } : {}),
        ...(config.threshold !== undefined && config.threshold >= 100
          ? { rechargeThreshold: Number(config.threshold) }
          : {}),
        ...(config.rechargeAmount !== undefined && config.rechargeAmount >= 500
          ? { rechargeAmount: Number(config.rechargeAmount) }
          : {}),
      },
    });

    return {
      enabled: updated.autoRechargeEnabled,
      threshold: updated.rechargeThreshold,
      rechargeAmount: updated.rechargeAmount,
    };
  }

  async depositCredits(
    orgId: string,
    amountInr: number,
    options?: {
      userEmail?: string;
      isAutoRecharge?: boolean;
      razorpayPaymentId?: string;
      razorpayOrderId?: string;
      successUrl?: string;
      cancelUrl?: string;
    },
  ): Promise<{ success: boolean; newBalance: number; transaction: WalletTransaction; duplicate?: boolean; isSimulated: boolean }> {
    const depositAmount = Math.max(1, Math.round(amountInr * 100) / 100);
    const dbWallet = await ensureDbWallet(orgId);

    // Idempotency check if Razorpay payment ID was supplied
    if (options?.razorpayPaymentId) {
      const existingEntries = await prisma.walletLedgerEntry.findMany({
        where: { walletId: dbWallet.id, category: 'DEPOSIT' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      const existing = existingEntries.find(
        (e) => (e.metadata as any)?.razorpayPaymentId === options.razorpayPaymentId,
      );
      if (existing) {
        return {
          success: true,
          newBalance: dbWallet.balance,
          duplicate: true,
          transaction: {
            id: existing.id,
            timestamp: existing.createdAt.toISOString(),
            type: 'CREDIT',
            category: 'DEPOSIT',
            description: existing.description,
            amount: existing.amount,
            balanceAfter: existing.balanceAfter,
          },
          isSimulated: false,
        };
      }
    }

    const category: TransactionCategory = options?.isAutoRecharge ? 'AUTO_RECHARGE' : 'DEPOSIT';
    const description = options?.razorpayPaymentId
      ? `Razorpay Wallet Top-Up (₹${depositAmount.toLocaleString('en-IN')}) — ${options.razorpayPaymentId}`
      : options?.isAutoRecharge
      ? `Automatic Balance Safeguard Recharge (₹${depositAmount.toLocaleString('en-IN')})`
      : `Pre-Paid Usage Credit Deposit (₹${depositAmount.toLocaleString('en-IN')})`;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.organizationWallet.update({
        where: { id: dbWallet.id },
        data: {
          balance: { increment: depositAmount },
          totalDeposited: { increment: depositAmount },
          currency: 'INR',
        },
      });
      const entry = await tx.walletLedgerEntry.create({
        data: {
          walletId: dbWallet.id,
          type: 'CREDIT',
          category,
          description,
          amount: depositAmount,
          balanceAfter: Math.round(updated.balance * 100) / 100,
          metadata: {
            depositAmount,
            isAutoRecharge: Boolean(options?.isAutoRecharge),
            ...(options?.razorpayPaymentId ? { razorpayPaymentId: options.razorpayPaymentId } : {}),
            ...(options?.razorpayOrderId ? { razorpayOrderId: options.razorpayOrderId } : {}),
          },
        },
      });
      return { updated, entry };
    });

    return {
      success: true,
      newBalance: Math.round(result.updated.balance * 100) / 100,
      transaction: {
        id: result.entry.id,
        timestamp: result.entry.createdAt.toISOString(),
        type: 'CREDIT',
        category,
        description,
        amount: depositAmount,
        balanceAfter: result.entry.balanceAfter,
      },
      isSimulated: !Boolean(options?.razorpayPaymentId),
    };
  }

  async deductVoiceCall(
    orgId: string,
    durationSeconds: number,
    metadata?: { leadId?: string; leadName?: string; callUuid?: string },
  ): Promise<WalletTransaction | null> {
    if (durationSeconds <= 0) return null;

    const dbWallet = await ensureDbWallet(orgId);
    // Fair 30-second pulse billing (₹7.50 per 30s pulse at ₹15/min; ₹0 on unanswered calls)
    const pulses = Math.max(1, Math.ceil(durationSeconds / 30));
    const billedMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
    const cost = Math.round(pulses * (UNIT_RATES.voicePerMinute / 2) * 100) / 100;
    const leadDisplay = metadata?.leadName ? ` — ${metadata.leadName}` : '';
    const description = `ElevenLabs + Plivo AI Call (${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s)${leadDisplay}`;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.organizationWallet.update({
        where: { id: dbWallet.id },
        data: {
          balance: { decrement: cost },
          totalSpent: { increment: cost },
          voiceMinutesBilled: { increment: billedMinutes },
        },
      });
      const entry = await tx.walletLedgerEntry.create({
        data: {
          walletId: dbWallet.id,
          type: 'DEBIT',
          category: 'VOICE_CALL',
          description,
          amount: -cost,
          balanceAfter: Math.round(updated.balance * 100) / 100,
          metadata: { durationSeconds, pulses30s: pulses, minutesBilled: pulses * 0.5, ...metadata },
        },
      });
      return { updated, entry };
    });

    return {
      id: result.entry.id,
      timestamp: result.entry.createdAt.toISOString(),
      type: 'DEBIT',
      category: 'VOICE_CALL',
      description,
      amount: -cost,
      balanceAfter: result.entry.balanceAfter,
    };
  }

  async deductWhatsAppQualification(
    orgId: string,
    metadata?: { leadId?: string; phone?: string; leadName?: string },
  ): Promise<WalletTransaction | null> {
    const dbWallet = await ensureDbWallet(orgId);
    const cost = UNIT_RATES.whatsappPerLead;
    const nameDisplay = metadata?.leadName || metadata?.phone || 'Inbound Buyer';
    const description = `WhatsApp Speed-to-Lead Qualification — ${nameDisplay}`;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.organizationWallet.update({
        where: { id: dbWallet.id },
        data: {
          balance: { decrement: cost },
          totalSpent: { increment: cost },
          leadsQualified: { increment: 1 },
        },
      });
      const entry = await tx.walletLedgerEntry.create({
        data: {
          walletId: dbWallet.id,
          type: 'DEBIT',
          category: 'WHATSAPP_QUALIFICATION',
          description,
          amount: -cost,
          balanceAfter: Math.round(updated.balance * 100) / 100,
          metadata: { cost, ...metadata },
        },
      });
      return { updated, entry };
    });

    logger.info(
      `[Wallet Debit] Deducted ₹${cost} for WhatsApp qualification on org ${orgId}. Remaining balance: ₹${result.entry.balanceAfter}`,
    );

    return {
      id: result.entry.id,
      timestamp: result.entry.createdAt.toISOString(),
      type: 'DEBIT',
      category: 'WHATSAPP_QUALIFICATION',
      description,
      amount: -cost,
      balanceAfter: result.entry.balanceAfter,
    };
  }
}

export const walletService = new WalletService();
