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
  DollarSign,
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
  { name: 'Website Portal', value: 45, color: '#635bff' },
  { name: 'Zillow / Realtor', value: 30, color: '#00d4b2' },
  { name: 'WhatsApp Bot', value: 15, color: '#0a2540' },
  { name: 'Referral Direct', value: 10, color: '#ffc700' },
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
      commission: '$38,400',
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
      commission: '$24,000',
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
      commission: '$15,500',
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
      commission: '$11,200',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Stripe Enterprise Header Controls ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#e3e8ee] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#0a2540]">
              Brokerage Analytics & Intelligence
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#635bff]/10 px-2.5 py-0.5 text-xs font-bold text-[#635bff] border border-[#635bff]/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#635bff] animate-pulse" />
              Live Executive Dashboard
            </span>
          </div>
          <p className="text-xs text-[#4f566b] mt-0.5">
            Real-time pipeline velocity, escrow volume trendline, contingency speed metrics, and commission forecasting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Exporting Stripe Analytics PDF/CSV summary...')}
            className="btn-stripe-secondary text-xs"
          >
            <Download className="h-3.5 w-3.5 text-[#4f566b]" />
            <span>Export Analytics</span>
          </button>
          <Link to="/organization" className="btn-stripe-primary text-xs">
            <Users className="h-3.5 w-3.5" />
            <span>Manage Team Seats</span>
          </Link>
        </div>
      </div>

      {/* ── Prototype Notification Banner ── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold text-xs">Prototype Preview Notice</h4>
          <p className="text-[11px] leading-relaxed text-amber-800">
            Escrow and deal counts reflect active database records. Pipeline forecasting, speed-to-lead benchmarks, and advisor leaderboards represent simulated demo data while the real-time database aggregation engine is in development.
          </p>
        </div>
      </div>

      {/* ── Top Metric Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Escrows (Live Database Metric) */}
        <div className="stripe-card p-4 bg-white relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#4f566b] uppercase tracking-wider">
                Active Escrows
              </span>
              <div className="text-2xl font-black text-[#0a2540] font-mono mt-1">
                {loading ? '...' : activeDealsCount}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#635bff]/10 text-[#635bff] border border-[#635bff]/20">
              <Building2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-[#e3e8ee]">
            <span className="text-[#635bff] font-bold text-[11px]">
              Live Database Deals
            </span>
            <span className="text-[#8792a2] text-[10px]">{deals.length} Total Deals</span>
          </div>
        </div>

        {/* Closed Escrows (Live Database Metric) */}
        <div className="stripe-card p-4 bg-white relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#4f566b] uppercase tracking-wider">
                Closed Escrows
              </span>
              <div className="text-2xl font-black text-[#059669] font-mono mt-1">
                {loading ? '...' : closedDealsCount}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#059669] border border-emerald-200">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-[#e3e8ee]">
            <span className="text-[#059669] font-bold text-[11px]">
              Completed Transactions
            </span>
            <span className="text-[#8792a2] text-[10px]">Verified Closed</span>
          </div>
        </div>

        {/* Contingency Deadlines (Live Database Metric) */}
        <div className="stripe-card p-4 bg-white relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#4f566b] uppercase tracking-wider">
                Active Milestones
              </span>
              <div className="text-2xl font-black text-[#0a2540] font-mono mt-1">
                {loading ? '...' : totalDeadlinesCount}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0a2540]/10 text-[#0a2540] border border-[#0a2540]/20">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-[#e3e8ee]">
            <span className="text-[#0a2540] font-bold text-[11px]">
              Tracked Contingencies
            </span>
            <span className="text-[#8792a2] text-[10px]">Live Database Records</span>
          </div>
        </div>

        {/* Speed-to-Lead Benchmark (Simulated Demo Benchmark) */}
        <div className="stripe-card p-4 bg-white relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#4f566b] uppercase tracking-wider">
                Speed to Lead (Target)
              </span>
              <div className="text-2xl font-black text-[#059669] font-mono mt-1">
                &lt; 5 min
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-[#059669] border border-emerald-200">
              <Zap className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-[#e3e8ee]">
            <span className="text-[#059669] font-bold text-[11px]">
              Target Response Window
            </span>
            <span className="text-amber-600 text-[10px] font-semibold">Simulated Benchmark</span>
          </div>
        </div>
      </div>

      {/* ── Interactive Recharts Graphical Analytics Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Volume Trend Area Chart (2 Cols) */}
        <div className="lg:col-span-2 stripe-card p-5 space-y-4 bg-white">
          <div className="flex items-center justify-between border-b border-[#e3e8ee] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#0a2540] flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#635bff]" />
                Escrow Volume &amp; Transaction Growth ($M)
              </h2>
              <p className="text-[11px] text-[#4f566b]">
                Monthly total volume in escrow vs. successfully closed contract pipeline.
              </p>
            </div>
            <span className="text-[11px] font-extrabold text-[#635bff] bg-[#635bff]/10 px-2.5 py-1 rounded-md border border-[#635bff]/20 font-mono">
              $12.3M YTD Peak
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MONTHLY_VOLUME_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#635bff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#635bff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#4f566b' }} axisLine={{ stroke: '#e3e8ee' }} />
                <YAxis tick={{ fontSize: 11, fill: '#4f566b' }} axisLine={{ stroke: '#e3e8ee' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e3e8ee',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                <Area type="monotone" dataKey="volume" name="Escrow Volume ($M)" stroke="#635bff" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVolume)" />
                <Area type="monotone" dataKey="closed" name="Closed Count" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorClosed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Source Breakdown Donut Chart (1 Col) */}
        <div className="stripe-card p-5 space-y-4 bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#e3e8ee] pb-3">
              <h2 className="text-sm font-bold text-[#0a2540] flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-[#635bff]" />
                Inbound Lead Attribution
              </h2>
              <span className="text-[10px] text-[#8792a2]">Parsed automatically</span>
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
                      backgroundColor: '#ffffff',
                      borderColor: '#e3e8ee',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-[#e3e8ee]">
            {LEAD_SOURCE_DATA.map((source) => (
              <div key={source.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: source.color }} />
                  <span className="text-[#3c4257] font-semibold">{source.name}</span>
                </div>
                <span className="font-mono text-[#0a2540] font-bold">{source.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contingency Resolution Speed Bar Chart ── */}
      <div className="stripe-card p-5 space-y-4 bg-white">
        <div className="flex items-center justify-between border-b border-[#e3e8ee] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#0a2540] flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#635bff]" />
              Contingency Clause Resolution Velocity
            </h2>
            <p className="text-[11px] text-[#4f566b]">
              Average resolution days vs. total processed contingencies across portfolio.
            </p>
          </div>
          <span className="text-xs font-bold text-[#059669] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            Avg 8.3 Days to Release
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={CONTINGENCY_BREAKDOWN} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#4f566b' }} axisLine={{ stroke: '#e3e8ee' }} />
              <YAxis tick={{ fontSize: 11, fill: '#4f566b' }} axisLine={{ stroke: '#e3e8ee' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e3e8ee',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              />
              <Bar dataKey="total" name="Total Contingencies" fill="#635bff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolved" name="Released / Cleared" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Conversion Funnel Card ── */}
      <div className="stripe-card p-6 bg-[#0a2540] text-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#1a385c] pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
              <TrendingUp className="h-4 w-4 text-[#635bff]" /> Inbound Lead Conversion Funnel
            </h2>
            <p className="text-xs text-slate-300">
              How Stripe AI Lead Copilot converts cold website/portal inquiries into closed commissions.
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            22.8% Tour Conversion Rate
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
          <div className="bg-[#1a385c]/60 p-3.5 rounded-lg border border-[#2b4c75] text-center">
            <p className="text-[10px] text-slate-300 uppercase font-bold">1. Inbound Leads</p>
            <p className="text-xl font-bold font-mono mt-1 text-white">342</p>
            <p className="text-[10px] text-slate-400 mt-1">Web, Zillow, WhatsApp</p>
          </div>
          <div className="bg-[#1a385c]/60 p-3.5 rounded-lg border border-[#2b4c75] text-center">
            <p className="text-[10px] text-slate-300 uppercase font-bold">2. AI Extracted</p>
            <p className="text-xl font-bold font-mono mt-1 text-white">328</p>
            <p className="text-[10px] text-emerald-400 mt-1">95.9% Parsed</p>
          </div>
          <div className="bg-[#1a385c]/60 p-3.5 rounded-lg border border-[#2b4c75] text-center">
            <p className="text-[10px] text-slate-300 uppercase font-bold">3. Property Matches</p>
            <p className="text-xl font-bold font-mono mt-1 text-white">214</p>
            <p className="text-[10px] text-sky-400 mt-1">Matched 70%+ score</p>
          </div>
          <div className="bg-[#1a385c]/60 p-3.5 rounded-lg border border-[#2b4c75] text-center">
            <p className="text-[10px] text-slate-300 uppercase font-bold">4. Tours Booked</p>
            <p className="text-xl font-bold font-mono mt-1 text-white">78</p>
            <p className="text-[10px] text-amber-400 mt-1">23.8% Conversion</p>
          </div>
          <div className="bg-emerald-500/20 p-3.5 rounded-lg border border-emerald-500/40 text-center">
            <p className="text-[10px] text-emerald-300 uppercase font-bold">5. Deals Won</p>
            <p className="text-xl font-bold font-mono mt-1 text-emerald-300">18</p>
            <p className="text-[10px] text-emerald-300 mt-1">$89.1k Commission</p>
          </div>
        </div>
      </div>

      {/* ── Agent Performance Leaderboard ── */}
      <div className="stripe-card overflow-hidden bg-white">
        <div className="p-4 border-b border-[#e3e8ee] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0a2540] flex items-center gap-2">
              <Award className="h-4 w-4 text-[#635bff]" /> Advisor Performance Benchmarks (Prototype Demo)
            </h2>
            <p className="text-xs text-[#4f566b]">Simulated ranking of advisor response benchmarks, pipeline volume, and assisted draft acceptance rate.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8f9fa] text-[#3c4257] font-bold border-b border-[#e3e8ee]">
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
            <tbody className="divide-y divide-[#e3e8ee] text-[#1a1f36]">
              {leaderboard.map((agent) => (
                <tr key={agent.rank} className="hover:bg-[#f8f9fa] transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#0a2540]">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${
                        agent.rank === 1
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : agent.rank === 2
                          ? 'bg-slate-200 text-slate-800'
                          : agent.rank === 3
                          ? 'bg-amber-800/10 text-amber-900'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      #{agent.rank}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-[#0a2540]">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[#0a2540] text-white font-bold flex items-center justify-center text-xs">
                        {agent.avatar}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0a2540]">{agent.name}</p>
                        <p className="text-[10px] text-[#8792a2] font-normal">{agent.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#059669] font-bold text-[11px] border border-emerald-200">
                      ⚡ {agent.speedToLead}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0a2540]">{agent.leadsHandled}</td>
                  <td className="py-3.5 px-4 font-mono text-[#4f566b]">{agent.toursBooked}</td>
                  <td className="py-3.5 px-4 font-mono text-[#059669] font-bold">{agent.dealsClosed}</td>
                  <td className="py-3.5 px-4 font-mono text-[#635bff] font-bold">{agent.draftAcceptanceRate}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-[#0a2540] font-mono">
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
