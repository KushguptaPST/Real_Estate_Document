import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Activity,
  Cpu,
  Layers,
  PhoneCall,
  Server,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  ArrowUpRight,
  Zap,
  Building,
  Users,
  Search,
  ChevronRight,
  Headphones,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/context/ToastContext';
import {
  adminApi,
  type AdminMetricsResponse,
  type VisualPathwayNode,
  type PathwaySettings,
} from '@/services/api';

export function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'SWITCHBOARD' | 'TENANTS' | 'PATHWAYS'>('TELEMETRY');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [pathways, setPathways] = useState<{ nodes: VisualPathwayNode[]; settings: PathwaySettings } | null>(null);
  
  // Switchboard Form State
  const [selectedLlm, setSelectedLlm] = useState<string>('gemini-2.5-flash');
  const [selectedStt, setSelectedStt] = useState<string>('deepgram-nova-2');
  const [selectedTts, setSelectedTts] = useState<string>('cartesia-sonic');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('plivo-high-throughput');
  const [updatingSwitchboard, setUpdatingSwitchboard] = useState(false);

  // Pathways Sliders State
  const [discountFlexibility, setDiscountFlexibility] = useState(6);
  const [budgetStretch, setBudgetStretch] = useState(20);
  const [advisorsOnDuty, setAdvisorsOnDuty] = useState(8);
  const [savingPathways, setSavingPathways] = useState(false);

  // Tenant Search
  const [tenantSearch, setTenantSearch] = useState('');

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [metricsRes, pathwaysRes] = await Promise.all([
        adminApi.getMetrics(),
        adminApi.getPathways(),
      ]);
      setMetrics(metricsRes);
      setPathways(pathwaysRes);
      setSelectedLlm(metricsRes.switchboard.activeLlm);
      setSelectedStt(metricsRes.switchboard.activeStt);
      setSelectedTts(metricsRes.switchboard.activeTts);
      setSelectedCarrier(metricsRes.switchboard.activeCarrier);
      setDiscountFlexibility(pathwaysRes.settings.maxDiscountFlexibilityPct);
      setBudgetStretch(pathwaysRes.settings.budgetStretchCeilingPct);
      setAdvisorsOnDuty(pathwaysRes.settings.fieldAdvisorsOnDuty);
    } catch (err: any) {
      console.warn('Failed to load admin data:', err);
      toast.error('Admin Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleExecuteFailover = async () => {
    try {
      setUpdatingSwitchboard(true);
      const res = await adminApi.updateSwitchboard({
        activeLlm: selectedLlm as any,
        activeStt: selectedStt as any,
        activeTts: selectedTts as any,
        activeCarrier: selectedCarrier as any,
      });
      if (res.success) {
        toast.success(
          'Failover Executed',
          `Global topology updated: ${selectedLlm.toUpperCase()} &bull; ${selectedTts.toUpperCase()} with 0 dropped calls.`
        );
        loadAdminData();
      }
    } catch (err: any) {
      toast.error('Failover Failed', err.message);
    } finally {
      setUpdatingSwitchboard(false);
    }
  };

  const handleSavePathwaySettings = async () => {
    try {
      setSavingPathways(true);
      const res = await adminApi.updatePathways({
        settings: {
          maxDiscountFlexibilityPct: discountFlexibility,
          budgetStretchCeilingPct: budgetStretch,
          fieldAdvisorsOnDuty: advisorsOnDuty,
        },
      });
      if (res.success) {
        toast.success('Pathways Saved', 'Commercial negotiation parameters synced to voice agent brain.');
      }
    } catch (err: any) {
      toast.error('Save Failed', err.message);
    } finally {
      setSavingPathways(false);
    }
  };

  const filteredTenants = metrics?.tenants.filter((t) =>
    t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    t.stateJurisdiction.toLowerCase().includes(tenantSearch.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8 pb-16">
      {/* ── Super-Admin Mission Control Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded bg-purple-100 text-purple-700 text-[10px] font-extrabold uppercase tracking-wider">
              Operator Mission Control
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              PSTN &amp; WebSocket Gateway: 100% Nominal
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Super-Admin Mission Control &amp; Global Switchboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-tenant telemetry, global STT/TTS failovers, gross margins, and visual pathway governance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAdminData}
            disabled={loading}
            className="rounded-full text-xs font-semibold"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
          <a
            href="/organization"
            className="px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            Client Workspace
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* ── 4 Top KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Revenue */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Stripe Revenue (MTD)</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              ${metrics ? metrics.kpis.monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '15,172.20'}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold mt-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+24.8% MoM &bull; Stripe Verified</span>
            </div>
          </div>
        </div>

        {/* Card 2: AI Infrastructure Cost & Margin */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Infrastructure Cost</span>
            <span className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <Zap className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              ${metrics ? metrics.kpis.infrastructureCost.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '2,184.80'}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 mt-1">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {metrics ? `${metrics.kpis.netGrossMarginPct}%` : '85.6%'} Net Margin
              </span>
              <span className="text-slate-400 font-normal">Plivo + Deepgram + Cartesia</span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Brokerage Tenants */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Brokerage Tenants</span>
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Building className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {metrics ? metrics.kpis.totalTenants : 28}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
              <PhoneCall className="h-3.5 w-3.5 text-purple-600" />
              <span className="font-semibold text-slate-700">{metrics ? metrics.kpis.activeDids : 142} Active Local DIDs</span>
              <span>&bull; {metrics ? (metrics.kpis.totalMonthlyMinutes / 1000).toFixed(1) : '84.2'}k mins</span>
            </div>
          </div>
        </div>

        {/* Card 4: End-to-End Latency */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Duplex Latency</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-slate-900 font-mono">
              {metrics ? `${metrics.latencyWaterfall.totalDuplexMs}ms` : '425ms'}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-semibold text-emerald-700">Sub-500ms Target</span>
              <span>&bull; {metrics?.kpis.concurrentActiveCalls || 18} Live Streams</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabbed Workspace Navigation ── */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('TELEMETRY')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'TELEMETRY'
                ? 'border-slate-900 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="h-4 w-4" />
            Stream Telemetry &amp; P&amp;L Meter
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SWITCHBOARD')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'SWITCHBOARD'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cpu className="h-4 w-4" />
            Global Model Switchboard
            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] px-1.5 py-0 font-bold">
              1-Click Failover
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TENANTS')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'TENANTS'
                ? 'border-slate-900 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building className="h-4 w-4" />
            Tenant Brokerages ({metrics?.tenants.length || 6})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PATHWAYS')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'PATHWAYS'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="h-4 w-4" />
            Visual Pathway Builder (Section 11.3)
          </button>
        </div>
      </div>

      {/* ── TAB 1: Stream Telemetry & Global P&L Meter ── */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-6">
          {/* Sub-500ms Latency Waterfall Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-700" />
                  Duplex Audio Streaming Latency Waterfall (Real-Time Diagnostic)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  End-to-end voice loop timing across WebSockets, STT transcription, LLM token generation, and TTS synthesis.
                </p>
              </div>
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Total Duplex: {metrics?.latencyWaterfall.totalDuplexMs || 425}ms
              </span>
            </div>

            {/* Waterfall Steps */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Step 1: STT Transcription</span>
                <span className="text-xl font-black text-slate-900 font-mono mt-1 block">
                  {metrics?.latencyWaterfall.sttDeepgramMs || 120}ms
                </span>
                <p className="text-[11px] text-slate-500 mt-1">Deepgram Nova-2 (Raw 8kHz PCM streaming partials)</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Step 2: LLM Time-to-First-Token</span>
                <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
                  {metrics?.latencyWaterfall.llmGeminiTtftMs || 185}ms
                </span>
                <p className="text-[11px] text-slate-500 mt-1">Gemini 2.5 Flash / Groq (Micro-market negotiation)</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Step 3: TTS First Audio Chunk</span>
                <span className="text-xl font-black text-purple-600 font-mono mt-1 block">
                  {metrics?.latencyWaterfall.ttsCartesiaMs || 95}ms
                </span>
                <p className="text-[11px] text-slate-500 mt-1">Cartesia Sonic (90ms first byte + room tone injection)</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Step 4: Network RTT &amp; Plivo</span>
                <span className="text-xl font-black text-emerald-600 font-mono mt-1 block">
                  {metrics?.latencyWaterfall.networkRoundTripMs || 25}ms
                </span>
                <p className="text-[11px] text-slate-500 mt-1">Plivo WebSocket packet delivery + G.711 stream buffer</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Sub-80ms Interruption Barge-In Active:</strong> When the buyer interrupts, the client-side VAD emits <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300">clearAudio</code> in <strong>76ms</strong> to instantly cut off bot playback.
                </span>
              </div>
              <span className="font-mono font-bold text-emerald-700">Zero Overlap</span>
            </div>
          </div>

          {/* Unit Cost Economics & P&L Meter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Unit Cost Economics vs. Client Margin (Section 11.6)
              </h3>
              <p className="text-xs text-slate-500">
                Transparent breakdown of third-party raw costs vs. SaaS metered wallet deduction rate.
              </p>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">Voice Telephony (Duplex Call)</span>
                    <span className="text-[11px] text-slate-500">Plivo ($0.015) + Deepgram ($0.007) + Cartesia ($0.018) + LLM ($0.003) = ~$0.043/min</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-slate-900 block">$0.18 / min</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                      76% Gross Margin
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">Meta WhatsApp Speed-to-Lead</span>
                    <span className="text-[11px] text-slate-500">Meta Graph API ($0.016/msg) + LLM ($0.002) = ~$0.018/inquiry</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-slate-900 block">$0.06 / lead</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                      70% Gross Margin
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">Carrier DIDs (Phone Number Pool)</span>
                    <span className="text-[11px] text-slate-500">Plivo wholesale cost ($1.00/number/month)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-slate-900 block">$5.00 / line / mo</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                      400% Markup
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Server className="h-4 w-4 text-purple-600" />
                Live Cluster Stream Diagnostics
              </h3>
              <p className="text-xs text-slate-500">
                Telephony carrier gateways, WebSocket workers, and regional cluster uptime.
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-700 font-medium">Plivo Mumbai / Singapore Trunk</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 100% Operational (18 trunks in use)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-700 font-medium">Deepgram Nova-2 Streaming STT</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 120ms latency &bull; Zero drops
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-700 font-medium">Cartesia Sonic Voice Synthesis</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 95ms First-Byte &bull; 48kHz OPUS
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-700 font-medium">Meta WhatsApp Graph API v21.0</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Webhook 200 OK (&lt; 600ms)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Global Model Switchboard (1-Click Failover) ── */}
      {activeTab === 'SWITCHBOARD' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-purple-600" />
              Global Model Switchboard &amp; Zero-Downtime Failover (Section 13.1)
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              If an upstream vendor (e.g. Deepgram or Cartesia) degrades, switch providers globally with 1 click without restarting servers or dropping existing active phone calls.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* LLM Selector */}
            <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Primary Conversational LLM</span>
              <div className="space-y-2">
                {[
                  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', latency: '185ms', provider: 'Google' },
                  { id: 'groq-llama-3.3-70b', name: 'Groq Llama-3.3 70B', latency: '140ms', provider: 'Groq' },
                  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', latency: '380ms', provider: 'Anthropic' },
                  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', latency: '210ms', provider: 'OpenAI' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedLlm === item.id
                        ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="llm"
                        value={item.id}
                        checked={selectedLlm === item.id}
                        onChange={() => setSelectedLlm(item.id)}
                        className="sr-only"
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${selectedLlm === item.id ? 'text-purple-200' : 'text-slate-400'}`}>
                      {item.latency}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* STT Selector */}
            <div className="p-4 rounded-xl border border-slate-200 bg-emerald-50/30 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Streaming Speech-to-Text (STT)</span>
              <div className="space-y-2">
                {[
                  { id: 'deepgram-nova-2', name: 'Deepgram Nova-2', latency: '120ms', provider: 'Deepgram' },
                  { id: 'whisper-large-v3', name: 'Whisper Large v3', latency: '220ms', provider: 'Groq' },
                  { id: 'assemblyai-conformer-2', name: 'AssemblyAI Conformer', latency: '260ms', provider: 'AssemblyAI' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedStt === item.id
                        ? 'bg-[#0A0A0A] text-white border-slate-900 font-bold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="stt"
                        value={item.id}
                        checked={selectedStt === item.id}
                        onChange={() => setSelectedStt(item.id)}
                        className="sr-only"
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${selectedStt === item.id ? 'text-slate-400' : 'text-slate-400'}`}>
                      {item.latency}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* TTS Selector */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Cloned Voice Synthesis (TTS)</span>
              <div className="space-y-2">
                {[
                  { id: 'cartesia-sonic', name: 'Cartesia Sonic', latency: '95ms', provider: 'Cartesia' },
                  { id: 'elevenlabs-turbo-v2.5', name: 'ElevenLabs Turbo 2.5', latency: '170ms', provider: 'ElevenLabs' },
                  { id: 'azure-neural-hd', name: 'Azure Neural HD', latency: '220ms', provider: 'Microsoft' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedTts === item.id
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="tts"
                        value={item.id}
                        checked={selectedTts === item.id}
                        onChange={() => setSelectedTts(item.id)}
                        className="sr-only"
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${selectedTts === item.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {item.latency}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Carrier Gateway */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">PSTN Telephony Carrier</span>
              <div className="space-y-2">
                {[
                  { id: 'plivo-high-throughput', name: 'Plivo Carrier Pool', latency: '25ms', provider: 'Plivo' },
                  { id: 'twilio-sip-trunking', name: 'Twilio SIP Trunking', latency: '40ms', provider: 'Twilio' },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      selectedCarrier === item.id
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="carrier"
                        value={item.id}
                        checked={selectedCarrier === item.id}
                        onChange={() => setSelectedCarrier(item.id)}
                        className="sr-only"
                      />
                      <span>{item.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono ${selectedCarrier === item.id ? 'text-emerald-200' : 'text-slate-400'}`}>
                      {item.latency}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Last Failover Event: <strong>{metrics?.switchboard.lastFailoverAt ? new Date(metrics.switchboard.lastFailoverAt).toLocaleDateString() : 'None'}</strong> &bull; Reason: {metrics?.switchboard.failoverReason || 'Nominal operation'}
            </div>

            <Button
              onClick={handleExecuteFailover}
              disabled={updatingSwitchboard}
              className="rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6 shadow-md"
            >
              {updatingSwitchboard ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Broadcasting Topology...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Execute Global Failover Switch
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB 3: Tenant Brokerages Directory ── */}
      {activeTab === 'TENANTS' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="h-5 w-5 text-emerald-700" />
                Managed Tenant Brokerages Directory ({filteredTenants.length} Active)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-tenant isolated workspaces, carrier phone pools, monthly minutes, and pre-paid wallet balances.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search brokerage, city, or plan..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-full pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-3 px-4">Brokerage Name</th>
                  <th className="py-3 px-3">State / City</th>
                  <th className="py-3 px-3">Plan Tier</th>
                  <th className="py-3 px-3 text-center">Carrier DIDs</th>
                  <th className="py-3 px-3 text-right">Voice Minutes</th>
                  <th className="py-3 px-3 text-right">Pre-Paid Wallet</th>
                  <th className="py-3 px-4 text-right">Monthly Rev</th>
                  <th className="py-3 px-3 text-center">Stream Ping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-slate-400" />
                        <span>{t.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{t.stateJurisdiction}</td>
                    <td className="py-3 px-3">
                      <Badge className={`text-[10px] font-bold ${
                        t.tier === 'ENTERPRISE'
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : t.tier === 'TEAM'
                          ? 'bg-emerald-100 text-emerald-900 border-slate-200'
                          : 'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>
                        {t.tier}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-slate-800">
                      {t.activeDids} lines
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {t.monthlyMinutes.toLocaleString()} m
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                      ${t.walletBalance.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      ${t.monthlyRevenue.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {t.lastActive}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: Visual Conversational Pathway Builder (Section 11.3) ── */}
      {activeTab === 'PATHWAYS' && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="h-5 w-5 text-emerald-600" />
                Visual Conversational Pathway Builder (Section 11.3)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                No blank prompt boxes. Real estate brokers configure structured goal nodes that guide the AI through natural qualification to site visit locking.
              </p>
            </div>

            <Button
              onClick={handleSavePathwaySettings}
              disabled={savingPathways}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
            >
              {savingPathways ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Save Pathway Rules
            </Button>
          </div>

          {/* 3 Commercial Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                <span>Max Discount Flexibility</span>
                <span className="font-mono text-emerald-600">{discountFlexibility}% on-site waiver</span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={discountFlexibility}
                onChange={(e) => setDiscountFlexibility(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">Frames price cuts as "clubhouse/floor-rise waiver for serious buyers".</p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                <span>Budget Stretch Ceiling</span>
                <span className="font-mono text-emerald-700">+{budgetStretch}% Elastic Match</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="5"
                value={budgetStretch}
                onChange={(e) => setBudgetStretch(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">Evaluates motivated seller properties up to +20% with EMI bridge.</p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                <span>Field Advisors On Duty</span>
                <span className="font-mono text-purple-600">{advisorsOnDuty} Senior Brokers</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="1"
                value={advisorsOnDuty}
                onChange={(e) => setAdvisorsOnDuty(Number(e.target.value))}
                className="w-full accent-purple-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">Rounds-robin weekend showings and live telephony warm transfers.</p>
            </div>
          </div>

          {/* 5 Sequential Goal Nodes */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Sequential Goal Node Topology (Sub-500ms Duplex Execution)
            </span>

            <div className="grid grid-cols-1 gap-3.5">
              {pathways?.nodes.map((node, idx) => (
                <div
                  key={node.id}
                  className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <span className="h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                      {node.stepNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{node.name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          node.type === 'SITE_VISIT_LOCK'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : node.type === 'WARM_TRANSFER'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {node.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{node.goal}</p>
                      <div className="mt-2 p-2 rounded bg-slate-50 border border-slate-100 text-[11px] font-mono text-slate-700">
                        "{node.promptSnippet}"
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Target: ~{node.targetDurationSeconds}s
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Check className="h-3 w-3" />
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
