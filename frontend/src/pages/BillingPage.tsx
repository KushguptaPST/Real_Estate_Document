import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Wallet,
  Receipt,
  Check,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  Layers,
  Send,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  billingApi,
  walletApi,
  type SubscriptionStatusResponse,
  type WalletStateResponse,
} from '@/services/api';
import { WORKSPACE_PLANS, type PlanTier } from '@/data/plans';
import { openRazorpayCheckout } from '@/utils/razorpay';
import { WorkspacePageSkeleton } from '@/components/ui/skeleton';

type BillingTab = 'plan' | 'wallet' | 'ledger';
type LedgerFilter = 'ALL' | 'CREDIT' | 'DEBIT';

export function BillingPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const isOwner = user?.role === 'OWNER';

  const [activeTab, setActiveTab] = useState<BillingTab>('plan');
  const [isAnnual, setIsAnnual] = useState(true);

  const [loading, setLoading] = useState(
    () => !(billingApi.getCachedSubscription() && walletApi.getCached()),
  );
  const [subscription, setSubscription] = useState<SubscriptionStatusResponse | null>(
    () => billingApi.getCachedSubscription(),
  );
  const [wallet, setWallet] = useState<WalletStateResponse | null>(() => walletApi.getCached());

  const [loadingPlan, setLoadingPlan] = useState<PlanTier | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Wallet Top-Up & Auto-Recharge state
  const [depositingAmount, setDepositingAmount] = useState<number | null>(null);
  const [customTopupInput, setCustomTopupInput] = useState('1000');
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(
    () => walletApi.getCached()?.autoRecharge.enabled ?? false,
  );
  const [thresholdInput, setThresholdInput] = useState(
    () => String(walletApi.getCached()?.autoRecharge.threshold ?? 500),
  );
  const [rechargeInput, setRechargeInput] = useState(
    () => String(walletApi.getCached()?.autoRecharge.rechargeAmount ?? 2000),
  );
  const [savingAutoRecharge, setSavingAutoRecharge] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('ALL');

  const loadBillingData = useCallback(async () => {
    const hasWarmCache = Boolean(billingApi.getCachedSubscription() && walletApi.getCached());
    try {
      if (!hasWarmCache) setLoading(true);
      const [sub, wal] = await Promise.all([
        billingApi.getSubscription(),
        walletApi.getWallet(),
      ]);
      setSubscription(sub);
      setWallet(wal);
      setAutoRechargeEnabled(wal.autoRecharge.enabled);
      setThresholdInput(String(wal.autoRecharge.threshold));
      setRechargeInput(String(wal.autoRecharge.rechargeAmount));
    } catch (err: any) {
      if (!hasWarmCache) {
        toast.error('Failed to load billing details', err.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const handlePlanCheckout = async (plan: PlanTier) => {
    if (!isOwner) {
      toast.error('Permission required', 'Only a Brokerage Admin (Owner) can change subscription plans.');
      return;
    }

    try {
      setLoadingPlan(plan);
      const order = await billingApi.createRazorpayOrder({
        type: 'SUBSCRIPTION_PLAN',
        plan,
        isAnnual,
      });
      const rzpResponse = await openRazorpayCheckout(order);
      await billingApi.verifyRazorpayPayment({
        ...rzpResponse,
        type: 'SUBSCRIPTION_PLAN',
        plan,
        isAnnual,
      });
      await Promise.all([loadBillingData(), refreshUser()]);
      toast.success('Subscription updated', `Your workspace is now active on the ${plan} tier.`);
    } catch (err: any) {
      toast.error('Plan update failed', err.message || 'Could not process Razorpay payment');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleTopUp = async (amountInr: number) => {
    if (!isOwner) {
      toast.error('Permission required', 'Only a Brokerage Admin (Owner) can add wallet credits.');
      return;
    }
    if (!Number.isFinite(amountInr) || amountInr < 100 || amountInr > 50000) {
      toast.error('Invalid top-up amount', 'Enter an amount between ₹100 and ₹50,000.');
      return;
    }

    try {
      setDepositingAmount(amountInr);
      const order = await billingApi.createRazorpayOrder({
        type: 'WALLET_TOPUP',
        amountInr,
      });
      const rzpResponse = await openRazorpayCheckout(order);
      const verified = await billingApi.verifyRazorpayPayment({
        ...rzpResponse,
        type: 'WALLET_TOPUP',
        amountInr,
      });
      await loadBillingData();
      toast.success(
        'Wallet credited via Razorpay',
        `Added ₹${amountInr.toLocaleString('en-IN')}. New balance: ₹${(verified.newBalance ?? amountInr).toLocaleString('en-IN')}.`
      );
    } catch (err: any) {
      toast.error('Top-up failed', err.message || 'Could not process wallet deposit');
    } finally {
      setDepositingAmount(null);
    }
  };

  const handleSaveAutoRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      toast.error('Permission required', 'Only a Brokerage Admin (Owner) can modify auto-recharge rules.');
      return;
    }

    const threshold = Number(thresholdInput);
    const rechargeAmount = Number(rechargeInput);
    if (!Number.isFinite(threshold) || threshold < 10 || threshold > 25000) {
      toast.error('Invalid threshold', 'Trigger threshold must be between ₹10 and ₹25,000.');
      return;
    }
    if (!Number.isFinite(rechargeAmount) || rechargeAmount < 50 || rechargeAmount > 50000) {
      toast.error('Invalid recharge amount', 'Auto-recharge amount must be between ₹50 and ₹50,000.');
      return;
    }

    try {
      setSavingAutoRecharge(true);
      await walletApi.updateAutoRecharge({
        enabled: autoRechargeEnabled,
        threshold,
        rechargeAmount,
      });
      await loadBillingData();
      toast.success('Auto-recharge saved', autoRechargeEnabled ? `Auto top-up (+₹${rechargeAmount.toLocaleString('en-IN')}) active below ₹${threshold.toLocaleString('en-IN')}.` : 'Auto-recharge paused.');
    } catch (err: any) {
      toast.error('Could not save settings', err.message || 'Please try again.');
    } finally {
      setSavingAutoRecharge(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setOpeningPortal(true);
      const res = await billingApi.createPortalSession(`${window.location.origin}/billing`);
      if (!res.mock && res.url) {
        window.location.href = res.url;
        return;
      }
      setActiveTab('ledger');
      toast.success('Razorpay Ledger Ready', 'All payments, wallet top-ups, and receipts are shown in Invoices & Ledger below.');
    } catch (err: any) {
      toast.error('Portal unavailable', err.message || 'Could not open billing portal');
    } finally {
      setOpeningPortal(false);
    }
  };

  if (loading && !subscription) {
    return <WorkspacePageSkeleton variant="billing" />;
  }

  const currentTier = (subscription?.tier || user?.subscriptionTier || 'SOLO') as PlanTier;
  const activePlan = WORKSPACE_PLANS.find((p) => p.id === currentTier) ?? WORKSPACE_PLANS[0];
  const seatsUsed = subscription?.usage.seatsUsed ?? 1;
  const maxSeats = subscription?.usage.maxSeats ?? activePlan.maxSeats;
  const activeDeals = subscription?.usage.activeDeals ?? 0;
  const maxDeals = subscription?.usage.maxDeals ?? null;
  const seatPct = Math.min(100, Math.round((seatsUsed / Math.max(1, maxSeats)) * 100));
  const dealPct = maxDeals ? Math.min(100, Math.round((activeDeals / maxDeals) * 100)) : 12;

  const filteredTx = (wallet?.transactions ?? []).filter((tx) => {
    if (ledgerFilter === 'ALL') return true;
    return tx.type === ledgerFilter;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Plan &amp; Billing</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
              {activePlan.name} &bull; {subscription?.status || 'ACTIVE'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your subscription tier, team seat &amp; deal quotas, INR wallet credits, and Razorpay receipts for{' '}
            <span className="font-semibold text-slate-700">{subscription?.organizationName || user?.organizationName}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenPortal}
          disabled={openingPortal}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
        >
          {openingPortal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 text-slate-500" />}
          <span>Invoices &amp; Receipts</span>
        </button>
      </div>

      {!isOwner && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
          <Lock className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            You are signed in as an Advisor. You can inspect current plan quotas and usage below, while plan upgrades and wallet deposits require a Brokerage Admin (Owner).
          </span>
        </div>
      )}

      {/* Overview Quota & Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Current Plan & Deals Quota */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-700" /> Active Deal Quota
            </span>
            <span className="text-xs font-bold font-mono text-slate-900">
              {activeDeals} / {maxDeals ?? 'Unlimited'}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${dealPct >= 90 && maxDeals ? 'bg-rose-500' : 'bg-emerald-600'}`}
              style={{ width: `${Math.max(4, dealPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            {maxDeals ? `${Math.max(0, maxDeals - activeDeals)} deal slots remaining on ${activePlan.name}.` : 'Unlimited escrow & contingency tracking active.'}
          </p>
        </div>

        {/* Card 2: Agent Seat Quota */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-700" /> Licensed Team Seats
            </span>
            <span className="text-xs font-bold font-mono text-slate-900">
              {seatsUsed} / {maxSeats}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${seatPct >= 90 ? 'bg-amber-500' : 'bg-slate-900'}`}
              style={{ width: `${Math.max(6, seatPct)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            {Math.max(0, maxSeats - seatsUsed)} invite {maxSeats - seatsUsed === 1 ? 'seat' : 'seats'} remaining before plan upgrade is needed.
          </p>
        </div>

        {/* Card 3: Pre-Paid Credits Balance */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-emerald-700" /> Wallet Balance
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              <Send className="h-2.5 w-2.5" /> Telegram ₹0
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono text-slate-900">
              ₹{(wallet?.balance ?? 0).toLocaleString('en-IN')}
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
            >
              Top Up Wallet →
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Total deposited: ₹{(wallet?.stats.totalDeposited ?? 0).toLocaleString('en-IN')} INR
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-white border border-slate-200 p-1 shadow-2xs">
        {[
          { id: 'plan' as const, label: 'Subscription & Upgrade', icon: CreditCard },
          { id: 'wallet' as const, label: 'Wallet & Auto-Recharge', icon: Wallet },
          { id: 'ledger' as const, label: 'Invoices & Ledger', icon: Receipt },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Plan & Upgrade */}
      {activeTab === 'plan' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Choose Your Workspace Plan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upgrade or switch tiers anytime. Changes apply immediately via Razorpay (+ 18% GST).
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  !isAnnual ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isAnnual ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Annual</span>
                <span className="rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                  -20%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {WORKSPACE_PLANS.map((plan) => {
              const isCurrent = currentTier === plan.id;
              const price = isAnnual ? plan.annualMonthlyEquivalentInr : plan.monthlyPriceInr;
              const busy = loadingPlan === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`bg-white rounded-2xl p-6 flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'border-2 border-emerald-600 ring-4 ring-emerald-50 shadow-sm'
                      : 'border border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isCurrent
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isCurrent ? 'Current Plan' : plan.badgeText}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">{plan.tagline}</p>

                    <div className="mt-4 pb-4 border-b border-slate-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold font-mono text-slate-900">
                          ₹{price.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-slate-500">/ month</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">
                        {isAnnual
                          ? `₹${plan.annualTotalInr.toLocaleString('en-IN')} billed annually (+ 18% GST)`
                          : 'Billed monthly (+ 18% GST)'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 my-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Team Seats</span>
                        <span className="font-bold text-slate-900">{plan.maxSeats} {plan.maxSeats === 1 ? 'Seat' : 'Seats'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Active Deals</span>
                        <span className="font-bold text-slate-900">{plan.maxDealsLabel}</span>
                      </div>
                    </div>

                    <ul className="space-y-2.5 text-xs text-slate-600 mb-6">
                      {plan.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    disabled={isCurrent || busy || !isOwner}
                    onClick={() => handlePlanCheckout(plan.id)}
                    className={`w-full rounded-xl py-2.5 px-4 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed ${
                      isCurrent
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : !isOwner
                        ? 'bg-slate-100 text-slate-400 border border-slate-200'
                        : plan.id === 'TEAM'
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                        : 'bg-[#0A0A0A] hover:bg-slate-800 text-white shadow-xs'
                    }`}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Processing via Razorpay...</span>
                      </>
                    ) : isCurrent ? (
                      'Current Active Plan'
                    ) : (
                      `Switch to ${plan.name}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Wallet & Auto-Recharge */}
      {activeTab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top-Up Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Top Up Prepaid Credits</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Telegram AI Bot runs at ₹0 per message. Wallet credits cover optional future voice &amp; WhatsApp channels.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold font-mono text-emerald-800">
                ₹{(wallet?.balance ?? 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Quick Razorpay Presets (INR)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[500, 1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={!isOwner || depositingAmount !== null}
                    onClick={() => handleTopUp(amt)}
                    className={`rounded-xl py-2.5 px-3 text-xs font-bold border transition-all cursor-pointer disabled:opacity-50 ${
                      amt === 2500
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] hover:bg-slate-800'
                        : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {depositingAmount === amt ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                    ) : (
                      `+₹${amt.toLocaleString('en-IN')}`
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Custom Deposit Amount (INR)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={100}
                  max={50000}
                  value={customTopupInput}
                  onChange={(e) => setCustomTopupInput(e.target.value)}
                  disabled={!isOwner}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  disabled={!isOwner || depositingAmount !== null}
                  onClick={() => handleTopUp(Number(customTopupInput))}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {depositingAmount === Number(customTopupInput) ? 'Processing...' : 'Add Credits'}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">Telegram AI Bot</span>
                <span className="font-bold text-emerald-700 font-mono">₹0 / unlimited (Active)</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>AI Voice Calling (Coming Soon)</span>
                <span className="font-mono">₹{wallet?.unitRates.voicePerMinute ?? 12} / min</span>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>WhatsApp Business API (Coming Soon)</span>
                <span className="font-mono">₹{wallet?.unitRates.whatsappPerLead ?? 3} / lead</span>
              </div>
            </div>
          </div>

          {/* Auto-Recharge Form */}
          <form onSubmit={handleSaveAutoRecharge} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Auto-Recharge Safeguard</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Prevent service interruption when your balance drops below a threshold.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isOwner}
                  onClick={() => setAutoRechargeEnabled((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    autoRechargeEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition ${
                      autoRechargeEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Trigger Below (₹)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={25000}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    disabled={!isOwner}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Auto Top-Up Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={50000}
                    value={rechargeInput}
                    onChange={(e) => setRechargeInput(e.target.value)}
                    disabled={!isOwner}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
                <span>INR Razorpay Safeguard</span>
              </div>
              <button
                type="submit"
                disabled={!isOwner || savingAutoRecharge}
                className="rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingAutoRecharge && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Auto-Recharge</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: Invoices & Wallet Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Payment &amp; Wallet Ledger</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete history of Razorpay deposits, credits, and usage deductions.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-auto">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'CREDIT', label: 'Credits' },
                  { id: 'DEBIT', label: 'Debits' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLedgerFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    ledgerFilter === f.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Sparkles className="h-6 w-6 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No transactions match this filter</p>
              <p className="text-xs text-slate-500">
                Wallet deposits and metered charges will appear here with running balances.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="py-3 px-5">Date &amp; Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-5 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTx.map((tx) => {
                    const isCredit = tx.type === 'CREDIT';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(tx.timestamp).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isCredit
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isCredit ? (
                              <ArrowDownLeft className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-800 font-medium">{tx.description}</td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                            isCredit ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {isCredit ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-slate-600 whitespace-nowrap">
                          ₹{tx.balanceAfter.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
