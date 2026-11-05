import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  PhoneOutgoing,
  Bot,
  Users,
  CheckCircle2,
  CalendarCheck,
  Voicemail,
  Loader2,
  Play,
  Pause,
  Upload,
  AlertCircle,
  Activity,
  Sliders,
  ShieldCheck,
  RefreshCw,
  PhoneForwarded,
} from 'lucide-react';
import { campaignsApi, type CampaignStateResponse, type CampaignLogItem } from '@/services/api';
import { useToast } from '@/context/ToastContext';

export function CampaignsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<CampaignStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Trunk Governor Slider State
  const [trunks, setTrunks] = useState(15);

  // CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [rawCsvText, setRawCsvText] = useState(
    'FullName,Phone,Budget,PreferredLocation\nAlexander Vance,+15125550192,$1.25M,Downtown Austin\nElena Rostova,+15125550144,$925K,Zilker Park\nDavid Kim,+15125550183,$1.85M,Tarrytown\nMarcus Sterling,+15125550171,$2.4M,Westlake Hills'
  );
  const [importing, setImporting] = useState(false);

  const fetchStats = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await campaignsApi.getStats();
      setData(res);
      if (res.campaign?.concurrencyTrunks) {
        setTrunks(res.campaign.concurrencyTrunks);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load campaign data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => fetchStats(), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleCampaign = async () => {
    if (!data) return;
    try {
      setActionLoading(true);
      if (data.campaign.status === 'RUNNING') {
        const res = await campaignsApi.pauseCampaign();
        toast.info(res.message);
      } else {
        const res = await campaignsApi.startCampaign({ concurrencyTrunks: trunks });
        toast.success(res.message);
      }
      await fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateTrunks = async (newVal: number) => {
    setTrunks(newVal);
    if (data?.campaign.status === 'RUNNING') {
      try {
        await campaignsApi.startCampaign({ concurrencyTrunks: newVal });
        toast.success(`Trunk concurrency updated to ${newVal} active lines`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to update trunks');
      }
    }
  };

  const handleImportLeads = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawCsvText.trim()) return;

    try {
      setImporting(true);
      const lines = rawCsvText.trim().split('\n');
      const leads: Array<{ fullName: string; phone: string; budget?: string; preferredLocation?: string }> = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line) continue;
        const [fullName, phone, budget, preferredLocation] = line.split(',').map((s) => s.trim());
        if (fullName && phone) {
          leads.push({ fullName, phone, budget, preferredLocation });
        }
      }

      if (leads.length === 0) {
        toast.error('No valid rows found in CSV format');
        return;
      }

      const res = await campaignsApi.importLeads(leads);
      toast.success(`Successfully imported ${res.importedCount} leads into campaign batch!`);
      setShowImportModal(false);
      await fetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-900" />
      </div>
    );
  }

  const campaign = data?.campaign;
  const isRunning = campaign?.status === 'RUNNING';

  const getOutcomeBadge = (outcome: CampaignLogItem['outcome']) => {
    switch (outcome) {
      case 'VISIT_CONFIRMED':
        return {
          label: 'Site Visit Confirmed',
          bg: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
          icon: CalendarCheck,
        };
      case 'LIVE_HUMAN_ANSWERED':
        return {
          label: 'Live Human Answered',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: PhoneCall,
        };
      case 'AMD_VOICEMAIL_DROP':
        return {
          label: 'AMD Voicemail Drop',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: Voicemail,
        };
      case 'WARM_TRANSFER':
        return {
          label: 'Warm Human Transfer',
          bg: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
          icon: PhoneForwarded,
        };
      case 'BUSY_RETRY':
      default:
        return {
          label: 'Busy / Queued Retry',
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          icon: PhoneOutgoing,
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="h-6 w-6 text-purple-600" />
              High-Scale Campaign Calling Engine
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border flex items-center gap-1.5 ${
                isRunning
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {campaign?.status || 'IDLE'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Batch dialer (10,000+ numbers) &bull; ML AMD Voicemail Handling &bull; Plivo Duplex Streaming &bull; Sub-500ms Latency
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-slate-900' : ''}`} />
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-700" />
            <span>Upload CSV (5,000+ Leads)</span>
          </button>

          <button
            onClick={handleToggleCampaign}
            disabled={actionLoading}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 text-white ${
              isRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRunning ? (
              <>
                <Pause className="h-4 w-4 fill-current" />
                <span>Pause Dialer</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Launch Autonomous Campaign</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 4 Key Performance Metrics Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Leads & Dials */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Coverage &amp; Dials</span>
            <Users className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {campaign?.callsDialed.toLocaleString() || 0}
            <span className="text-xs text-slate-400 font-normal"> / {campaign?.totalLeads.toLocaleString() || 0}</span>
          </div>
          <p className="text-[11px] text-slate-500">
            {campaign?.totalLeads ? Math.round((campaign.callsDialed / campaign.totalLeads) * 100) : 0}% database dialed
          </p>
        </div>

        {/* Card 2: Live Humans Connected */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Live Humans Connected</span>
            <PhoneCall className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">
            {campaign?.liveHumansConnected.toLocaleString() || 0}
          </div>
          <p className="text-[11px] text-slate-500">
            {campaign?.callsDialed ? Math.round((campaign.liveHumansConnected / campaign.callsDialed) * 100) : 0}% human pick-up rate
          </p>
        </div>

        {/* Card 3: Answering Machine Detection (AMD) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>AMD Voicemail Interceptions</span>
            <Voicemail className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-600 tracking-tight">
            {campaign?.voicemailsDetected.toLocaleString() || 0}
          </div>
          <p className="text-[11px] text-slate-500">&lt; 1.5s detection &bull; Dropped audio memos</p>
        </div>

        {/* Card 4: Site Visits Locked */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Site Visits Confirmed</span>
            <CalendarCheck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 tracking-tight">
            {campaign?.siteVisitsLocked.toLocaleString() || 0}
          </div>
          <p className="text-[11px] text-slate-500">
            {campaign?.warmTransfersRequested || 0} warm human transfers
          </p>
        </div>
      </div>

      {/* ── Concurrency Trunk Governor & DND Compliance Box ── */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-emerald-700" />
              Concurrency Trunk Governor &amp; Carrier Pool
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Limits concurrent Plivo outbound phone channels to prevent carrier rate-limiting and manage advisor capacity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              DND Filter: 09:30 AM – 07:30 PM IST
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700">Active Simultaneous Outbound Trunks:</span>
            <span className="font-mono text-purple-700 font-extrabold text-sm bg-purple-50 px-2.5 py-0.5 rounded border border-purple-200">
              {trunks} Simultaneous Lines
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={trunks}
            onChange={(e) => handleUpdateTrunks(parseInt(e.target.value, 10))}
            className="w-full accent-purple-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>1 Line (Safe Single-Dial)</span>
            <span>15 Lines (Recommended Baseline)</span>
            <span>30 Lines (Max Concurrent Trunks)</span>
          </div>
        </div>
      </div>

      {/* ── Real-Time Call Event Feed & Action Stream ── */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs space-y-0">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-emerald-700" />
              Live Outbound Calling Action Stream
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time duplex calls, AMD voicemail drops, and site visit confirmations.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Auto-polling every 8s
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {campaign?.logs?.map((log) => {
            const badge = getOutcomeBadge(log.outcome);
            const Icon = badge.icon;

            return (
              <div key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start sm:items-center gap-3">
                  <span className={`p-2 rounded-xl border shrink-0 ${badge.bg}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{log.leadName}</span>
                      <span className="text-[11px] font-mono text-slate-500">{log.phone}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">{log.notes}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                    {badge.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CSV Bulk Ingestion Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  <Upload className="h-5 w-5 text-emerald-700" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload CSV Lead Batch</h3>
                  <p className="text-[11px] text-slate-500">
                    Import up to 10,000 numbers for automated campaign dialing
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportLeads} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  CSV Lead Data (Header: FullName,Phone,Budget,PreferredLocation)
                </label>
                <textarea
                  rows={8}
                  required
                  value={rawCsvText}
                  onChange={(e) => setRawCsvText(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-800 p-3 focus:border-slate-900 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  DND numbers and out-of-window contacts are automatically scrubbed during dialing.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing || !rawCsvText.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Ingesting Leads...
                    </>
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5" />
                      Import Batch into Campaign
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
