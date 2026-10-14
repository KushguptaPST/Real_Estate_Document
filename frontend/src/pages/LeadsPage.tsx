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

  // New Lead Form State
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEnquiryText, setNewEnquiryText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (poolTab === 'ACTION_QUEUE') {
      fetchActionQueue();
    } else if (poolTab === 'TASKS') {
      fetchTasks();
    } else if (poolTab === 'SITE_VISITS') {
      fetchSiteVisits();
    } else {
      fetchLeads();
    }
    fetchTaskCounts();
    fetchScheduledVisitsCount();
    fetchQueueSummary();
  }, [search, statusFilter, priorityFilter, poolTab, taskFilter, visitFilter, queueBucket]);

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

  const totalLeadsCount = leads.length;
  const urgentCount = leads.filter((l) => l.priority === 'URGENT' || l.priority === 'HIGH').length;
  const newLeadsCount = leads.filter((l) => l.status === 'NEW').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Lead Operations &amp; Conversion Pipeline
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C9A961]/10 px-2.5 py-0.5 text-xs font-semibold text-[#C9A961] border border-[#C9A961]/25">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C9A961] animate-pulse" />
              Agentic Auto-Pilot Active
            </span>
          </div>
          <p className="text-xs text-[#9A9AA5] mt-0.5">
            Real-time buyer qualification, Telegram voice advisor, site visit bookings &amp; automated follow-ups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCsvModal(true)}
            className="btn-stripe-secondary text-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            Import CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-stripe-primary text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Inbound Lead
          </button>
        </div>
      </div>

      {/* ── Metric Cards Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="luxury-card p-4.5 bg-[#141418] border border-white/[0.08] rounded-2xl hover:border-[#C9A961]/40 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Total Active Leads</span>
              <div className="text-2xl font-bold text-white mt-1 font-mono">{totalLeadsCount}</div>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-1.5">
                <TrendingUp className="h-3 w-3" /> Live Pipeline
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#181820] text-[#C9A961] border border-[#C9A961]/25">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>

        <div className="luxury-card p-4.5 bg-[#141418] border border-white/[0.08] rounded-2xl hover:border-emerald-500/40 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">New Inbound Queue</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{newLeadsCount}</div>
              <span className="text-[11px] text-[#9A9AA5] mt-1.5 block">Awaiting Contact</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>

        <div className="luxury-card p-4.5 bg-[#141418] border border-white/[0.08] rounded-2xl hover:border-amber-500/40 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">High Priority Buyers</span>
              <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{urgentCount}</div>
              <span className="text-[11px] text-amber-400 font-semibold mt-1.5 block">Immediate Timeline</span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
              <Zap className="h-4.5 w-4.5" />
            </div>
          </div>
        </div>

        <div className="luxury-card p-4.5 bg-[#141418] border border-white/[0.08] rounded-2xl hover:border-cyan-500/40 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">AI Sales Advisor</span>
              <div className="text-2xl font-bold text-cyan-400 mt-1 font-mono">24/7 Active</div>
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
                  poolTab === 'ACTION_QUEUE' ? 'bg-[#C9A961]/20 text-[#C9A961]' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {actionQueueSummary.overdueCount > 0
                  ? `${actionQueueSummary.overdueCount} overdue`
                  : actionQueueSummary.dueTodayCount > 0
                  ? `${actionQueueSummary.dueTodayCount} today`
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
        <div className="space-y-6">
          {/* Action Queue KPI Metric Summary Cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Overdue */}
            <div
              onClick={() => setQueueBucket('overdue')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                queueBucket === 'overdue'
                  ? 'bg-rose-950/30 border-rose-500/40 ring-1 ring-rose-500/30 shadow-sm'
                  : 'bg-[#141418] border-white/[0.08] hover:border-rose-500/30 hover:bg-rose-950/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Overdue</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/25">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-2">
                {actionQueueSummary?.overdueCount ?? 0}
              </div>
              <p className="text-[11px] text-rose-400/80 font-medium mt-0.5">Needs immediate resolution</p>
            </div>

            {/* Due Today */}
            <div
              onClick={() => setQueueBucket('today')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                queueBucket === 'today'
                  ? 'bg-cyan-950/30 border-cyan-500/40 ring-1 ring-cyan-500/30 shadow-sm'
                  : 'bg-[#141418] border-white/[0.08] hover:border-cyan-500/30 hover:bg-cyan-950/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Due Today</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                  <Clock className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-2">
                {actionQueueSummary?.dueTodayCount ?? 0}
              </div>
              <p className="text-[11px] text-cyan-400/80 font-medium mt-0.5">Target actions for today</p>
            </div>

            {/* Attention Required */}
            <div
              onClick={() => setQueueBucket('attention')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                queueBucket === 'attention'
                  ? 'bg-amber-950/30 border-amber-500/40 ring-1 ring-amber-500/30 shadow-sm'
                  : 'bg-[#141418] border-white/[0.08] hover:border-amber-500/30 hover:bg-amber-950/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Attention Required</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
                {actionQueueSummary?.attentionCount ?? 0}
              </div>
              <p className="text-[11px] text-amber-400/80 font-medium mt-0.5">Stalled or lapsed leads</p>
            </div>

            {/* Upcoming Visits */}
            <div
              onClick={() => setQueueBucket('upcoming')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                queueBucket === 'upcoming'
                  ? 'bg-emerald-950/30 border-emerald-500/40 ring-1 ring-emerald-500/30 shadow-sm'
                  : 'bg-[#141418] border-white/[0.08] hover:border-emerald-500/30 hover:bg-emerald-950/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Upcoming Visits</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  <Building2 className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
                {actionQueueSummary?.upcomingCount ?? 0}
              </div>
              <p className="text-[11px] text-emerald-400/80 font-medium mt-0.5">Scheduled property tours</p>
            </div>

            {/* Recently Completed */}
            <div
              onClick={() => setQueueBucket('completed')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                queueBucket === 'completed'
                  ? 'bg-teal-950/30 border-teal-500/40 ring-1 ring-teal-500/30 shadow-sm'
                  : 'bg-[#141418] border-white/[0.08] hover:border-teal-500/30 hover:bg-teal-950/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-medium text-[#9A9AA5] uppercase tracking-wider">Completed Today</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/25">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-teal-400 mt-2">
                {actionQueueSummary?.completedCount ?? 0}
              </div>
              <p className="text-[11px] text-teal-400/80 font-medium mt-0.5">Recorded achievements</p>
            </div>
          </div>

          {/* Bucket Filter Controls & Refresh */}
          <div className="luxury-card p-3 flex flex-wrap items-center justify-between gap-3 bg-[#141418] border border-white/[0.08] rounded-2xl">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: 'All Action Items', count: actionQueueSummary?.totalActive ?? 0 },
                  { id: 'overdue', label: 'Overdue', count: actionQueueSummary?.overdueCount ?? 0 },
                  { id: 'today', label: 'Due Today', count: actionQueueSummary?.dueTodayCount ?? 0 },
                  { id: 'attention', label: 'Attention Required', count: actionQueueSummary?.attentionCount ?? 0 },
                  { id: 'upcoming', label: 'Upcoming', count: actionQueueSummary?.upcomingCount ?? 0 },
                  { id: 'completed', label: 'Completed Today', count: actionQueueSummary?.completedCount ?? 0 },
                ] as const
              ).map((b) => {
                const active = queueBucket === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setQueueBucket(b.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? b.id === 'overdue'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-xs'
                          : b.id === 'attention'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs'
                          : 'bg-[#C9A961]/20 text-[#C9A961] border border-[#C9A961]/40 shadow-xs'
                        : 'bg-[#181820] text-[#9A9AA5] border border-white/[0.08] hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span>{b.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        active ? 'bg-white/10 text-white' : 'bg-white/5 text-[#9A9AA5]'
                      }`}
                    >
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#9A9AA5] font-mono">
                Timezone: {actionQueueData?.timezone || 'Local'}
              </span>
              <button
                onClick={() => fetchActionQueue(queueBucket)}
                disabled={loadingQueue}
                className="p-1.5 rounded-lg border border-white/[0.08] bg-[#181820] text-[#9A9AA5] hover:text-[#C9A961] hover:border-[#C9A961]/40 transition-colors cursor-pointer"
                title="Refresh action queue"
              >
                <RefreshCw className={`h-4 w-4 ${loadingQueue ? 'animate-spin text-[#C9A961]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Action Queue Items Stream */}
          {loadingQueue && !actionQueueData ? (
            <div className="luxury-card flex justify-center py-16 bg-[#141418] border border-white/[0.08] rounded-2xl">
              <Loader2 className="h-7 w-7 animate-spin text-[#C9A961]" />
            </div>
          ) : queueError ? (
            <div className="banner-error flex items-center justify-between p-4 bg-rose-950/30 border border-rose-500/30 rounded-2xl">
              <div className="flex items-center gap-2 text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{queueError}</span>
              </div>
              <button
                onClick={() => fetchActionQueue(queueBucket)}
                className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : !actionQueueData || actionQueueData.items.length === 0 ? (
            <div className="empty-state p-12 text-center bg-[#141418] rounded-2xl border border-white/[0.08]">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white">No items in {queueBucket} queue</h3>
              <p className="text-xs text-[#9A9AA5] mt-1 max-w-sm mx-auto">
                {queueBucket === 'overdue'
                  ? 'All tasks and appointments are up to date! Zero overdue items.'
                  : queueBucket === 'today'
                  ? 'No follow-up tasks or appointments scheduled for today.'
                  : queueBucket === 'attention'
                  ? 'No stalled or uncontacted leads requiring intervention.'
                  : 'Your action queue is completely clear. Visit lead profiles to schedule new follow-ups or tours.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {actionQueueData.items.map((item) => {
                const isOverdue = item.bucket === 'overdue';
                const isToday = item.bucket === 'today';
                const isAttention = item.actionType === 'ATTENTION_LEAD';
                const isVisit = item.actionType === 'SITE_VISIT';
                const isTask = item.actionType === 'TASK';

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-4.5 flex flex-col justify-between transition-all border shadow-sm ${
                      isOverdue
                        ? 'border-rose-500/30 bg-[#161214] hover:border-rose-500/50'
                        : isAttention
                        ? 'border-amber-500/30 bg-[#171410] hover:border-amber-500/50'
                        : isToday
                        ? 'border-cyan-500/30 bg-[#101518] hover:border-cyan-500/50'
                        : 'border-white/[0.08] bg-[#141418] hover:border-white/20'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Card Top: Lead Name & Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => navigate(`/leads/${item.lead.id}`)}
                          className="text-left font-bold text-sm text-white hover:text-[#C9A961] transition-colors flex items-center gap-1 group cursor-pointer"
                        >
                          <span className="truncate max-w-[170px]">{item.lead.fullName}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-[#9A9AA5] group-hover:text-[#C9A961] transition-transform group-hover:translate-x-0.5" />
                        </button>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isVisit ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <Building2 className="h-3 w-3" /> Visit
                            </span>
                          ) : isTask ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                              <CheckSquare className="h-3 w-3" /> Task
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

                      {/* Explainable Attention Reason Callout */}
                      {item.attentionReason && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                          <span>{item.attentionReason}</span>
                        </div>
                      )}

                      {/* Property Details if Visit */}
                      {item.property && (
                        <div className="p-3 rounded-xl bg-[#1A1A22] border border-white/[0.08] text-xs space-y-1">
                          <p className="font-bold flex items-center gap-1.5 text-white text-[11px]">
                            <Building2 className="h-3.5 w-3.5 text-[#C9A961] shrink-0" />
                            {item.property.title}
                          </p>
                          <p className="text-[11px] text-[#9A9AA5]">
                            {item.property.address}, {item.property.city} • <span className="text-[#C9A961] font-mono font-medium">${item.property.price.toLocaleString()}</span>
                          </p>
                        </div>
                      )}

                      {/* Due Date & Assignee metadata */}
                      <div className="flex items-center justify-between text-[11px] text-[#9A9AA5] pt-2 border-t border-white/[0.08]">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 text-[#9A9AA5]" />
                          {isOverdue ? (
                            <span className="text-rose-400 font-bold">
                              Overdue ({new Date(item.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                            </span>
                          ) : isToday ? (
                            <span className="text-cyan-400 font-bold">
                              Due Today ({new Date(item.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          ) : (
                            <span>Due: {new Date(item.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </span>
                        <span className="truncate max-w-[110px] text-[10px] text-[#9A9AA5]">
                          {item.assignedUser?.name || 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    {/* Context-Appropriate Actions */}
                    <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-white/[0.08]">
                      <button
                        onClick={() => navigate(`/leads/${item.lead.id}`)}
                        className="btn-stripe-secondary text-xs px-3 py-1.5"
                      >
                        Lead Cockpit &rarr;
                      </button>

                      <div className="flex items-center gap-1.5">
                        {item.leadTaskId && item.bucket !== 'completed' && (
                          <button
                            onClick={() => handleCompleteQueueTask(item.leadTaskId!)}
                            disabled={completingTaskId === item.leadTaskId}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600/90 text-white font-bold text-xs hover:bg-emerald-500 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer shadow-sm shadow-emerald-900/30"
                          >
                            {completingTaskId === item.leadTaskId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Complete
                          </button>
                        )}
                        {item.siteVisitId && (
                          <button
                            onClick={() => navigate(`/leads/${item.lead.id}`)}
                            className="btn-stripe-primary text-xs px-3 py-1.5"
                          >
                            Manage Visit
                          </button>
                        )}
                        {!item.leadTaskId && !item.siteVisitId && (
                          <button
                            onClick={() => navigate(`/leads/${item.lead.id}`)}
                            className="px-3 py-1.5 rounded-xl bg-[#C9A961]/20 text-[#C9A961] border border-[#C9A961]/40 font-bold text-xs hover:bg-[#C9A961]/30 transition-colors flex items-center gap-1"
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
                className="rounded-2xl p-4.5 flex flex-col justify-between cursor-pointer border border-white/[0.08] bg-[#141418] hover:border-white/20 transition-all shadow-sm group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1A22] text-[#C9A961] font-bold text-xs border border-white/[0.08] shadow-xs">
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

                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border ${priorityColors[lead.priority]}`}>
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

                  <div className="space-y-1.5 text-xs text-[#9A9AA5] mb-3 bg-[#1A1A22] p-2.5 rounded-xl border border-white/[0.08]">
                    {lead.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-[#9A9AA5] flex-shrink-0" />
                        <span className="truncate text-[#F5F5F7] text-[11px]">{lead.email}</span>
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-[#9A9AA5] flex-shrink-0" />
                        <span className="text-[#F5F5F7] text-[11px] font-mono">{lead.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* ── Requirement Summary Pill ── */}
                  <div className="rounded-xl bg-[#1A1A22] p-3 border border-white/[0.08] space-y-2 text-xs">
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
                        className="btn-stripe-primary text-[11px] py-1 px-3 flex items-center gap-1 shadow-xs"
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
