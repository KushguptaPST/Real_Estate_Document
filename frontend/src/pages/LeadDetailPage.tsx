import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { leadsApi, conversationsApi, propertiesApi, organizationApi, siteVisitsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type {
  Lead,
  LeadAssignmentHistory,
  User as OrgUser,
  CallDirection,
  CallOutcome,
  LeadCallLog,
  LeadTask,
  LeadTaskType,
  LeadTaskStatus,
  SiteVisit,
  SiteVisitStatus,
  TimelineCategory,
  TimelineEvent,
} from '@/types';
import {
  ArrowLeft,
  User,
  Sparkles,
  Send,
  ShieldAlert,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Check,
  Bot,
  UserCheck,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Inbox,
  LogOut,
  Clock,
  History,
  Zap,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  CheckSquare,
  ListTodo,
  FileCheck,
  CalendarClock,
  X,
  Plus,
  MapPin,
  Activity,
  Briefcase,
  ExternalLink,
  ShieldCheck,
  IndianRupee,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatIndianPrice, formatIndianPriceFull } from '@/utils/currency';

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<LeadAssignmentHistory[]>([]);
  const [callLogs, setCallLogs] = useState<LeadCallLog[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ownership Action States
  const [claiming, setClaiming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releaseReason, setReleaseReason] = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [targetAdvisorId, setTargetAdvisorId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Call Logging States
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [callDirection, setCallDirection] = useState<CallDirection>('OUTBOUND');
  const [callOutcome, setCallOutcome] = useState<CallOutcome>('CONNECTED');
  const [callTimestamp, setCallTimestamp] = useState<string>('');
  const [callDurationSeconds, setCallDurationSeconds] = useState<string>('');
  const [callNotes, setCallNotes] = useState<string>('');
  const [callFollowUpNeeded, setCallFollowUpNeeded] = useState<boolean>(false);
  const [callFollowUpDate, setCallFollowUpDate] = useState<string>('');
  const [loggingCall, setLoggingCall] = useState<boolean>(false);
  const [callFormError, setCallFormError] = useState<string | null>(null);

  // Follow-Up Task States
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<LeadTaskType>('CALL');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssignedUserId, setTaskAssignedUserId] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [taskTabFilter, setTaskTabFilter] = useState<'ALL' | 'OPEN' | 'OVERDUE' | 'COMPLETED'>('OPEN');

  // Requirements Edit Form State
  const [minBudget, setMinBudget] = useState<number | ''>('');
  const [maxBudget, setMaxBudget] = useState<number | ''>('');
  const [locations, setLocations] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [minBedrooms, setMinBedrooms] = useState<number | ''>('');
  const [possessionTimeline, setPossessionTimeline] = useState('');
  const [savingReqs, setSavingReqs] = useState(false);
  const [processingProposalId, setProcessingProposalId] = useState<string | null>(null);

  // Conversation Chat State
  const [advisorMessage, setAdvisorMessage] = useState('');
  const [sendingAdvisorMessage, setSendingAdvisorMessage] = useState(false);
  const [simulatedCustomerMessage, setSimulatedCustomerMessage] = useState('');
  const [sendingSimulatedMessage, setSendingSimulatedMessage] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [togglingTakeover, setTogglingTakeover] = useState(false);
  const [expandedBrief, setExpandedBrief] = useState(false);
  const [togglingAutoPilot, setTogglingAutoPilot] = useState(false);
  const [refreshingMatches, setRefreshingMatches] = useState(false);

  // ── Phase 3B: Lead-to-Deal Conversion States ──
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<any | null>(null);
  const [convertAddress, setConvertAddress] = useState('');
  const [convertPropertyId, setConvertPropertyId] = useState('');
  const [convertBuyerName, setConvertBuyerName] = useState('');
  const [convertSellerName, setConvertSellerName] = useState('');
  const [convertAcceptanceDate, setConvertAcceptanceDate] = useState('');
  const [convertTimezone, setConvertTimezone] = useState('America/New_York');
  const [eligibilityOverride, setEligibilityOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // ── Phase 2E: Persistent Buyer Memory & Follow-Up States ──
  const [memoryData, setMemoryData] = useState<{ memory: any; recommendation: any } | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [planningFollowUp, setPlanningFollowUp] = useState(false);

  // ── Real Site Visits States ──
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [visitTabFilter, setVisitTabFilter] = useState<'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'>('ALL');
  const [showScheduleVisitModal, setShowScheduleVisitModal] = useState(false);
  const [visitPropertyId, setVisitPropertyId] = useState<string>('');
  const [visitStartAt, setVisitStartAt] = useState<string>('');
  const [visitDurationMinutes, setVisitDurationMinutes] = useState<number>(60);
  const [visitLocation, setVisitLocation] = useState<string>('');
  const [visitNotes, setVisitNotes] = useState<string>('');
  const [visitAdvisorId, setVisitAdvisorId] = useState<string>('');
  const [schedulingVisit, setSchedulingVisit] = useState(false);
  const [visitFormError, setVisitFormError] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<{ checked: boolean; available?: boolean; error?: string } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Visit Action Modals
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleStartAt, setRescheduleStartAt] = useState<string>('');
  const [rescheduleDuration, setRescheduleDuration] = useState<number>(60);
  const [rescheduleLocation, setRescheduleLocation] = useState<string>('');
  const [rescheduleNotes, setRescheduleNotes] = useState<string>('');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeNotes, setOutcomeNotes] = useState<string>('');
  const [completingVisit, setCompletingVisit] = useState(false);

  const [showCancelVisitModal, setShowCancelVisitModal] = useState(false);
  const [cancelVisitReason, setCancelVisitReason] = useState<string>('');
  const [cancellingVisit, setCancellingVisit] = useState(false);

  // ── Unified Activity Timeline States ──
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineCategory, setTimelineCategory] = useState<TimelineCategory>('ALL');

  async function loadTimeline(cat: TimelineCategory = timelineCategory) {
    if (!id) return;
    try {
      setLoadingTimeline(true);
      setTimelineError(null);
      const data = await leadsApi.getTimeline(id, { category: cat });
      setTimelineEvents(data.events || []);
      setTimelineTotal(data.total || 0);
    } catch (err: any) {
      setTimelineError(err.message || 'Failed to load lead timeline');
    } finally {
      setLoadingTimeline(false);
    }
  }

  function handleFilterCategory(cat: TimelineCategory) {
    setTimelineCategory(cat);
    loadTimeline(cat);
  }

  function getTimelineCategoryConfig(category: string) {
    switch (category) {
      case 'CALLS':
        return {
          label: 'Call',
          badgeClass: 'bg-[#C9A961]/15 text-[#C9A961] border-[#C9A961]/30',
          dotClass: 'bg-[#181820] border-[#C9A961] text-[#C9A961]',
          icon: PhoneCall,
        };
      case 'TASKS':
        return {
          label: 'Task',
          badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          dotClass: 'bg-[#181820] border-cyan-500 text-cyan-400',
          icon: CheckSquare,
        };
      case 'VISITS':
        return {
          label: 'Site Visit',
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          dotClass: 'bg-[#181820] border-emerald-500 text-emerald-400',
          icon: Building2,
        };
      case 'OWNERSHIP':
        return {
          label: 'Ownership',
          badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dotClass: 'bg-[#181820] border-amber-500 text-amber-400',
          icon: UserCheck,
        };
      default:
        return {
          label: 'Activity',
          badgeClass: 'bg-[#181820] text-[#D1D1DB] border-white/[0.08]',
          dotClass: 'bg-[#181820] border-slate-500 text-[#9A9AA5]',
          icon: Activity,
        };
    }
  }

  function getLocalIsoString(date: Date = new Date()) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function handleOpenLogCallModal() {
    setCallDirection('OUTBOUND');
    setCallOutcome('CONNECTED');
    setCallTimestamp(getLocalIsoString());
    setCallDurationSeconds('');
    setCallNotes('');
    setCallFollowUpNeeded(false);
    setCallFollowUpDate('');
    setCallFormError(null);
    setShowLogCallModal(true);
  }

  async function handleConfirmLogCall(e: React.FormEvent) {
    e.preventDefault();
    if (!id || loggingCall) return;

    const callDate = callTimestamp ? new Date(callTimestamp) : new Date();
    if (isNaN(callDate.getTime())) {
      setCallFormError('Please enter a valid call date and time');
      return;
    }
    if (callDate.getTime() > Date.now() + 5 * 60 * 1000) {
      setCallFormError('Call date and time cannot be in the future');
      return;
    }

    let duration: number | null = null;
    if (callDurationSeconds.trim()) {
      const parsed = Number(callDurationSeconds);
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        setCallFormError('Duration must be a positive whole number of seconds');
        return;
      }
      duration = parsed;
    }

    if (callOutcome === 'OTHER' && (!callNotes || callNotes.trim().length < 3)) {
      setCallFormError('Notes are required (minimum 3 characters) when outcome is "Other"');
      return;
    }

    let followUpDate: string | undefined = undefined;
    if (callFollowUpNeeded && callFollowUpDate) {
      const fDate = new Date(callFollowUpDate);
      if (isNaN(fDate.getTime())) {
        setCallFormError('Please enter a valid follow-up date and time');
        return;
      }
      if (fDate.getTime() < Date.now() - 60 * 1000) {
        setCallFormError('Follow-up date must be in the future');
        return;
      }
      followUpDate = fDate.toISOString();
    }

    try {
      setLoggingCall(true);
      setCallFormError(null);

      await leadsApi.logCall(id, {
        direction: callDirection,
        outcome: callOutcome,
        calledAt: callDate.toISOString(),
        durationSeconds: duration,
        notes: callNotes.trim() || null,
        followUpNeeded: callFollowUpNeeded,
        followUpDate: followUpDate || null,
      });

      setShowLogCallModal(false);
      setActionFeedback({
        type: 'success',
        text: 'Call log successfully recorded.',
      });

      await loadLeadData();
    } catch (err: any) {
      if (err.status === 403) {
        setCallFormError('Advisors cannot record calls for leads owned by another advisor');
      } else {
        setCallFormError(err.message || 'Failed to record call log');
      }
    } finally {
      setLoggingCall(false);
    }
  }

  function formatDuration(seconds: number | null | undefined): string | null {
    if (seconds === null || seconds === undefined || seconds < 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  }

  function getOutcomeBadge(outcome: CallOutcome) {
    switch (outcome) {
      case 'CONNECTED':
        return { label: 'Connected', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'CALLBACK_REQUESTED':
        return { label: 'Callback Requested', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'VOICEMAIL':
        return { label: 'Left Voicemail', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'NO_ANSWER':
        return { label: 'No Answer', bg: 'bg-[#1E1E26] text-[#D1D1DB] border-white/[0.08]' };
      case 'BUSY':
        return { label: 'Line Busy', bg: 'bg-[#1E1E26] text-[#D1D1DB] border-white/[0.08]' };
      case 'WRONG_NUMBER':
        return { label: 'Wrong Number', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
      case 'OTHER':
      default:
        return { label: 'Other', bg: 'bg-[#1E1E26] text-[#D1D1DB] border-white/[0.08]' };
    }
  }

  function handleOpenAddTaskModal() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    setTaskTitle('');
    setTaskType('CALL');
    setTaskDueDate(getLocalIsoString(tomorrow));
    setTaskPriority('MEDIUM');
    setTaskDescription('');
    setTaskAssignedUserId(lead?.assignedUserId || currentUser?.id || '');
    setTaskFormError(null);
    setShowAddTaskModal(true);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!id || savingTask) return;
    if (!taskTitle.trim()) {
      setTaskFormError('Task title is required');
      return;
    }
    const due = new Date(taskDueDate);
    if (isNaN(due.getTime())) {
      setTaskFormError('Invalid task due date and time');
      return;
    }

    try {
      setSavingTask(true);
      setTaskFormError(null);
      await leadsApi.createTask(id, {
        title: taskTitle.trim(),
        taskType,
        dueDate: due.toISOString(),
        priority: taskPriority,
        description: taskDescription.trim() || null,
        assignedUserId: currentUser?.role === 'OWNER' && taskAssignedUserId ? taskAssignedUserId : undefined,
      });

      setShowAddTaskModal(false);
      setActionFeedback({
        type: 'success',
        text: 'Follow-up task created successfully.',
      });
      await loadLeadData();
    } catch (err: any) {
      if (err.status === 403) {
        setTaskFormError('Advisors cannot create tasks for leads owned by another advisor');
      } else {
        setTaskFormError(err.message || 'Failed to create task');
      }
    } finally {
      setSavingTask(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
    if (!id || completingTaskId) return;
    try {
      setCompletingTaskId(taskId);
      await leadsApi.completeTask(id, taskId);
      setActionFeedback({
        type: 'success',
        text: 'Task marked as completed.',
      });
      await loadLeadData();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to complete task',
      });
    } finally {
      setCompletingTaskId(null);
    }
  }

  async function handleCancelTask(taskId: string) {
    if (!id || cancellingTaskId) return;
    const reason = window.prompt('Reason for cancelling this task (optional):');
    if (reason === null) return;
    try {
      setCancellingTaskId(taskId);
      await leadsApi.cancelTask(id, taskId, reason || undefined);
      setActionFeedback({
        type: 'success',
        text: 'Task cancelled.',
      });
      await loadLeadData();
    } catch (err: any) {
      setActionFeedback({
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
        return { label: 'Message', icon: MessageSquare, bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
      case 'SITE_VISIT':
        return { label: 'Site Visit', icon: Building2, bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'SEND_DETAILS':
        return { label: 'Send Details', icon: Send, bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'DOCUMENT_FOLLOW_UP':
        return { label: 'Doc Follow-Up', icon: FileCheck, bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'OTHER':
      default:
        return { label: 'Other', icon: CheckSquare, bg: 'bg-[#1E1E26] text-[#D1D1DB] border-white/[0.08]' };
    }
  }

  function getTaskPriorityBadge(priority: string) {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'LOW':
      default:
        return 'bg-[#1E1E26] text-[#9A9AA5] border-white/[0.08]';
    }
  }

  function getSiteVisitStatusBadge(status: SiteVisitStatus) {
    switch (status) {
      case 'SCHEDULED':
        return { label: 'Scheduled', bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: 'bg-[#1E1E26] text-[#9A9AA5] border-white/[0.08]' };
      case 'NO_SHOW':
        return { label: 'No Show', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    }
  }

  function handleOpenScheduleVisitModal() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const initialStart = getLocalIsoString(tomorrow);
    setVisitStartAt(initialStart);
    setVisitDurationMinutes(60);
    const defaultProp = matches[0]?.propertyId || allProperties[0]?.id || '';
    setVisitPropertyId(defaultProp);
    const selectedProp = allProperties.find((p) => p.id === defaultProp) || matches[0]?.property;
    setVisitLocation(selectedProp ? `${selectedProp.title}, ${selectedProp.address}` : '');
    setVisitNotes('');
    setVisitAdvisorId(lead?.assignedUserId || currentUser?.id || '');
    setVisitFormError(null);
    setAvailabilityStatus(null);
    setShowScheduleVisitModal(true);

    checkVisitAvailability(initialStart, 60, lead?.assignedUserId || currentUser?.id);
  }

  async function checkVisitAvailability(start: string, duration: number, advisorId?: string, excludeVisitId?: string) {
    if (!start) return;
    try {
      setCheckingAvailability(true);
      const res = await siteVisitsApi.checkAvailability({
        startAt: start,
        durationMinutes: duration,
        advisorId: advisorId || undefined,
        excludeVisitId,
      });
      setAvailabilityStatus({ checked: true, available: res.available });
    } catch (err: any) {
      setAvailabilityStatus({ checked: true, available: false, error: err.message || 'Availability conflict' });
    } finally {
      setCheckingAvailability(false);
    }
  }

  async function handleScheduleVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !visitStartAt) return;
    try {
      setSchedulingVisit(true);
      setVisitFormError(null);

      await leadsApi.scheduleSiteVisit(id, {
        propertyId: visitPropertyId || null,
        startAt: visitStartAt,
        durationMinutes: visitDurationMinutes,
        meetingLocation: visitLocation || null,
        notes: visitNotes || null,
        assignedUserId: isOrgOwner && visitAdvisorId ? visitAdvisorId : undefined,
      });

      setShowScheduleVisitModal(false);
      await loadLeadData();
    } catch (err: any) {
      setVisitFormError(err.message || 'Failed to schedule site visit');
    } finally {
      setSchedulingVisit(false);
    }
  }

  function handleOpenRescheduleModal(visit: SiteVisit) {
    setSelectedVisit(visit);
    setRescheduleStartAt(getLocalIsoString(new Date(visit.startAt)));
    const durationMins = Math.round((new Date(visit.endAt).getTime() - new Date(visit.startAt).getTime()) / 60000);
    setRescheduleDuration(durationMins > 0 ? durationMins : 60);
    setRescheduleLocation(visit.meetingLocation || '');
    setRescheduleNotes(visit.notes || '');
    setRescheduleError(null);
    setShowRescheduleModal(true);
  }

  async function handleRescheduleVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisit) return;
    try {
      setRescheduling(true);
      setRescheduleError(null);

      await siteVisitsApi.reschedule(selectedVisit.id, {
        startAt: rescheduleStartAt,
        durationMinutes: rescheduleDuration,
        meetingLocation: rescheduleLocation || null,
        notes: rescheduleNotes || null,
      });

      setShowRescheduleModal(false);
      setSelectedVisit(null);
      await loadLeadData();
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule site visit');
    } finally {
      setRescheduling(false);
    }
  }

  function handleOpenOutcomeModal(visit: SiteVisit) {
    setSelectedVisit(visit);
    setOutcomeNotes(visit.outcomeNotes || '');
    setShowOutcomeModal(true);
  }

  async function handleCompleteVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisit) return;
    try {
      setCompletingVisit(true);
      await siteVisitsApi.complete(selectedVisit.id, outcomeNotes || undefined);
      setShowOutcomeModal(false);
      setSelectedVisit(null);
      await loadLeadData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete visit');
    } finally {
      setCompletingVisit(false);
    }
  }

  function handleOpenCancelVisitModal(visit: SiteVisit) {
    setSelectedVisit(visit);
    setCancelVisitReason('');
    setShowCancelVisitModal(true);
  }

  async function handleCancelVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisit) return;
    try {
      setCancellingVisit(true);
      await siteVisitsApi.cancel(selectedVisit.id, cancelVisitReason || undefined);
      setShowCancelVisitModal(false);
      setSelectedVisit(null);
      await loadLeadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel visit');
    } finally {
      setCancellingVisit(false);
    }
  }

  async function handleMarkNoShow(visit: SiteVisit) {
    if (!confirm(`Mark ${lead?.fullName || 'lead'} as No-Show for this site visit?`)) return;
    try {
      await siteVisitsApi.markNoShow(visit.id);
      await loadLeadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record no-show');
    }
  }

  useEffect(() => {
    if (id) loadLeadData();
  }, [id]);

  // Real-time polling for conversation thread (status updates, new Telegram messages, takeover state)
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      try {
        const updatedThread = await conversationsApi.getThread(id);
        setThread((prev: any) => {
          if (!prev) return updatedThread;
          const prevMsgs = prev.messages || [];
          const newMsgs = updatedThread.messages || [];
          const statusChanged =
            prevMsgs.length > 0 &&
            newMsgs.length > 0 &&
            prevMsgs[prevMsgs.length - 1]?.deliveryStatus !== newMsgs[newMsgs.length - 1]?.deliveryStatus;
          if (
            prevMsgs.length !== newMsgs.length ||
            statusChanged ||
            prev.isHumanTakeover !== updatedThread.isHumanTakeover ||
            prev.state !== updatedThread.state
          ) {
            return updatedThread;
          }
          return prev;
        });
      } catch {
        // silent polling catch
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  async function loadLeadData() {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const [leadData, threadData, matchesData, assignmentsData, propertiesData, memoryResp] = await Promise.all([
        leadsApi.get(id),
        conversationsApi.getThread(id),
        propertiesApi.getLeadMatches(id),
        leadsApi.getAssignments(id).catch(() => []),
        propertiesApi.list().catch(() => []),
        leadsApi.getMemory(id).catch((err) => {
          setMemoryError(err?.message || 'Unable to load buyer memory');
          return null;
        }),
      ]);

      setLead(leadData);
      setThread(threadData);
      setMatches(matchesData);
      setAssignmentHistory(assignmentsData);
      setCallLogs(leadData.callLogs || []);
      setTasks(leadData.tasks || []);
      setSiteVisits(leadData.siteVisits || []);
      setAllProperties(propertiesData || []);
      if (memoryResp) {
        setMemoryData(memoryResp);
        setMemoryError(null);
      }

      loadTimeline();

      if (currentUser?.role === 'OWNER') {
        organizationApi.listMembers().then(setOrgMembers).catch(() => {});
      }

      const req = leadData.requirements;
      if (req) {
        setMinBudget(req.minBudget ?? '');
        setMaxBudget(req.maxBudget ?? '');
        setLocations((req.preferredLocations || []).join(', '));
        setPropertyType(req.propertyType ?? '');
        setMinBedrooms(req.minBedrooms ?? '');
        setPossessionTimeline(req.possessionTimeline ?? '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }

  async function reloadMemory() {
    if (!id) return;
    try {
      setLoadingMemory(true);
      setMemoryError(null);
      const res = await leadsApi.getMemory(id);
      setMemoryData(res);
    } catch (err: any) {
      setMemoryError(err?.message || 'Failed to refresh buyer memory');
    } finally {
      setLoadingMemory(false);
    }
  }

  async function handleCreateFollowUpTask() {
    if (!id || planningFollowUp || !memoryData?.recommendation) return;
    const rec = memoryData.recommendation;
    try {
      setPlanningFollowUp(true);
      const res = await leadsApi.planFollowUp(id, {
        trigger: rec.trigger,
        title: `Follow-Up [${rec.trigger}]: ${lead?.fullName || 'Lead'}`,
        description: `Trigger: ${rec.trigger}\nRationale: ${rec.reason}\nRecommended Action: ${rec.recommendedAction}`,
        priority: rec.priority,
        dueDate: rec.suggestedDueDate,
        draftContent: rec.suggestedDraftContent,
      });

      setActionFeedback({
        type: 'success',
        text: res.isExisting
          ? `Follow-up task already planned: "${res.taskTitle}"`
          : `Created follow-up task: "${res.taskTitle}"`,
      });
      await loadLeadData();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to create follow-up task',
      });
    } finally {
      setPlanningFollowUp(false);
    }
  }

  async function handleClaim() {
    if (!id) return;
    try {
      setClaiming(true);
      setActionFeedback(null);
      await leadsApi.claim(id, 'Claimed via Lead Cockpit');
      setActionFeedback({
        type: 'success',
        text: 'Successfully claimed lead!',
      });
      await loadLeadData();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('already assigned') || err.message?.includes('another advisor')) {
        setActionFeedback({
          type: 'warning',
          text: 'This lead was just claimed by another advisor.',
        });
      } else if (err.status === 422 || err.message?.includes('cap')) {
        setActionFeedback({
          type: 'error',
          text: 'Active lead cap reached (25 active leads maximum). Please close or release an active lead first.',
        });
      } else {
        setActionFeedback({
          type: 'error',
          text: err.message || 'Failed to claim lead',
        });
      }
      await loadLeadData();
    } finally {
      setClaiming(false);
    }
  }

  async function handleConfirmRelease(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      setReleasing(true);
      setActionFeedback(null);
      await leadsApi.release(id, releaseReason.trim() || undefined);
      setShowReleaseModal(false);
      setReleaseReason('');
      setActionFeedback({
        type: 'success',
        text: 'Lead successfully released to the unassigned pool.',
      });
      await loadLeadData();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to release lead',
      });
    } finally {
      setReleasing(false);
    }
  }

  async function handleConfirmReassign(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      setReassigning(true);
      setActionFeedback(null);
      const target = targetAdvisorId === 'unassigned' ? null : targetAdvisorId;
      await leadsApi.reassign(id, target, reassignReason.trim() || undefined);
      setShowReassignModal(false);
      setTargetAdvisorId('');
      setReassignReason('');
      setActionFeedback({
        type: 'success',
        text: 'Lead successfully reassigned!',
      });
      await loadLeadData();
    } catch (err: any) {
      if (err.status === 422 || err.message?.includes('cap')) {
        setActionFeedback({
          type: 'error',
          text: 'Cannot reassign: target advisor has reached their active lead cap (25 active leads maximum).',
        });
      } else {
        setActionFeedback({
          type: 'error',
          text: err.message || 'Failed to reassign lead',
        });
      }
    } finally {
      setReassigning(false);
    }
  }

  async function handleSaveRequirements(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      setSavingReqs(true);
      await leadsApi.updateRequirements(id, {
        minBudget: minBudget ? Number(minBudget) : null,
        maxBudget: maxBudget ? Number(maxBudget) : null,
        preferredLocations: locations.split(',').map((s) => s.trim()).filter(Boolean),
        propertyType: propertyType || null,
        minBedrooms: minBedrooms ? Number(minBedrooms) : null,
        possessionTimeline: possessionTimeline || null,
      });

      // Refresh matches after requirement changes
      const updatedMatches = await propertiesApi.refreshLeadMatches(id);
      setMatches(updatedMatches.matches || []);
      const updatedLead = await leadsApi.get(id);
      setLead(updatedLead);
    } catch (err: any) {
      alert(err.message || 'Failed to update requirements');
    } finally {
      setSavingReqs(false);
    }
  }

  async function handleAcceptProposal(proposal: any) {
    if (!id || processingProposalId) return;
    try {
      setProcessingProposalId(proposal.id);
      setActionFeedback(null);
      await leadsApi.acceptProposal(id, proposal.id);

      // Populate local form fields immediately
      const pc = proposal.proposedChanges;
      if (pc) {
        if (pc.minBudget != null && pc.minBudget !== '') setMinBudget(Number(pc.minBudget));
        if (pc.maxBudget != null && pc.maxBudget !== '') setMaxBudget(Number(pc.maxBudget));
        if (pc.locations && Array.isArray(pc.locations) && pc.locations.length > 0) {
          setLocations(pc.locations.join(', '));
        }
        if (pc.propertyType) setPropertyType(pc.propertyType);
        if (pc.minBedrooms != null && pc.minBedrooms !== '') setMinBedrooms(Number(pc.minBedrooms));
        if (pc.timeline) setPossessionTimeline(pc.timeline);
      }

      setActionFeedback({
        type: 'success',
        text: 'Applied & confirmed AI requirement proposal into database!',
      });

      // Reload lead, matches, and memory
      const [updatedMatches, updatedLead] = await Promise.all([
        propertiesApi.refreshLeadMatches(id).catch(() => null),
        leadsApi.get(id).catch(() => null),
      ]);
      if (updatedMatches?.matches) setMatches(updatedMatches.matches);
      if (updatedLead) setLead(updatedLead);
      await reloadMemory();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to apply proposal',
      });
    } finally {
      setProcessingProposalId(null);
    }
  }

  async function handleRejectProposal(proposalId: string) {
    if (!id || processingProposalId) return;
    try {
      setProcessingProposalId(proposalId);
      setActionFeedback(null);
      await leadsApi.rejectProposal(id, proposalId);
      setActionFeedback({
        type: 'success',
        text: 'Dismissed proposal.',
      });
      await reloadMemory();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to dismiss proposal',
      });
    } finally {
      setProcessingProposalId(null);
    }
  }

  async function handleSendAdvisorMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !advisorMessage.trim()) return;

    try {
      setSendingAdvisorMessage(true);

      // If takeover is not active, automatically enable human takeover so the advisor
      // can safely handle the lead without autonomous AI interruptions.
      if (!thread?.isHumanTakeover) {
        await conversationsApi.toggleTakeover(id, true);
      }

      await conversationsApi.sendAdvisorMessage(id, advisorMessage.trim());
      setAdvisorMessage('');

      const updatedThread = await conversationsApi.getThread(id);
      setThread(updatedThread);
    } catch (err: any) {
      alert(err.message || 'Failed to send advisor message');
    } finally {
      setSendingAdvisorMessage(false);
    }
  }

  async function handleSimulateCustomerMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !simulatedCustomerMessage.trim()) return;

    try {
      setSendingSimulatedMessage(true);
      await conversationsApi.simulateCustomerMessage(id, simulatedCustomerMessage.trim());
      setSimulatedCustomerMessage('');

      const updatedThread = await conversationsApi.getThread(id);
      setThread(updatedThread);
    } catch (err: any) {
      alert(err.message || 'Failed to simulate customer message');
    } finally {
      setSendingSimulatedMessage(false);
    }
  }


  async function handleToggleTakeover() {
    if (!id || !thread) return;
    try {
      setTogglingTakeover(true);
      const nextState = !thread.isHumanTakeover;
      const updated = await conversationsApi.toggleTakeover(id, nextState);
      setThread(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle human takeover');
    } finally {
      setTogglingTakeover(false);
    }
  }

  async function handleToggleAutoPilot() {
    if (!id || !thread) return;
    try {
      setTogglingAutoPilot(true);
      const nextState = !thread.autoReplyEnabled;
      const updated = await conversationsApi.toggleAutoPilot(id, nextState);
      setThread(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle Auto-Pilot mode');
    } finally {
      setTogglingAutoPilot(false);
    }
  }

  const [reviewingMessageId, setReviewingMessageId] = useState<string | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);

  async function handleReviewAiMessage(msgId: string, status: 'APPROVED' | 'REJECTED') {
    if (!id || reviewingMessageId) return;
    try {
      setReviewingMessageId(msgId);
      await conversationsApi.reviewMessage(id, msgId, status);
      const updatedThread = await conversationsApi.getThread(id);
      setThread(updatedThread);
    } catch (err: any) {
      alert(err.message || 'Failed to review message');
    } finally {
      setReviewingMessageId(null);
    }
  }

  async function handleRetryMessage(msgId: string) {
    if (!id || retryingMessageId) return;
    try {
      setRetryingMessageId(msgId);
      await conversationsApi.retryMessage(id, msgId);
      const updatedThread = await conversationsApi.getThread(id);
      setThread(updatedThread);
    } catch (err: any) {
      alert(err.message || 'Failed to retry message dispatch');
    } finally {
      setRetryingMessageId(null);
    }
  }

  async function handleRefreshMatches() {
    if (!id) return;
    try {
      setRefreshingMatches(true);
      const res = await propertiesApi.refreshLeadMatches(id);
      setMatches(res.matches || []);
    } catch (err: any) {
      alert(err.message || 'Failed to refresh matches');
    } finally {
      setRefreshingMatches(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#C9A961]" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-6 text-center text-rose-300">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-rose-400" />
        {error || 'Lead not found'}
      </div>
    );
  }

  const isLeadOwner = Boolean(lead.assignedUserId && lead.assignedUserId === currentUser?.id);
  const isUnassigned = !lead.assignedUserId;
  const isOrgOwner = currentUser?.role === 'OWNER';
  const canConvert = isOrgOwner || isLeadOwner;
  const canLogCall = isOrgOwner || isLeadOwner || isUnassigned;
  const canManageTasks = isOrgOwner || isLeadOwner || isUnassigned;

  function handleOpenConvertModal() {
    if (!lead) return;
    setConvertError(null);
    setConvertSuccess(null);
    setEligibilityOverride(false);
    setOverrideReason('');
    const topMatch = matches[0]?.property;
    const defaultAddress = topMatch?.address
      ? `${topMatch.address}, ${topMatch.city || ''} ${topMatch.state || ''}`.trim()
      : (lead as any).preferredPropertyAddress || '';
    setConvertAddress(defaultAddress);
    setConvertPropertyId(matches[0]?.propertyId || '');
    setConvertBuyerName(lead.fullName || '');
    setConvertSellerName('');
    setConvertAcceptanceDate('');
    setShowConvertModal(true);
  }

  async function handleConvertToDeal(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !lead) return;
    if (!convertAddress.trim()) {
      setConvertError('Property address is required');
      return;
    }
    const isEarlyStage = ['NEW', 'CONTACTED'].includes(lead.status);
    if (isEarlyStage && (!eligibilityOverride || !overrideReason.trim())) {
      setConvertError('Eligibility override and justification reason are required for early-stage leads (NEW/CONTACTED)');
      return;
    }

    try {
      setConverting(true);
      setConvertError(null);
      const res = await leadsApi.convertToDeal(id, {
        propertyAddress: convertAddress.trim(),
        buyerName: convertBuyerName.trim() || undefined,
        sellerName: convertSellerName.trim() || undefined,
        acceptanceDate: convertAcceptanceDate ? new Date(convertAcceptanceDate).toISOString() : undefined,
        timezone: convertTimezone || undefined,
        propertyId: convertPropertyId || undefined,
        eligibilityOverride: isEarlyStage ? eligibilityOverride : undefined,
        overrideReason: isEarlyStage ? overrideReason.trim() : undefined,
      });

      setConvertSuccess(res);
      await loadLeadData();
    } catch (err: any) {
      console.error('Failed to convert lead to deal:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to convert lead to deal';
      setConvertError(msg);
    } finally {
      setConverting(false);
    }
  }

  function canCompleteOrCancelTask(t: LeadTask) {
    if (isOrgOwner) return true;
    if (t.assignedUserId === currentUser?.id) return true;
    if (lead?.assignedUserId === currentUser?.id) return true;
    return false;
  }

  const filteredTasks = tasks.filter((t) => {
    if (taskTabFilter === 'OPEN') return t.status === 'OPEN';
    if (taskTabFilter === 'OVERDUE') {
      return t.status === 'OPEN' && (t.isOverdue || new Date(t.dueDate).getTime() < Date.now());
    }
    if (taskTabFilter === 'COMPLETED') return t.status === 'COMPLETED';
    return true; // 'ALL'
  });

  return (
    <div className="space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/leads')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A9AA5] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Leads Dashboard
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#9A9AA5]">Status:</span>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {lead.status}
          </span>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {lead.priority} Priority
          </span>
        </div>
      </div>

      {/* ── Action Feedback Banner ── */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : actionFeedback.type === 'warning'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' && <Check className="h-4 w-4 text-emerald-400" />}
            {actionFeedback.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400" />}
            {actionFeedback.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-400" />}
            <span className="font-medium">{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-bold hover:opacity-75 text-[#9A9AA5] hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Stagnant Inactivity Warning ── */}
      {lead.isInactiveWarning && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <div>
              <span className="font-bold">Attention — Inactivity Warning:</span> No qualifying advisor activity has been recorded on this lead for{' '}
              <span className="font-extrabold">{lead.daysSinceLastActivity} days</span>. Owner review recommended.
            </div>
          </div>
          {currentUser?.role === 'OWNER' && (
            <button
              onClick={() => setShowReassignModal(true)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors w-fit"
            >
              Reassign Lead
            </button>
          )}
        </div>
      )}

      {/* ── Lead Title & Header ── */}
      <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-[#C9A961]/15 border border-[#C9A961]/30 flex items-center justify-center text-[#C9A961]">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{lead.fullName}</h1>
            <p className="text-xs text-[#9A9AA5]">
              Source: <span className="font-semibold text-[#D1D1DB]">{lead.source}</span> • Contact: {lead.email || lead.phone || 'None'}
            </p>
          </div>
        </div>

        {/* ── AI Mode & Human Takeover Controls ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* AI Draft Mode Toggle */}
          <div className="flex flex-col gap-1 bg-[#181820] p-2.5 rounded-xl border border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="text-left">
                <p className="text-[11px] font-bold text-[#D1D1DB] flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-[#C9A961]" />
                  {thread?.autoReplyEnabled ? '⚡ Autopilot: Instant Auto-Reply' : '📝 Copilot: Review Drafts First'}
                </p>
              </div>
              <button
                onClick={handleToggleAutoPilot}
                disabled={togglingAutoPilot}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                  thread?.autoReplyEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
                    : 'bg-[#252530] text-[#D1D1DB] hover:bg-slate-300'
                }`}
                title="Click to switch between Instant Auto-Reply and Copilot Draft Mode"
              >
                {togglingAutoPilot && <Loader2 className="h-3 w-3 animate-spin" />}
                {thread?.autoReplyEnabled ? '⚡ Autopilot ON' : 'Enable Autopilot'}
              </button>
            </div>
            <p className="text-[10px] text-[#6E6E7A]">
              {thread?.autoReplyEnabled
                ? 'Conversation replies are auto-approved instantly. Database criteria changes require manual review.'
                : 'AI suggested replies are held for advisor review (Pending Approval).'}
            </p>
          </div>

          {/* Takeover Control */}
          <div className="flex items-center gap-2 bg-[#181820] p-2.5 rounded-xl border border-white/[0.08]">
            <button
              onClick={handleToggleTakeover}
              disabled={togglingTakeover}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 ${
                thread?.isHumanTakeover
                  ? 'bg-amber-600 text-white hover:bg-amber-500'
                  : 'btn-stripe-primary text-xs'
              }`}
            >
              {togglingTakeover && <Loader2 className="h-3 w-3 animate-spin" />}
              {thread?.isHumanTakeover ? 'Resume AI' : 'Takeover Chat'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Lead Ownership & Claim/Release Bar ── */}
      <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#9A9AA5] uppercase tracking-wider">Current Advisor:</span>
          {lead.assignedUser ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A961] bg-[#C9A961]/10 px-3 py-1 rounded-full border border-[#C9A961]/30">
              <UserCheck className="h-3.5 w-3.5 text-[#C9A961]" />
              {lead.assignedUser.name || lead.assignedUser.email}
              {lead.assignedUserId === currentUser?.id && ' (You)'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 border-dashed">
              <Inbox className="h-3.5 w-3.5" />
              Unassigned Pool
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Deal Link or Convert Button */}
          {lead.deal ? (
            <Link
              to={`/deals/${lead.deal.id}`}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
              title="View converted deal"
            >
              <Briefcase className="h-3.5 w-3.5 text-emerald-400" />
              View Deal
              <ExternalLink className="h-3 w-3 text-emerald-400" />
            </Link>
          ) : lead.status !== 'LOST' ? (
            <button
              onClick={handleOpenConvertModal}
              disabled={!canConvert}
              title={
                !canConvert
                  ? 'Only the assigned advisor or organization owner can convert this lead'
                  : 'Convert qualified lead to an active deal'
              }
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Convert to Deal
            </button>
          ) : null}
          {/* Claim button */}
          {!lead.assignedUserId && !['WON', 'LOST'].includes(lead.status) && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="btn-stripe-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-xs"
            >
              {claiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Claim Lead
            </button>
          )}

          {/* Release button */}
          {Boolean(lead.assignedUserId) &&
            (currentUser?.role === 'OWNER' || lead.assignedUserId === currentUser?.id) && (
              <button
                onClick={() => setShowReleaseModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 bg-[#181820] text-[#D1D1DB] border border-white/[0.08] hover:text-rose-400 hover:border-rose-500/40 transition-all cursor-pointer"
                title="Release back to unassigned pool"
              >
                <LogOut className="h-3.5 w-3.5" />
                Release to Pool
              </button>
            )}

          {/* Reassign button */}
          {currentUser?.role === 'OWNER' && (
            <button
              onClick={() => setShowReassignModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 bg-[#181820] text-[#9A9AA5] border border-white/[0.08] hover:text-[#F5F5F7] hover:border-white/20 transition-all cursor-pointer"
              title="Reassign to another advisor"
            >
              <UserCheck className="h-3.5 w-3.5 text-[#C9A961]" />
              Reassign Advisor
            </button>
          )}
        </div>
      </div>

      {/* ── 3-Column Layout: Requirements | Conversation | Inventory Matches ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left Column: Editable Requirements (4 Cols) ── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-[#C9A961]" />
              Structured Requirements
            </h2>

            {(() => {
              const pendingReqProposals = memoryData?.memory?.requirements?.pendingProposals;
              if (!pendingReqProposals || pendingReqProposals.length === 0) return null;
              const latest = pendingReqProposals[0];
              return (
                <div className="mb-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      {pendingReqProposals.length} AI Proposal{pendingReqProposals.length > 1 ? 's' : ''} Ready
                    </span>
                    <span className="text-[11px] text-[#9A9AA5] block truncate mt-0.5">
                      Apply latest criteria to this form & database
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAcceptProposal(latest)}
                    disabled={!!processingProposalId}
                    className="px-2.5 py-1 rounded-lg bg-[#C9A961] hover:bg-[#DFBF77] text-black font-extrabold text-[11px] shrink-0 transition-colors shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" />
                    {processingProposalId === latest?.id ? 'Applying...' : 'Apply Latest'}
                  </button>
                </div>
              );
            })()}

            <form onSubmit={handleSaveRequirements} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">Min Budget (₹ INR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 15000000 (₹1.5 Cr)"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
                  {typeof minBudget === 'number' && minBudget > 0 && (
                    <span className="text-[10px] text-[#C9A961] font-mono mt-0.5 block">{formatIndianPrice(minBudget)}</span>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">Max Budget (₹ INR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 25000000 (₹2.5 Cr)"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
                  {typeof maxBudget === 'number' && maxBudget > 0 && (
                    <span className="text-[10px] text-[#C9A961] font-mono mt-0.5 block">{formatIndianPrice(maxBudget)}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">Preferred Locations</label>
                <input
                  type="text"
                  placeholder="Downtown, Westside"
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs focus:border-[#C9A961] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">Property Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] px-2 py-1.5 text-xs focus:border-[#C9A961] focus:outline-none"
                  >
                    <option value="">Any Type</option>
                    <option value="APARTMENT">Apartment</option>
                    <option value="VILLA">Villa</option>
                    <option value="CONDO">Condo</option>
                    <option value="SINGLE_FAMILY">Single Family</option>
                    <option value="TOWNHOUSE">Townhouse</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">Min Bedrooms</label>
                  <input
                    type="number"
                    placeholder="e.g. 3"
                    value={minBedrooms}
                    onChange={(e) => setMinBedrooms(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">Possession Timeline</label>
                <input
                  type="text"
                  placeholder="e.g. 60_DAYS or Immediate"
                  value={possessionTimeline}
                  onChange={(e) => setPossessionTimeline(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs focus:border-[#C9A961] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingReqs}
                className="w-full btn-stripe-primary py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                {savingReqs && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save &amp; Recalculate Matches
              </button>
            </form>
          </div>

          {/* ── Real Property Site Visits Card ── */}
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Property Site Visits
                <span className="text-[11px] text-[#9A9AA5] font-medium">
                  ({siteVisits.length})
                </span>
              </h2>
              <button
                onClick={handleOpenScheduleVisitModal}
                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
              >
                <Plus className="h-3 w-3" /> Schedule
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-semibold">
              {(['ALL', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const).map((tab) => {
                const count = tab === 'ALL'
                  ? siteVisits.length
                  : siteVisits.filter((v) => v.status === tab).length;
                const active = visitTabFilter === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setVisitTabFilter(tab)}
                    className={`px-2 py-0.5 rounded-lg border transition-all whitespace-nowrap ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-[#181820] text-[#9A9AA5] border-white/[0.08] hover:bg-[#1E1E26]'
                    }`}
                  >
                    {tab === 'NO_SHOW' ? 'No-Show' : tab.charAt(0) + tab.slice(1).toLowerCase()} ({count})
                  </button>
                );
              })}
            </div>

            {/* Visits List */}
            {(() => {
              const filteredVisits = siteVisits.filter((v) =>
                visitTabFilter === 'ALL' ? true : v.status === visitTabFilter,
              );

              if (filteredVisits.length === 0) {
                return (
                  <div className="p-4 rounded-xl border border-dashed border-white/[0.08] text-center space-y-2">
                    <Building2 className="h-6 w-6 text-[#4A4A55] mx-auto" />
                    <p className="text-xs text-[#6E6E7A]">
                      No {visitTabFilter !== 'ALL' ? visitTabFilter.toLowerCase() : ''} site visits recorded.
                    </p>
                    <button
                      onClick={handleOpenScheduleVisitModal}
                      className="text-xs text-emerald-600 font-bold hover:underline"
                    >
                      Schedule a property tour &rarr;
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {filteredVisits.map((visit) => {
                    const badge = getSiteVisitStatusBadge(visit.status);
                    const startDate = new Date(visit.startAt);
                    const endDate = new Date(visit.endAt);

                    return (
                      <div
                        key={visit.id}
                        className="p-3 rounded-xl border border-white/[0.08] bg-[#181820]/60 hover:bg-[#1E1E26] hover:shadow-xs transition-all text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-[11px]">
                                {startDate.toLocaleDateString([], {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="text-[10px] text-[#9A9AA5] font-medium">
                                {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                                {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {visit.property && (
                              <p className="font-semibold text-[#F5F5F7] text-[11px] flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                {visit.property.title}
                              </p>
                            )}
                          </div>
                          <Badge className={`${badge.bg} text-[10px] shrink-0 font-bold`}>
                            {badge.label}
                          </Badge>
                        </div>

                        {visit.meetingLocation && (
                          <p className="text-[11px] text-[#9A9AA5] flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-[#6E6E7A] shrink-0" />
                            {visit.meetingLocation}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-[#6E6E7A] pt-1 border-t border-white/[0.06]">
                          <span>Advisor: {visit.assignedUser?.name || visit.assignedUser?.email || 'Assigned'}</span>
                          {visit.leadTask && (
                            <span className="text-[#9A9AA5]">
                              Task: {visit.leadTask.status}
                            </span>
                          )}
                        </div>

                        {visit.outcomeNotes && (
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-[11px]">
                            <span className="font-bold">Outcome: </span>
                            {visit.outcomeNotes}
                          </div>
                        )}

                        {visit.cancelReason && (
                          <div className="p-2 rounded-lg bg-[#1E1E26] text-[#D1D1DB] border border-white/[0.08] text-[11px]">
                            <span className="font-bold">Cancelled: </span>
                            {visit.cancelReason}
                          </div>
                        )}

                        {/* Action buttons if SCHEDULED */}
                        {visit.status === 'SCHEDULED' && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              onClick={() => handleOpenOutcomeModal(visit)}
                              className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 font-bold text-[10px] transition-colors"
                            >
                              Complete Outcome
                            </button>
                            <button
                              onClick={() => handleOpenRescheduleModal(visit)}
                              className="px-2 py-1 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 font-semibold text-[10px] transition-colors"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleMarkNoShow(visit)}
                              className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 font-semibold text-[10px] transition-colors"
                            >
                              No-Show
                            </button>
                            <button
                              onClick={() => handleOpenCancelVisitModal(visit)}
                              className="px-2 py-1 rounded-lg bg-[#1E1E26] text-[#9A9AA5] border border-white/[0.08] hover:bg-[#252530] font-semibold text-[10px] transition-colors ml-auto"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* ── Assignment History Card ── */}
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <History className="h-4 w-4 text-[#C9A961]" />
                Assignment History
              </span>
              <span className="text-[11px] text-[#9A9AA5] font-medium">
                {assignmentHistory.length} events
              </span>
            </h2>

            {assignmentHistory.length === 0 ? (
              <p className="text-xs text-[#6E6E7A] py-3 text-center">
                No reassignment history recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {assignmentHistory.map((item) => {
                  let transitionLabel = 'Assigned';
                  if (!item.previousUserId && item.assignedUserId) {
                    transitionLabel = `Claimed by ${item.assignedUser?.name || item.assignedUser?.email || 'Advisor'}`;
                  } else if (item.previousUserId && !item.assignedUserId) {
                    transitionLabel = `Released to pool from ${item.previousUser?.name || item.previousUser?.email || 'Advisor'}`;
                  } else if (item.previousUserId && item.assignedUserId) {
                    transitionLabel = `Reassigned: ${item.previousUser?.name || item.previousUser?.email} → ${item.assignedUser?.name || item.assignedUser?.email}`;
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl border border-white/[0.08] bg-[#181820]/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[#F5F5F7] text-[11px]">
                          {transitionLabel}
                        </span>
                        <span className="text-[10px] text-[#6E6E7A]">
                          {new Date(item.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {item.reason && (
                        <p className="text-[11px] text-[#9A9AA5] italic">
                          "{item.reason}"
                        </p>
                      )}
                      <p className="text-[10px] text-[#6E6E7A]">
                        Actor: {item.changedBy?.name || item.changedBy?.email || 'System'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Middle Column: Customer Conversation & Phone Call History (4 Cols) ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* ── Advisor Escalation & Handoff Card (Phase 2D) ── */}
          {(() => {
            const latestEscalationMsg = thread?.messages
              ?.slice()
              .reverse()
              .find((m: any) => m.suggestedAction?.escalation?.escalated);
            const activeEscalation = latestEscalationMsg?.suggestedAction?.escalation;
            const activeBrief = activeEscalation?.brief;
            const openEscalationTask = tasks.find(
              (t) => t.status === 'OPEN' && t.title.startsWith('Escalation [')
            );
            const showEscalationCard = Boolean(activeEscalation || openEscalationTask);

            if (!showEscalationCard) return null;

            return (
              <div
                className={`rounded-2xl border p-5 shadow-xs transition-all ${
                  (activeEscalation?.urgency || openEscalationTask?.priority) === 'URGENT'
                    ? 'border-rose-500/30 bg-rose-500/10'
                    : (activeEscalation?.urgency || openEscalationTask?.priority) === 'HIGH'
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-[#C9A961]/30 bg-[#181820]'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-xl ${
                        (activeEscalation?.urgency || openEscalationTask?.priority) === 'URGENT'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">Advisor Escalation Brief</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            (activeEscalation?.urgency || openEscalationTask?.priority) === 'URGENT'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : (activeEscalation?.urgency || openEscalationTask?.priority) === 'HIGH'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30'
                          }`}
                        >
                          {activeEscalation?.urgency || openEscalationTask?.priority || 'HIGH'} URGENCY
                        </span>
                      </div>
                      <p className="text-xs text-[#9A9AA5] mt-0.5">
                        Reason: <span className="font-semibold text-[#D1D1DB]">{activeEscalation?.reason || 'HUMAN_INTERVENTION_REQUIRED'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-1.5">
                    {thread?.isHumanTakeover ? (
                      <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> Takeover Active
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#D1D1DB] bg-[#181820] px-2.5 py-1 rounded-full border border-white/[0.08] flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Awaiting Advisor
                      </span>
                    )}
                  </div>
                </div>

                {/* Trigger & Context */}
                <div className="mt-3 text-xs space-y-2">
                  <div className="bg-[#181820] rounded-xl p-3 border border-white/[0.06]">
                    <span className="text-[11px] font-bold text-[#9A9AA5] uppercase tracking-wider block mb-1">
                      Triggering Context
                    </span>
                    <p className="text-[#F5F5F7] font-medium whitespace-pre-wrap">
                      {activeEscalation?.explanation || openEscalationTask?.description || 'Buyer requested human advisor assistance.'}
                    </p>
                  </div>

                  {/* Recommended Next Action */}
                  {(activeEscalation?.recommendedAdvisorAction || openEscalationTask) && (
                    <div className="bg-[#181820] rounded-xl p-3 border border-[#C9A961]/20">
                      <span className="text-[11px] font-bold text-[#C9A961] uppercase tracking-wider flex items-center gap-1 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Recommended Advisor Action
                      </span>
                      <p className="text-[#F5F5F7] font-medium">
                        {activeEscalation?.recommendedAdvisorAction || 'Review conversation history and reach out to the buyer directly.'}
                      </p>
                    </div>
                  )}

                  {/* Grounded Brief Details Toggle */}
                  {activeBrief && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedBrief(!expandedBrief)}
                        className="text-xs font-semibold text-[#C9A961] hover:text-[#d8b870] flex items-center gap-1 transition-colors"
                      >
                        {expandedBrief ? 'Hide Detailed Evidence Brief' : 'View Grounded Context & Proposals Brief'}
                      </button>

                      {expandedBrief && (
                        <div className="mt-2 p-3 bg-[#181820] rounded-xl border border-white/[0.06] space-y-2 text-xs">
                          <div>
                            <span className="font-bold text-[#D1D1DB]">Confirmed Requirements: </span>
                            <span className="text-[#9A9AA5]">
                              {activeBrief.confirmedRequirements
                                ? `${activeBrief.confirmedRequirements.minBudget != null || activeBrief.confirmedRequirements.maxBudget != null ? `Budget: ${activeBrief.confirmedRequirements.minBudget ? formatIndianPrice(activeBrief.confirmedRequirements.minBudget) : '₹0'} - ${activeBrief.confirmedRequirements.maxBudget ? formatIndianPrice(activeBrief.confirmedRequirements.maxBudget) : 'No max'}` : 'Budget: Flexible'} | Locations: ${activeBrief.confirmedRequirements.preferredLocations?.join(', ') || 'Any'} | Beds: ${activeBrief.confirmedRequirements.minBedrooms ?? 'Any'}`
                                : 'None confirmed yet in database'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-[#D1D1DB]">Pending Requirement Proposals: </span>
                            <span className="text-[#9A9AA5]">
                              {activeBrief.pendingRequirementProposal ? 'Requires Advisor Review (Pending Approval)' : 'None pending'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-[#D1D1DB]">Confirmed Site Visits: </span>
                            <span className="text-[#9A9AA5]">
                              {activeBrief.confirmedSiteVisits?.length > 0
                                ? activeBrief.confirmedSiteVisits.map((v: any) => `${v.propertyTitle} (${new Date(v.startTime).toLocaleDateString()})`).join(', ')
                                : 'No confirmed site visits yet'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-[#D1D1DB]">Site Visit Proposals: </span>
                            <span className="text-[#9A9AA5]">
                              {activeBrief.pendingSiteVisitProposal ? 'Proposed Tour Window (Pending Buyer Consent)' : 'None pending'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Controls */}
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleTakeover}
                      disabled={togglingTakeover}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 ${
                        thread?.isHumanTakeover
                          ? 'bg-amber-600 text-white hover:bg-amber-500'
                          : 'btn-stripe-primary text-xs'
                      }`}
                    >
                      {togglingTakeover && <Loader2 className="h-3 w-3 animate-spin" />}
                      {thread?.isHumanTakeover ? 'Resume AI' : 'Takeover Chat'}
                    </button>

                    {openEscalationTask && (
                      <button
                        onClick={() => handleCompleteTask(openEscalationTask.id)}
                        disabled={completingTaskId === openEscalationTask.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs flex items-center gap-1.5"
                      >
                        {completingTaskId === openEscalationTask.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        <Check className="h-3.5 w-3.5" /> Mark Escalation Resolved
                      </button>
                    )}
                  </div>

                  {latestEscalationMsg?.approvalStatus === 'PENDING_APPROVAL' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleReviewAiMessage(latestEscalationMsg.id, 'APPROVED')}
                        disabled={reviewingMessageId === latestEscalationMsg.id}
                        className="btn-stripe-primary text-xs px-2.5 py-1.5 flex items-center gap-1 disabled:opacity-50"
                      >
                        {reviewingMessageId === latestEscalationMsg.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        <Check className="h-3 w-3" /> Approve Draft
                      </button>
                      <button
                        onClick={() => handleReviewAiMessage(latestEscalationMsg.id, 'REJECTED')}
                        disabled={reviewingMessageId === latestEscalationMsg.id}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/25 disabled:opacity-50"
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Follow-Up Recommendation Card (Phase 2E) ── */}
          {(() => {
            const rec = memoryData?.recommendation;
            if (!rec) return null;

            const pendingDraftMsg = thread?.messages?.find(
              (m: any) =>
                m.senderType === 'AI' &&
                m.approvalStatus === 'PENDING_APPROVAL' &&
                (m.suggestedAction?.followUpPlan || m.suggestedAction?.followUpProposal),
            );

            const triggerLabels: Record<string, { label: string; badge: string }> = {
              UNANSWERED_QUESTION: {
                label: 'Unanswered Buyer Question',
                badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
              },
              COMPLETED_VISIT_FOLLOW_UP: {
                label: 'Post-Walkthrough Feedback Due',
                badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
              },
              VISIT_INTEREST_UNSCHEDULED: {
                label: 'Tour Interest Needs Scheduling',
                badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
              },
              NEW_MATCHING_INVENTORY: {
                label: 'New Matching Inventory Ready',
                badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
              },
              INACTIVE_LEAD_CHECKIN: {
                label: 'Inactive Lead Periodic Check-in',
                badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
              },
              ADVISOR_COMMITMENT_DUE: {
                label: 'Advisor Commitment Due',
                badge: 'bg-[#C9A961]/15 text-[#C9A961] border-[#C9A961]/30',
              },
            };

            const triggerConfig = rec.trigger ? triggerLabels[rec.trigger] : null;

            return (
              <div
                className={`rounded-2xl border p-5 shadow-sm transition-all relative overflow-hidden ${
                  rec.shouldFollowUp
                    ? 'bg-[#141418] border-[#C9A961]/35 ring-1 ring-[#C9A961]/20'
                    : 'bg-[#141418] border-white/[0.08] text-[#9A9AA5]'
                }`}
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#C9A961]/50 to-transparent" />

                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30 shadow-2xs">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        Follow-Up Recommendation
                        {rec.priority && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              rec.priority === 'HIGH' || rec.priority === 'URGENT'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-[#181820] text-[#D1D1DB] border-white/[0.08]'
                            }`}
                          >
                            {rec.priority}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-[#9A9AA5] font-medium mt-0.5">
                        Deterministic trigger analysis &amp; multi-day lead nurturing
                      </p>
                    </div>
                  </div>

                  {triggerConfig && (
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${triggerConfig.badge}`}
                    >
                      {triggerConfig.label}
                    </span>
                  )}
                </div>

                <div className="text-xs space-y-3 mt-3">
                  <div className="p-3.5 rounded-xl bg-[#181820] border border-white/[0.08]">
                    <p className="font-semibold text-[#F5F5F7] leading-relaxed">{rec.reason}</p>
                    <p className="text-[11px] text-[#9A9AA5] mt-1.5">
                      <span className="font-bold text-[#C9A961]">Action: </span>
                      {rec.recommendedAction}
                    </p>
                  </div>

                  {rec.evidence && rec.evidence.length > 0 && (
                    <div className="text-[11px] text-[#9A9AA5] pl-3 border-l-2 border-[#C9A961]/50 space-y-1 py-0.5">
                      <span className="font-bold text-[#D1D1DB] block mb-1">Underlying Evidence:</span>
                      {rec.evidence.map((ev: string, idx: number) => {
                        const cleanEv = ev.replace(/\$undefined\s*-\s*\$undefined/, 'Flexible budget');
                        return (
                          <div key={idx} className="flex items-start gap-1.5">
                            <span className="text-[#C9A961] font-bold">•</span>
                            <span className="text-[#D1D1DB]">{cleanEv}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#9A9AA5] pt-1">
                    <span>
                      Proposed Due:{' '}
                      <strong className="text-[#F5F5F7] font-mono">
                        {new Date(rec.suggestedDueDate).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                    {rec.alreadyPlanned && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        Task Already Open
                      </span>
                    )}
                  </div>

                  {/* Suggested Draft Content Box */}
                  {rec.suggestedDraftContent && (
                    <div className="p-3 rounded-xl bg-[#101014] border border-[#C9A961]/25 text-[11px] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#F5F5F7] flex items-center gap-1.5">
                          <Bot className="h-3.5 w-3.5 text-[#C9A961]" />
                          Prepared Customer Draft (Pending Approval)
                        </span>
                        <span className="text-[10px] text-[#C9A961] italic font-medium">No autonomous dispatch</span>
                      </div>
                      <p className="text-[#F5F5F7] bg-[#181820] p-3 rounded-xl border border-white/[0.08] italic text-xs leading-relaxed">
                        "{rec.suggestedDraftContent}"
                      </p>
                    </div>
                  )}

                  {/* Action Controls */}
                  <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      {rec.shouldFollowUp && !rec.alreadyPlanned ? (
                        <button
                          onClick={handleCreateFollowUpTask}
                          disabled={planningFollowUp || !canManageTasks}
                          className="btn-stripe-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          {planningFollowUp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          <CheckSquare className="h-3.5 w-3.5" />
                          Create Follow-up Task
                        </button>
                      ) : rec.alreadyPlanned ? (
                        <span className="text-[11px] text-[#9A9AA5] italic">
                          An active follow-up task is already assigned for this trigger.
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#9A9AA5] italic">
                          Follow-up suppressed by lead state or active engagement.
                        </span>
                      )}
                    </div>

                    {pendingDraftMsg && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReviewAiMessage(pendingDraftMsg.id, 'APPROVED')}
                          disabled={reviewingMessageId === pendingDraftMsg.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-50 flex items-center gap-1 transition-all cursor-pointer"
                        >
                          {reviewingMessageId === pendingDraftMsg.id && <Loader2 className="h-3 w-3 animate-spin" />}
                          <Check className="h-3 w-3" /> Approve Draft
                        </button>
                        <button
                          onClick={() => handleReviewAiMessage(pendingDraftMsg.id, 'REJECTED')}
                          disabled={reviewingMessageId === pendingDraftMsg.id}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-50 transition-all cursor-pointer"
                        >
                          Discard
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Customer Messages Card */}
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs flex flex-col h-[360px]">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-[#C9A961]" />
                Customer Messages
              </h2>
              <span className="text-[11px] text-[#9A9AA5] font-medium">Channel: {thread?.channel}</span>
            </div>

            {/* ── Messages Timeline ── */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 text-xs pr-1">
              {thread?.messages?.length === 0 ? (
                <div className="text-center py-10 text-[#6E6E7A]">
                  No messages recorded yet. Type below to send a message.
                </div>
              ) : (
                thread?.messages?.map((msg: any) => {
                  if (msg.senderType === 'AI' && !msg.content?.trim()) return null;
                  const isCustomer = msg.senderType === 'CUSTOMER';
                  const isAi = msg.senderType === 'AI';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl p-3 ${
                          isCustomer
                            ? 'bg-[#1E1E26] text-white'
                            : isAi
                            ? 'bg-[#181820] text-indigo-100 border border-indigo-500/30'
                            : 'bg-gradient-to-r from-[#C9A961] to-[#E5C985] text-[#0A0A0B] font-semibold'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5 text-[10px] font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="opacity-80">{msg.senderType}</span>
                            {isAi && msg.approvalStatus === 'PENDING_APPROVAL' && (
                              <span className="text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded text-[9px]">
                                Pending Approval
                              </span>
                            )}
                            {isAi && msg.approvalStatus === 'APPROVED' && (
                              <span className="text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded text-[9px]">
                                Approved
                              </span>
                            )}
                          </div>

                          {/* Outbound Delivery Status Badge */}
                          {!isCustomer && msg.deliveryStatus && msg.deliveryStatus !== 'NOT_APPLICABLE' && (
                            <div className="flex items-center gap-1">
                              {msg.deliveryStatus === 'QUEUED' && (
                                <span className="text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5 animate-pulse" /> Outbox Queued
                                </span>
                              )}
                              {msg.deliveryStatus === 'SENDING' && (
                                <span className="text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Sending...
                                </span>
                              )}
                              {msg.deliveryStatus === 'SENT' && (
                                <span className="text-sky-300 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Send className="h-2.5 w-2.5" /> Dispatched
                                </span>
                              )}
                              {msg.deliveryStatus === 'DELIVERED' && (
                                <span className="text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Delivered
                                </span>
                              )}
                              {msg.deliveryStatus === 'FAILED' && (
                                <span className="text-rose-300 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <AlertCircle className="h-2.5 w-2.5" /> Failed
                                </span>
                              )}
                              {msg.deliveryStatus === 'RETRY_PENDING' && (
                                <span className="text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Retry Pending
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* Delivery Failure Notice & Authorized Retry Button */}
                        {!isCustomer && msg.deliveryStatus === 'FAILED' && (
                          <div className="mt-2 pt-2 border-t border-rose-500/30 flex flex-col gap-1.5">
                            <div className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded p-1.5">
                              <span className="font-semibold">Delivery Issue:</span> {msg.deliveryError || 'Failed to dispatch to recipient'}
                            </div>
                            <button
                              disabled={retryingMessageId === msg.id}
                              onClick={() => handleRetryMessage(msg.id)}
                              className="self-end px-2.5 py-1 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-500 disabled:opacity-50 inline-flex items-center gap-1 shadow-xs transition"
                            >
                              {retryingMessageId === msg.id ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-2.5 w-2.5" />
                              )}
                              Retry Dispatch
                            </button>
                          </div>
                        )}

                        {/* AI Suggested Approval Buttons */}
                        {isAi && msg.approvalStatus === 'PENDING_APPROVAL' && (
                          <div className="mt-2 pt-2 border-t border-[#C9A961]/30 flex items-center gap-2">
                            <button
                              onClick={() => handleReviewAiMessage(msg.id, 'APPROVED')}
                              disabled={reviewingMessageId === msg.id}
                              className="btn-stripe-primary text-[10px] px-2 py-1 flex items-center gap-1 disabled:opacity-50"
                            >
                              {reviewingMessageId === msg.id && <Loader2 className="h-3 w-3 animate-spin" />}
                              <Check className="h-3 w-3" /> Approve Draft
                            </button>
                            <button
                              onClick={() => handleReviewAiMessage(msg.id, 'REJECTED')}
                              disabled={reviewingMessageId === msg.id}
                              className="px-2 py-1 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold hover:bg-rose-500/25 disabled:opacity-50"
                            >
                              Discard
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Advisor Message Input Form ── */}
            <form onSubmit={handleSendAdvisorMessage} className="pt-3 border-t border-white/[0.06] flex gap-2">
              <input
                type="text"
                placeholder={thread?.isHumanTakeover ? "Type message as Advisor..." : "Send advisor reply (will activate takeover)..."}
                value={advisorMessage}
                onChange={(e) => setAdvisorMessage(e.target.value)}
                className="flex-1 rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] placeholder:text-[#6E6E7A] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sendingAdvisorMessage || !advisorMessage.trim()}
                className="btn-stripe-primary text-xs px-3.5 py-2 flex items-center gap-1.5 disabled:opacity-50"
              >
                {sendingAdvisorMessage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Reply</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* ── Follow-Up Tasks & Reminders Card ── */}
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ListTodo className="h-4 w-4 text-[#C9A961]" />
                  Follow-Up Tasks &amp; Reminders
                </h2>
                {tasks.some((t) => t.status === 'OPEN' && (t.isOverdue || new Date(t.dueDate).getTime() < Date.now())) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse">
                    Overdue
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#9A9AA5] font-medium">
                  {tasks.filter((t) => t.status === 'OPEN').length} open
                </span>
                <button
                  onClick={handleOpenAddTaskModal}
                  disabled={!canManageTasks}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30 hover:bg-[#C9A961]/25 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!canManageTasks ? 'Only assigned advisor or owner can create tasks' : 'Schedule new follow-up task'}
                >
                  <Plus className="h-3 w-3" />
                  + Add Task
                </button>
              </div>
            </div>

            {/* Filter Sub-Tabs */}
            <div className="flex items-center gap-1.5 pb-1">
              {(['OPEN', 'ALL', 'OVERDUE', 'COMPLETED'] as const).map((tab) => {
                const count =
                  tab === 'ALL'
                    ? tasks.length
                    : tab === 'OPEN'
                    ? tasks.filter((t) => t.status === 'OPEN').length
                    : tab === 'OVERDUE'
                    ? tasks.filter((t) => t.status === 'OPEN' && (t.isOverdue || new Date(t.dueDate).getTime() < Date.now())).length
                    : tasks.filter((t) => t.status === 'COMPLETED').length;
                return (
                  <button
                    key={tab}
                    onClick={() => setTaskTabFilter(tab)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                      taskTabFilter === tab
                        ? 'bg-[#C9A961] text-[#0A0A0B] hover:bg-[#D4B872] font-semibold'
                        : 'bg-[#1E1E26] text-[#9A9AA5] hover:bg-[#252530]'
                    }`}
                  >
                    {tab === 'OPEN' ? 'Open' : tab === 'ALL' ? 'All' : tab === 'OVERDUE' ? 'Overdue' : 'Completed'} ({count})
                  </button>
                );
              })}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="rounded-xl bg-[#181820] p-5 text-center text-xs text-[#9A9AA5] border border-white/[0.06] space-y-2">
                <p>No {taskTabFilter.toLowerCase()} tasks found.</p>
                {canManageTasks && taskTabFilter !== 'COMPLETED' && (
                  <button
                    onClick={handleOpenAddTaskModal}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#C9A961] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create a follow-up task for this lead
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {filteredTasks.map((t) => {
                  const typeBadge = getTaskTypeBadge(t.taskType);
                  const Icon = typeBadge.icon;
                  const isOverdue = t.status === 'OPEN' && (t.isOverdue || new Date(t.dueDate).getTime() < Date.now());
                  const canAct = canCompleteOrCancelTask(t);

                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition-colors ${
                        isOverdue
                          ? 'border-rose-500/30 bg-rose-500/10'
                          : t.status === 'COMPLETED'
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : t.status === 'CANCELLED'
                          ? 'border-white/[0.08] bg-[#181820]/30 opacity-75'
                          : 'border-white/[0.08] bg-[#181820]/60 hover:bg-[#181820]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${typeBadge.bg}`}>
                            <Icon className="h-3 w-3" />
                            {typeBadge.label}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getTaskPriorityBadge(t.priority)}`}>
                            {t.priority}
                          </span>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <AlertTriangle className="h-3 w-3" /> Overdue
                            </span>
                          )}
                          {t.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </span>
                          )}
                          {t.status === 'CANCELLED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#1E1E26] text-[#9A9AA5] border border-white/[0.08]">
                              <XCircle className="h-3 w-3" /> Cancelled
                            </span>
                          )}
                          {t.callLogId && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              From Call Log
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        {t.status === 'OPEN' && canAct && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleCompleteTask(t.id)}
                              disabled={completingTaskId === t.id}
                              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                              title="Mark task completed"
                            >
                              {completingTaskId === t.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Complete
                            </button>
                            <button
                              onClick={() => handleCancelTask(t.id)}
                              disabled={cancellingTaskId === t.id}
                              className="p-1 rounded-lg text-[#6E6E7A] hover:text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                              title="Cancel task"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className={`font-bold text-xs ${t.status === 'COMPLETED' ? 'text-[#9A9AA5] line-through' : 'text-white'}`}>
                          {t.title}
                        </h4>
                        {t.description && (
                          <p className="text-[11px] text-[#9A9AA5] mt-0.5 whitespace-pre-wrap">{t.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#9A9AA5] pt-1 border-t border-white/[0.06]/60">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3 text-[#6E6E7A]" />
                          Due: {new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>Assignee: {t.assignedUser?.name || t.assignedUser?.email || 'Unassigned'}</span>
                      </div>

                      {t.status === 'COMPLETED' && t.completedAt && (
                        <div className="text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 flex items-center justify-between">
                          <span>Completed by: {t.completedUser?.name || t.completedUser?.email || 'Advisor'}</span>
                          <span>{new Date(t.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: AI Verified Property Matches (4 Cols) ── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-[#C9A961]" />
                Verified Property Matches ({matches.length})
              </h2>
              <button
                onClick={handleRefreshMatches}
                disabled={refreshingMatches}
                className="p-1.5 rounded-lg text-[#9A9AA5] hover:text-[#C9A961] hover:bg-[#1E1E26] transition-colors"
                title="Refresh matches"
              >
                <RefreshCw className={`h-4 w-4 ${refreshingMatches ? 'animate-spin text-[#C9A961]' : ''}`} />
              </button>
            </div>

            {matches.length === 0 ? (
              <div className="rounded-xl bg-[#181820] p-6 text-center text-xs text-[#9A9AA5] border border-white/[0.06]">
                No inventory properties match current mandatory filters (budget &amp; bedrooms).
              </div>
            ) : (
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {matches.map((m: any) => (
                  <div key={m.id} className="rounded-xl border border-white/[0.08] p-3 bg-[#181820]/60 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white">{m.property.title}</h4>
                        <p className="text-[11px] text-[#9A9AA5]">{m.property.address}, {m.property.city}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {Math.round(m.matchScore * 100)}% Match
                      </span>
                    </div>

                    <div className="text-[#D1D1DB] font-semibold flex items-center gap-3 text-[11px]">
                      <span title={formatIndianPriceFull(m.property.price)}>{formatIndianPrice(m.property.price)}</span>
                      <span>•</span>
                      <span>{m.property.bedrooms} Beds / {m.property.bathrooms} Baths</span>
                    </div>

                    {/* ── Verified Match Reasons ── */}
                    <div className="text-[11px] text-[#9A9AA5] bg-[#181820] p-2 rounded-lg border border-white/[0.06] space-y-1">
                      <p className="font-bold text-[#F5F5F7] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Match Breakdown:
                      </p>
                      <p className="whitespace-pre-wrap text-[10.5px] leading-relaxed">{m.matchReason}</p>
                    </div>

                    {/* ── Failed Soft Criteria Tags ── */}
                    {m.failedCriteria?.length > 0 && (
                      <div className="text-[10px] text-amber-300 bg-amber-500/10 p-1.5 rounded-md border border-amber-500/25">
                        <span className="font-bold">Unmet Preference:</span> {m.failedCriteria.join('; ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Full-Width: Unified Activity Timeline ── */}
      <div className="mt-8 rounded-2xl bg-[#141418] border border-white/[0.08] p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#C9A961]" />
              Unified Activity Timeline
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#C9A961]/15 text-[#C9A961] border border-[#C9A961]/30">
                {timelineTotal} {timelineTotal === 1 ? 'event' : 'events'}
              </span>
            </h2>
            <p className="text-xs text-[#9A9AA5] mt-0.5">
              Canonical chronological history across lead lifecycle, follow-up tasks, site visits, and assignments.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 bg-[#1E1E26] p-1 rounded-xl text-xs font-semibold">
              {(
                [
                  { id: 'ALL', label: 'All Activity' },
                  { id: 'TASKS', label: 'Tasks' },
                  { id: 'VISITS', label: 'Site Visits' },
                  { id: 'OWNERSHIP', label: 'Ownership' },
                ] as const
              ).map((tab) => {
                const active = timelineCategory === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleFilterCategory(tab.id)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      active
                        ? 'bg-[#C9A961] text-[#0A0A0B] shadow-xs font-bold'
                        : 'text-[#9A9AA5] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => loadTimeline(timelineCategory)}
              disabled={loadingTimeline}
              className="p-1.5 rounded-lg border border-white/[0.08] text-[#9A9AA5] hover:text-[#C9A961] hover:bg-[#181820] transition-colors"
              title="Refresh timeline"
            >
              <RefreshCw className={`h-4 w-4 ${loadingTimeline ? 'animate-spin text-[#C9A961]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading / Error / Empty States */}
        {timelineError ? (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400" />
              <span>{timelineError}</span>
            </div>
            <button
              onClick={() => loadTimeline(timelineCategory)}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loadingTimeline && timelineEvents.length === 0 ? (
          <div className="p-12 text-center text-[#6E6E7A] space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#C9A961]" />
            <p className="text-xs">Loading activity timeline...</p>
          </div>
        ) : timelineEvents.length === 0 ? (
          <div className="p-10 rounded-xl border border-dashed border-white/[0.08] text-center space-y-2">
            <Clock className="h-8 w-8 text-[#4A4A55] mx-auto" />
            <p className="text-xs font-semibold text-[#9A9AA5]">No activity recorded for this category.</p>
            <p className="text-[11px] text-[#6E6E7A]">
              Recorded phone calls, scheduled tasks, site visits, and assignment updates will appear here chronologically.
            </p>
          </div>
        ) : (
          <div className="relative pl-7 sm:pl-9 space-y-6 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#252530]">
            {timelineEvents.map((evt) => {
              const cfg = getTimelineCategoryConfig(evt.category);
              const IconComp = cfg.icon;

              return (
                <div key={evt.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-7 sm:-left-9 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[#141418] shadow-xs ${cfg.dotClass}`}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </div>

                  {/* Timeline Event Card */}
                  <div className="rounded-xl border border-white/[0.08]/90 bg-[#181820]/40 p-4 hover:bg-[#181820] transition-colors space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-white">{evt.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </span>
                        {evt.outcome && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#181820] text-[#D1D1DB] border border-white/[0.08] shadow-2xs">
                            {evt.outcome}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#6E6E7A] font-medium whitespace-nowrap">
                        {new Date(evt.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {evt.description && (
                      <p className="text-xs text-[#F5F5F7] bg-[#181820] p-2.5 rounded-lg border border-white/[0.06] leading-relaxed whitespace-pre-wrap">
                        {evt.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#9A9AA5] pt-1 border-t border-white/[0.08]/50 flex-wrap">
                      <span className="flex items-center gap-1 font-medium">
                        <User className="h-3 w-3 text-[#6E6E7A]" />
                        Actor: {evt.actor?.name || evt.actor?.email || 'System'}
                      </span>

                      <div className="flex items-center gap-2">
                        {evt.metadata?.durationFormatted && (
                          <span className="font-medium text-[#9A9AA5] bg-[#1E1E26] px-2 py-0.5 rounded-md">
                            Duration: {evt.metadata.durationFormatted}
                          </span>
                        )}
                        {evt.metadata?.meetingLocation && (
                          <span className="flex items-center gap-1 text-[#9A9AA5] bg-[#1E1E26] px-2 py-0.5 rounded-md">
                            <MapPin className="h-3 w-3 text-[#6E6E7A]" />
                            {evt.metadata.meetingLocation}
                          </span>
                        )}
                        {evt.metadata?.priority && (
                          <span className="font-semibold text-[#9A9AA5] bg-[#1E1E26] px-2 py-0.5 rounded-md">
                            {evt.metadata.priority} Priority
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Release Lead Modal ── */}
      {showReleaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2540]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] p-5 border border-white/[0.12] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <LogOut className="h-4 w-4 text-amber-600" />
                Release Lead to Pool
              </h3>
              <button
                onClick={() => setShowReleaseModal(false)}
                className="text-[#6E6E7A] hover:text-[#D1D1DB] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#9A9AA5]">
              Releasing this lead will remove the current assignment and return it to the organization's unassigned pool where other advisors can claim it.
            </p>

            <form onSubmit={handleConfirmRelease} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#D1D1DB] mb-1">
                  Reason for Release (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Workload rebalancing, out of territory"
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowReleaseModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releasing}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 flex items-center gap-1.5"
                >
                  {releasing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Release to Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reassign Lead Modal (Owner Only) ── */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2540]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] p-5 border border-white/[0.12] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#635bff]" />
                Reassign Lead to Advisor
              </h3>
              <button
                onClick={() => setShowReassignModal(false)}
                className="text-[#6E6E7A] hover:text-[#D1D1DB] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#9A9AA5]">
              Select an advisor from your team or choose unassigned pool. Target advisor must have fewer than 25 active leads.
            </p>

            <form onSubmit={handleConfirmReassign} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#D1D1DB] mb-1">
                  Target Advisor *
                </label>
                <select
                  value={targetAdvisorId}
                  onChange={(e) => setTargetAdvisorId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                >
                  <option value="">Select advisor...</option>
                  <option value="unassigned">Unassigned Pool (Release)</option>
                  {orgMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#D1D1DB] mb-1">
                  Reassignment Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Territory reassignment, performance distribution"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !targetAdvisorId}
                  className="px-3 py-1.5 rounded-xl bg-[#635bff] text-white text-xs font-bold hover:bg-[#5247db] flex items-center gap-1.5 disabled:opacity-50"
                >
                  {reassigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ── Add Follow-Up Task Modal ── */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141418] p-6 shadow-2xl border border-white/[0.12] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-[#C9A961]" />
                Schedule Follow-Up Task
              </h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="rounded-lg p-1 text-[#6E6E7A] hover:bg-[#1E1E26] hover:text-[#9A9AA5]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4 text-xs">
              {taskFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{taskFormError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call lead to discuss 3BHK site visit options"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] placeholder:text-[#6E6E7A] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                />
              </div>

              {/* Task Type & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Task Type *
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as LeadTaskType)}
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#F5F5F7] focus:border-[#C9A961] focus:outline-none font-medium"
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="MESSAGE">WhatsApp / Message</option>
                    <option value="SITE_VISIT">Site Visit</option>
                    <option value="SEND_DETAILS">Send Property Details</option>
                    <option value="DOCUMENT_FOLLOW_UP">Document Follow-Up</option>
                    <option value="OTHER">Other Task</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Priority *
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#F5F5F7] focus:border-[#C9A961] focus:outline-none font-medium"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Due Date & Assignee (if Owner) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Due Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
                </div>
                {isOrgOwner && orgMembers.length > 0 ? (
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">
                      Assigned Advisor
                    </label>
                    <select
                      value={taskAssignedUserId}
                      onChange={(e) => setTaskAssignedUserId(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#F5F5F7] focus:border-[#C9A961] focus:outline-none"
                    >
                      {orgMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.email} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">
                      Assignee
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentUser?.name || currentUser?.email || 'You'}
                      className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#9A9AA5]"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Description / Notes <span className="text-[#6E6E7A] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Specific follow-up instructions, customer questions to answer, units to show..."
                  className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] placeholder:text-[#6E6E7A] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="btn-stripe-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingTask && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Schedule Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Schedule Site Visit Modal ── */}
      {showScheduleVisitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141418] border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Schedule Property Site Visit
              </h3>
              <button
                onClick={() => setShowScheduleVisitModal(false)}
                className="text-[#6E6E7A] hover:text-[#9A9AA5] p-1 rounded-lg hover:bg-[#1E1E26]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleVisit} className="mt-4 space-y-4 text-xs">
              {visitFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{visitFormError}</span>
                </div>
              )}

              {/* Property Selection */}
              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Property <span className="text-[#6E6E7A] font-normal">(Optional)</span>
                </label>
                <select
                  value={visitPropertyId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setVisitPropertyId(pid);
                    const prop = allProperties.find((p) => p.id === pid) || matches.find((m) => m.propertyId === pid)?.property;
                    if (prop) {
                      setVisitLocation(`${prop.title}, ${prop.address}`);
                    }
                  }}
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#F5F5F7] focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">No specific property / General Showing</option>
                  {allProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({formatIndianPrice(p.price)} • {p.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Start Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={visitStartAt}
                    onChange={(e) => {
                      setVisitStartAt(e.target.value);
                      checkVisitAvailability(e.target.value, visitDurationMinutes, visitAdvisorId);
                    }}
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Duration *
                  </label>
                  <select
                    value={visitDurationMinutes}
                    onChange={(e) => {
                      const dur = Number(e.target.value);
                      setVisitDurationMinutes(dur);
                      checkVisitAvailability(visitStartAt, dur, visitAdvisorId);
                    }}
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#F5F5F7] focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes (1 hour)</option>
                    <option value={90}>90 minutes (1.5 hours)</option>
                    <option value={120}>120 minutes (2 hours)</option>
                  </select>
                </div>
              </div>

              {/* Live Advisor Availability Feedback */}
              <div className="p-2.5 rounded-xl border border-white/[0.08] bg-[#181820] flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#D1D1DB] flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#9A9AA5]" />
                  Advisor Availability Check:
                </span>
                {checkingAvailability ? (
                  <span className="text-[#9A9AA5] flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                  </span>
                ) : availabilityStatus?.available ? (
                  <span className="text-emerald-300 font-bold flex items-center gap-1 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Slot Available
                  </span>
                ) : availabilityStatus && !availabilityStatus.available ? (
                  <span className="text-rose-300 font-bold flex items-center gap-1 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                    <XCircle className="h-3 w-3 text-rose-400" /> Overlap Conflict
                  </span>
                ) : (
                  <span className="text-[#6E6E7A]">Select time to verify</span>
                )}
              </div>

              {/* Meeting Location */}
              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Meeting Location / Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meet at building concierge / unit 4B"
                  value={visitLocation}
                  onChange={(e) => setVisitLocation(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Assigned Advisor (if Owner) */}
              {isOrgOwner && orgMembers.length > 0 && (
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Assigned Advisor
                  </label>
                  <select
                    value={visitAdvisorId}
                    onChange={(e) => {
                      setVisitAdvisorId(e.target.value);
                      checkVisitAvailability(visitStartAt, visitDurationMinutes, e.target.value);
                    }}
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#F5F5F7] focus:border-emerald-500 focus:outline-none"
                  >
                    {orgMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Showing Notes <span className="text-[#6E6E7A] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Key items buyer wants to see (e.g. view, parking spot, kitchen finishes)..."
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowScheduleVisitModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedulingVisit || (availabilityStatus !== null && !availabilityStatus.available)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {schedulingVisit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Schedule Visit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reschedule Site Visit Modal ── */}
      {showRescheduleModal && selectedVisit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-600" />
                Reschedule Site Visit
              </h3>
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedVisit(null);
                }}
                className="text-[#6E6E7A] hover:text-[#9A9AA5] p-1 rounded-lg hover:bg-[#1E1E26]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRescheduleVisit} className="mt-4 space-y-4 text-xs">
              {rescheduleError && (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{rescheduleError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    New Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={rescheduleStartAt}
                    onChange={(e) => setRescheduleStartAt(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Duration *
                  </label>
                  <select
                    value={rescheduleDuration}
                    onChange={(e) => setRescheduleDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#F5F5F7] focus:border-sky-500 focus:outline-none"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>120 minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Location / Instructions
                </label>
                <input
                  type="text"
                  value={rescheduleLocation}
                  onChange={(e) => setRescheduleLocation(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setSelectedVisit(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduling}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {rescheduling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Record Visit Outcome Modal ── */}
      {showOutcomeModal && selectedVisit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Record Visit Outcome
              </h3>
              <button
                onClick={() => {
                  setShowOutcomeModal(false);
                  setSelectedVisit(null);
                }}
                className="text-[#6E6E7A] hover:text-[#9A9AA5] p-1 rounded-lg hover:bg-[#1E1E26]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteVisit} className="mt-4 space-y-4 text-xs">
              <p className="text-[#9A9AA5] text-[11px]">
                Record the client’s impressions, interest level, and next steps for this showing.
              </p>

              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Outcome Notes *
                </label>
                <textarea
                  required
                  rows={4}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="e.g. Buyer loved the master bedroom and view. Considering submitting an offer. Requested draft contract..."
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setShowOutcomeModal(false);
                    setSelectedVisit(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completingVisit}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {completingVisit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Mark Visit Completed
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Cancel Visit Modal ── */}
      {showCancelVisitModal && selectedVisit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/[0.08] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-600" />
                Cancel Site Visit
              </h3>
              <button
                onClick={() => {
                  setShowCancelVisitModal(false);
                  setSelectedVisit(null);
                }}
                className="text-[#6E6E7A] hover:text-[#9A9AA5] p-1 rounded-lg hover:bg-[#1E1E26]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCancelVisit} className="mt-4 space-y-4 text-xs">
              <p className="text-[#9A9AA5] text-[11px]">
                Are you sure you want to cancel this visit? This will release the advisor slot and cancel any linked task.
              </p>

              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows={3}
                  value={cancelVisitReason}
                  onChange={(e) => setCancelVisitReason(e.target.value)}
                  placeholder="e.g. Buyer rescheduled for next weekend / Seller unable to provide access..."
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelVisitModal(false);
                    setSelectedVisit(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancellingVisit}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {cancellingVisit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Phase 3B: Lead-to-Deal Conversion Modal ── */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[#141418] p-6 shadow-2xl border border-white/[0.08] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {convertSuccess ? 'Deal Created Successfully' : 'Convert Lead to Deal'}
                  </h3>
                  <p className="text-xs text-[#9A9AA5]">
                    {convertSuccess
                      ? 'Deal and contingency pipeline initialized'
                      : 'Create an active contract deal and link contingency management'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowConvertModal(false);
                  setConvertSuccess(null);
                  setConvertError(null);
                }}
                className="text-[#6E6E7A] hover:text-[#9A9AA5] p-1 rounded-lg hover:bg-[#1E1E26]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {convertSuccess ? (
              <div className="mt-5 space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Deal #{convertSuccess.deal.id.slice(0, 8)} Created
                  </div>
                  <p className="text-xs text-emerald-300/90 mb-3">
                    Lead <span className="font-semibold text-white">{lead?.fullName}</span> has been converted to an active deal.
                  </p>

                  <div className="bg-[#181820] rounded-lg p-3 space-y-1.5 border border-emerald-500/20 text-xs text-[#D1D1DB]">
                    <div className="flex justify-between">
                      <span className="text-[#9A9AA5]">Property Address:</span>
                      <span className="font-semibold">{convertSuccess.deal.propertyAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9A9AA5]">Status:</span>
                      <span className="font-semibold text-emerald-400">{convertSuccess.deal.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9A9AA5]">Contingency Pipeline:</span>
                      <span className="font-semibold text-[#C9A961]">
                        {convertSuccess.contingencyInitialization?.status || 'PENDING_DOCUMENT_UPLOAD'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#181820] rounded-xl border border-white/[0.08] text-[#9A9AA5] text-xs">
                  <div className="flex items-center gap-2 font-semibold text-[#F5F5F7] mb-1">
                    <ShieldCheck className="h-4 w-4 text-[#C9A961]" />
                    Next Step: Upload Contract Document
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Contingency notification settings are configured. Upload the executed purchase agreement PDF on the deal page to automatically extract binding contingency deadlines.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConvertModal(false);
                      setConvertSuccess(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#D1D1DB] hover:bg-[#181820]"
                  >
                    Stay on Lead
                  </button>
                  <Link
                    to={`/deals/${convertSuccess.deal.id}`}
                    className="btn-stripe-primary text-xs px-4 py-2 flex items-center gap-1.5"
                  >
                    Go to Deal
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConvertToDeal} className="mt-4 space-y-4 text-xs">
                {/* Lead Summary Info */}
                <div className="p-3 rounded-xl bg-[#181820] border border-white/[0.08]">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-[#F5F5F7]">{lead?.fullName}</span>
                    <Badge variant={lead?.status === 'QUALIFIED' || lead?.status === 'PROPOSAL' ? 'success' : 'warning'}>
                      Stage: {lead?.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-[#9A9AA5] flex gap-4">
                    {lead?.email && <span>{lead.email}</span>}
                    {lead?.phone && <span>{lead.phone}</span>}
                  </div>
                </div>

                {/* Qualification Guidance */}
                {['NEW', 'CONTACTED'].includes(lead?.status || '') ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Early Stage Lead:</span> This lead is in stage{' '}
                      <span className="font-bold">{lead?.status}</span>. Converting prior to full qualification requires an explicit override reason.
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Lead stage qualifies for deal conversion under standard policy.</span>
                  </div>
                )}

                {/* Error Banner */}
                {convertError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{convertError}</span>
                  </div>
                )}

                {/* Property Linking Option */}
                {allProperties.length > 0 && (
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">
                      Link Existing Property (Optional)
                    </label>
                    <select
                      value={convertPropertyId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        setConvertPropertyId(pid);
                        if (pid) {
                          const prop = allProperties.find((p) => p.id === pid);
                          if (prop) {
                            setConvertAddress(`${prop.address}, ${prop.city || ''} ${prop.state || ''}`.trim());
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                    >
                      <option value="">-- None (Manual Address) --</option>
                      {allProperties.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.status === 'SOLD' || p.status === 'OFF_MARKET'}>
                          {p.address} {p.city ? `(${p.city})` : ''} - {p.status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Mandatory Property Address */}
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Property Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={convertAddress}
                    onChange={(e) => setConvertAddress(e.target.value)}
                    placeholder="e.g. 742 Evergreen Terrace, Springfield, OR"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] placeholder:text-[#6E6E7A] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
                </div>

                {/* Buyer & Seller Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">Buyer Name</label>
                    <input
                      type="text"
                      value={convertBuyerName}
                      onChange={(e) => setConvertBuyerName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] placeholder:text-[#6E6E7A] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">Seller Name (Optional)</label>
                    <input
                      type="text"
                      value={convertSellerName}
                      onChange={(e) => setConvertSellerName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] placeholder:text-[#6E6E7A] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Acceptance Date & Timezone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">
                      Offer Acceptance Date
                    </label>
                    <input
                      type="datetime-local"
                      value={convertAcceptanceDate}
                      onChange={(e) => setConvertAcceptanceDate(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">Timezone</label>
                    <select
                      value={convertTimezone}
                      onChange={(e) => setConvertTimezone(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-[#181820] text-[#F5F5F7] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                    >
                      <option value="America/New_York">Eastern (America/New_York)</option>
                      <option value="America/Chicago">Central (America/Chicago)</option>
                      <option value="America/Denver">Mountain (America/Denver)</option>
                      <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
                    </select>
                  </div>
                </div>

                {/* Early Stage Override */}
                {['NEW', 'CONTACTED'].includes(lead?.status || '') && (
                  <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/25 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={eligibilityOverride}
                        onChange={(e) => setEligibilityOverride(e.target.checked)}
                        className="rounded border-amber-500/40 accent-amber-500"
                      />
                      <span className="font-semibold text-amber-300">
                        Confirm eligibility override for this lead
                      </span>
                    </label>

                    {eligibilityOverride && (
                      <div>
                        <label className="block font-semibold text-amber-300 mb-1">
                          Override Justification <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="e.g. Buyer submitted verified cash offer directly via private negotiation..."
                          className="w-full rounded-lg border border-amber-500/40 bg-[#181820] text-[#F5F5F7] px-2.5 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Form Footer */}
                <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConvertModal(false);
                      setConvertError(null);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={converting}
                    className="btn-stripe-primary text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {converting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <Briefcase className="h-3.5 w-3.5" />
                        Convert to Deal
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
