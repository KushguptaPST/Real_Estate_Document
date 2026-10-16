import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { dealsApi } from '@/services/api';
import type { Deal } from '@/types';
import {
  BarChart3,
  Building2,
  Clock,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Layers,
  IndianRupee,
  Users,
  Award,
  Zap,
  Download,
  Filter,
  PieChart as PieChartIcon,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface AgentLeaderboard {
  rank: number;
  name: string;
  avatar: string;
  role: string;
  speedToLead: string;
  leadsHandled: number;
  toursBooked: number;
  dealsClosed: number;
  draftAcceptanceRate: string;
  commission: string;
}

const MONTHLY_VOLUME_DATA = [
  { month: 'Jan', volume: 4.2, escrows: 8, closed: 6 },
  { month: 'Feb', volume: 5.8, escrows: 11, closed: 9 },
  { month: 'Mar', volume: 7.1, escrows: 14, closed: 12 },
  { month: 'Apr', volume: 6.4, escrows: 12, closed: 10 },
  { month: 'May', volume: 8.9, escrows: 17, closed: 15 },
  { month: 'Jun', volume: 10.5, escrows: 21, closed: 18 },
  { month: 'Jul', volume: 12.3, escrows: 24, closed: 21 },
];

const CONTINGENCY_BREAKDOWN = [
  { category: 'Inspection', total: 42, resolved: 39, avgDays: 7.2 },
  { category: 'Financing', total: 38, resolved: 35, avgDays: 14.8 },
  { category: 'Appraisal', total: 29, resolved: 28, avgDays: 10.4 },
  { category: 'Title/HOA', total: 24, resolved: 24, avgDays: 4.1 },
  { category: 'Insurance', total: 18, resolved: 17, avgDays: 5.6 },
];

const LEAD_SOURCE_DATA = [
  { name: 'Website Portal', value: 45, color: '#C9A961' },
  { name: 'Zillow / Realtor', value: 30, color: '#10B981' },
  { name: 'WhatsApp Bot', value: 15, color: '#818CF8' },
  { name: 'Referral Direct', value: 10, color: '#F59E0B' },
];

export function AnalyticsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dealsApi
      .list()
      .then(setDeals)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeDealsCount = useMemo(() => deals.filter((d) => d.status === 'ACTIVE').length, [deals]);
  const closedDealsCount = useMemo(() => deals.filter((d) => d.status === 'CLOSED').length, [deals]);
  const totalDeadlinesCount = useMemo(
    () => deals.reduce((acc, d) => acc + (d._count?.deadlines ?? d.deadlines?.length ?? 0), 0),
    [deals],
  );

  // Mock Agent Leaderboard for B2B Agency Analytics (Simulated benchmark preview)
  const leaderboard: AgentLeaderboard[] = [
    {
      rank: 1,
      name: 'Sarah Jenkins',
      avatar: 'S',
      role: 'Senior Listing Agent',
      speedToLead: '11 sec',
      leadsHandled: 84,
      toursBooked: 29,
      dealsClosed: 8,
      draftAcceptanceRate: '94%',
      commission: '₹38.4 Lakh',
    },
    {
      rank: 2,
      name: 'Michael Vance',
      avatar: 'M',
      role: 'Buyer Specialist',
      speedToLead: '16 sec',
      leadsHandled: 62,
      toursBooked: 18,
      dealsClosed: 5,
      draftAcceptanceRate: '88%',
      commission: '₹24.0 Lakh',
    },
    {
      rank: 3,
      name: 'Elena Rostova',
      avatar: 'E',
      role: 'Relocation Agent',
      speedToLead: '24 sec',
      leadsHandled: 45,
      toursBooked: 14,
      dealsClosed: 3,
      draftAcceptanceRate: '91%',
      commission: '₹15.5 Lakh',
    },
    {
      rank: 4,
      name: 'David Kim',
      avatar: 'D',
      role: 'Commercial & Condo Agent',
      speedToLead: '32 sec',
      leadsHandled: 38,
      toursBooked: 10,
      dealsClosed: 2,
      draftAcceptanceRate: '82%',
      commission: '₹11.2 Lakh',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25 shrink-0 shadow-xs">
            <BarChart3 className="h-5 w-5 text-[#C9A961]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F7]">
                Brokerage Analytics &amp; Intelligence
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#C9A961] border border-[#C9A961]/25">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C9A961] animate-pulse" />
                Live Executive Dashboard
              </span>
            </div>
            <p className="text-xs text-[#9A9AA5] mt-1">
              Real-time pipeline velocity, escrow volume trendline, contingency speed metrics, and commission forecasting.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => alert('Exporting Analytics PDF/CSV summary...')}
            className="btn-stripe-secondary text-xs h-9 px-3.5 gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-[#C9A961]" />
            <span>Export Analytics</span>
          </button>
          <Link to="/organization" className="btn-stripe-primary text-xs h-9 px-4 gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>Manage Team Seats</span>
          </Link>
        </div>
      </div>

      {/* ── Notification Banner ── */}
      <div className="rounded-xl border border-[#C9A961]/20 bg-[#C9A961]/5 p-4 text-[#F5F5F7] flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-[#C9A961] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-xs text-[#C9A961]">Prototype Preview Notice</h4>
          <p className="text-[11px] leading-relaxed text-[#9A9AA5]">
            Escrow and deal counts reflect active database records. Pipeline forecasting, speed-to-lead benchmarks, and advisor leaderboards represent simulated demo data while the real-time database aggregation engine is in development.
          </p>
        </div>
      </div>

      {/* ── Top Metric Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Escrows */}
        <div className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/30 transition-all flex flex-col justify-between min-h-[148px] shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-[#9A9AA5] uppercase tracking-wider">
              Active Escrows
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25 shrink-0 shadow-2xs">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#F5F5F7] font-mono tracking-tight">
              {loading ? '...' : activeDealsCount}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
              <span className="text-[#C9A961] font-semibold text-[11px]">
                Live Database Deals
              </span>
              <span className="text-[#6E6E7A] text-[10px] font-mono">{deals.length} Total Deals</span>
            </div>
          </div>
        </div>

        {/* Closed Escrows */}
        <div className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/30 transition-all flex flex-col justify-between min-h-[148px] shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-[#9A9AA5] uppercase tracking-wider">
              Closed Escrows
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0 shadow-2xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              {loading ? '...' : closedDealsCount}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
              <span className="text-emerald-400 font-semibold text-[11px]">
                Completed Transactions
              </span>
              <span className="text-[#6E6E7A] text-[10px] font-mono">Verified Closed</span>
            </div>
          </div>
        </div>

        {/* Contingency Deadlines */}
        <div className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/30 transition-all flex flex-col justify-between min-h-[148px] shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-[#9A9AA5] uppercase tracking-wider">
              Active Milestones
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25 shrink-0 shadow-2xs">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#F5F5F7] font-mono tracking-tight">
              {loading ? '...' : totalDeadlinesCount}
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
              <span className="text-[#C9A961] font-semibold text-[11px]">
                Tracked Contingencies
              </span>
              <span className="text-[#6E6E7A] text-[10px] font-mono">Live Database Records</span>
            </div>
          </div>
        </div>

        {/* Speed-to-Lead Benchmark */}
        <div className="glass-panel rounded-2xl p-5 bg-[#141418] border border-white/[0.08] hover:border-[#C9A961]/30 transition-all flex flex-col justify-between min-h-[148px] shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-[#9A9AA5] uppercase tracking-wider">
              Speed to Lead (Target)
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shrink-0 shadow-2xs">
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              &lt; 5 min
            </div>
            <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
              <span className="text-emerald-400 font-semibold text-[11px]">
                Target Response Window
              </span>
              <span className="text-amber-400 text-[10px] font-semibold font-mono">Simulated Benchmark</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive Recharts Graphical Analytics Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Volume Trend Area Chart (2 Cols) */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-5 space-y-4 bg-[#141418] border border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#C9A961]" />
                Escrow Volume &amp; Transaction Growth (₹ Cr)
              </h2>
              <p className="text-[11px] text-[#9A9AA5]">
                Monthly total volume in escrow vs. successfully closed contract pipeline.
              </p>
            </div>
            <span className="text-[11px] font-extrabold text-[#C9A961] bg-[#C9A961]/10 px-2.5 py-1 rounded-md border border-[#C9A961]/25 font-mono">
              ₹12.3 Cr YTD Peak
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MONTHLY_VOLUME_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A961" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#C9A961" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9A9AA5' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9A9AA5' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
                <Tooltip
                  cursor={{ stroke: 'rgba(201, 169, 97, 0.4)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  contentStyle={{
                    backgroundColor: '#181820',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                    fontSize: '12px',
                    color: '#F5F5F7',
                    fontWeight: 600,
                  }}
                />
                <Area type="monotone" dataKey="volume" name="Escrow Volume (₹ Cr)" stroke="#C9A961" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVolume)" />
                <Area type="monotone" dataKey="closed" name="Closed Count" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorClosed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Source Breakdown Donut Chart (1 Col) */}
        <div className="glass-panel rounded-2xl p-5 space-y-4 bg-[#141418] border border-white/[0.08] flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h2 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-[#C9A961]" />
                Inbound Lead Attribution
              </h2>
              <span className="text-[10px] text-[#6E6E7A]">Parsed automatically</span>
            </div>

            <div className="h-56 w-full my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={LEAD_SOURCE_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {LEAD_SOURCE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#141418',
                      borderColor: 'rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: '#F5F5F7',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
            {LEAD_SOURCE_DATA.map((source) => (
              <div key={source.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: source.color }} />
                  <span className="text-[#9A9AA5] font-medium">{source.name}</span>
                </div>
                <span className="font-mono text-[#F5F5F7] font-bold">{source.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contingency Resolution Speed Bar Chart ── */}
      <div className="glass-panel rounded-2xl p-5 space-y-4 bg-[#141418] border border-white/[0.08] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-3 gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#C9A961]" />
              Contingency Clause Resolution Velocity
            </h2>
            <p className="text-[11px] text-[#9A9AA5]">
              Average resolution days vs. total processed contingencies across portfolio.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-3 text-[11px] font-medium text-[#9A9AA5]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-xs bg-[#C9A961]" /> Total
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-xs bg-[#10B981]" /> Released / Cleared
              </span>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/25">
              Avg 8.3 Days to Release
            </span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CONTINGENCY_BREAKDOWN} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#9A9AA5' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9A9AA5' }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
              <Tooltip
                cursor={{ fill: 'rgba(255, 255, 255, 0.04)', radius: 6 }}
                contentStyle={{
                  backgroundColor: '#181820',
                  borderColor: 'rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
                  fontSize: '12px',
                  color: '#F5F5F7',
                  padding: '10px 14px',
                }}
                labelStyle={{
                  color: '#C9A961',
                  fontWeight: 700,
                  fontSize: '12px',
                  marginBottom: '4px',
                }}
                itemStyle={{
                  fontSize: '11px',
                  color: '#F5F5F7',
                  padding: '2px 0',
                }}
              />
              <Bar dataKey="total" name="Total Contingencies" fill="#C9A961" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="resolved" name="Released / Cleared" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Conversion Funnel Card ── */}
      <div className="glass-panel rounded-2xl p-6 bg-[#101014] border border-white/[0.08] text-white space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2 uppercase tracking-wide">
              <TrendingUp className="h-4 w-4 text-[#C9A961]" /> Inbound Lead Conversion Funnel
            </h2>
            <p className="text-xs text-[#9A9AA5]">
              How AI Lead Matcher converts cold website/portal inquiries into closed commissions.
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            22.8% Tour Conversion Rate
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
          <div className="bg-[#181820] p-3.5 rounded-xl border border-white/10 text-center">
            <p className="text-[10px] text-[#9A9AA5] uppercase font-bold">1. Inbound Leads</p>
            <p className="text-xl font-bold font-mono mt-1 text-[#F5F5F7]">342</p>
            <p className="text-[10px] text-[#6E6E7A] mt-1">Web, Zillow, WhatsApp</p>
          </div>
          <div className="bg-[#181820] p-3.5 rounded-xl border border-white/10 text-center">
            <p className="text-[10px] text-[#9A9AA5] uppercase font-bold">2. AI Extracted</p>
            <p className="text-xl font-bold font-mono mt-1 text-[#F5F5F7]">328</p>
            <p className="text-[10px] text-emerald-400 mt-1">95.9% Parsed</p>
          </div>
          <div className="bg-[#181820] p-3.5 rounded-xl border border-white/10 text-center">
            <p className="text-[10px] text-[#9A9AA5] uppercase font-bold">3. Property Matches</p>
            <p className="text-xl font-bold font-mono mt-1 text-[#F5F5F7]">214</p>
            <p className="text-[10px] text-[#C9A961] mt-1">Matched 70%+ score</p>
          </div>
          <div className="bg-[#181820] p-3.5 rounded-xl border border-white/10 text-center">
            <p className="text-[10px] text-[#9A9AA5] uppercase font-bold">4. Tours Booked</p>
            <p className="text-xl font-bold font-mono mt-1 text-[#F5F5F7]">78</p>
            <p className="text-[10px] text-amber-400 mt-1">23.8% Conversion</p>
          </div>
          <div className="bg-emerald-500/15 p-3.5 rounded-xl border border-emerald-500/30 text-center">
            <p className="text-[10px] text-emerald-400 uppercase font-bold">5. Deals Won</p>
            <p className="text-xl font-bold font-mono mt-1 text-emerald-400">18</p>
            <p className="text-[10px] text-emerald-300 mt-1">₹89.1 Lakh Commission</p>
          </div>
        </div>
      </div>

      {/* ── Agent Performance Leaderboard ── */}
      <div className="glass-panel rounded-2xl overflow-hidden bg-[#141418] border border-white/[0.08] shadow-sm">
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#F5F5F7] flex items-center gap-2">
              <Award className="h-4 w-4 text-[#C9A961]" /> Advisor Performance Benchmarks (Prototype Demo)
            </h2>
            <p className="text-xs text-[#9A9AA5]">Simulated ranking of advisor response benchmarks, pipeline volume, and assisted draft acceptance rate.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#101014] text-[#9A9AA5] font-bold border-b border-white/[0.08]">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Agent Name</th>
                <th className="py-3 px-4">Speed to Lead</th>
                <th className="py-3 px-4">Leads Handled</th>
                <th className="py-3 px-4">Tours Booked</th>
                <th className="py-3 px-4">Closed Deals</th>
                <th className="py-3 px-4">Draft Acceptance %</th>
                <th className="py-3 px-4 text-right">Commission Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06] text-[#F5F5F7]">
              {leaderboard.map((agent) => (
                <tr key={agent.rank} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#F5F5F7]">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${
                        agent.rank === 1
                          ? 'bg-[#C9A961]/20 text-[#C9A961] border border-[#C9A961]/40'
                          : agent.rank === 2
                          ? 'bg-slate-700/50 text-slate-200 border border-slate-600'
                          : agent.rank === 3
                          ? 'bg-amber-800/20 text-amber-400 border border-amber-800/40'
                          : 'bg-white/5 text-[#9A9AA5]'
                      }`}
                    >
                      #{agent.rank}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#F5F5F7]">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[#181820] text-[#C9A961] border border-[#C9A961]/30 font-bold flex items-center justify-center text-xs">
                        {agent.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#F5F5F7]">{agent.name}</p>
                        <p className="text-[10px] text-[#6E6E7A] font-normal">{agent.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[11px] border border-emerald-500/25">
                      ⚡ {agent.speedToLead}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-[#F5F5F7]">{agent.leadsHandled}</td>
                  <td className="py-3.5 px-4 font-mono text-[#9A9AA5]">{agent.toursBooked}</td>
                  <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">{agent.dealsClosed}</td>
                  <td className="py-3.5 px-4 font-mono text-[#C9A961] font-bold">{agent.draftAcceptanceRate}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-400 font-mono">
                    {agent.commission}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
