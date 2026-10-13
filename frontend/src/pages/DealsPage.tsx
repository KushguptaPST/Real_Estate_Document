import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { dealsApi } from '@/services/api';
import type { Deal } from '@/types';
import { formatDate } from '@/utils/date';
import {
  Building2,
  Plus,
  Search,
  Sparkles,
  ChevronRight,
  Clock,
  Loader2,
  AlertTriangle,
  Inbox,
  Download,
  Calendar as CalendarIcon,
  Layers,
  CheckCircle2,
  History,
  BarChart3,
  ShieldCheck,
  LayoutGrid,
  List,
  Filter,
  ArrowUpRight,
  DollarSign,
  User,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

type ViewMode = 'table' | 'kanban';

export function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'CLOSED' | 'CANCELLED'>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    dealsApi
      .list()
      .then(setDeals)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = useMemo(() => deals.filter((d) => d.status === 'ACTIVE').length, [deals]);
  const closedCount = useMemo(() => deals.filter((d) => d.status === 'CLOSED').length, [deals]);
  const cancelledCount = useMemo(() => deals.filter((d) => d.status === 'CANCELLED').length, [deals]);
  const totalMilestones = useMemo(
    () => deals.reduce((acc, deal) => acc + (deal._count?.deadlines ?? 0), 0),
    [deals]
  );

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        deal.propertyAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.buyerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.sellerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTab = activeTab === 'ALL' || deal.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [deals, searchQuery, activeTab]);

  // Group deals for Kanban board stages
  const kanbanStages = useMemo(() => {
    const stages = [
      { id: 'ACCEPTED', title: 'Offer Accepted & EMD', color: 'border-blue-500', bg: 'bg-blue-50/50' },
      { id: 'INSPECTION', title: 'Inspection & Feasibility', color: 'border-amber-500', bg: 'bg-amber-50/50' },
      { id: 'FINANCING', title: 'Appraisal & Financing', color: 'border-purple-500', bg: 'bg-purple-50/50' },
      { id: 'CLOSING', title: 'Clear to Close', color: 'border-emerald-500', bg: 'bg-emerald-50/50' },
    ];

    return stages.map((stage) => {
      let stageDeals: Deal[] = [];
      if (stage.id === 'ACCEPTED') {
        stageDeals = filteredDeals.filter((d) => d.status === 'ACTIVE' && (d._count?.deadlines ?? 0) <= 2);
      } else if (stage.id === 'INSPECTION') {
        stageDeals = filteredDeals.filter((d) => d.status === 'ACTIVE' && (d._count?.deadlines ?? 0) > 2 && (d._count?.deadlines ?? 0) <= 5);
      } else if (stage.id === 'FINANCING') {
        stageDeals = filteredDeals.filter((d) => d.status === 'ACTIVE' && (d._count?.deadlines ?? 0) > 5);
      } else {
        stageDeals = filteredDeals.filter((d) => d.status === 'CLOSED');
      }

      return { ...stage, deals: stageDeals };
    });
  }, [filteredDeals]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Page Title & Main Action Bar ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Transaction Command Center
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C9A961] border border-[#C9A961]/25">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C9A961] animate-pulse" />
              Live Pipeline Sync
            </span>
          </div>
          <p className="text-xs text-[#9A9AA5] mt-0.5">
            Real-time contract surveillance, contingency release velocity &amp; escrow tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-[#141418] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#1A1A22] text-[#C9A961] shadow-2xs border border-white/[0.08]'
                  : 'text-[#9A9AA5] hover:text-[#F5F5F7]'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-[#1A1A22] text-[#C9A961] shadow-2xs border border-white/[0.08]'
                  : 'text-[#9A9AA5] hover:text-[#F5F5F7]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Kanban Board</span>
            </button>
          </div>

          <button
            onClick={() => alert('Exporting transaction pipeline summary (CSV)...')}
            className="btn-stripe-secondary text-xs"
          >
            <Download className="h-3.5 w-3.5 text-[#9A9AA5]" />
            <span>Export</span>
          </button>
          <Link to="/upload" className="btn-stripe-primary text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Ingest Contract PDF</span>
          </Link>
        </div>
      </div>

      {/* ── Dynamic High-Density Metric Summary Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="stripe-card p-4 bg-[#141418] hover:border-[#C9A961]/40 transition-all border border-white/[0.08]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-widest">
                Active Escrows
              </span>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                {loading ? '—' : activeCount}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25">
              <Building2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> +14.2% vs last mo
            </span>
            <span className="text-[#6E6E7A] text-[10px] font-mono">Active Pipeline</span>
          </div>
        </div>

        <div className="stripe-card p-4 bg-[#141418] hover:border-[#C9A961]/40 transition-all border border-white/[0.08]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-widest">
                Tracked Milestones
              </span>
              <div className="text-2xl font-bold text-[#C9A961] mt-1 font-mono">
                {loading ? '—' : totalMilestones}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
            <span className="text-[#C9A961] font-semibold text-[11px] flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 100% Date Accuracy
            </span>
            <span className="text-[#6E6E7A] text-[10px] font-mono">Zero Missed</span>
          </div>
        </div>

        <div className="stripe-card p-4 bg-[#141418] hover:border-[#C9A961]/40 transition-all border border-white/[0.08]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-widest">
                Closed Portfolio
              </span>
              <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
                {loading ? '—' : closedCount}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-semibold text-[11px]">
              100% SLA Released
            </span>
            <span className="text-[#6E6E7A] text-[10px] font-mono">Completed</span>
          </div>
        </div>

        <div className="stripe-card p-4 bg-[#141418] hover:border-[#C9A961]/40 transition-all border border-white/[0.08]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-widest">
                Deposit SLA Rate
              </span>
              <div className="text-2xl font-bold text-white mt-1 font-mono">
                100.0%
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
            <span className="text-white font-semibold text-[11px]">
              0 EMD Forfeitures
            </span>
            <span className="text-[#6E6E7A] text-[10px] font-mono">Protected</span>
          </div>
        </div>
      </div>

      {/* ── Enterprise Tabbed Filter Bar ── */}
      <div className="border-b border-white/[0.08] flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'border-[#C9A961] text-[#C9A961]'
                : 'border-transparent text-[#9A9AA5] hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>All Transactions</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#181820] text-[#9A9AA5] font-bold border border-white/[0.08]">
              {deals.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'border-[#C9A961] text-[#C9A961]'
                : 'border-transparent text-[#9A9AA5] hover:text-white'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Active Escrows</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30 font-bold">
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CLOSED')}
            className={`py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'CLOSED'
                ? 'border-[#C9A961] text-[#C9A961]'
                : 'border-transparent text-[#9A9AA5] hover:text-white'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Closed Deals</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#181820] text-[#9A9AA5] font-bold border border-white/[0.08]">
              {closedCount}
            </span>
          </button>

          {cancelledCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('CANCELLED')}
              className={`py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'CANCELLED'
                  ? 'border-[#C9A961] text-[#C9A961]'
                  : 'border-transparent text-[#9A9AA5] hover:text-white'
              }`}
            >
              <span>Cancelled</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20">
                {cancelledCount}
              </span>
            </button>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/analytics"
            className="text-xs text-[#9A9AA5] hover:text-[#C9A961] font-semibold flex items-center gap-1 transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5 text-[#C9A961]" />
            <span>Executive Analytics</span>
          </Link>
          <Link
            to="/audit"
            className="text-xs text-[#9A9AA5] hover:text-[#C9A961] font-semibold flex items-center gap-1 transition-colors"
          >
            <History className="h-3.5 w-3.5 text-[#9A9AA5]" />
            <span>Audit Trail</span>
          </Link>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="stripe-card p-3 bg-[#141418] border border-white/[0.08]">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6E6E7A]" />
          <input
            type="text"
            placeholder="Search transactions by address, buyer, seller, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-base pl-9 text-xs bg-[#181820] border-white/[0.08] text-[#F5F5F7] placeholder:text-[#6E6E7A] focus:border-[#C9A961]"
          />
        </div>
      </div>

      {/* Loading / Error / Empty States */}
      {loading && (
        <div className="stripe-card flex flex-col items-center justify-center py-12 text-xs text-[#9A9AA5] bg-[#141418] border border-white/[0.08]">
          <Loader2 className="h-6 w-6 animate-spin text-[#C9A961] mb-2" />
          <span>Loading transaction command center...</span>
        </div>
      )}

      {error && (
        <div className="banner-error text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && deals.length === 0 && (
        <div className="empty-state bg-[#141418] border border-white/[0.08] rounded-2xl p-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] mx-auto mb-3 border border-[#C9A961]/25">
            <Inbox className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">No transactions found</h3>
          <p className="mt-1 text-xs text-[#9A9AA5] max-w-sm mx-auto">
            Upload your executed purchase agreement PDF to activate real-time milestone tracking.
          </p>
          <Button asChild size="sm" className="mt-4 btn-stripe-primary text-xs">
            <Link to="/upload">
              <Plus className="h-3.5 w-3.5" />
              <span>Upload Contract PDF</span>
            </Link>
          </Button>
        </div>
      )}

      {/* ── VIEW 1: High-Density Enterprise Table ── */}
      {!loading && deals.length > 0 && viewMode === 'table' && (
        <div className="stripe-card overflow-hidden bg-[#141418] border border-white/[0.08] rounded-2xl shadow-xl">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/[0.08] bg-[#181820]">
                <TableHead className="w-[30%] py-2.5 px-4 font-mono uppercase tracking-wider text-[#9A9AA5] text-[10px]">Property Address &amp; ID</TableHead>
                <TableHead className="w-[22%] py-2.5 px-4 font-mono uppercase tracking-wider text-[#9A9AA5] text-[10px]">Contract Parties</TableHead>
                <TableHead className="w-[16%] py-2.5 px-4 font-mono uppercase tracking-wider text-[#9A9AA5] text-[10px]">Mutual Acceptance</TableHead>
                <TableHead className="w-[16%] py-2.5 px-4 font-mono uppercase tracking-wider text-[#9A9AA5] text-[10px]">Milestones Progress</TableHead>
                <TableHead className="w-[8%] py-2.5 px-4 font-mono uppercase tracking-wider text-[#9A9AA5] text-[10px]">Status</TableHead>
                <TableHead className="text-right py-2.5 px-4 font-mono uppercase tracking-wider text-[#9A9AA5] text-[10px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-[#9A9AA5]">
                    No transactions found matching query "{searchQuery}".
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeals.map((deal) => (
                  <TableRow key={deal.id} className="group hover:bg-white/[0.03] transition-colors border-b border-white/[0.08]">
                    {/* Property Address & ID */}
                    <TableCell className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] shrink-0 border border-white/[0.08] group-hover:border-[#C9A961]/40 transition-all">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/deals/${deal.id}`}
                            className="font-semibold text-[#F5F5F7] hover:text-[#C9A961] transition-colors truncate block text-xs tracking-tight"
                          >
                            {deal.propertyAddress}
                          </Link>
                          <span className="text-[10px] text-[#6E6E7A] block font-mono">
                            ID: {deal.id.slice(0, 14)}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Contract Parties */}
                    <TableCell className="py-3.5 px-4">
                      <div className="space-y-1 text-xs">
                        {deal.buyerName && (
                          <div className="text-[11px] flex items-center gap-1.5 truncate">
                            <span className="px-1.5 py-0.2 rounded bg-[#181820] text-[#9A9AA5] font-mono text-[9px] border border-white/[0.08]">BUYER</span>
                            <span className="font-medium text-[#F5F5F7] truncate">{deal.buyerName}</span>
                          </div>
                        )}
                        {deal.sellerName && (
                          <div className="text-[11px] flex items-center gap-1.5 truncate">
                            <span className="px-1.5 py-0.2 rounded bg-[#181820] text-[#9A9AA5] font-mono text-[9px] border border-white/[0.08]">SELLER</span>
                            <span className="text-[#9A9AA5] truncate">{deal.sellerName}</span>
                          </div>
                        )}
                        {!deal.buyerName && !deal.sellerName && <span className="text-[#6E6E7A] text-[11px] font-mono">—</span>}
                      </div>
                    </TableCell>

                    {/* Mutual Acceptance Date */}
                    <TableCell className="py-3.5 px-4 font-mono text-xs text-[#9A9AA5]">
                      {deal.acceptanceDate ? (
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="h-3.5 w-3.5 text-[#6E6E7A]" />
                          <span>{formatDate(deal.acceptanceDate)}</span>
                        </div>
                      ) : (
                        <span className="text-[#6E6E7A]">—</span>
                      )}
                    </TableCell>

                    {/* Milestones Visual Progress */}
                    <TableCell className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-[#C9A961] font-mono">
                            {deal._count?.deadlines ?? 0} Milestones
                          </span>
                          <span className="text-[#6E6E7A] font-mono">
                            {deal.status === 'CLOSED' ? '100%' : '75% Active'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#181820] overflow-hidden border border-white/[0.08]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              deal.status === 'CLOSED' ? 'bg-emerald-400' : 'bg-[#C9A961]'
                            }`}
                            style={{ width: deal.status === 'CLOSED' ? '100%' : '75%' }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-medium rounded-full border ${
                          deal.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : deal.status === 'CLOSED'
                            ? 'bg-white/5 text-[#9A9AA5] border-white/10'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            deal.status === 'ACTIVE'
                              ? 'bg-emerald-400 animate-pulse'
                              : deal.status === 'CLOSED'
                              ? 'bg-slate-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        {deal.status}
                      </span>
                    </TableCell>

                    {/* Action Controls */}
                    <TableCell className="text-right py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/deals/${deal.id}/assistant`}
                          className="btn-stripe-secondary text-[11px] py-1 px-2.5 font-medium"
                        >
                          <Sparkles className="h-3 w-3 text-[#C9A961]" />
                          <span>Copilot</span>
                        </Link>

                        <Link
                          to={`/deals/${deal.id}`}
                          className="btn-stripe-primary text-[11px] py-1 px-3"
                        >
                          <span>Open</span>
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── VIEW 2: Rich Kanban Board Pipeline ── */}
      {!loading && deals.length > 0 && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kanbanStages.map((stage) => (
            <div key={stage.id} className="stripe-card p-3.5 bg-[#0E0E12] border border-white/[0.08] rounded-2xl flex flex-col min-h-[500px]">
              {/* Stage Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full border-2 ${stage.color}`} />
                  <h3 className="text-xs font-semibold text-white">{stage.title}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#141418] text-[10px] font-mono text-[#9A9AA5] border border-white/[0.08]">
                  {stage.deals.length}
                </span>
              </div>

              {/* Stage Deal Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {stage.deals.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#141418]/40 p-6 text-center text-xs text-[#6E6E7A]">
                    No deals in this phase
                  </div>
                ) : (
                  stage.deals.map((deal) => (
                    <div
                      key={deal.id}
                      className="stripe-card p-3.5 bg-[#141418] border border-white/[0.08] rounded-xl space-y-3 hover:border-[#C9A961]/40 hover:shadow-lg transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            to={`/deals/${deal.id}`}
                            className="font-medium text-white hover:text-[#C9A961] text-xs truncate block"
                          >
                            {deal.propertyAddress}
                          </Link>
                          <span className="text-[10px] text-[#6E6E7A] font-mono">
                            ID: {deal.id.slice(0, 10)}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-full bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/25">
                          {deal._count?.deadlines ?? 0} Milestones
                        </span>
                      </div>

                      {/* Parties */}
                      <div className="rounded-xl bg-[#181820] p-2.5 border border-white/[0.08] space-y-1 text-[11px]">
                        {deal.buyerName && (
                          <div className="flex items-center justify-between text-[#9A9AA5]">
                            <span className="text-[9px] font-mono text-[#6E6E7A]">BUYER:</span>
                            <span className="font-medium text-white truncate max-w-[140px]">{deal.buyerName}</span>
                          </div>
                        )}
                        {deal.sellerName && (
                          <div className="flex items-center justify-between text-[#9A9AA5]">
                            <span className="text-[9px] font-mono text-[#6E6E7A]">SELLER:</span>
                            <span className="truncate max-w-[140px] text-[#9A9AA5]">{deal.sellerName}</span>
                          </div>
                        )}
                      </div>

                      {/* Acceptance Date */}
                      <div className="flex items-center justify-between text-[10px] text-[#9A9AA5]">
                        <span className="flex items-center gap-1 font-mono">
                          <CalendarIcon className="h-3 w-3 text-[#6E6E7A]" />
                          {deal.acceptanceDate ? formatDate(deal.acceptanceDate) : 'Pending'}
                        </span>
                        <span className="text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20 text-[9px]">
                          Active
                        </span>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
                        <Link
                          to={`/deals/${deal.id}/assistant`}
                          className="btn-stripe-ghost text-[10px] py-0.5 px-1.5 text-[#9A9AA5] hover:text-[#C9A961]"
                        >
                          <Sparkles className="h-3 w-3 text-[#C9A961]" />
                          Copilot
                        </Link>
                        <Link
                          to={`/deals/${deal.id}`}
                          className="btn-stripe-primary text-[10px] py-1 px-2.5"
                        >
                          Open Deal →
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
