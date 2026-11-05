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
  Phone,
  Mail,
  Building2,
  DollarSign,
  IndianRupee,
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
import { formatPrice, formatPriceFull, formatIndianPrice, formatIndianPriceFull } from '@/utils/currency';
import { useToast } from '@/context/ToastContext';

export function LeadsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
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
        return { label: 'Call', icon: PhoneCall, bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'MESSAGE':
        return { label: 'Message', icon: MessageSquare, bg: 'bg-zinc-100 text-zinc-800 border-zinc-200' };
      case 'SITE_VISIT':
        return { label: 'Site Visit', icon: Building2, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'SEND_DETAILS':
        return { label: 'Send Details', icon: Send, bg: 'bg-zinc-100 text-zinc-800 border-zinc-200' };
      case 'DOCUMENT_FOLLOW_UP':
        return { label: 'Doc Follow-Up', icon: FileCheck, bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'OTHER':
      default:
        return { label: 'Other', icon: CheckSquare, bg: 'bg-slate-100 text-slate-600 border-slate-200' };
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
      toast.success('Lead created successfully');
      navigate(`/leads/${lead.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  }

  const priorityColors: Record<string, string> = {
    URGENT: 'bg-rose-50 text-rose-700 border-rose-200',
    HIGH: 'bg-amber-50 text-amber-800 border-amber-200',
    MEDIUM: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    LOW: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const statusColors: Record<string, string> = {
    NEW: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    CONTACTED: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    QUALIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    SITE_VISIT_SCHEDULED: 'bg-teal-50 text-teal-700 border-teal-200',
    PROPOSAL: 'bg-amber-50 text-amber-800 border-amber-200',
    WON: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    LOST: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const totalLeadsCount = pipelineStats.total || leads.length;
  const urgentCount = pipelineStats.urgentCount || leads.filter((l) => l.priority === 'URGENT' || l.priority === 'HIGH').length;
  const newLeadsCount = pipelineStats.newCount || leads.filter((l) => l.status === 'NEW').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Lead Pipeline
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              {totalLeadsCount} Active Inbound Leads
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time buyer qualification, tour scheduling, and autonomous voice follow-up.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCsvModal(true)}
            className="btn-stripe-secondary text-xs px-3.5 py-2 cursor-pointer flex items-center gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs rounded-xl transition-all"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs px-3.5 py-2 cursor-pointer flex items-center gap-1.5 shadow-xs bg-[#0A0A0A] hover:bg-slate-800 text-white font-semibold rounded-xl transition-all"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-400" />
            <span>Add Inbound Lead</span>
          </button>
        </div>
      </div>

      {/* ── Unified Metric Ribbon (Always Live Data) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Active Pipeline */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[136px] shadow-xs group">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Buyer Pipeline</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 border border-slate-200 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">{totalLeadsCount}</div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Live Pipeline Sync</span>
            </div>
          </div>
        </div>

        {/* New Inbound Queue */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[136px] shadow-xs group">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">New Inbound Queue</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:scale-105 transition-transform shadow-2xs shrink-0">
              <Inbox className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 font-mono tracking-tight">{newLeadsCount}</div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              Awaiting First Contact
            </div>
          </div>
        </div>

        {/* Action Queue Alerts & Deadlines */}
        <div
          onClick={() => setPoolTab('ACTION_QUEUE')}
          className={`rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between min-h-[136px] border shadow-xs group ${
            (actionQueueSummary?.overdueCount ?? 0) > 0
              ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300 ring-1 ring-rose-200/50'
              : 'bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-md'
          }`}
          title="Click to view Action Queue"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Action Queue Alerts</span>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border group-hover:scale-105 transition-transform shadow-2xs shrink-0 ${
              (actionQueueSummary?.overdueCount ?? 0) > 0
                ? 'bg-rose-100 text-rose-600 border-rose-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono tracking-tight flex items-center gap-2">
              <span className={(actionQueueSummary?.overdueCount ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'}>
                {actionQueueSummary?.totalActive ?? 0}
              </span>
              {(actionQueueSummary?.overdueCount ?? 0) > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                  {actionQueueSummary?.overdueCount} Overdue
                </span>
              )}
            </div>
            <div className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1.5 ${
              (actionQueueSummary?.overdueCount ?? 0) > 0 ? 'text-rose-600' : 'text-slate-500'
            }`}>
              {(actionQueueSummary?.overdueCount ?? 0) > 0 ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Requires immediate action</span>
                </>
              ) : (
                <span>All tasks &amp; tours on schedule</span>
              )}
            </div>
          </div>
        </div>

        {/* Autonomous AI Advisor */}
        <div className="rounded-2xl p-5 bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between min-h-[136px] shadow-xs group">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Autonomous AI Copilot</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0A0A] text-white shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <Bot className="h-5 w-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              24/7 Active
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              Duplex Voice &amp; WhatsApp AI
            </div>
          </div>
        </div>
      </div>

      {/* ── Pool Tabs & Search Controls ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
          <button
            onClick={() => setPoolTab('ACTION_QUEUE')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'ACTION_QUEUE'
                ? 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Action Queue
            {actionQueueSummary && actionQueueSummary.totalActive > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  actionQueueSummary.overdueCount > 0
                    ? 'bg-rose-500 text-white animate-pulse'
                    : poolTab === 'ACTION_QUEUE'
                    ? 'bg-slate-700 text-white'
                    : 'bg-emerald-100 text-emerald-800'
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
                ? 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            All Leads
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${poolTab === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {pipelineStats.total || leads.length}
            </span>
          </button>

          <button
            onClick={() => setPoolTab('MY')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'MY'
                ? 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            My Leads
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${poolTab === 'MY' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {pipelineStats.myCount}
            </span>
          </button>

          <button
            onClick={() => setPoolTab('UNASSIGNED')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'UNASSIGNED'
                ? 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>Unassigned Pool</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${poolTab === 'UNASSIGNED' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {pipelineStats.unassignedCount}
            </span>
          </button>

          <button
            onClick={() => setPoolTab('TASKS')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'TASKS'
                ? 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ListTodo className="h-3.5 w-3.5" />
            Follow-Up Tasks
            {taskCounts.overdue > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                {taskCounts.overdue} overdue
              </span>
            ) : taskCounts.upcoming > 0 ? (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${poolTab === 'TASKS' ? 'bg-slate-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                {taskCounts.upcoming}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setPoolTab('SITE_VISITS')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              poolTab === 'SITE_VISITS'
                ? 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Property Tours
            {scheduledVisitsCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${poolTab === 'SITE_VISITS' ? 'bg-slate-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
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
          <div className="p-3 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
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
                          ? 'bg-rose-50 text-rose-700 border border-rose-300 shadow-xs'
                          : 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {filter === 'upcoming' && <CalendarClock className="h-3.5 w-3.5" />}
                    {filter === 'overdue' && <AlertTriangle className="h-3.5 w-3.5" />}
                    {filter === 'completed' && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {filter === 'all' && <ListTodo className="h-3.5 w-3.5" />}
                    <span className="capitalize">{filter}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? (filter === 'overdue' ? 'bg-rose-100 text-rose-800' : 'bg-slate-800 text-white') : 'bg-slate-200/70 text-slate-700'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-slate-500 font-mono">
              {user?.role === 'OWNER' ? 'Organization follow-up queue' : 'Your assigned follow-ups'}
            </span>
          </div>
        ) : poolTab === 'SITE_VISITS' ? (
          <div className="p-3 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: '', label: 'All Tours' },
                { id: 'SCHEDULED', label: 'Scheduled', count: scheduledVisitsCount },
                { id: 'COMPLETED', label: 'Completed' },
                { id: 'CANCELLED', label: 'Cancelled' },
                { id: 'NO_SHOW', label: 'No-Show' },
              ].map((f) => {
                const isActive = visitFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setVisitFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{f.label}</span>
                    {f.count !== undefined && f.count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-slate-800 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                        {f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <span className="text-xs text-slate-500 font-mono">
              In-person property walkthroughs &amp; buyer showings
            </span>
          </div>
        ) : poolTab === 'ACTION_QUEUE' ? null : (
          <div className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
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
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none"
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
      <div key={poolTab} className="smooth-transition min-h-[480px]">
        {poolTab === 'ACTION_QUEUE' ? (
          <div className="space-y-4">
          {/* Action Command Toolbar: Category Pills + Live Search */}
          <div className="p-3 px-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            {/* Category Filter Pills (Single scrollable row, never wraps awkwardly) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 shrink min-w-0">
              {(
                [
                  { id: 'all', label: 'All Action Items', count: actionQueueSummary?.totalActive ?? 0, icon: Zap },
                  { id: 'overdue', label: 'Overdue', count: actionQueueSummary?.overdueCount ?? 0, icon: AlertTriangle, isAlert: true },
                  { id: 'today', label: 'Due Today', count: actionQueueSummary?.dueTodayCount ?? 0, icon: Clock },
                  { id: 'attention', label: 'Needs Attention', count: actionQueueSummary?.attentionCount ?? 0, icon: AlertCircle },
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
                    className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs ${
                      active
                        ? b.id === 'overdue'
                          ? 'bg-rose-50 text-rose-700 border border-rose-300 shadow-xs'
                          : b.id === 'attention'
                          ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-xs'
                          : 'bg-slate-900 text-white border border-slate-900 shadow-xs'
                        : isOverdueAlert
                        ? 'bg-rose-50/70 text-rose-700 border border-rose-200 hover:border-rose-300'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{b.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono leading-none ${
                        active
                          ? 'bg-white text-slate-900 font-bold shadow-2xs'
                          : isOverdueAlert
                          ? 'bg-rose-200 text-rose-800 font-bold'
                          : 'bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Action Search, Timezone Badge & Refresh Button */}
            <div className="flex items-center gap-2.5 w-full xl:w-auto justify-between xl:justify-end shrink-0">
              <div className="relative flex-1 xl:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter actions by lead, property..."
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="h-9 px-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-mono text-slate-500 font-semibold flex items-center justify-center shrink-0">
                  {actionQueueData?.timezone || 'UTC'}
                </span>
                <button
                  onClick={() => fetchActionQueue(queueBucket)}
                  disabled={loadingQueue}
                  className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title="Refresh Action Queue"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingQueue ? 'animate-spin text-slate-900' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Action Queue Items Stream */}
          {loadingQueue && !actionQueueData ? (
            <div className="flex justify-center py-20 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
              <div className="text-center">
                <Loader2 className="h-7 w-7 animate-spin text-slate-900 mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Syncing agentic action queue...</p>
              </div>
            </div>
          ) : queueError ? (
            <div className="banner-error flex items-center justify-between p-4 bg-rose-50 border border-rose-200 rounded-2xl">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
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
            <div className="empty-state p-14 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Action Queue is Clear</h3>
              <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
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
                  <div className="empty-state p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
                    <Search className="h-8 w-8 text-slate-400 mx-auto mb-2 opacity-50" />
                    <h3 className="text-sm font-bold text-slate-900">No items match your search</h3>
                    <p className="text-xs text-slate-500 mt-1">Try clearing or adjusting your search keyword.</p>
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
                          className={`rounded-2xl p-5 flex flex-col justify-between transition-all border shadow-xs bg-white ${
                            isOverdue
                              ? 'border-slate-200 border-l-4 border-l-rose-500 hover:border-slate-300 hover:shadow-md'
                              : isAttention
                              ? 'border-slate-200 border-l-4 border-l-amber-500 hover:border-slate-300 hover:shadow-md'
                              : isToday
                              ? 'border-slate-200 border-l-4 border-l-emerald-600 hover:border-slate-300 hover:shadow-md'
                              : 'border-slate-200 border-l-4 border-l-slate-400 hover:border-slate-300 hover:shadow-md'
                          }`}
                        >
                          <div className="space-y-3.5">
                            {/* Card Top: Avatar, Name, Contact Chips & Badges */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                                  {initials}
                                </div>
                                <div>
                                  <button
                                    onClick={() => navigate(`/leads/${item.lead.id}`)}
                                    className="text-left font-bold text-sm text-slate-900 hover:text-emerald-700 transition-colors flex items-center gap-1 group cursor-pointer"
                                  >
                                    <span className="truncate max-w-[200px] sm:max-w-none">{item.lead.fullName}</span>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
                                  </button>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                                    {item.lead.phone && (
                                      <a
                                        href={`tel:${item.lead.phone}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="hover:text-slate-900 flex items-center gap-1 font-mono text-[10px]"
                                      >
                                        <Phone className="h-2.5 w-2.5 text-emerald-700" />
                                        <span>{item.lead.phone}</span>
                                      </a>
                                    )}
                                    {item.lead.email && (
                                      <a
                                        href={`mailto:${item.lead.email}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="hover:text-slate-900 flex items-center gap-1 truncate max-w-[190px] text-[10px]"
                                      >
                                        <Mail className="h-2.5 w-2.5 text-slate-400" />
                                        <span className="truncate">{item.lead.email}</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {isVisit ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Building2 className="h-3 w-3" /> Property Tour
                                  </span>
                                ) : isTask ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                                    <CheckSquare className="h-3 w-3" /> Follow-Up
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                    Needs Touch
                                  </span>
                                )}

                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                                    priorityColors[item.priority] || 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {item.priority}
                                </span>
                              </div>
                            </div>

                            {/* Title & Description */}
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 leading-snug">
                                {item.title}
                              </h4>
                              {item.description && (
                                <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>

                            {/* Attention Reason Banner */}
                            {item.attentionReason && (
                              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                <span>{item.attentionReason}</span>
                              </div>
                            )}

                            {/* Luxury Property Details Card */}
                            {item.property && (
                              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center shrink-0">
                                    <Building2 className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate">{item.property.title}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{item.property.address}, {item.property.city}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs font-mono font-bold text-emerald-700" title={formatIndianPriceFull(item.property.price)}>
                                    {formatIndianPrice(item.property.price)}
                                  </span>
                                  <span className="block text-[10px] text-emerald-600 font-medium">MLS Verified</span>
                                </div>
                              </div>
                            )}

                            {/* Due Date & Assignee metadata */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                              <span className="flex items-center gap-1.5">
                                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                                {isOverdue ? (
                                  <span className="text-rose-600 font-bold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse" />
                                    Overdue ({new Date(item.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                                  </span>
                                ) : isToday ? (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                    Due Today ({new Date(item.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                  </span>
                                ) : (
                                  <span>Due: {new Date(item.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                Advisor: <span className="text-slate-900 font-semibold">{item.assignedUser?.name || 'Assigned'}</span>
                              </span>
                            </div>
                          </div>

                          {/* Context-Appropriate Action Buttons */}
                          <div className="flex items-center justify-between gap-2 mt-4 pt-3.5 border-t border-slate-100">
                            <button
                              onClick={() => navigate(`/leads/${item.lead.id}`)}
                              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs px-3.5 py-1.5 cursor-pointer flex items-center gap-1 transition-colors"
                            >
                              Lead Cockpit &rarr;
                            </button>

                            <div className="flex items-center gap-2">
                              {item.leadTaskId && item.bucket !== 'completed' && (
                                <button
                                  onClick={() => handleCompleteQueueTask(item.leadTaskId!)}
                                  disabled={completingTaskId === item.leadTaskId}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
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
                                  className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs px-4 py-1.5 cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
                                >
                                  <Building2 className="h-3.5 w-3.5" />
                                  Manage Tour
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
                      <div className="p-5 bg-white border border-slate-200/90 rounded-2xl space-y-4 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5" /> Fast-Action Hub
                          </h3>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            1 Priority Action
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <p className="text-slate-600 leading-relaxed">
                            Prompt resolution on pending tours increases buyer conversion by <span className="text-slate-900 font-bold">3.2x</span>.
                          </p>

                          <div className="space-y-2 pt-1">
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">Showing Checklist</span>
                              <div className="space-y-1 text-[11px] text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                                  <span>MLS Listing verified available</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span>Buyer attendance confirmation required</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <FileSpreadsheet className="h-3 w-3 text-emerald-700 shrink-0" />
                                  <span>CMA Valuation ready for presentation</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 flex flex-col gap-2">
                            <button
                              onClick={() => navigate('/properties')}
                              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs w-full justify-center py-2 cursor-pointer flex items-center gap-1.5 transition-colors"
                            >
                              <Building2 className="h-3.5 w-3.5 text-slate-700" />
                              Inspect Property in MLS
                            </button>
                            <button
                              onClick={() => navigate(`/leads/${items[0].lead.id}`)}
                              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs w-full justify-center py-2 cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
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
          <div className="flex justify-center py-16 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <Loader2 className="h-7 w-7 animate-spin text-slate-900" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs">
            <ListTodo className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900">No {taskFilter} tasks</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
                  className={`rounded-2xl p-5 flex flex-col justify-between transition-all border shadow-xs ${
                    isOverdue
                      ? 'border-rose-200 bg-rose-50/40 hover:border-rose-300'
                      : task.status === 'COMPLETED'
                      ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300'
                      : task.status === 'CANCELLED'
                      ? 'border-slate-200 bg-slate-50/60 opacity-60'
                      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => navigate(`/leads/${task.leadId}`)}
                        className="text-left font-bold text-sm text-slate-900 hover:text-emerald-700 flex items-center gap-1 group cursor-pointer transition-colors"
                      >
                        <span className="truncate max-w-[160px]">{task.lead?.fullName || 'Lead'}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700" />
                      </button>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${typeBadge.bg}`}>
                          <Icon className="h-3 w-3" />
                          {typeBadge.label}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${priorityColors[task.priority] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className={`text-xs font-bold ${task.status === 'COMPLETED' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </span>
                      )}
                      {task.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </span>
                      )}
                      {task.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle className="h-3 w-3" /> Cancelled
                        </span>
                      )}
                      {task.callLogId && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono text-[10px]">
                          From Call Log
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 text-[10px]">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                      {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {task.status === 'OPEN' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={completingTaskId === task.id}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
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
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer"
                          title="Cancel task"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {task.status === 'COMPLETED' && task.completedAt && (
                      <span className="text-[10px] text-emerald-600 font-medium font-mono">
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
          <div className="flex justify-center py-16 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
            <Loader2 className="h-7 w-7 animate-spin text-slate-900" />
          </div>
        ) : (
          <div className="space-y-4">
            {siteVisits.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs">
                <Building2 className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-900">No property tours found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {visitFilter === 'SCHEDULED'
                    ? 'No upcoming scheduled property walkthroughs or showings.'
                    : 'No property tours found matching this filter.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {siteVisits.map((visit) => {
                  const startDate = new Date(visit.startAt);
                  const endDate = new Date(visit.endAt);

                  return (
                    <div
                      key={visit.id}
                      className="rounded-2xl p-5 flex flex-col justify-between transition-all border border-slate-200/90 bg-white hover:border-slate-300 shadow-xs hover:shadow-md"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => navigate(`/leads/${visit.leadId}`)}
                            className="font-bold text-slate-900 text-sm hover:text-emerald-700 transition-colors text-left cursor-pointer flex items-center gap-1 group"
                          >
                            <span>{visit.lead?.fullName || 'Lead Profile'}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-0.5" />
                          </button>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              visit.status === 'SCHEDULED'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : visit.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : visit.status === 'NO_SHOW'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {visit.status === 'NO_SHOW' ? 'No-Show' : visit.status}
                          </span>
                        </div>

                        {visit.property && (
                          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs text-slate-900">
                            <p className="font-bold flex items-center gap-1.5 text-xs text-slate-900">
                              <Building2 className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                              <span className="truncate">{visit.property.title}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 truncate">
                              {visit.property.address}, {visit.property.city}
                            </p>
                            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">List Price</span>
                              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                                {formatPriceFull(visit.property.price)}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="text-xs space-y-2">
                          <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                            <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span>
                              {startDate.toLocaleDateString([], {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              • {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                              {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {visit.meetingLocation && (
                            <p className="text-[11px] text-slate-600 flex items-start gap-1.5 pl-1">
                              <span className="font-semibold text-slate-800 shrink-0">Meeting:</span>
                              <span className="text-slate-600">{visit.meetingLocation}</span>
                            </p>
                          )}

                          {visit.notes && (
                            <p className="text-[11px] text-slate-600 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                              "{visit.notes}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 mt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="text-[11px] truncate max-w-[140px] text-slate-500">
                          Advisor: <span className="font-medium text-slate-700">{visit.assignedUser?.name || visit.assignedUser?.email?.split('@')[0] || 'Assigned'}</span>
                        </span>
                        <button
                          onClick={() => navigate(`/leads/${visit.leadId}`)}
                          className="font-bold text-slate-900 hover:text-emerald-700 text-xs cursor-pointer flex items-center gap-1 group/btn transition-colors"
                        >
                          <span>Manage Tour</span>
                          <span className="transition-transform group-hover/btn:translate-x-0.5">&rarr;</span>
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
        <div className="flex justify-center py-16 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <Loader2 className="h-7 w-7 animate-spin text-slate-900" />
        </div>
      ) : error ? (
        <div className="banner-error">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs">
          <Inbox className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-900">No leads in queue</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
                className="rounded-2xl p-5 flex flex-col justify-between cursor-pointer border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-xs group hover:shadow-md hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200 shadow-xs flex shrink-0">
                        {initials}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
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
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                          title={`Assigned to ${lead.assignedUser.name || lead.assignedUser.email}`}
                        >
                          <UserCheck className="h-3 w-3" />
                          {lead.assignedUser.id === user?.id ? 'My Lead' : (lead.assignedUser.name || lead.assignedUser.email)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 border-dashed">
                          <Inbox className="h-3 w-3" />
                          Unassigned Pool
                        </span>
                      )}
                    </div>

                    {lead.isInactiveWarning && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200"
                        title={`Lead inactive for ${lead.daysSinceLastActivity} days`}
                      >
                        <Clock className="h-3 w-3 text-amber-500" />
                        {lead.daysSinceLastActivity}d Inactive
                      </span>
                    )}
                  </div>

                  {/* Contact Chips */}
                  <div className="flex flex-col gap-1 text-[11px] text-slate-500 mb-3 px-1">
                    {lead.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-700">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-emerald-700 shrink-0" />
                        <span className="text-slate-800 font-mono">{lead.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* ── Requirement Summary Card ── */}
                  <div className="rounded-xl bg-slate-50/80 p-3 border border-slate-200/70 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-semibold text-[11px]">
                      <span className="flex items-center gap-1 text-slate-500">
                        <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                        Max Budget
                      </span>
                      <span className="text-slate-900 font-bold font-mono" title={req?.maxBudget ? formatIndianPriceFull(req.maxBudget) : undefined}>
                        {req?.maxBudget ? formatIndianPrice(req.maxBudget) : 'Flexible'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Building2 className="h-3.5 w-3.5 text-slate-700" />
                        Preference
                      </span>
                      <span className="text-slate-700">
                        {req?.propertyType || 'Any'} • {req?.minBedrooms ? `${req.minBedrooms}+ Beds` : 'Any'}
                      </span>
                    </div>

                    {req?.preferredLocations && req.preferredLocations.length > 0 && (
                      <p className="text-[10px] text-slate-500 truncate pt-1.5 border-t border-slate-200/60 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                        <span>{req.preferredLocations.join(', ')}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
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
                    <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1 group-hover:underline">
                      Cockpit <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* ── Add Lead Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 border border-slate-200 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-700" />
                Add Inbound Lead &amp; Auto-Extract
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name *</label>
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
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    placeholder="sarah@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone</label>
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
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
