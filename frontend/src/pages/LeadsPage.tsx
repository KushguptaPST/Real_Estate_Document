import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsApi, leadTasksApi, siteVisitsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { CsvImportModal } from '@/components/CsvImportModal';
import type {
  Lead,
  LeadTask,
  LeadTaskType,
  SiteVisit,
  SiteVisitStatus,
  ActionQueueResponse,
  ActionQueueItem,
  ActionQueueBucket,
  ActionQueueSummary,
} from '@/types';
import {
  Users,
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Sparkles,
  Phone,
  Mail,
  Building2,
  DollarSign,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  TrendingUp,
  Bot,
  Zap,
  UserCheck,
  Inbox,
  Clock,
  AlertTriangle,
  Check,
  ListTodo,
  CheckSquare,
  CalendarClock,
  PhoneCall,
  MessageSquare,
  Send,
  FileCheck,
  XCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Activity,
  MapPin,
} from 'lucide-react';

export function LeadsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [poolTab, setPoolTab] = useState<'ACTION_QUEUE' | 'ALL' | 'MY' | 'UNASSIGNED' | 'TASKS' | 'SITE_VISITS'>('ACTION_QUEUE');
  const [claimingLeadId, setClaimingLeadId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Advisor Tasks State
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [taskFilter, setTaskFilter] = useState<'upcoming' | 'overdue' | 'completed' | 'all'>('upcoming');
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [taskCounts, setTaskCounts] = useState({ upcoming: 0, overdue: 0, completed: 0, all: 0 });

  // Site Visits State
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [visitFilter, setVisitFilter] = useState<string>('');
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [scheduledVisitsCount, setScheduledVisitsCount] = useState(0);

  // Action Queue State
  const [actionQueueData, setActionQueueData] = useState<ActionQueueResponse | null>(null);
  const [actionQueueSummary, setActionQueueSummary] = useState<ActionQueueSummary | null>(null);
  const [queueBucket, setQueueBucket] = useState<ActionQueueBucket>('all');
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [actionSearch, setActionSearch] = useState('');

  // Overall Pipeline Summary State (always populated across tabs)
  const [pipelineStats, setPipelineStats] = useState({
    total: 0,
    newCount: 0,
    urgentCount: 0,
    myCount: 0,
    unassignedCount: 0,
  });

  // New Lead Form State
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEnquiryText, setNewEnquiryText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPipelineStats();
    fetchTaskCounts();
    fetchScheduledVisitsCount();
    fetchQueueSummary();

    if (poolTab === 'ACTION_QUEUE') {
      fetchActionQueue();
    } else if (poolTab === 'TASKS') {
      fetchTasks();
    } else if (poolTab === 'SITE_VISITS') {
      fetchSiteVisits();
    } else {
      fetchLeads();
    }
  }, [search, statusFilter, priorityFilter, poolTab, taskFilter, visitFilter, queueBucket]);

  async function fetchPipelineStats() {
    try {
      const all = await leadsApi.list({});
      setPipelineStats({
        total: all.length,
        newCount: all.filter((l) => l.status === 'NEW').length,
        urgentCount: all.filter((l) => l.priority === 'URGENT' || l.priority === 'HIGH').length,
        myCount: all.filter((l) => l.assignedUserId === user?.id).length,
        unassignedCount: all.filter((l) => !l.assignedUserId).length,
      });
    } catch {
      // ignore count failure
    }
  }

  async function fetchQueueSummary() {
    try {
      const res = await leadTasksApi.getActionQueue({ limit: 1 });
      if (res?.summary) {
        setActionQueueSummary(res.summary);
      }
    } catch {
      // ignore count failure
    }
  }

  async function fetchActionQueue(bucket: ActionQueueBucket = queueBucket) {
    try {
      setLoadingQueue(true);
      setQueueError(null);
      const res = await leadTasksApi.getActionQueue({
        bucket: bucket === 'all' ? undefined : bucket,
      });
      setActionQueueData(res);
      if (res?.summary) {
        setActionQueueSummary(res.summary);
      }
    } catch (err: any) {
      setQueueError(err.message || 'Failed to load advisor action queue');
    } finally {
      setLoadingQueue(false);
    }
  }

  async function handleCompleteQueueTask(taskId: string) {
    try {
      setCompletingTaskId(taskId);
      await leadTasksApi.complete(taskId);
      setFeedbackMessage({
        type: 'success',
        text: 'Follow-up task marked as completed!',
      });
      await Promise.all([
        fetchActionQueue(),
        fetchQueueSummary(),
        fetchTaskCounts(),
      ]);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to complete task',
      });
    } finally {
      setCompletingTaskId(null);
    }
  }

  async function fetchTaskCounts() {
    try {
      const [up, ov, cp, al] = await Promise.all([
        leadTasksApi.list({ filter: 'upcoming', limit: 100 }),
        leadTasksApi.list({ filter: 'overdue', limit: 100 }),
        leadTasksApi.list({ filter: 'completed', limit: 100 }),
        leadTasksApi.list({ filter: 'all', limit: 100 }),
      ]);
      setTaskCounts({
        upcoming: up.length,
        overdue: ov.length,
        completed: cp.length,
        all: al.length,
      });
    } catch {
      // ignore count failure
    }
  }

  async function fetchScheduledVisitsCount() {
    try {
      const data = await siteVisitsApi.list({ status: 'SCHEDULED' });
      setScheduledVisitsCount(data.length);
    } catch {
      // ignore
    }
  }

  async function fetchSiteVisits() {
    try {
      setLoadingVisits(true);
      setError(null);
      const data = await siteVisitsApi.list({
        status: visitFilter || undefined,
      });
      setSiteVisits(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load site visits');
    } finally {
      setLoadingVisits(false);
    }
  }

  async function fetchTasks() {
    try {
      setLoadingTasks(true);
      setError(null);
      const data = await leadTasksApi.list({
        filter: taskFilter,
      });
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load follow-up tasks');
    } finally {
      setLoadingTasks(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      setCompletingTaskId(taskId);
      await leadTasksApi.complete(taskId);
      setFeedbackMessage({
        type: 'success',
        text: 'Follow-up task marked as completed!',
      });
      await fetchTasks();
      await fetchTaskCounts();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to complete task',
      });
    } finally {
      setCompletingTaskId(null);
    }
  }

  async function handleCancelTask(taskId: string) {
    const reason = window.prompt('Reason for cancelling this task (optional):');
    if (reason === null) return;
    try {
      setCancellingTaskId(taskId);
      await leadTasksApi.cancel(taskId, reason || undefined);
      setFeedbackMessage({
        type: 'success',
        text: 'Follow-up task cancelled.',
      });
      await fetchTasks();
      await fetchTaskCounts();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to cancel task',
      });
    } finally {
      setCancellingTaskId(null);
    }
  }

  function getTaskTypeBadge(type: LeadTaskType) {
    switch (type) {
      case 'CALL':
        return { label: 'Call', icon: PhoneCall, bg: 'bg-[#C9A961]/15 text-[#C9A961] border-[#C9A961]/30' };
      case 'MESSAGE':
        return { label: 'Message', icon: MessageSquare, bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
      case 'SITE_VISIT':
        return { label: 'Site Visit', icon: Building2, bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'SEND_DETAILS':
        return { label: 'Send Details', icon: Send, bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'DOCUMENT_FOLLOW_UP':
        return { label: 'Doc Follow-Up', icon: FileCheck, bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'OTHER':
      default:
        return { label: 'Other', icon: CheckSquare, bg: 'bg-white/5 text-[#9A9AA5] border-white/10' };
    }
  }

  async function fetchLeads() {
    try {
      setLoading(true);
      setError(null);
      const params: Parameters<typeof leadsApi.list>[0] = {
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      };

      if (poolTab === 'MY' && user?.id) {
        params.assignedUserId = user.id;
      } else if (poolTab === 'UNASSIGNED') {
        params.unassigned = true;
      }

      const data = await leadsApi.list(params);
      setLeads(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimLead(e: React.MouseEvent, leadId: string) {
    e.stopPropagation();
    try {
      setClaimingLeadId(leadId);
      setFeedbackMessage(null);
      await leadsApi.claim(leadId, 'Claimed via Leads Dashboard');
      setFeedbackMessage({
        type: 'success',
        text: 'Lead successfully claimed and added to your active pipeline!',
      });
      await fetchLeads();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('already assigned') || err.message?.includes('another advisor')) {
        setFeedbackMessage({
          type: 'warning',
          text: 'This lead was just claimed by another advisor.',
        });
      } else if (err.status === 422 || err.message?.includes('cap')) {
        setFeedbackMessage({
          type: 'error',
          text: 'Active lead cap reached (25 active leads maximum). Please close or release existing leads first.',
        });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: err.message || 'Failed to claim lead',
        });
      }
      await fetchLeads();
    } finally {
      setClaimingLeadId(null);
    }
  }

  async function handleCreateLead(e: React.FormEvent) {
    e.preventDefault();
    if (!newFullName.trim()) return;

    try {
      setSubmitting(true);
      const lead = await leadsApi.create({
        fullName: newFullName,
        email: newEmail || undefined,
        phone: newPhone || undefined,
        enquiryText: newEnquiryText || undefined,
        source: 'MANUAL',
      });
      setShowAddModal(false);
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewEnquiryText('');
      navigate(`/leads/${lead.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  }

  const priorityColors: Record<string, string> = {
    URGENT: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
    HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    MEDIUM: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
    LOW: 'bg-white/5 text-[#9A9AA5] border-white/10',
  };

  const statusColors: Record<string, string> = {
    NEW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    CONTACTED: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25',
    QUALIFIED: 'bg-[#C9A961]/10 text-[#C9A961] border-[#C9A961]/25',
    SITE_VISIT_SCHEDULED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    PROPOSAL: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
    WON: 'bg-teal-500/10 text-teal-400 border-teal-500/25',
    LOST: 'bg-white/5 text-[#9A9AA5] border-white/10',
  };

  const totalLeadsCount = pipelineStats.total || leads.length;
  const urgentCount = pipelineStats.urgentCount || leads.filter((l) => l.priority === 'URGENT' || l.priority === 'HIGH').length;
  const newLeadsCount = pipelineStats.newCount || leads.filter((l) => l.status === 'NEW').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Lead Operations &amp; Conversion Pipeline
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C9A961] border border-[#C9A961]/25">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C9A961] animate-pulse" />
              Agentic Auto-Pilot Active
            </span>
          </div>
          <p className="text-xs text-[#9A9AA5] mt-1">
            Deterministic buyer qualification, automated tour scheduling &amp; real-time conversational advisor.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCsvModal(true)}
            className="btn-stripe-secondary text-xs px-3.5 py-2 cursor-pointer flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            Import CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-stripe-primary text-xs px-3.5 py-2 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Inbound Lead
          </button>
        </div>
      </div>

      {/* ── Unified Metric Ribbon (Always Live Data) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Active Pipeline */}
        <div className="luxury-card p-4.5 bg-[#141418] border border-white/[0.08] rounded-2xl hover:border-[#C9A961]/40 transition-all shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Total Active Leads</span>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{totalLeadsCount}</div>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-1.5">
                <TrendingUp className="h-3 w-3" /> Live Pipeline Sync
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>

        {/* New Inbound Queue */}
        <div className="luxury-card p-4.5 bg-[#141418] border border-white/[0.08] rounded-2xl hover:border-emerald-500/40 transition-all shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">New Inbound Queue</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{newLeadsCount}</div>
              <span className="text-[11px] text-[#9A9AA5] mt-1.5 block">Awaiting First Contact</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>

        {/* Action Queue Alerts & Deadlines */}
        <div
          onClick={() => setPoolTab('ACTION_QUEUE')}
          className={`luxury-card p-4.5 rounded-2xl transition-all cursor-pointer border shadow-sm ${
            (actionQueueSummary?.overdueCount ?? 0) > 0
              ? 'bg-[#181214] border-rose-500/35 hover:border-rose-500/60 ring-1 ring-rose-500/20'
              : 'bg-[#141418] border-white/[0.08] hover:border-amber-500/40'
          }`}
          title="Click to view Action Queue"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Action Queue Alerts</span>
              <div className="text-2xl font-bold font-mono mt-1 flex items-center gap-2">
                <span className={(actionQueueSummary?.overdueCount ?? 0) > 0 ? 'text-rose-400' : 'text-white'}>
                  {actionQueueSummary?.totalActive ?? 0}
                </span>
                {(actionQueueSummary?.overdueCount ?? 0) > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                    {actionQueueSummary?.overdueCount} Overdue
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-semibold mt-1.5 flex items-center gap-1 ${
                (actionQueueSummary?.overdueCount ?? 0) > 0 ? 'text-rose-400' : 'text-[#9A9AA5]'
              }`}>
                {(actionQueueSummary?.overdueCount ?? 0) > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3" /> Requires immediate action
                  </>
                ) : (
                  'All tasks & tours on schedule'
                )}
              </span>
            </div>
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              (actionQueueSummary?.overdueCount ?? 0) > 0
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
            }`}>
              <Zap className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>

        {/* Autonomous AI Advisor */}
        <div className="luxury-card p-4.5 bg-[#141418] border border-white/[0.08] rounded-2xl hover:border-cyan-500/40 transition-all shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Autonomous AI Copilot</span>
              <div className="text-2xl font-bold text-cyan-400 mt-1 font-mono flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                24/7 Active
              </div>
              <span className="text-[11px] text-[#9A9AA5] mt-1.5 block">Telegram &amp; Voice Synthesis</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <Bot className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Pool Tabs & Search Controls ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3 overflow-x-auto">
          <button
            onClick={() => setPoolTab('ACTION_QUEUE')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'ACTION_QUEUE'
                ? 'bg-[#1A1A22] text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                : 'bg-[#141418] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Action Queue
            {actionQueueSummary && actionQueueSummary.totalActive > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  actionQueueSummary.overdueCount > 0
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                    : 'bg-[#C9A961]/20 text-[#C9A961]'
                }`}
              >
                {actionQueueSummary.overdueCount > 0
                  ? `${actionQueueSummary.overdueCount} overdue`
                  : actionQueueSummary.totalActive}
              </span>
            )}
          </button>

          <button
            onClick={() => setPoolTab('ALL')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'ALL'
                ? 'bg-[#1A1A22] text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                : 'bg-[#141418] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            All Leads
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/5 text-[#9A9AA5]">
              {pipelineStats.total || leads.length}
            </span>
          </button>

          <button
            onClick={() => setPoolTab('MY')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'MY'
                ? 'bg-[#1A1A22] text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                : 'bg-[#141418] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            My Leads
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/5 text-[#9A9AA5]">
              {pipelineStats.myCount}
            </span>
          </button>

          <button
            onClick={() => setPoolTab('UNASSIGNED')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'UNASSIGNED'
                ? 'bg-[#1A1A22] text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                : 'bg-[#141418] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>Unassigned Pool</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/5 text-[#9A9AA5]">
              {pipelineStats.unassignedCount}
            </span>
          </button>

          <button
            onClick={() => setPoolTab('TASKS')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'TASKS'
                ? 'bg-[#1A1A22] text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                : 'bg-[#141418] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" />
            Follow-Up Tasks
            {taskCounts.overdue > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold animate-pulse">
                {taskCounts.overdue} overdue
              </span>
            ) : taskCounts.upcoming > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold">
                {taskCounts.upcoming}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setPoolTab('SITE_VISITS')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'SITE_VISITS'
                ? 'bg-[#1A1A22] text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                : 'bg-[#141418] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Site Visits
            {scheduledVisitsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                {scheduledVisitsCount}
              </span>
            )}
          </button>
        </div>

        {feedbackMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : feedbackMessage.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' && <Check className="h-4 w-4 text-emerald-600" />}
              {feedbackMessage.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
              {feedbackMessage.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-600" />}
              <span className="font-medium">{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs font-bold hover:opacity-75"
            >
              ✕
            </button>
          </div>
        )}

        {poolTab === 'TASKS' ? (
          <div className="p-3 flex flex-wrap items-center justify-between gap-3 bg-[#141418] border border-white/[0.08] rounded-2xl">
            <div className="flex items-center gap-2">
              {(['upcoming', 'overdue', 'completed', 'all'] as const).map((filter) => {
                const count =
                  filter === 'upcoming'
                    ? taskCounts.upcoming
                    : filter === 'overdue'
                    ? taskCounts.overdue
                    : filter === 'completed'
                    ? taskCounts.completed
                    : taskCounts.all;
                const isActive = taskFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? filter === 'overdue'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-xs'
                          : 'bg-[#C9A961]/20 text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                        : 'bg-[#181820] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
                    }`}
                  >
                    {filter === 'upcoming' && <CalendarClock className="h-3.5 w-3.5" />}
                    {filter === 'overdue' && <AlertTriangle className="h-3.5 w-3.5" />}
                    {filter === 'completed' && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {filter === 'all' && <ListTodo className="h-3.5 w-3.5" />}
                    <span className="capitalize">{filter}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-white/10 text-white' : 'bg-white/5 text-[#9A9AA5]'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-[#9A9AA5] font-mono">
              {user?.role === 'OWNER' ? 'Organization follow-up queue' : 'Your assigned follow-ups'}
            </span>
          </div>
        ) : poolTab === 'ACTION_QUEUE' ? null : (
          <div className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#141418] border border-white/[0.08] rounded-2xl">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9A9AA5]" />
              <input
                type="text"
                placeholder="Search leads by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-base pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-[#9A9AA5]" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="input-base w-auto py-1.5 text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="NEW">New</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="QUALIFIED">Qualified</option>
                  <option value="PROPOSAL">Proposal</option>
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="input-base w-auto py-1.5 text-xs"
              >
                <option value="">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Content States ── */}
      {poolTab === 'ACTION_QUEUE' ? (
        <div className="space-y-4">
          {/* Action Command Toolbar: Category Pills + Live Search */}
          <div className="p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 bg-[#141418] border border-white/[0.08] rounded-2xl shadow-sm">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
              {(
                [
                  { id: 'all', label: 'All Action Items', count: actionQueueSummary?.totalActive ?? 0, icon: Zap },
                  { id: 'overdue', label: 'Overdue', count: actionQueueSummary?.overdueCount ?? 0, icon: AlertTriangle, isAlert: true },
                  { id: 'today', label: 'Due Today', count: actionQueueSummary?.dueTodayCount ?? 0, icon: Clock },
                  { id: 'attention', label: 'Needs Attention', count: actionQueueSummary?.attentionCount ?? 0, icon: Sparkles },
                  { id: 'upcoming', label: 'Property Tours', count: actionQueueSummary?.upcomingCount ?? 0, icon: Building2 },
                  { id: 'completed', label: 'Completed', count: actionQueueSummary?.completedCount ?? 0, icon: CheckCircle2 },
                ] as const
              ).map((b) => {
                const active = queueBucket === b.id;
                const Icon = b.icon;
                const isOverdueAlert = b.id === 'overdue' && b.count > 0;

                return (
                  <button
                    key={b.id}
                    onClick={() => setQueueBucket(b.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? b.id === 'overdue'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                          : b.id === 'attention'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                          : 'bg-[#C9A961]/20 text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                        : isOverdueAlert
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:border-rose-500/40'
                        : 'bg-[#181820] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{b.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        active
                          ? 'bg-white/10 text-white font-bold'
                          : isOverdueAlert
                          ? 'bg-rose-500/20 text-rose-300 font-bold'
                          : 'bg-white/5 text-[#9A9AA5]'
                      }`}
                    >
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Action Search & Refresh */}
            <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
              <div className="relative flex-1 md:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9A9AA5]" />
                <input
                  type="text"
                  placeholder="Filter actions by lead, property..."
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#181820] pl-8.5 pr-3 py-1.5 text-xs text-[#F5F5F7] placeholder:text-[#6E6E7A] focus:border-[#C9A961] focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-[#9A9AA5] font-mono hidden xl:inline">
                  {actionQueueData?.timezone || 'UTC'}
                </span>
                <button
                  onClick={() => fetchActionQueue(queueBucket)}
                  disabled={loadingQueue}
                  className="p-1.5 rounded-xl border border-white/[0.08] bg-[#181820] text-[#9A9AA5] hover:text-[#C9A961] hover:border-[#C9A961]/40 transition-colors cursor-pointer"
                  title="Refresh Action Queue"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingQueue ? 'animate-spin text-[#C9A961]' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Action Queue Items Stream */}
          {loadingQueue && !actionQueueData ? (
            <div className="luxury-card flex justify-center py-20 bg-[#141418] border border-white/[0.08] rounded-2xl shadow-sm">
              <div className="text-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#C9A961] mx-auto" />
                <p className="text-xs text-[#9A9AA5] mt-2">Syncing agentic action queue...</p>
              </div>
            </div>
          ) : queueError ? (
            <div className="banner-error flex items-center justify-between p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl">
              <div className="flex items-center gap-2 text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{queueError}</span>
              </div>
              <button
                onClick={() => fetchActionQueue(queueBucket)}
                className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : !actionQueueData || actionQueueData.items.length === 0 ? (
            <div className="empty-state p-14 text-center bg-[#141418] rounded-2xl border border-white/[0.08] shadow-sm">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Action Queue is Clear</h3>
              <p className="text-xs text-[#9A9AA5] mt-1.5 max-w-md mx-auto">
                {queueBucket === 'overdue'
                  ? 'All tasks and appointments are up to date! Zero overdue items.'
                  : queueBucket === 'today'
                  ? 'No follow-up tasks or appointments scheduled for today.'
                  : queueBucket === 'attention'
                  ? 'No stalled or uncontacted leads requiring intervention.'
                  : 'Your action queue is completely resolved. You can schedule new site visits or tasks directly from any lead profile.'}
              </p>
            </div>
          ) : (
            (() => {
              const items = actionQueueData.items.filter((item) => {
                if (!actionSearch.trim()) return true;
                const q = actionSearch.toLowerCase();
                return (
                  item.title.toLowerCase().includes(q) ||
                  item.lead.fullName.toLowerCase().includes(q) ||
                  item.property?.title.toLowerCase().includes(q) ||
                  item.property?.address.toLowerCase().includes(q) ||
                  item.lead.email?.toLowerCase().includes(q) ||
                  item.lead.phone?.includes(q)
                );
              });

              if (items.length === 0) {
                return (
                  <div className="empty-state p-12 text-center bg-[#141418] rounded-2xl border border-white/[0.08]">
                    <Search className="h-8 w-8 text-[#9A9AA5] mx-auto mb-2 opacity-50" />
                    <h3 className="text-sm font-bold text-white">No items match your search</h3>
                    <p className="text-xs text-[#9A9AA5] mt-1">Try clearing or adjusting your search keyword.</p>
                  </div>
                );
              }

              const isSingleItem = items.length === 1;

              return (
                <div className={isSingleItem ? 'grid grid-cols-1 lg:grid-cols-12 gap-5' : 'grid grid-cols-1 lg:grid-cols-2 gap-4'}>
                  <div className={isSingleItem ? 'lg:col-span-8' : 'contents'}>
                    {items.map((item) => {
                      const isOverdue = item.bucket === 'overdue';
                      const isToday = item.bucket === 'today';
                      const isAttention = item.actionType === 'ATTENTION_LEAD';
                      const isVisit = item.actionType === 'SITE_VISIT';
                      const isTask = item.actionType === 'TASK';

                      const initials = item.lead.fullName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl p-5 flex flex-col justify-between transition-all border shadow-sm ${
                            isOverdue
                              ? 'border-rose-500/30 bg-[#161214] border-l-4 border-l-rose-500 hover:border-rose-500/50 hover:shadow-rose-950/20'
                              : isAttention
                              ? 'border-amber-500/30 bg-[#171410] border-l-4 border-l-amber-500 hover:border-amber-500/50'
                              : isToday
                              ? 'border-cyan-500/30 bg-[#101518] border-l-4 border-l-cyan-500 hover:border-cyan-500/50'
                              : 'border-white/[0.08] bg-[#141418] border-l-4 border-l-[#C9A961] hover:border-white/20'
                          }`}
                        >
                          <div className="space-y-3.5">
                            {/* Card Top: Avatar, Name, Contact Chips & Badges */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#C9A961]/25 to-[#C9A961]/5 border border-[#C9A961]/30 text-[#C9A961] font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                  {initials}
                                </div>
                                <div>
                                  <button
                                    onClick={() => navigate(`/leads/${item.lead.id}`)}
                                    className="text-left font-bold text-sm text-white hover:text-[#C9A961] transition-colors flex items-center gap-1 group cursor-pointer"
                                  >
                                    <span className="truncate max-w-[200px] sm:max-w-none">{item.lead.fullName}</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-[#9A9AA5] group-hover:text-[#C9A961] group-hover:translate-x-0.5 transition-transform" />
                                  </button>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#9A9AA5] flex-wrap">
                                    {item.lead.phone && (
                                      <a
                                        href={`tel:${item.lead.phone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="hover:text-white flex items-center gap-1 font-mono text-[10px]"
                                      >
                                        <Phone className="h-2.5 w-2.5 text-[#C9A961]" />
                                        <span>{item.lead.phone}</span>
                                      </a>
                                    )}
                                    {item.lead.email && (
                                      <a
                                        href={`mailto:${item.lead.email}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="hover:text-white flex items-center gap-1 truncate max-w-[190px] text-[10px]"
                                      >
                                        <Mail className="h-2.5 w-2.5 text-[#9A9AA5]" />
                                        <span className="truncate">{item.lead.email}</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {isVisit ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                    <Building2 className="h-3 w-3" /> Property Tour
                                  </span>
                                ) : isTask ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                                    <CheckSquare className="h-3 w-3" /> Follow-Up
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
                                    <Sparkles className="h-3 w-3" /> Needs Touch
                                  </span>
                                )}

                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                    priorityColors[item.priority] || 'bg-white/5 text-[#9A9AA5] border-white/10'
                                  }`}
                                >
                                  {item.priority}
                                </span>
                              </div>
                            </div>

                            {/* Title & Description */}
                            <div>
                              <h4 className="text-xs font-bold text-[#F5F5F7] leading-snug">
                                {item.title}
                              </h4>
                              {item.description && (
                                <p className="text-[11px] text-[#9A9AA5] mt-1 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            {/* Attention Reason Banner */}
                            {item.attentionReason && (
                              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                                <span>{item.attentionReason}</span>
                              </div>
                            )}

                            {/* Luxury Property Details Card */}
                            {item.property && (
                              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#181820]/80 border border-white/[0.06] backdrop-blur-xs">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="h-8 w-8 rounded-lg bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/25 flex items-center justify-center shrink-0">
                                    <Building2 className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate">{item.property.title}</p>
                                    <p className="text-[11px] text-[#9A9AA5] truncate">{item.property.address}, {item.property.city}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs font-mono font-bold text-[#C9A961]">${item.property.price.toLocaleString()}</span>
                                  <span className="block text-[10px] text-emerald-400 font-medium">MLS Verified</span>
                                </div>
                              </div>
                            )}

                            {/* Due Date & Assignee metadata */}
                            <div className="flex items-center justify-between text-[11px] text-[#9A9AA5] pt-2 border-t border-white/[0.08]">
                              <span className="flex items-center gap-1.5">
                                <CalendarClock className="h-3.5 w-3.5 text-[#9A9AA5]" />
                                {isOverdue ? (
                                  <span className="text-rose-400 font-bold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
                                    Overdue ({new Date(item.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                                  </span>
                                ) : isToday ? (
                                  <span className="text-cyan-400 font-bold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                                    Due Today ({new Date(item.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                  </span>
                                ) : (
                                  <span>Due: {new Date(item.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                              </span>
                              <span className="text-[11px] text-[#9A9AA5] font-medium">
                                Advisor: <span className="text-[#F5F5F7] font-semibold">{item.assignedUser?.name || 'Assigned'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Context-Appropriate Action Buttons */}
                          <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-white/[0.08]">
                            <button
                              onClick={() => navigate(`/leads/${item.lead.id}`)}
                              className="btn-stripe-secondary text-xs px-3.5 py-1.5 cursor-pointer flex items-center gap-1"
                            >
                              Lead Cockpit &rarr;
                            </button>

                            <div className="flex items-center gap-2">
                              {item.leadTaskId && item.bucket !== 'completed' && (
                                <button
                                  onClick={() => handleCompleteQueueTask(item.leadTaskId!)}
                                  disabled={completingTaskId === item.leadTaskId}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm shadow-emerald-900/30"
                                >
                                  {completingTaskId === item.leadTaskId ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  Complete Task
                                </button>
                              )}
                              {item.siteVisitId && (
                                <button
                                  onClick={() => navigate(`/leads/${item.lead.id}`)}
                                  className="btn-stripe-primary text-xs px-4 py-1.5 cursor-pointer flex items-center gap-1.5 shadow-sm"
                                >
                                  <Building2 className="h-3.5 w-3.5" />
                                  Manage Tour
                                </button>
                              )}
                              {!item.leadTaskId && !item.siteVisitId && (
                                <button
                                  onClick={() => navigate(`/leads/${item.lead.id}`)}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#C9A961] hover:bg-[#D4B872] text-[#0A0A0B] font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <PhoneCall className="h-3.5 w-3.5" /> Outreach
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Single-Item Companion Fast-Action Panel */}
                  {isSingleItem && (
                    <div className="lg:col-span-4 space-y-4">
                      <div className="luxury-card p-5 bg-[#141418] border border-white/[0.08] rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#C9A961] flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" /> Fast-Action Hub
                          </h3>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">
                            1 Priority Action
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <p className="text-[#9A9AA5] leading-relaxed">
                            Prompt resolution on pending tours increases buyer conversion by <span className="text-white font-bold">3.2x</span>.
                          </p>

                          <div className="space-y-2 pt-1">
                            <div className="p-3 rounded-xl bg-[#181820] border border-white/[0.06] space-y-1.5">
                              <span className="text-[10px] font-mono font-bold text-[#9A9AA5] uppercase">Showing Checklist</span>
                              <div className="space-y-1 text-[11px] text-[#F5F5F7]">
                                <div className="flex items-center gap-1.5">
                                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                                  <span>MLS Listing verified available</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                                  <span>Buyer attendance confirmation required</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <FileSpreadsheet className="h-3 w-3 text-cyan-400 shrink-0" />
                                  <span>CMA Valuation ready for presentation</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 flex flex-col gap-2">
                            <button
                              onClick={() => navigate('/properties')}
                              className="btn-stripe-secondary text-xs w-full justify-center py-2 cursor-pointer flex items-center gap-1.5"
                            >
                              <Building2 className="h-3.5 w-3.5 text-[#C9A961]" />
                              Inspect Property in MLS
                            </button>
                            <button
                              onClick={() => navigate(`/leads/${items[0].lead.id}`)}
                              className="btn-stripe-primary text-xs w-full justify-center py-2 cursor-pointer flex items-center gap-1.5 shadow-sm"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                              Open Buyer Cockpit
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      ) : poolTab === 'TASKS' ? (
        loadingTasks ? (
          <div className="flex justify-center py-16 bg-[#141418] border border-white/[0.08] rounded-2xl">
            <Loader2 className="h-7 w-7 animate-spin text-[#C9A961]" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center bg-[#141418] rounded-2xl border border-white/[0.08]">
            <ListTodo className="h-8 w-8 text-[#C9A961] mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white font-serif">No {taskFilter} tasks</h3>
            <p className="text-xs text-[#9A9AA5] mt-1 max-w-sm mx-auto">
              {taskFilter === 'overdue'
                ? 'Great job! You have no overdue follow-up tasks.'
                : taskFilter === 'upcoming'
                ? 'No upcoming tasks scheduled. Visit any lead profile to schedule a follow-up.'
                : 'No tasks found for this view.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => {
              const typeBadge = getTaskTypeBadge(task.taskType);
              const Icon = typeBadge.icon;
              const isOverdue = task.status === 'OPEN' && (task.isOverdue || new Date(task.dueDate).getTime() < Date.now());

              return (
                <div
                  key={task.id}
                  className={`rounded-2xl p-4.5 flex flex-col justify-between transition-all border shadow-sm ${
                    isOverdue
                      ? 'border-rose-500/30 bg-[#161214] hover:border-rose-500/50'
                      : task.status === 'COMPLETED'
                      ? 'border-emerald-500/30 bg-[#101713] hover:border-emerald-500/50'
                      : task.status === 'CANCELLED'
                      ? 'border-white/[0.05] bg-[#141418] opacity-50'
                      : 'border-white/[0.08] bg-[#141418] hover:border-white/20'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => navigate(`/leads/${task.leadId}`)}
                        className="text-left font-bold text-sm text-white hover:text-[#C9A961] flex items-center gap-1 group cursor-pointer transition-colors"
                      >
                        <span className="truncate max-w-[160px]">{task.lead?.fullName || 'Lead'}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#9A9AA5] group-hover:text-[#C9A961]" />
                      </button>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${typeBadge.bg}`}>
                          <Icon className="h-3 w-3" />
                          {typeBadge.label}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${priorityColors[task.priority] || 'bg-white/5 text-[#9A9AA5] border-white/10'}`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className={`text-xs font-bold ${task.status === 'COMPLETED' ? 'text-[#9A9AA5] line-through' : 'text-[#F5F5F7]'}`}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-[11px] text-[#9A9AA5] mt-1 line-clamp-2">{task.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </span>
                      )}
                      {task.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      )}
                      {task.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-white/5 text-[#9A9AA5] border border-white/10">
                          <XCircle className="h-3 w-3" /> Cancelled
                        </span>
                      )}
                      {task.callLogId && (
                        <span className="px-1.5 py-0.5 rounded bg-[#C9A961]/10 text-[#C9A961] border border-[#C9A961]/25 font-mono text-[10px]">
                          From Call Log
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#9A9AA5]">
                    <span className="flex items-center gap-1 text-[10px]">
                      <CalendarClock className="h-3.5 w-3.5 text-[#9A9AA5]" />
                      {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {task.status === 'OPEN' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={completingTaskId === task.id}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                          title="Mark complete"
                        >
                          {completingTaskId === task.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Complete
                        </button>
                        <button
                          onClick={() => handleCancelTask(task.id)}
                          disabled={cancellingTaskId === task.id}
                          className="p-1 rounded-lg text-[#9A9AA5] hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Cancel task"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {task.status === 'COMPLETED' && task.completedAt && (
                      <span className="text-[10px] text-emerald-400 font-medium font-mono">
                        Done {new Date(task.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : poolTab === 'SITE_VISITS' ? (
        loadingVisits ? (
          <div className="flex justify-center py-16 bg-[#141418] border border-white/[0.08] rounded-2xl">
            <Loader2 className="h-7 w-7 animate-spin text-[#C9A961]" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filter pills for visits */}
            <div className="flex items-center gap-1.5 text-xs">
              {[
                { id: '', label: 'All Statuses' },
                { id: 'SCHEDULED', label: 'Scheduled' },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'CANCELLED', label: 'Cancelled' },
                { id: 'NO_SHOW', label: 'No-Show' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setVisitFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    visitFilter === f.id
                      ? 'bg-[#C9A961]/20 text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                      : 'bg-[#181820] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {siteVisits.length === 0 ? (
              <div className="p-12 text-center bg-[#141418] rounded-2xl border border-white/[0.08]">
                <Building2 className="h-8 w-8 text-[#C9A961] mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white font-serif">No site visits found</h3>
                <p className="text-xs text-[#9A9AA5] mt-1 max-w-sm mx-auto">
                  {visitFilter === 'SCHEDULED'
                    ? 'No upcoming scheduled property showings.'
                    : 'No property site visits found for this filter.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {siteVisits.map((visit) => {
                  const startDate = new Date(visit.startAt);
                  const endDate = new Date(visit.endAt);

                  return (
                    <div
                      key={visit.id}
                      className="rounded-2xl p-4.5 flex flex-col justify-between transition-all border border-white/[0.08] bg-[#141418] hover:border-white/20 shadow-sm"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => navigate(`/leads/${visit.leadId}`)}
                            className="font-bold text-white text-sm hover:text-[#C9A961] transition-colors text-left cursor-pointer flex items-center gap-1 group"
                          >
                            <span>{visit.lead?.fullName || 'Lead Profile'}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-[#9A9AA5] group-hover:text-[#C9A961]" />
                          </button>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              visit.status === 'SCHEDULED'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                                : visit.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                                : visit.status === 'NO_SHOW'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                                : 'bg-white/5 text-[#9A9AA5] border-white/10'
                            }`}
                          >
                            {visit.status === 'NO_SHOW' ? 'No-Show' : visit.status}
                          </span>
                        </div>

                        {visit.property && (
                          <div className="p-2.5 rounded-xl bg-[#1A1A22] border border-white/[0.08] text-xs text-white">
                            <p className="font-bold flex items-center gap-1.5 text-[11px] text-[#F5F5F7]">
                              <Building2 className="h-3.5 w-3.5 text-[#C9A961] shrink-0" />
                              {visit.property.title}
                            </p>
                            <p className="text-[10px] text-[#9A9AA5] mt-1 font-mono">
                              {visit.property.address}, {visit.property.city} • ${visit.property.price.toLocaleString()}
                            </p>
                          </div>
                        )}

                        <div className="text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 font-semibold text-[#F5F5F7] text-[11px]">
                            <Clock className="h-3.5 w-3.5 text-[#C9A961] shrink-0" />
                            {startDate.toLocaleDateString([], {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            • {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                            {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>

                          {visit.meetingLocation && (
                            <p className="text-[11px] text-[#9A9AA5] flex items-center gap-1">
                              <span className="font-semibold text-white">Location:</span> {visit.meetingLocation}
                            </p>
                          )}

                          {visit.notes && (
                            <p className="text-[11px] text-[#9A9AA5] italic bg-[#1A1A22] p-2 rounded-xl border border-white/[0.06]">
                              "{visit.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-[#9A9AA5]">
                        <span className="text-[10px] truncate max-w-[140px]">Advisor: {visit.assignedUser?.name || visit.assignedUser?.email || 'Assigned'}</span>
                        <button
                          onClick={() => navigate(`/leads/${visit.leadId}`)}
                          className="font-bold text-[#C9A961] hover:underline text-[11px] cursor-pointer flex items-center gap-1"
                        >
                          Manage Visit &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      ) : loading ? (
        <div className="flex justify-center py-16 bg-[#141418] border border-white/[0.08] rounded-2xl">
          <Loader2 className="h-7 w-7 animate-spin text-[#C9A961]" />
        </div>
      ) : error ? (
        <div className="banner-error">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="p-12 text-center bg-[#141418] rounded-2xl border border-white/[0.08]">
          <Sparkles className="h-8 w-8 text-[#C9A961] mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white font-serif">No leads in queue</h3>
          <p className="text-xs text-[#9A9AA5] mt-1 max-w-sm mx-auto">
            {poolTab === 'MY'
              ? 'You do not have any claimed active leads yet. Browse the Unassigned Pool to claim new leads.'
              : poolTab === 'UNASSIGNED'
              ? 'There are currently no unassigned leads in the pool.'
              : 'Get started by adding your first inbound lead or importing contacts via CSV.'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-stripe-primary mt-4 text-xs mx-auto"
          >
            <Plus className="h-3.5 w-3.5" /> Add First Lead
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => {
            const req = lead.requirements;
            const initials = lead.fullName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);
            const isUnassigned = !lead.assignedUserId;
            const isClaimable = isUnassigned && !['WON', 'LOST'].includes(lead.status);

            return (
              <div
                key={lead.id}
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="rounded-2xl p-5 flex flex-col justify-between cursor-pointer border border-white/[0.08] bg-[#141418] hover:border-[#C9A961]/40 transition-all shadow-sm group hover:shadow-lg hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#C9A961]/25 to-[#C9A961]/5 text-[#C9A961] font-bold text-xs border border-[#C9A961]/30 shadow-xs flex shrink-0">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-[#C9A961] transition-colors">
                          {lead.fullName}
                        </h3>
                        <span className={`inline-block px-2 py-0.2 text-[10px] font-extrabold rounded-full border mt-0.5 ${statusColors[lead.status]}`}>
                          {lead.status}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${priorityColors[lead.priority]}`}>
                      {lead.priority}
                    </span>
                  </div>

                  {/* ── Ownership & Inactivity Badges ── */}
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <div className="flex items-center gap-1.5">
                      {lead.assignedUser ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            lead.assignedUser.id === user?.id
                              ? 'bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30'
                              : 'bg-white/5 text-[#9A9AA5] border border-white/10'
                          }`}
                          title={`Assigned to ${lead.assignedUser.name || lead.assignedUser.email}`}
                        >
                          <UserCheck className="h-3 w-3" />
                          {lead.assignedUser.id === user?.id ? 'My Lead' : (lead.assignedUser.name || lead.assignedUser.email)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 border-dashed">
                          <Inbox className="h-3 w-3" />
                          Unassigned Pool
                        </span>
                      )}
                    </div>

                    {lead.isInactiveWarning && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        title={`Lead inactive for ${lead.daysSinceLastActivity} days`}
                      >
                        <Clock className="h-3 w-3 text-amber-400" />
                        {lead.daysSinceLastActivity}d Inactive
                      </span>
                    )}
                  </div>

                  {/* Contact Chips */}
                  <div className="flex flex-col gap-1 text-[11px] text-[#9A9AA5] mb-3 px-1">
                    {lead.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3 w-3 text-[#9A9AA5] shrink-0" />
                        <span className="truncate text-[#F5F5F7]">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-[#C9A961] shrink-0" />
                        <span className="text-[#F5F5F7] font-mono">{lead.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* ── Requirement Summary Card ── */}
                  <div className="rounded-xl bg-[#181820]/90 p-3 border border-white/[0.06] space-y-2 text-xs">
                    <div className="flex items-center justify-between font-semibold text-[11px]">
                      <span className="flex items-center gap-1 text-[#9A9AA5]">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                        Max Budget
                      </span>
                      <span className="text-[#C9A961] font-bold font-mono">
                        {req?.maxBudget ? `$${req.maxBudget.toLocaleString()}` : 'Flexible'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-[#9A9AA5]">
                        <Building2 className="h-3.5 w-3.5 text-cyan-400" />
                        Preference
                      </span>
                      <span className="text-[#F5F5F7]">
                        {req?.propertyType || 'Any'} • {req?.minBedrooms ? `${req.minBedrooms}+ Beds` : 'Any'}
                      </span>
                    </div>

                    {req?.preferredLocations && req.preferredLocations.length > 0 && (
                      <p className="text-[10px] text-[#9A9AA5] truncate pt-1.5 border-t border-white/[0.06]">
                        📍 {req.preferredLocations.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#9A9AA5]">
                  <span className="text-[10px] font-mono">Source: {lead.source}</span>
                  <div className="flex items-center gap-2">
                    {isClaimable && (
                      <button
                        onClick={(e) => handleClaimLead(e, lead.id)}
                        disabled={claimingLeadId === lead.id}
                        className="btn-stripe-primary text-[11px] py-1 px-3 flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        {claimingLeadId === lead.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        Claim
                      </button>
                    )}
                    <span className="text-[#C9A961] font-bold text-[11px] flex items-center gap-1 group-hover:underline">
                      Cockpit <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Lead Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141418] p-6 border border-white/[0.12] shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-serif">
                <Sparkles className="h-4 w-4 text-[#C9A961]" />
                Add Inbound Lead &amp; Auto-Extract
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#9A9AA5] hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#9A9AA5] mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="input-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#9A9AA5] mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="sarah@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9A9AA5] mb-1.5">Phone</label>
                  <input
                    type="text"
                    placeholder="(555) 019-2831"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="input-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#9A9AA5] mb-1.5">
                  Customer Message / Enquiry Notes (Gemini AI Auto-Extract)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Looking for a 3 bedroom condo in Downtown under $650k..."
                  value={newEnquiryText}
                  onChange={(e) => setNewEnquiryText(e.target.value)}
                  className="input-base resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-stripe-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-stripe-primary text-xs"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save &amp; Auto-Extract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CSV Import Modal ── */}
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        type="leads"
        onImportSuccess={fetchLeads}
      />
    </div>
  );
}
