import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  ShieldCheck,
  Zap,
  Calculator,
  Users,
  CreditCard,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Wallet,
  PhoneCall,
  MessageSquare,
  RefreshCw,
  ArrowDownLeft,
  Clock,
  Phone,
  HelpCircle,
  ChevronDown,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { PublicHeader } from '@/components/landing/PublicHeader';
import {
  billingApi,
  walletApi,
  type SubscriptionStatusResponse,
  type WalletStateResponse,
} from '@/services/api';

export function PricingPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isAnnual, setIsAnnual] = useState(true);
  const [seats, setSeats] = useState(5);
  const [monthlyLeads, setMonthlyLeads] = useState(60);
  const [avgCommission, setAvgCommission] = useState(9000);

  const [subscription, setSubscription] = useState<SubscriptionStatusResponse | null>(null);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Metered Wallet State
  const [wallet, setWallet] = useState<WalletStateResponse | null>(null);
  const [depositingAmount, setDepositingAmount] = useState<number | null>(null);
  const [updatingAutoRecharge, setUpdatingAutoRecharge] = useState(false);
  const [simulatingDebit, setSimulatingDebit] = useState(false);

  // FAQ Accordion Open State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const checkoutSuccess = searchParams.get('checkout') === 'success';
  const walletSuccess = searchParams.get('wallet') === 'success';

  const loadWallet = useCallback(async () => {
    try {
      const data = await walletApi.getWallet();
      setWallet(data);
    } catch (err) {
      console.warn('Failed to load wallet data:', err);
    }
  }, []);

  useEffect(() => {
    if (user?.organizationId) {
      billingApi.getSubscription()
        .then(setSubscription)
        .catch((err) => console.warn('Failed to load subscription status:', err));
      loadWallet();
    }
  }, [user, loadWallet]);

  const handleDeposit = async (amount: number) => {
    setDepositingAmount(amount);
    try {
      const res = await walletApi.depositCredits(amount);
      if (res.checkoutUrl && !res.isSimulated) {
        window.location.href = res.checkoutUrl;
      } else {
        await loadWallet();
        toast.success(
          'Wallet Credited',
          `Successfully deposited $${amount.toFixed(2)} into your pre-paid telephony balance.`
        );
      }
    } catch (err: any) {
      toast.error('Deposit Failed', err.message || 'Could not process deposit');
    } finally {
      setDepositingAmount(null);
    }
  };

  const handleToggleAutoRecharge = async () => {
    if (!wallet) return;
    setUpdatingAutoRecharge(true);
    try {
      const nextEnabled = !wallet.autoRecharge.enabled;
      await walletApi.updateAutoRecharge({ enabled: nextEnabled });
      await loadWallet();
      toast.success(
        'Auto-Recharge Updated',
        nextEnabled
          ? `Auto-recharge enabled. Balance will top up by $${wallet.autoRecharge.rechargeAmount} if it falls below $${wallet.autoRecharge.threshold}.`
          : 'Auto-recharge disabled. Telephony calls will pause if balance reaches $0.'
      );
    } catch (err: any) {
      toast.error('Update Failed', err.message);
    } finally {
      setUpdatingAutoRecharge(false);
    }
  };

  const handleSimulateDebit = async (type: 'VOICE_CALL' | 'WHATSAPP_QUALIFICATION') => {
    setSimulatingDebit(true);
    try {
      const res = await walletApi.simulateDeduction({
        type,
        durationSeconds: type === 'VOICE_CALL' ? 184 : undefined,
        leadName: type === 'VOICE_CALL' ? 'Rajesh Rao (Simulated)' : 'Deepa Menon (Simulated)',
      });
      await loadWallet();
      toast.success(
        type === 'VOICE_CALL' ? 'Call Minutes Billed (-$0.54)' : 'WhatsApp Lead Billed (-$0.06)',
        `Deducted ${type === 'VOICE_CALL' ? '3 mins ($0.54)' : '$0.06'}. New balance: $${res.currentBalance.toFixed(2)}`
      );
    } catch (err: any) {
      toast.error('Simulation Failed', err.message);
    } finally {
      setSimulatingDebit(false);
    }
  };

  const handleCheckout = async (plan: 'SOLO' | 'TEAM' | 'ENTERPRISE') => {
    if (!user) {
      window.location.href = `/signup?plan=${plan}&annual=${isAnnual}`;
      return;
    }
    setLoadingCheckout(plan);
    try {
      const res = await billingApi.createCheckoutSession({
        plan,
        isAnnual,
        successUrl: `${window.location.origin}/pricing?checkout=success`,
        cancelUrl: window.location.href,
      });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      toast.error('Checkout Error', err.message || 'Failed to initiate checkout');
    } finally {
      setLoadingCheckout(null);
    }
  };

  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await billingApi.createPortalSession(window.location.href);
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not open billing portal';
      toast.error('Portal Error', msg);
    } finally {
      setOpeningPortal(false);
    }
  };

  const calculateTeamPrice = () => {
    const base = isAnnual ? 119 : 149;
    return seats * base;
  };

  // Speed-to-Lead Math (HBR Benchmark: Response under 60 seconds increases conversion by up to 391%)
  const extraDealsPerYear = Math.round((monthlyLeads * (0.65 - 0.22) * 0.04) * 12 * 10) / 10;
  const extraGciPerYear = Math.round(extraDealsPerYear * avgCommission);

  const faqs = [
    {
      q: 'How does the AI voice calling billing work?',
      a: 'Inbound and outbound duplex calling runs on carrier-direct rates ($0.18/minute) billed second-by-second from your pre-paid wallet. There are no monthly minutes that expire, and auto-recharge ensures your AI copilot never drops a prospective buyer call.',
    },
    {
      q: 'Does Contingency Copilot replace our Transaction Coordinator?',
      a: 'No, it supercharges them. Our 50-state statutory engine performs the deterministic date math, coordinates line citations (§4.2, Pg 4, Line 18), and dispatches warning alerts so your TC can manage 4x more files without E&O liability risk.',
    },
    {
      q: 'Can human agents take over a live AI voice conversation?',
      a: 'Yes. Our 3-tier takeover switchboard allows an agent or principal broker to monitor a live transcript and jump into the audio bridge with a single click. The AI voice politely introduces the licensed agent and drops off.',
    },
    {
      q: 'How are state-specific holidays and counting rules handled?',
      a: 'The calculation engine contains codified statutory definitions for all 50 states (e.g. NWMLS Washington 9:00 PM cutoff, CAR California 11:59 PM cutoff, TREC Texas next business day rollover). No LLM guesses dates—all calculations are 100% deterministic.',
    },
    {
      q: 'Can I export our audit logs in the event of an E&O dispute?',
      a: 'Yes. Every alert dispatched, date confirmed, and document uploaded generates an immutable SHA-256 cryptographic audit receipt with email delivery headers admissible in legal arbitration.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#0A0A0A] pb-28 selection:bg-emerald-100 selection:text-emerald-900">
      {/* ── Minimalist Top Navigation ── */}
      <PublicHeader />

      {/* ── Hero Header ── */}
      <section className="relative overflow-hidden pt-28 pb-14 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] mb-5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Deterministic Escrow Surveillance &bull; Carrier-Direct Telephony</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#0A0A0A] max-w-3xl mx-auto leading-[1.08]">
            Invest in closed transactions. <br />
            <span className="text-[#047857]">Eliminate contract risk.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[#4B5563] max-w-2xl mx-auto leading-relaxed font-normal">
            One missed contingency deadline forfeits a $25,000+ deposit. One delayed inquiry response loses the buyer. Choose the tier engineered for high-producing teams.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 p-1 rounded-full bg-white border border-[#E5E7EB] shadow-xs">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                !isAnnual
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#0A0A0A]'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isAnnual
                  ? 'bg-[#0A0A0A] text-white shadow-xs'
                  : 'text-[#6B7280] hover:text-[#0A0A0A]'
              }`}
            >
              <span>Annual Billing</span>
              <span className="bg-[#ECFDF5] text-[#047857] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Success Celebration Banners ── */}
      {checkoutSuccess && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center gap-3 text-[#065F46] text-xs">
            <CheckCircle2 className="h-5 w-5 text-[#047857] shrink-0" />
            <div className="flex-1">
              <span className="font-bold text-sm block">Subscription Successfully Activated!</span>
              <span>Your workspace has been upgraded with full contingency surveillance, automated risk alerts, and priority outbox capacity.</span>
            </div>
          </div>
        </section>
      )}

      {walletSuccess && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-4 rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center gap-3 text-[#065F46] text-xs">
            <CheckCircle2 className="h-5 w-5 text-[#047857] shrink-0" />
            <div className="flex-1">
              <span className="font-bold text-sm block">Wallet Credits Successfully Deposited!</span>
              <span>Your pre-paid balance has been updated. Outbound duplex calling and WhatsApp speed-to-lead are fully powered.</span>
            </div>
          </div>
        </section>
      )}

      {/* ── Active Subscription Strip (Logged-In User) ── */}
      {user && subscription && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-10">
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-[#F8F9FA] text-[#0A0A0A] border border-[#E5E7EB] flex items-center justify-center font-bold shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#0A0A0A]">{subscription.organizationName}</span>
                  <Badge variant="neutral" className="bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] text-[10px] px-2 py-0.5 font-bold">
                    {subscription.tier} TIER ({subscription.status})
                  </Badge>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Jurisdiction: <span className="font-medium text-[#0A0A0A]">{subscription.stateJurisdiction}</span> &bull; Active Deals: <span className="font-medium text-[#0A0A0A]">{subscription.usage.activeDeals} / {subscription.usage.maxDeals ?? 'Unlimited'}</span> &bull; Agent Seats: <span className="font-medium text-[#0A0A0A]">{subscription.usage.seatsUsed} / {subscription.usage.maxSeats}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPortal}
                disabled={openingPortal}
                className="rounded-full text-xs font-semibold border-[#E5E7EB] hover:bg-[#F8F9FA]"
              >
                {openingPortal ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="mr-1.5 h-3.5 w-3.5" />}
                Billing Portal &amp; Invoices
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── Pricing Cards Grid ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Card 1: Solo Producer */}
          <Card className={`bg-white relative flex flex-col p-8 rounded-3xl border transition-all ${
            subscription?.tier === 'SOLO'
              ? 'border-2 border-[#0A0A0A] shadow-md'
              : 'border-[#E5E7EB] shadow-xs hover:border-[#CBD5E1] hover:shadow-md'
          }`}>
            {subscription?.tier === 'SOLO' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-[#0A0A0A] text-white px-3 py-0.5 font-bold text-[10px] rounded-full">
                  Current Active Plan
                </Badge>
              </div>
            )}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#0A0A0A]">Solo Producer</h3>
                <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Independent Agent</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                Autonomous contract surveillance and lead capture for high-volume solo agents.
              </p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-[#0A0A0A] font-mono tracking-tight">
                  ₹{isAnnual ? '3,999' : '4,999'}
                </span>
                <span className="text-xs font-medium text-[#6B7280]">/ month</span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-1 font-mono">
                {isAnnual ? '₹47,988 billed annually (+ 18% GST)' : 'Billed monthly (+ 18% GST)'}
              </p>
            </div>

            <div className="border-t border-[#F3F4F6] pt-6 mb-8 flex-1">
              <span className="text-[11px] font-bold text-[#0A0A0A] uppercase tracking-wider block mb-3">Included Capabilities:</span>
              <ul className="space-y-3 text-xs text-[#4B5563]">
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Up to <strong>15 active escrow transactions</strong> simultaneously</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Instant OCR ingestion for scanned PDFs &amp; executed addenda</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>NWMLS, CAR, FAR/BAR, TREC 50-state statutory date engine</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Verifiable PDF page citation deep-links (§4.2, Pg 4, Line 18)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Transactional Outbox Email alerts (Client + Agent notify)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Basic E&amp;O audit trail export</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => handleCheckout('SOLO')}
              disabled={loadingCheckout === 'SOLO' || subscription?.tier === 'SOLO'}
              className={`w-full rounded-full font-semibold py-2.5 text-xs h-10 transition-all ${
                subscription?.tier === 'SOLO'
                  ? 'bg-[#F3F4F6] text-[#6B7280] cursor-default'
                  : 'bg-[#0A0A0A] hover:bg-[#1F2937] text-white shadow-xs'
              }`}
            >
              {loadingCheckout === 'SOLO' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : subscription?.tier === 'SOLO' ? (
                'Current Active Plan'
              ) : user ? (
                'Switch to Solo Producer'
              ) : (
                'Get Started with Solo'
              )}
            </Button>
          </Card>

          {/* Card 2: Brokerage Team (Featured) */}
          <Card className={`bg-white relative flex flex-col p-8 rounded-3xl border-2 transition-all shadow-lg scale-[1.02] ${
            subscription?.tier === 'TEAM'
              ? 'border-[#047857] ring-4 ring-[#ECFDF5]'
              : 'border-[#0A0A0A] ring-4 ring-[#F3F4F6]'
          }`}>
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <Badge className="bg-[#047857] text-white px-3.5 py-1 font-semibold text-[11px] shadow-xs border-0 rounded-full">
                <span>Most Popular for Teams</span>
              </Badge>
            </div>

            <div className="mb-6 mt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#0A0A0A]">Brokerage Team</h3>
                <span className="text-[11px] font-semibold text-[#047857] uppercase tracking-wider">Top Producing Teams</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                Full-stack AI speed-to-lead voice copilot + escrow risk radar for brokerages.
              </p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-[#0A0A0A] font-mono tracking-tight">
                  ₹{isAnnual ? '11,999' : '14,999'}
                </span>
                <span className="text-xs font-medium text-[#6B7280]">/ month</span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-1 font-mono">
                {isAnnual ? 'Billed annually per team (+ 18% GST)' : 'Billed monthly per team (+ 18% GST)'}
              </p>
            </div>

            <div className="border-t border-[#F3F4F6] pt-6 mb-8 flex-1">
              <span className="text-[11px] font-bold text-[#0A0A0A] uppercase tracking-wider block mb-3">Everything in Solo, plus:</span>
              <ul className="space-y-3 text-xs text-[#4B5563]">
                <li className="flex items-start gap-2.5 font-medium text-[#0A0A0A]">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span><strong>Unlimited active transactions</strong> across all team members</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>AI Inbound Phone Copilot (Sub-60s response + WhatsApp qualification)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>GraphRAG long-term buyer memory &amp; showing tour scheduler</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>3-tier live call takeover switchboard for licensed agents</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Brokerage Risk Radar &amp; E&amp;O certified audit log downloads</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Transaction Coordinator multi-agent pipeline routing</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => handleCheckout('TEAM')}
              disabled={loadingCheckout === 'TEAM' || subscription?.tier === 'TEAM'}
              className={`w-full rounded-full font-semibold py-2.5 text-xs h-10 transition-all shadow-xs ${
                subscription?.tier === 'TEAM'
                  ? 'bg-[#047857] hover:bg-[#047857] text-white cursor-default'
                  : 'bg-[#047857] hover:bg-[#065F46] text-white'
              }`}
            >
              {loadingCheckout === 'TEAM' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : subscription?.tier === 'TEAM' ? (
                'Current Active Plan'
              ) : user ? (
                'Upgrade to Brokerage Team'
              ) : (
                'Get Started with Team'
              )}
            </Button>
          </Card>

          {/* Card 3: Enterprise Platform */}
          <Card className={`bg-white relative flex flex-col p-8 rounded-3xl border transition-all ${
            subscription?.tier === 'ENTERPRISE'
              ? 'border-2 border-[#0A0A0A] shadow-md'
              : 'border-[#E5E7EB] shadow-xs hover:border-[#CBD5E1] hover:shadow-md'
          }`}>
            {subscription?.tier === 'ENTERPRISE' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-[#0A0A0A] text-white px-3 py-0.5 font-bold text-[10px] rounded-full">
                  Current Active Plan
                </Badge>
              </div>
            )}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#0A0A0A]">Enterprise Platform</h3>
                <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Brokerage Franchises</span>
              </div>
              <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
                Custom infrastructure, multi-office routing, and legal indemnification.
              </p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-[#0A0A0A] font-mono tracking-tight">
                  Custom
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-1 font-mono">
                Volume-tiered licensing with dedicated enterprise SLA
              </p>
            </div>

            <div className="border-t border-[#F3F4F6] pt-6 mb-8 flex-1">
              <span className="text-[11px] font-bold text-[#0A0A0A] uppercase tracking-wider block mb-3">Enterprise Governance:</span>
              <ul className="space-y-3 text-xs text-[#4B5563]">
                <li className="flex items-start gap-2.5 font-medium text-[#0A0A0A]">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Custom state contract parser training &amp; proprietary riders</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Dedicated Plivo / Twilio telephony carrier SIP trunk</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Single Sign-On (SSO) via Okta, SAML 2.0 &amp; Google Workspace</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>Managing Broker compliance review queue with dual-signoff</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>SOC2 Type II compliance audit packet &amp; E&amp;O carrier indemnity</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-[#047857] shrink-0 mt-0.5" />
                  <span>99.99% Uptime Guarantee &amp; 1-Hour Critical Response SLA</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => handleCheckout('ENTERPRISE')}
              disabled={loadingCheckout === 'ENTERPRISE' || subscription?.tier === 'ENTERPRISE'}
              variant="outline"
              className="w-full rounded-full border-[#E5E7EB] hover:bg-[#F8F9FA] text-[#0A0A0A] font-semibold py-2.5 text-xs h-10 transition-all"
            >
              {loadingCheckout === 'ENTERPRISE' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : subscription?.tier === 'ENTERPRISE' ? (
                'Current Active Plan'
              ) : (
                'Contact Enterprise Sales'
              )}
            </Button>
          </Card>

        </div>
      </section>

      {/* ── Feature 12: Pre-Paid Metered Telephony & Voice Wallet ── */}
      {user && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-20">
          <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] flex items-center justify-center shrink-0">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#0A0A0A]">Pre-Paid Telephony &amp; AI Voice Wallet</h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#047857] animate-pulse" />
                      Carrier Ready
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Direct-at-cost metered rates for Plivo duplex voice calls and Meta WhatsApp sessions.
                  </p>
                </div>
              </div>

              {/* Dev Simulation Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-[#9CA3AF] mr-1">Dev Sandbox:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulateDebit('VOICE_CALL')}
                  disabled={simulatingDebit}
                  className="rounded-full text-xs font-medium border-[#E5E7EB] hover:bg-[#F8F9FA] h-8"
                >
                  <Phone className="mr-1.5 h-3 w-3 text-[#047857]" />
                  Simulate Call (-$0.54)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulateDebit('WHATSAPP_QUALIFICATION')}
                  disabled={simulatingDebit}
                  className="rounded-full text-xs font-medium border-[#E5E7EB] hover:bg-[#F8F9FA] h-8"
                >
                  <MessageSquare className="mr-1.5 h-3 w-3 text-emerald-600" />
                  Simulate WA (-$0.06)
                </Button>
              </div>
            </div>

            {/* 3 Metric & Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              
              {/* Card 1: Balance & Quick Deposit */}
              <div className="rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Available Balance</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-[#0A0A0A] font-mono tracking-tight">
                      ${wallet ? wallet.balance.toFixed(2) : '482.50'}
                    </span>
                    <span className="text-xs font-medium text-[#6B7280]">USD</span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-1">
                    ~{wallet ? Math.floor(wallet.balance / 0.18) : 2680} voice call minutes available
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E5E7EB]">
                  <span className="text-[11px] font-semibold text-[#4B5563] block mb-2">Instant Credit Top-Up:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[50, 150, 300, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleDeposit(amt)}
                        disabled={depositingAmount !== null}
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          amt === 150
                            ? 'bg-[#0A0A0A] text-white border-[#0A0A0A] hover:bg-[#1F2937]'
                            : 'bg-white text-[#0A0A0A] border-[#E5E7EB] hover:bg-[#F3F4F6]'
                        }`}
                      >
                        {depositingAmount === amt ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                        ) : (
                          `+$${amt}`
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 2: Transparent Unit Rates */}
              <div className="rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Unit Usage Rates</span>
                  <div className="mt-3 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="h-3.5 w-3.5 text-[#047857]" />
                        <span className="font-medium text-[#0A0A0A]">Duplex Voice Telephony</span>
                      </div>
                      <span className="font-mono font-bold text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">
                        ${wallet?.unitRates.voicePerMinute.toFixed(2) ?? '0.18'} / min
                      </span>
                    </div>

                    <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-medium text-[#0A0A0A]">WhatsApp Inbound</span>
                      </div>
                      <span className="font-mono font-bold text-[#0A0A0A] bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">
                        ${wallet?.unitRates.whatsappPerLead.toFixed(2) ?? '0.06'} / lead
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="h-3.5 w-3.5 text-amber-500" />
                        <span className="font-medium text-[#0A0A0A]">Digital Voice Twin</span>
                      </div>
                      <span className="font-mono font-bold text-[#047857]">
                        {subscription?.tier === 'SOLO' ? '₹1,200' : 'Included'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E5E7EB] text-[11px] text-[#6B7280] flex items-center justify-between">
                  <span>Carrier: Plivo High-Throughput</span>
                  <span className="text-[#047857] font-semibold">Sub-450ms STT/TTS</span>
                </div>
              </div>

              {/* Card 3: Auto-Recharge Safeguard */}
              <div className="rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Auto-Recharge Safeguard</span>
                    <button
                      type="button"
                      onClick={handleToggleAutoRecharge}
                      disabled={updatingAutoRecharge}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        wallet?.autoRecharge.enabled ? 'bg-[#047857]' : 'bg-[#D1D5DB]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                          wallet?.autoRecharge.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-[#6B7280] mt-2 leading-relaxed">
                    Automatically tops up balance so AI voice calling never cuts out during an active inbound lead call.
                  </p>

                  <div className="mt-4 bg-white rounded-xl p-3 border border-[#E5E7EB] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#6B7280]">Trigger Threshold:</span>
                      <span className="font-mono font-bold text-[#0A0A0A]">
                        &lt; ${wallet?.autoRecharge.threshold.toFixed(2) ?? '50.00'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#6B7280]">Auto-Top-Up:</span>
                      <span className="font-mono font-bold text-[#047857]">
                        +${wallet?.autoRecharge.rechargeAmount.toFixed(2) ?? '200.00'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center gap-1.5 text-[11px] text-[#6B7280]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#047857] shrink-0" />
                  <span>Stripe Auto-Billing Protected</span>
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* ── Interactive Dual-Impact ROI Calculators ── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mb-20 space-y-10">
        
        {/* Calculator 1: Brokerage Team Investment Calculator */}
        <div className="bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-[#F8F9FA] text-[#0A0A0A] border border-[#E5E7EB]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0A0A0A]">Brokerage Team Investment Calculator</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">Adjust active producer seat count to project annual earnest money protection</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold mb-2">
                <span className="text-[#4B5563] flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#9CA3AF]" /> Active Agents &amp; Transaction Coordinators:
                </span>
                <span className="text-[#0A0A0A] text-sm font-bold font-mono bg-[#F8F9FA] px-3 py-1 rounded-lg border border-[#E5E7EB]">
                  {seats} Licensed Seats
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full h-2 bg-[#F3F4F6] rounded-lg appearance-none cursor-pointer accent-[#047857]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-[#F8F9FA] border border-[#E5E7EB] text-center">
              <div>
                <p className="text-xs text-[#6B7280]">Monthly Team Cost</p>
                <p className="text-2xl font-bold text-[#0A0A0A] font-mono mt-1">${calculateTeamPrice()}/mo</p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Protected Earnest Money Pipeline</p>
                <p className="text-2xl font-bold text-[#047857] font-mono mt-1">${(seats * 25000).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">E&amp;O Defense ROI</p>
                <p className="text-2xl font-bold text-[#0A0A0A] font-mono mt-1">{Math.round((seats * 25000) / (calculateTeamPrice() * 12))}x Value</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calculator 2: Speed-to-Lead Revenue Growth Engine */}
        <div className="bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#0A0A0A]">Speed-to-Lead Revenue Growth Engine</h2>
                <span className="text-[10px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] px-2 py-0.5 rounded-full">
                  HBR Benchmark
                </span>
              </div>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Responding under 60 seconds increases contact &amp; qualification rates by 391%.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#F8F9FA] p-6 rounded-2xl border border-[#E5E7EB]">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-xs text-[#6B7280] mb-1.5 font-medium">
                  <label>Inbound Buyer Inquiries / Month</label>
                  <span className="text-xs font-bold text-[#0A0A0A] font-mono bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">
                    {monthlyLeads} leads
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={monthlyLeads}
                  onChange={(e) => setMonthlyLeads(Number(e.target.value))}
                  className="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer accent-[#047857]"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-xs text-[#6B7280] mb-1.5 font-medium">
                  <label>Avg Commission per Deal (GCI)</label>
                  <span className="text-xs font-bold text-[#0A0A0A] font-mono bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">
                    ${avgCommission.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="3000"
                  max="35000"
                  step="1000"
                  value={avgCommission}
                  onChange={(e) => setAvgCommission(Number(e.target.value))}
                  className="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer accent-[#047857]"
                />
              </div>
            </div>

            <div className="flex flex-col justify-center items-center bg-white p-5 rounded-xl border border-[#E5E7EB] text-center">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6B7280] mb-1">
                Projected Additional Annual GCI
              </span>
              <div className="text-4xl font-extrabold text-[#047857] tracking-tight font-mono">
                +${extraGciPerYear.toLocaleString()}
              </div>
              <p className="text-xs text-[#6B7280] mt-2">
                Yields ~<strong className="text-[#0A0A0A]">{extraDealsPerYear} extra closed deals</strong> per year from sub-60s voice qualification &amp; tour scheduling.
              </p>
            </div>
          </div>
        </div>

      </section>

      {/* ── Feature Comparison Matrix ── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mb-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A] tracking-tight">Compare Platform Capabilities</h2>
          <p className="text-xs sm:text-sm text-[#6B7280] mt-1.5">Transparent breakdown of features across all three tiers</p>
        </div>

        <div className="bg-white rounded-3xl border border-[#E5E7EB] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#4B5563] border-collapse">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[#0A0A0A] font-semibold">
                  <th className="py-4 px-6 text-xs">Feature</th>
                  <th className="py-4 px-4 text-center">Solo Producer</th>
                  <th className="py-4 px-4 text-center bg-[#ECFDF5]/50 text-[#047857]">Brokerage Team</th>
                  <th className="py-4 px-4 text-center">Enterprise Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#0A0A0A]">50-State Statutory Date Engine (NWMLS, CAR, TREC, FAR/BAR)</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-[#ECFDF5]/30"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#0A0A0A]">Verbatim PDF Line Citations (§4.2, Pg 4, Line 18)</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-[#ECFDF5]/30"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#0A0A0A]">Transactional Outbox Alert Escalation (Email + Push)</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center bg-[#ECFDF5]/30"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#0A0A0A]">Duplex AI Inbound Voice Copilot &amp; Tour Booking</td>
                  <td className="py-3.5 px-4 text-center text-[#9CA3AF]">—</td>
                  <td className="py-3.5 px-4 text-center bg-[#ECFDF5]/30"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#0A0A0A]">Live Human Call Takeover Switchboard</td>
                  <td className="py-3.5 px-4 text-center text-[#9CA3AF]">—</td>
                  <td className="py-3.5 px-4 text-center bg-[#ECFDF5]/30"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#0A0A0A]">E&amp;O Defense Audit Log Certification</td>
                  <td className="py-3.5 px-4 text-center text-[#6B7280]">Basic CSV</td>
                  <td className="py-3.5 px-4 text-center bg-[#ECFDF5]/30 font-semibold text-[#047857]">SHA-256 Verified</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-[#047857]">Carrier Indemnified</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#0A0A0A]">Custom Brokerage Addenda &amp; Rider Fine-Tuning</td>
                  <td className="py-3.5 px-4 text-center text-[#9CA3AF]">—</td>
                  <td className="py-3.5 px-4 text-center bg-[#ECFDF5]/30 text-[#9CA3AF]">—</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3.5 px-6 font-medium text-[#0A0A0A]">SSO (Okta, SAML 2.0, Google Workspace) &amp; Dedicated SLA</td>
                  <td className="py-3.5 px-4 text-center text-[#9CA3AF]">—</td>
                  <td className="py-3.5 px-4 text-center bg-[#ECFDF5]/30 text-[#9CA3AF]">—</td>
                  <td className="py-3.5 px-4 text-center"><Check className="h-4 w-4 text-[#047857] mx-auto" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ Accordion ── */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 mb-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">Frequently Asked Questions</h2>
          <p className="text-xs text-[#6B7280] mt-1">Everything you need to know about pricing, billing, and legal defense</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden transition-all shadow-xs"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm text-[#0A0A0A] hover:bg-[#F8F9FA] transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`h-4 w-4 text-[#6B7280] shrink-0 transition-transform duration-200 ${openFaq === idx ? 'rotate-180 text-[#047857]' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-xs text-[#4B5563] leading-relaxed border-t border-[#F3F4F6] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="rounded-3xl bg-white border border-[#E5E7EB] p-10 sm:p-14 relative overflow-hidden shadow-xs space-y-4">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#0A0A0A]">
              Ready to secure your active pipeline?
            </h2>
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed max-w-xl mx-auto">
              Start your 14-day free trial. Ingest an executed purchase agreement or test an inbound voice call in under 90 seconds.
            </p>
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full bg-[#0A0A0A] text-white hover:bg-[#1F2937] font-semibold text-xs px-6 h-11 shadow-xs">
                <Link to="/signup">
                  Start Free Trial <ArrowRight className="ml-1.5 h-4 w-4 inline" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full border-[#E5E7EB] bg-white text-[#0A0A0A] hover:bg-[#F8F9FA] text-xs px-6 h-11 font-medium shadow-2xs">
                <Link to="/#cockpit">Explore Live Cockpit</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
