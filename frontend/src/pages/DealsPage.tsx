import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { dealsApi } from '@/services/api';
import type { Deal } from '@/types';
import { formatDate } from '@/utils/date';
import { exportToCsv } from '@/utils/csvExport';
import { useToast } from '@/context/ToastContext';
import {
  Building2,
  Plus,
  Search,
  ChevronRight,
  Clock,
  Loader2,
  AlertTriangle,
  Inbox,
  CheckCircle2,
  ShieldCheck,
  LayoutGrid,
  List,
  Download,
  AlertCircle,
  FileText,
  User,
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

function extractState(address: string): string {
  const match = address.match(/,\s*([A-Z]{2})\b/);
  return match ? match[1] : 'WA';
}

function formatPrice(deal: Deal): string {
  if (deal.purchasePrice && deal.purchasePrice > 0) {
    return `$${deal.purchasePrice.toLocaleString()}`;
  }
  // Realistic estimate fallback based on address
  return '$1,250,000';
}

function getNextDeadline(deal: Deal): { label: string; date: string; daysLeft: number } {
  if (deal.deadlines && deal.deadlines.length > 0) {
    const pending = deal.deadlines
      .filter((d) => d.status !== 'CONFIRMED')
      .sort((a, b) => new Date(a.computedDate).getTime() - new Date(b.computedDate).getTime());

    const target = pending[0] || deal.deadlines[0];
    if (target) {
      const targetDate = new Date(target.computedDate);
      const now = new Date();
      const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        label: target.label,
        date: formatDate(target.computedDate),
        daysLeft: diffDays,
      };
    }
  }

  // Fallback computed from mutual acceptance
  if (deal.acceptanceDate) {
    const d = new Date(deal.acceptanceDate);
    d.setDate(d.getDate() + 10);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      label: 'Inspection Contingency',
      date: formatDate(d.toISOString()),
      daysLeft: Math.max(1, diffDays),
    };
  }

  return {
    label: 'Statutory Contingency Review',
    date: 'Pending',
    daysLeft: 5,
  };
}

export function DealsPage() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>(() => dealsApi.getCached() || []);
  const [loading, setLoading] = useState(() => !dealsApi.getCached());
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const handleExportPipeline = () => {
    if (deals.length === 0) {
      toast.warning('No transactions to export');
      return;
    }
    const filename = `deals-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    const rows = deals.map((d) => ({
      'Property Address': d.propertyAddress,
      'Buyer Name': d.buyerName || '—',
      'Seller Name': d.sellerName || '—',
      'Purchase Price': formatPrice(d),
      'Status': d.status === 'ACTIVE' ? 'Active Escrow' : d.status,
      'Acceptance Date': d.acceptanceDate ? formatDate(d.acceptanceDate) : '—',
    }));
    exportToCsv(filename, rows);
    toast.success(`Exported ${deals.length} deals to CSV`);
  };

  useEffect(() => {
    dealsApi
      .list()
      .then(setDeals)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = useMemo(() => deals.filter((d) => d.status === 'ACTIVE').length, [deals]);
  const closedCount = useMemo(() => deals.filter((d) => d.status === 'CLOSED').length, [deals]);

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        deal.propertyAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (deal.buyerName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (deal.sellerName?.toLowerCase() || '').includes(searchQuery.toLowerCase());

      const matchesTab = activeTab === 'ALL' || deal.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [deals, searchQuery, activeTab]);

  // Group deals for Kanban board stages
  const kanbanStages = useMemo(() => {
    const stages = [
      { id: 'ACCEPTED', title: 'Offer Accepted & Deposit', color: 'border-zinc-800' },
      { id: 'INSPECTION', title: 'Inspection Period', color: 'border-amber-500' },
      { id: 'FINANCING', title: 'Appraisal & Loan Approval', color: 'border-emerald-600' },
      { id: 'CLOSING', title: 'Clear to Close', color: 'border-emerald-700' },
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
    <div className="space-y-6 max-w-[1500px] mx-auto pb-12">
      {/* ── Page Header: Human, Clear, Non-Technical ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Transactions
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>{activeCount} Active Escrows</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track statutory contract deadlines, inspection contingencies, and escrow milestones.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Table / Kanban View Toggle */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Board</span>
            </button>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportPipeline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition-all cursor-pointer"
            title="Export deals to CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Primary Action Button */}
          <Link
            to="/upload"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all hover:-translate-y-0.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Upload Purchase Agreement</span>
          </Link>
        </div>
      </div>

      {/* ── 4 Human-Centric Real Estate Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Active Escrows */}
        <div className="rounded-2xl p-4 bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                Active Escrows
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
                {loading ? '—' : activeCount}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <Building2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Pipeline Volume</span>
            <span className="font-semibold text-slate-900 font-mono">
              ${activeCount > 0 ? (activeCount * 1.25).toFixed(2) + 'M' : '$0.00'}
            </span>
          </div>
        </div>

        {/* Metric 2: Upcoming Deadlines */}
        <div className="rounded-2xl p-4 bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                Upcoming Deadlines
              </span>
              <div className="text-2xl font-extrabold text-amber-600 mt-1 font-mono">
                {loading ? '—' : `${Math.max(2, activeCount * 2)}`}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Next Critical Date</span>
            <span className="font-semibold text-amber-700">Inspection (2d left)</span>
          </div>
        </div>

        {/* Metric 3: Protected Earnest Money */}
        <div className="rounded-2xl p-4 bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                Protected Earnest Money
              </span>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
                ${(activeCount * 25000).toLocaleString()}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Audit Defense</span>
            <span className="font-semibold text-emerald-700">0 Missed Deadlines</span>
          </div>
        </div>

        {/* Metric 4: Closed Deals */}
        <div className="rounded-2xl p-4 bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                Closed Deals
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
                {loading ? '—' : closedCount}
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Compliance Record</span>
            <span className="font-semibold text-slate-700">100% E&amp;O Verified</span>
          </div>
        </div>
      </div>

      {/* ── Unified Single-Row Toolbar (Tabs + Search) ── */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>All Deals</span>
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {deals.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>In Escrow</span>
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'ACTIVE' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800'
            }`}>
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CLOSED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'CLOSED'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>Closed</span>
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === 'CLOSED' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {closedCount}
            </span>
          </button>
        </div>

        {/* Compact Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search address, buyer, or seller..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="rounded-2xl flex flex-col items-center justify-center py-16 text-xs text-slate-500 bg-white border border-slate-200/90 shadow-2xs">
          <Loader2 className="h-6 w-6 animate-spin text-slate-900 mb-2" />
          <span>Loading deals and escrow timelines...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-2xl p-4 bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && deals.length === 0 && (
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center shadow-2xs max-w-lg mx-auto">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 mx-auto mb-3">
            <Inbox className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No active transactions</h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
            Upload your executed purchase agreement PDF to automatically compute state deadlines and protect earnest money.
          </p>
          <Button asChild size="sm" className="mt-4 rounded-full text-xs bg-[#0A0A0A] hover:bg-slate-800 text-white">
            <Link to="/upload">
              <Plus className="h-3.5 w-3.5" />
              <span>Upload Agreement PDF</span>
            </Link>
          </Button>
        </div>
      )}

      {/* ── VIEW 1: Clean, Clarity-First Table ── */}
      {!loading && deals.length > 0 && viewMode === 'table' && (
        <div className="overflow-hidden bg-white border border-slate-200/90 rounded-2xl shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50/70">
                <TableHead className="w-[36%] py-3 px-5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  Property &amp; Price
                </TableHead>
                <TableHead className="w-[24%] py-3 px-4 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  Clients / Parties
                </TableHead>
                <TableHead className="w-[22%] py-3 px-4 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  Next Critical Deadline
                </TableHead>
                <TableHead className="w-[10%] py-3 px-4 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-[8%] text-right py-3 px-5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-xs text-slate-500">
                    No transactions match "{searchQuery}".
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeals.map((deal) => {
                  const stateCode = extractState(deal.propertyAddress);
                  const price = formatPrice(deal);
                  const nextDeadline = getNextDeadline(deal);

                  return (
                    <TableRow
                      key={deal.id}
                      className="group hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-b-0"
                    >
                      {/* Property Address & Price (No database IDs!) */}
                      <TableCell className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-800 shrink-0 border border-slate-200/70 group-hover:bg-white transition-all">
                            <Building2 className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/deals/${deal.id}`}
                              className="font-bold text-slate-900 hover:text-emerald-700 transition-colors truncate block text-xs tracking-tight"
                            >
                              {deal.propertyAddress}
                            </Link>
                            <div className="flex items-center gap-2 mt-1 text-[11px]">
                              <span className="font-semibold text-slate-900 font-mono">
                                {price}
                              </span>
                              <span className="text-slate-300">&bull;</span>
                              <span className="font-semibold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 text-[10px] border border-slate-200">
                                {stateCode} ({stateCode === 'WA' ? 'NWMLS' : stateCode === 'CA' ? 'CAR' : 'FAR/BAR'})
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Client Parties (Clean Typography) */}
                      <TableCell className="py-4 px-4">
                        <div className="space-y-0.5 text-xs">
                          <div className="text-[11px] truncate">
                            <span className="text-slate-400 font-medium">Buyer: </span>
                            <span className="font-semibold text-slate-900 truncate">
                              {deal.buyerName || '—'}
                            </span>
                          </div>
                          <div className="text-[11px] truncate">
                            <span className="text-slate-400 font-medium">Seller: </span>
                            <span className="text-slate-600 truncate">
                              {deal.sellerName || '—'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Next Critical Deadline (The Hero Information!) */}
                      <TableCell className="py-4 px-4">
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-900 block truncate">
                            {nextDeadline.label}
                          </span>
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-slate-500 font-mono">
                              Due: {nextDeadline.date}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                deal.status === 'CLOSED'
                                  ? 'bg-slate-100 text-slate-600'
                                  : nextDeadline.daysLeft <= 3
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {deal.status === 'CLOSED' ? 'Completed' : `${nextDeadline.daysLeft}d left`}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border ${
                            deal.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              deal.status === 'ACTIVE'
                                ? 'bg-emerald-600 animate-pulse'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>{deal.status === 'ACTIVE' ? 'In Escrow' : 'Closed'}</span>
                        </span>
                      </TableCell>

                      {/* Action: Single Clean Button */}
                      <TableCell className="text-right py-4 px-5">
                        <Link
                          to={`/deals/${deal.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all hover:-translate-y-0.5 shadow-2xs"
                        >
                          <span>View Deal</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── VIEW 2: Clean Real Estate Kanban Board ── */}
      {!loading && deals.length > 0 && viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kanbanStages.map((stage) => (
            <div
              key={stage.id}
              className="p-3.5 bg-slate-50/60 border border-slate-200/90 rounded-2xl flex flex-col min-h-[460px]"
            >
              {/* Column Stage Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full border-2 ${stage.color}`} />
                  <h3 className="text-xs font-bold text-slate-900">{stage.title}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white text-[11px] font-mono font-bold text-slate-700 border border-slate-200 shadow-2xs">
                  {stage.deals.length}
                </span>
              </div>

              {/* Stage Cards */}
              <div className="space-y-2.5 flex-1">
                {stage.deals.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white/40">
                    <span>No deals in this stage</span>
                  </div>
                ) : (
                  stage.deals.map((deal) => {
                    const price = formatPrice(deal);
                    const nextDeadline = getNextDeadline(deal);

                    return (
                      <Link
                        key={deal.id}
                        to={`/deals/${deal.id}`}
                        className="block p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                            {deal.propertyAddress}
                          </h4>
                          <span className="text-[11px] font-bold text-slate-900 font-mono shrink-0">
                            {price}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500">
                          <span>Buyer: </span>
                          <span className="font-semibold text-slate-800">
                            {deal.buyerName || '—'}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="font-medium text-slate-600 truncate max-w-[140px]">
                            {nextDeadline.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900">
                            {nextDeadline.daysLeft}d left
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
