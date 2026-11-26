import { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  Cpu,
  FileCheck2,
  IndianRupee,
  LogOut,
  PauseCircle,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  adminApi,
  type AdminOverviewResponse,
  type AdminTenantDetail,
  type AdminTenantSummary,
} from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { EigenEstateIcon } from '@/components/brand/EigenEstateLogo';

type AdminSection = 'OVERVIEW' | 'TENANTS' | 'KYC' | 'SWITCHBOARD' | 'AUDIT';

const TTS_LABELS: Record<string, string> = {
  eleven_flash_v2_5: 'ElevenLabs Flash v2.5 (ulaw 8kHz)',
  cartesia_sonic: 'Cartesia Sonic (pcm_mulaw 8kHz)',
  edge_neural: 'Microsoft Edge Neural TTS',
};

const PROVIDER_LABELS: Record<string, string> = {
  PLIVO_VOICE: 'Plivo India Voice PSTN',
  PLIVO_DID: 'Plivo Indian DID Rentals',
  ELEVENLABS_TTS: 'ElevenLabs Flash v2.5 Voice',
  CARTESIA_TTS: 'Cartesia Sonic Voice',
  EDGE_TTS: 'Microsoft Edge Neural (Fallback)',
  DEEPGRAM_STT: 'Deepgram Nova-2 Streaming STT',
  GEMINI_LLM: 'Google Gemini Agent LLM',
  META_WHATSAPP: 'Meta WhatsApp Cloud API',
  RAZORPAY_FEE: 'Razorpay Payment Gateway (2.36%)',
};

const TIER_LABELS: Record<string, string> = {
  SOLO: 'Solo Partner',
  TEAM: 'Brokerage Team',
  ENTERPRISE: 'Builder / Mandate',
};

const formatInr = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Math.abs(val) >= 100 ? 0 : 2,
  }).format(val);

export function AdminPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [section, setSection] = useState<AdminSection>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [tenants, setTenants] = useState<AdminTenantSummary[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'SOLO' | 'TEAM' | 'ENTERPRISE' | 'SUSPENDED'>('ALL');

  // Tenant intervention slide-over
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminTenantDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Operational controls
  const [walletAmount, setWalletAmount] = useState('1000');
  const [walletReason, setWalletReason] = useState('Onboarding / goodwill AI calling credits');
  const [suspendReason, setSuspendReason] = useState('Compliance review or billing overdue');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Switchboard state
  const [ttsEngine, setTtsEngine] = useState<'eleven_flash_v2_5' | 'cartesia_sonic' | 'edge_neural'>('eleven_flash_v2_5');
  const [llmModel, setLlmModel] = useState('gemini-2.5-flash');
  const [maxConcurrency, setMaxConcurrency] = useState(50);
  const [autoFailover, setAutoFailover] = useState(true);
  const [dialerPaused, setDialerPaused] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tRes] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getTenants(search || undefined),
      ]);
      setOverview(ov);
      setTenants(tRes.tenants);
      setTtsEngine(ov.config.primaryTtsEngine);
      setLlmModel(ov.config.primaryLlmModel);
      setMaxConcurrency(ov.config.maxPlatformConcurrency);
      setAutoFailover(ov.config.autoFailoverEnabled);
      setDialerPaused(ov.config.outboundDialerPaused);
      setLastSyncedAt(new Date());
    } catch (err: any) {
      toast.error(err.message || 'Check PLATFORM_ADMIN_EMAILS configuration.', 'Unable to load Console');
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openTenantDetail = async (orgId: string) => {
    setSelectedOrgId(orgId);
    setDetailLoading(true);
    try {
      const res = await adminApi.getTenantDetail(orgId);
      setDetail(res);
    } catch (err: any) {
      toast.error(err.message || 'Unable to inspect workspace', 'Inspection failed');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setBusyAction('config');
    try {
      const res = await adminApi.updateConfig({
        primaryTtsEngine: ttsEngine,
        primaryLlmModel: llmModel,
        maxPlatformConcurrency: Number(maxConcurrency) || 50,
        autoFailoverEnabled: autoFailover,
        outboundDialerPaused: dialerPaused,
        note: 'Updated via Eigen Estate Executive Console',
      });
      toast.success(`Active voice engine: ${TTS_LABELS[res.config.primaryTtsEngine] || res.config.primaryTtsEngine}`, 'Configuration saved');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update configuration', 'Save failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleKillSwitch = async () => {
    const nextPaused = !dialerPaused;
    setBusyAction('kill');
    try {
      await adminApi.updateConfig({
        outboundDialerPaused: nextPaused,
        note: nextPaused ? 'Global outbound campaign dialer paused' : 'Global outbound campaign dialer resumed',
      });
      setDialerPaused(nextPaused);
      if (nextPaused) {
        toast.warning('All outbound AI campaign dialing across tenants is now halted.', 'Global Dialer Paused');
      } else {
        toast.success('Outbound AI campaign dialing has resumed.', 'Global Dialer Active');
      }
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Unable to update dialer state', 'Action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleKyc = async (orgId: string, status: 'ACCEPTED' | 'REJECTED' | 'SUBMITTED') => {
    setBusyAction(`kyc-${orgId}-${status}`);
    try {
      await adminApi.updateKyc(orgId, { status });
      toast.success(`Plivo India KYC updated to ${status}`);
      await loadAll();
      if (selectedOrgId === orgId) {
        await openTenantDetail(orgId);
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to update KYC status', 'KYC update failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAdjustWallet = async (orgId: string) => {
    const amt = Number(walletAmount);
    if (!Number.isFinite(amt) || amt === 0) {
      toast.error('Enter a valid non-zero INR amount');
      return;
    }
    setBusyAction('wallet');
    try {
      const res = await adminApi.adjustWallet(orgId, {
        amountInr: amt,
        reason: walletReason.trim() || 'Executive adjustment',
      });
      toast.success(`Updated wallet balance: ${formatInr(res.newBalance)}`);
      await Promise.all([loadAll(), openTenantDetail(orgId)]);
    } catch (err: any) {
      toast.error(err.message || 'Unable to adjust wallet balance', 'Wallet update failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleSuspend = async (orgId: string, currentlySuspended: boolean) => {
    setBusyAction('suspend');
    try {
      await adminApi.updateOrgStatus(orgId, {
        isSuspended: !currentlySuspended,
        reason: !currentlySuspended ? suspendReason : 'Workspace reactivated by Platform Operations',
      });
      if (currentlySuspended) {
        toast.success('Workspace access restored');
      } else {
        toast.warning('Workspace suspended and running campaigns paused');
      }
      await Promise.all([loadAll(), openTenantDetail(orgId)]);
    } catch (err: any) {
      toast.error(err.message || 'Unable to update status', 'Action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePauseCampaigns = async (orgId: string) => {
    setBusyAction('pause-campaigns');
    try {
      const res = await adminApi.pauseTenantCampaigns(orgId);
      toast.success(`Paused ${res.pausedCount} active campaign(s)`);
      await Promise.all([loadAll(), openTenantDetail(orgId)]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to pause campaigns', 'Action failed');
    } finally {
      setBusyAction(null);
    }
  };

  const kpis = overview?.kpis;
  const maxCogsItem = Math.max(1, ...(overview?.providerBreakdown.map((p) => p.costInr) || [1]));

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (tierFilter === 'SUSPENDED') return t.isSuspended;
      if (tierFilter !== 'ALL') return t.subscriptionTier === tierFilter;
      return true;
    });
  }, [tenants, tierFilter]);

  const kycQueue = useMemo(() => {
    return tenants.filter((t) => t.id !== 'demo-sandbox-org');
  }, [tenants]);

  const navItems: Array<{ id: AdminSection; label: string; icon: any; badge?: string | number }> = [
    { id: 'OVERVIEW', label: 'Executive P&L', icon: TrendingUp },
    { id: 'TENANTS', label: 'Brokerages', icon: Building2, badge: tenants.length },
    {
      id: 'KYC',
      label: 'India Plivo KYC',
      icon: FileCheck2,
      badge: kpis && kpis.pendingKycCount > 0 ? kpis.pendingKycCount : undefined,
    },
    { id: 'SWITCHBOARD', label: 'AI & Telephony', icon: Cpu },
    { id: 'AUDIT', label: 'Governance Log', icon: Activity },
  ];

  const sectionMeta: Record<AdminSection, { title: string; subtitle: string }> = {
    OVERVIEW: {
      title: 'Executive Revenue & Unit Economics',
      subtitle: 'Real-time INR subscription MRR, actual vendor COGS, and platform margin performance.',
    },
    TENANTS: {
      title: 'Brokerage Accounts & Profitability',
      subtitle: 'Manage workspace plans, seat utilization, wallet balances, and account health.',
    },
    KYC: {
      title: 'India Telephony Compliance (Plivo KYC)',
      subtitle: 'Verify brokerage business entities before activating Indian outbound DIDs.',
    },
    SWITCHBOARD: {
      title: 'AI Model Routing & Telephony Safety',
      subtitle: 'Control primary voice synthesis engines, automatic failover thresholds, and emergency dialer controls.',
    },
    AUDIT: {
      title: 'Operations Governance Trail',
      subtitle: 'Immutable log of wallet adjustments, KYC approvals, suspensions, and switchboard changes.',
    },
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F6F7F9] text-slate-900 font-sans">
      {/* ── Dedicated Company Admin Navigation Rail (Completely Separate from Customer CRM) ── */}
      <aside className="w-64 shrink-0 bg-[#0B0F14] text-slate-200 flex flex-col border-r border-slate-800/80">
        {/* Brand Identity */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
              <EigenEstateIcon className="h-5 w-5" fill="#34D399" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-tight">Eigen Estate</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Company Operations Console</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Control Plane
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-white/12 text-white font-semibold shadow-xs border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`h-4 w-4 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                      item.id === 'KYC'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Operator Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Platform Founder'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Operations Viewport ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Executive Bar */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 tracking-tight truncate">
              {sectionMeta[section].title}
            </h1>
            <p className="text-xs text-slate-500 truncate">{sectionMeta[section].subtitle}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {dialerPaused ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Outbound Dialer Paused
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Systems Operational
              </span>
            )}

            {lastSyncedAt && (
              <span className="hidden md:inline text-[11px] text-slate-400 tabular-nums">
                Synced {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-7">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* ── SECTION 1: EXECUTIVE P&L ── */}
            {section === 'OVERVIEW' && kpis && (
              <>
                {/* Top KPI Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>30-DAY GROSS REVENUE</span>
                      <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <IndianRupee className="h-4 w-4 text-emerald-700" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2.5">
                      {formatInr(kpis.grossRevenue30dInr)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      MRR {formatInr(kpis.monthlySubscriptionMrrInr)} + Topups {formatInr(kpis.extraTopups30dInr)}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>VENDOR INFRASTRUCTURE COST</span>
                      <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Cpu className="h-4 w-4 text-amber-700" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2.5">
                      {formatInr(kpis.totalCogs30dInr)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      {kpis.totalCallMinutes30d} voice mins · {kpis.totalAgentRuns30d} AI turns
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>CONTRIBUTION PROFIT</span>
                      <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      </div>
                    </div>
                    <p
                      className={`text-2xl font-bold tabular-nums mt-2.5 ${
                        kpis.netProfit30dInr >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {formatInr(kpis.netProfit30dInr)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      Platform Gross Margin:{' '}
                      <span className="font-bold text-slate-900">{kpis.grossMarginPct}%</span>
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>ACTIVE ACCOUNTS &amp; FLOAT</span>
                      <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Wallet className="h-4 w-4 text-slate-700" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-2.5">
                      {kpis.activePaidOrgs} Active{' '}
                      <span className="text-sm font-medium text-slate-400">/ {kpis.totalOrgs} total</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      Prepaid Float: {formatInr(kpis.totalWalletLiabilityInr)} · Suspended: {kpis.suspendedOrgs}
                    </p>
                  </div>
                </div>

                {/* Middle Row: Vendor COGS + Runtime Telemetry */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          30-Day Vendor Spend Breakdown
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Metered automatically across Plivo calls, voice synthesis, STT, LLM tokens, WhatsApp, and Razorpay fees.
                        </p>
                      </div>
                    </div>

                    {overview.providerBreakdown.length === 0 ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-5 space-y-4">
                        <p className="text-xs text-slate-600">
                          No live billable vendor events logged in the past 30 days yet. Baseline blended cost model currently active:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-xl bg-white border border-slate-200/70">
                            <p className="text-slate-500 font-medium">AI Voice Calling</p>
                            <p className="font-bold text-slate-900 mt-1 tabular-nums">₹15.00 / min billed</p>
                            <p className="text-[11px] text-emerald-700 mt-0.5">~₹2.45/min blended vendor cost</p>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200/70">
                            <p className="text-slate-500 font-medium">WhatsApp Speed-to-Lead</p>
                            <p className="font-bold text-slate-900 mt-1 tabular-nums">₹3.00 / lead billed</p>
                            <p className="text-[11px] text-emerald-700 mt-0.5">~₹0.85/template Meta fee</p>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200/70">
                            <p className="text-slate-500 font-medium">Payment Gateway</p>
                            <p className="font-bold text-slate-900 mt-1 tabular-nums">2.36% Razorpay fee</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">2% MDR + 18% GST auto-tracked</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {overview.providerBreakdown.map((item) => {
                          const widthPct = Math.max(4, Math.round((item.costInr / maxCogsItem) * 100));
                          return (
                            <div key={item.provider} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">
                                  {PROVIDER_LABELS[item.provider] || item.provider}
                                </span>
                                <span className="text-slate-600 tabular-nums">
                                  {formatInr(item.costInr)} · {item.eventsCount} event(s)
                                </span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-700"
                                  style={{ width: `${widthPct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
                    <h2 className="text-sm font-bold text-slate-900">Telephony &amp; AI Health</h2>
                    <div className="divide-y divide-slate-100 text-xs">
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-500">Live Calls in Progress</span>
                        <span className="font-bold text-slate-900 tabular-nums">{kpis.activeCallsNow}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-500">Active Indian Plivo DIDs</span>
                        <span className="font-bold text-slate-900 tabular-nums">{kpis.activeDids}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-500">Registered Advisors &amp; Owners</span>
                        <span className="font-bold text-slate-900 tabular-nums">{kpis.totalUsers}</span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-500">Agent Response p50 / p95</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {kpis.aiLatencyP50Ms}ms / {kpis.aiLatencyP95Ms}ms
                        </span>
                      </div>
                      <div className="flex justify-between py-2.5">
                        <span className="text-slate-500">Active Voice Engine</span>
                        <span className="font-semibold text-emerald-700 text-right">
                          {TTS_LABELS[overview.config.primaryTtsEngine] || overview.config.primaryTtsEngine}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Brokerage Accounts Snapshot */}
                <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Recent Brokerage Workspaces</h2>
                      <p className="text-xs text-slate-500">Click any brokerage to inspect usage, approve KYC, or adjust credits.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSection('TENANTS')}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                    >
                      View all ({tenants.length}) →
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80">
                        <tr>
                          <th className="px-6 py-3">Brokerage &amp; Owner</th>
                          <th className="px-4 py-3">Plan</th>
                          <th className="px-4 py-3">Seats</th>
                          <th className="px-4 py-3">Wallet</th>
                          <th className="px-4 py-3">MRR</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tenants.slice(0, 5).map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/80">
                            <td className="px-6 py-3">
                              <p className="font-semibold text-slate-900">{t.name}</p>
                              <p className="text-[11px] text-slate-500">{t.owner?.email || 'No owner linked'}</p>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700">
                              {TIER_LABELS[t.subscriptionTier] || t.subscriptionTier}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-600">
                              {t.seatsUsed} / {t.maxSeats}
                            </td>
                            <td className="px-4 py-3 tabular-nums font-semibold text-slate-900">
                              {formatInr(t.walletBalance)}
                            </td>
                            <td className="px-4 py-3 tabular-nums font-semibold text-emerald-700">
                              {formatInr(t.monthlyRevenueInr)}
                            </td>
                            <td className="px-4 py-3">
                              {t.isSuspended ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold">
                                  Suspended
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                  {t.subscriptionStatus}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => openTenantDetail(t.id)}
                                className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ── SECTION 2: BROKERAGE ACCOUNTS ── */}
            {section === 'TENANTS' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search brokerage name or owner email..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'SOLO', 'TEAM', 'ENTERPRISE', 'SUSPENDED'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTierFilter(f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          tierFilter === f
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {f === 'ALL' ? 'All Accounts' : f === 'SUSPENDED' ? 'Suspended' : TIER_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Brokerage</th>
                        <th className="px-4 py-3">Plan &amp; Quotas</th>
                        <th className="px-4 py-3">Telephony / WhatsApp</th>
                        <th className="px-4 py-3">Wallet Balance</th>
                        <th className="px-4 py-3">30d Economics</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTenants.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/80">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-slate-900">{t.name}</p>
                            <p className="text-[11px] text-slate-500">{t.owner?.email || t.id}</p>
                          </td>
                          <td className="px-4 py-3.5 tabular-nums">
                            <span className="font-semibold text-slate-800">
                              {TIER_LABELS[t.subscriptionTier] || t.subscriptionTier}
                            </span>
                            <p className="text-[11px] text-slate-500">
                              {t.seatsUsed}/{t.maxSeats} seats · {t.dealsCount} deals
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              <span
                                className={`px-1.5 py-0.5 rounded font-semibold ${
                                  t.plivoComplianceStatus === 'ACCEPTED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : t.plivoComplianceStatus === 'SUBMITTED'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                KYC: {t.plivoComplianceStatus}
                              </span>
                              {t.whatsappConnected && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                  WhatsApp Live
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">{t.activeDids} active DID(s)</p>
                          </td>
                          <td className="px-4 py-3.5 font-semibold tabular-nums text-slate-900">
                            {formatInr(t.walletBalance)}
                          </td>
                          <td className="px-4 py-3.5 tabular-nums">
                            <p className="text-slate-600">
                              Rev {formatInr(t.monthlyRevenueInr)} · Cost {formatInr(t.cogs30dInr)}
                            </p>
                            <p className={`font-bold ${t.profit30dInr >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              Net {formatInr(t.profit30dInr)}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            {t.isSuspended ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold">
                                Suspended
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                {t.subscriptionStatus}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => openTenantDetail(t.id)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SECTION 3: INDIA PLIVO KYC QUEUE ── */}
            {section === 'KYC' && (
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Brokerage Organization</th>
                      <th className="px-4 py-3">Owner Contact</th>
                      <th className="px-4 py-3">Plivo Subaccount</th>
                      <th className="px-4 py-3">Compliance Status</th>
                      <th className="px-5 py-3 text-right">Verification Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kycQueue.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-slate-900">{t.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {TIER_LABELS[t.subscriptionTier] || t.subscriptionTier}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">{t.owner?.email || '—'}</td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                          {t.plivoSubaccountId || 'Not provisioned yet'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold ${
                              t.plivoComplianceStatus === 'ACCEPTED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : t.plivoComplianceStatus === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700'
                                : t.plivoComplianceStatus === 'SUBMITTED'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {t.plivoComplianceStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => handleKyc(t.id, 'ACCEPTED')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold cursor-pointer disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() => handleKyc(t.id, 'REJECTED')}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── SECTION 4: AI SWITCHBOARD & KILL SWITCH ── */}
            {section === 'SWITCHBOARD' && overview && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">AI Voice &amp; Model Routing</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Changes take effect globally across all active Plivo media streams and WhatsApp/widget AI runs.
                    </p>
                  </div>

                  <div className="space-y-4 text-sm">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Primary Real-Time Voice TTS Engine
                      </label>
                      <select
                        value={ttsEngine}
                        onChange={(e) => setTtsEngine(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm"
                      >
                        <option value="eleven_flash_v2_5">ElevenLabs Flash v2.5 (ulaw 8kHz, Recommended)</option>
                        <option value="cartesia_sonic">Cartesia Sonic (pcm_mulaw 8kHz, Warm Backup)</option>
                        <option value="edge_neural">Microsoft Edge Neural TTS (Zero-Cost Fallback)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Primary Conversation LLM Model
                      </label>
                      <select
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm"
                      >
                        <option value="gemini-2.5-flash">Google Gemini 2.5 Flash (Low Latency / High Margin)</option>
                        <option value="gemini-2.5-flash-lite">Google Gemini 2.5 Flash Lite (Ultra-Low Cost)</option>
                        <option value="gemini-2.5-pro">Google Gemini 2.5 Pro (Complex Deal Reasoning)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Global Concurrent Call Cap
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={maxConcurrency}
                          onChange={(e) => setMaxConcurrency(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pb-2">
                          <input
                            type="checkbox"
                            checked={autoFailover}
                            onChange={(e) => setAutoFailover(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          Auto-failover after 3 TTS errors
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      disabled={busyAction === 'config'}
                      className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                    >
                      {busyAction === 'config' ? 'Applying Switchboard Config...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-2xs space-y-4">
                    <h2 className="text-base font-bold text-rose-900 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-rose-600" />
                      Emergency Outbound Dialer Kill Switch
                    </h2>
                    <p className="text-xs text-slate-600">
                      Immediately halts all batch Plivo outbound campaign dialing across every organization while keeping inbound WhatsApp and CRM operations running normally.
                    </p>
                    <button
                      type="button"
                      onClick={handleToggleKillSwitch}
                      disabled={busyAction === 'kill'}
                      className={`w-full py-3 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        dialerPaused
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {dialerPaused ? 'Resume Outbound Campaign Dialer' : 'Pause All Outbound Campaign Dialing'}
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-2.5 text-xs">
                    <h3 className="font-bold text-slate-900">Failover Status</h3>
                    <div className="flex justify-between text-slate-600">
                      <span>Consecutive TTS Failures</span>
                      <span className="font-bold tabular-nums">{overview.config.consecutiveTtsFailures} / 3</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Last Automatic Failover</span>
                      <span className="font-medium text-right">
                        {overview.config.failoverReason || 'None triggered'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Last Modified By</span>
                      <span>{overview.config.updatedBy || 'System Default'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── SECTION 5: GOVERNANCE AUDIT LOG ── */}
            {section === 'AUDIT' && overview && (
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-4 py-3">Admin Operator</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Target Brokerage</th>
                      <th className="px-5 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                          No super-admin governance events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      overview.auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3 text-slate-500 tabular-nums whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{log.adminEmail}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{log.organization?.name || 'Platform Global'}</td>
                          <td className="px-5 py-3 text-slate-600">{log.note || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Tenant Intervention Slide-Over Drawer ── */}
      {selectedOrgId && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {detail?.organization?.name || 'Loading workspace...'}
                </h2>
                <p className="text-xs text-slate-500">Workspace ID: {selectedOrgId}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrgId(null);
                  setDetail(null);
                }}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-16 w-full rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* India Plivo KYC Approval */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">India Plivo Telephony Compliance (KYC)</span>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-semibold">
                      {detail.organization.channels?.plivoComplianceStatus || 'NOT_SUBMITTED'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleKyc(selectedOrgId, 'ACCEPTED')}
                      disabled={busyAction !== null}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 cursor-pointer"
                    >
                      Approve KYC
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKyc(selectedOrgId, 'REJECTED')}
                      disabled={busyAction !== null}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 cursor-pointer"
                    >
                      Reject KYC
                    </button>
                  </div>
                </div>

                {/* Wallet Credit / Debit */}
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Wallet Adjustment (Audit Logged)</span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      Balance: {formatInr(detail.organization.wallet?.balance || 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      value={walletAmount}
                      onChange={(e) => setWalletAmount(e.target.value)}
                      placeholder="Amount INR"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200"
                    />
                    <input
                      type="text"
                      value={walletReason}
                      onChange={(e) => setWalletReason(e.target.value)}
                      placeholder="Audit reason"
                      className="col-span-2 px-2.5 py-1.5 rounded-lg border border-slate-200"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdjustWallet(selectedOrgId)}
                    disabled={busyAction === 'wallet'}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 cursor-pointer"
                  >
                    Apply Credit / Debit
                  </button>
                </div>

                {/* Emergency Tenant Controls */}
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3">
                  <span className="font-bold text-rose-900 block">Emergency Workspace Intervention</span>
                  <input
                    type="text"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Reason for suspension"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handlePauseCampaigns(selectedOrgId)}
                      disabled={busyAction !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 cursor-pointer"
                    >
                      <PauseCircle className="h-3.5 w-3.5" />
                      Pause Running Campaigns
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleSuspend(selectedOrgId, Boolean(detail.organization.isSuspended))
                      }
                      disabled={busyAction !== null}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white font-semibold cursor-pointer ${
                        detail.organization.isSuspended
                          ? 'bg-emerald-700 hover:bg-emerald-800'
                          : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {detail.organization.isSuspended ? 'Reactivate Workspace' : 'Suspend Workspace'}
                    </button>
                  </div>
                </div>

                {/* Recent AI Traces */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">Recent AI Agent Runs</h3>
                  {detail.recentTraces.length === 0 ? (
                    <p className="text-slate-500">No AI runs recorded for this workspace yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.recentTraces.slice(0, 6).map((tr) => (
                        <div
                          key={tr.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
                        >
                          <span className="font-medium text-slate-800">
                            {tr.channel} · {tr.specialist} ({tr.intent})
                          </span>
                          <span className="text-slate-500 tabular-nums">
                            {tr.modelUsed} · {tr.latencyMs}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Calls */}
                <div>
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <PhoneCall className="h-3.5 w-3.5" />
                    Recent Voice Sessions
                  </h3>
                  {detail.recentCalls.length === 0 ? (
                    <p className="text-slate-500">No Plivo calls recorded for this workspace yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {detail.recentCalls.slice(0, 6).map((call) => (
                        <div
                          key={call.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100"
                        >
                          <span className="font-medium text-slate-800">
                            {call.direction} · {call.toNumber}
                          </span>
                          <span className="text-slate-500 tabular-nums">
                            {call.status} · {call.durationSeconds}s
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
