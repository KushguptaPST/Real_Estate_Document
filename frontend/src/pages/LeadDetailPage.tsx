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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
          badgeClass: 'bg-indigo-50 text-indigo-700 border-[#C9A961]/30',
          dotClass: 'bg-indigo-50 border-indigo-500 text-[#C9A961]',
          icon: PhoneCall,
        };
      case 'TASKS':
        return {
          label: 'Task',
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
          dotClass: 'bg-sky-50 border-sky-500 text-sky-600',
          icon: CheckSquare,
        };
      case 'VISITS':
        return {
          label: 'Site Visit',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dotClass: 'bg-emerald-50 border-emerald-500 text-emerald-600',
          icon: Building2,
        };
      case 'OWNERSHIP':
        return {
          label: 'Ownership',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          dotClass: 'bg-amber-50 border-amber-500 text-amber-600',
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
        return { label: 'Connected', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'CALLBACK_REQUESTED':
        return { label: 'Callback Requested', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'VOICEMAIL':
        return { label: 'Left Voicemail', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'NO_ANSWER':
        return { label: 'No Answer', bg: 'bg-[#1E1E26] text-[#D1D1DB] border-white/[0.08]' };
      case 'BUSY':
        return { label: 'Line Busy', bg: 'bg-[#1E1E26] text-[#D1D1DB] border-white/[0.08]' };
      case 'WRONG_NUMBER':
        return { label: 'Wrong Number', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
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
        return { label: 'Call', icon: PhoneCall, bg: 'bg-indigo-50 text-indigo-700 border-[#C9A961]/30' };
      case 'MESSAGE':
        return { label: 'Message', icon: MessageSquare, bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'SITE_VISIT':
        return { label: 'Site Visit', icon: Building2, bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'SEND_DETAILS':
        return { label: 'Send Details', icon: Send, bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'DOCUMENT_FOLLOW_UP':
        return { label: 'Doc Follow-Up', icon: FileCheck, bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'OTHER':
      default:
        return { label: 'Other', icon: CheckSquare, bg: 'bg-[#1E1E26] text-[#D1D1DB] border-white/[0.08]' };
    }
  }

  function getTaskPriorityBadge(priority: string) {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'LOW':
      default:
        return 'bg-[#1E1E26] text-[#9A9AA5] border-white/[0.08]';
    }
  }

  function getSiteVisitStatusBadge(status: SiteVisitStatus) {
    switch (status) {
      case 'SCHEDULED':
        return { label: 'Scheduled', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: 'bg-[#1E1E26] text-[#9A9AA5] border-white/[0.08]' };
      case 'NO_SHOW':
        return { label: 'No Show', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
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
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-center text-rose-700">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
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
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500 text-white">
            {lead.status}
          </span>
          <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-200">
            {lead.priority} Priority
          </span>
        </div>
      </div>

      {/* ── Action Feedback Banner ── */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : actionFeedback.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' && <Check className="h-4 w-4 text-emerald-600" />}
            {actionFeedback.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
            {actionFeedback.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-600" />}
            <span className="font-medium">{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-bold hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Stagnant Inactivity Warning ── */}
      {lead.isInactiveWarning && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <div>
              <span className="font-bold">Attention — Inactivity Warning:</span> No qualifying advisor activity has been recorded on this lead for{' '}
              <span className="font-extrabold">{lead.daysSinceLastActivity} days</span>. Owner review recommended.
            </div>
          </div>
          {currentUser?.role === 'OWNER' && (
            <button
              onClick={() => setShowReassignModal(true)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors w-fit"
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
                  : 'bg-[#C9A961] text-[#0A0A0B] hover:bg-[#D4B872] font-semibold hover:bg-indigo-500'
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
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#635bff] bg-indigo-50 px-3 py-1 rounded-full border border-[#C9A961]/25">
              <UserCheck className="h-3.5 w-3.5" />
              {lead.assignedUser.name || lead.assignedUser.email}
              {lead.assignedUserId === currentUser?.id && ' (You)'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 border-dashed">
              <Inbox className="h-3.5 w-3.5" />
              Unassigned Pool
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Deal Link or Convert Button */}
          {lead.deal ? (
            <Link
              to={`/deals/${lead.deal.id}`}
              className="btn-stripe-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
              title="View converted deal"
            >
              <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
              View Deal
              <ExternalLink className="h-3 w-3 text-emerald-600" />
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
              className="btn-stripe-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Convert to Deal
            </button>
          ) : null}

          {/* Log Call button */}
          <button
            onClick={handleOpenLogCallModal}
            disabled={!canLogCall}
            title={
              !canLogCall
                ? 'Only the assigned advisor or organization owner can record calls for this lead'
                : 'Record manual phone call'
            }
            className="btn-stripe-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            Log Call
          </button>

          {/* Claim button */}
          {!lead.assignedUserId && !['WON', 'LOST'].includes(lead.status) && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="btn-stripe-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs"
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
                className="btn-stripe-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-[#D1D1DB] hover:text-rose-600"
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
              className="btn-stripe-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-[#635bff] border-[#C9A961]/30 hover:bg-indigo-50"
              title="Reassign to another advisor"
            >
              <UserCheck className="h-3.5 w-3.5" />
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

            <form onSubmit={handleSaveRequirements} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">Min Budget ($)</label>
                  <input
                    type="number"
                    placeholder="e.g. 400000"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">Max Budget ($)</label>
                  <input
                    type="number"
                    placeholder="e.g. 750000"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
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
                className="w-full rounded-xl bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
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
                          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 text-[11px]">
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
                              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-[10px] transition-colors"
                            >
                              Complete Outcome
                            </button>
                            <button
                              onClick={() => handleOpenRescheduleModal(visit)}
                              className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 font-semibold text-[10px] transition-colors"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleMarkNoShow(visit)}
                              className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-semibold text-[10px] transition-colors"
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
                <History className="h-4 w-4 text-[#635bff]" />
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
                    ? 'border-rose-200 bg-rose-50/50'
                    : (activeEscalation?.urgency || openEscalationTask?.priority) === 'HIGH'
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-[#C9A961]/25 bg-indigo-50/40'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-xl ${
                        (activeEscalation?.urgency || openEscalationTask?.priority) === 'URGENT'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
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
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : (activeEscalation?.urgency || openEscalationTask?.priority) === 'HIGH'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-indigo-100 text-indigo-800 border border-[#C9A961]/30'
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
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1">
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
                        className="text-xs font-semibold text-[#C9A961] hover:text-indigo-800 flex items-center gap-1 transition-colors"
                      >
                        {expandedBrief ? 'Hide Detailed Evidence Brief' : 'View Grounded Context & Proposals Brief'}
                      </button>

                      {expandedBrief && (
                        <div className="mt-2 p-3 bg-[#181820] rounded-xl border border-white/[0.06] space-y-2 text-xs">
                          <div>
                            <span className="font-bold text-[#D1D1DB]">Confirmed Requirements: </span>
                            <span className="text-[#9A9AA5]">
                              {activeBrief.confirmedRequirements
                                ? `Budget: $${activeBrief.confirmedRequirements.minBudget?.toLocaleString()} - $${activeBrief.confirmedRequirements.maxBudget?.toLocaleString()} | Locations: ${activeBrief.confirmedRequirements.preferredLocations?.join(', ') || 'Any'} | Beds: ${activeBrief.confirmedRequirements.minBedrooms ?? 'Any'}`
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
                          : 'bg-[#C9A961] text-[#0A0A0B] hover:bg-[#D4B872] font-semibold hover:bg-indigo-500'
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
                        className="px-2.5 py-1.5 rounded-lg bg-[#C9A961] text-[#0A0A0B] hover:bg-[#D4B872] font-semibold text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1"
                      >
                        {reviewingMessageId === latestEscalationMsg.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        <Check className="h-3 w-3" /> Approve Draft
                      </button>
                      <button
                        onClick={() => handleReviewAiMessage(latestEscalationMsg.id, 'REJECTED')}
                        disabled={reviewingMessageId === latestEscalationMsg.id}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-semibold hover:bg-rose-200 disabled:opacity-50"
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
                badge: 'bg-rose-50 text-rose-700 border-rose-200',
              },
              COMPLETED_VISIT_FOLLOW_UP: {
                label: 'Post-Walkthrough Feedback Due',
                badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              },
              VISIT_INTEREST_UNSCHEDULED: {
                label: 'Tour Interest Needs Scheduling',
                badge: 'bg-sky-50 text-sky-700 border-sky-200',
              },
              NEW_MATCHING_INVENTORY: {
                label: 'New Matching Inventory Ready',
                badge: 'bg-purple-50 text-purple-700 border-purple-200',
              },
              INACTIVE_LEAD_CHECKIN: {
                label: 'Inactive Lead Periodic Check-in',
                badge: 'bg-amber-50 text-amber-700 border-amber-200',
              },
              ADVISOR_COMMITMENT_DUE: {
                label: 'Advisor Commitment Due',
                badge: 'bg-indigo-50 text-indigo-700 border-[#C9A961]/30',
              },
            };

            const triggerConfig = rec.trigger ? triggerLabels[rec.trigger] : null;

            return (
              <div
                className={`rounded-2xl border p-4 shadow-xs transition-all ${
                  rec.shouldFollowUp
                    ? 'bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 border-[#C9A961]/30/80 ring-1 ring-indigo-500/10'
                    : 'bg-[#181820]/60 border-white/[0.08] text-[#9A9AA5]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        Follow-Up Recommendation
                        {rec.priority && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase ${
                              rec.priority === 'HIGH' || rec.priority === 'URGENT'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-[#252530] text-[#D1D1DB]'
                            }`}
                          >
                            {rec.priority}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-[#9A9AA5] font-medium">
                        Deterministic trigger analysis &amp; multi-day lead nurturing
                      </p>
                    </div>
                  </div>

                  {triggerConfig && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${triggerConfig.badge}`}
                    >
                      {triggerConfig.label}
                    </span>
                  )}
                </div>

                <div className="text-xs space-y-2 mt-2.5">
                  <div className="p-2.5 rounded-xl bg-[#181820] border border-white/[0.08]">
                    <p className="font-semibold text-[#F5F5F7]">{rec.reason}</p>
                    <p className="text-[11px] text-[#9A9AA5] mt-1">
                      <span className="font-bold text-[#C9A961]">Action: </span>
                      {rec.recommendedAction}
                    </p>
                  </div>

                  {rec.evidence && rec.evidence.length > 0 && (
                    <div className="text-[11px] text-[#9A9AA5] pl-2 border-l-2 border-indigo-300 space-y-0.5">
                      <span className="font-bold text-[#D1D1DB] block">Underlying Evidence:</span>
                      {rec.evidence.map((ev: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1">
                          <span className="text-indigo-500 font-bold">•</span>
                          <span>{ev}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#9A9AA5] pt-1">
                    <span>
                      Proposed Due:{' '}
                      <strong className="text-[#D1D1DB]">
                        {new Date(rec.suggestedDueDate).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                    {rec.alreadyPlanned && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        Task Already Open
                      </span>
                    )}
                  </div>

                  {/* Suggested Draft Content Box */}
                  {rec.suggestedDraftContent && (
                    <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-[#C9A961]/25 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-900 flex items-center gap-1">
                          <Bot className="h-3.5 w-3.5 text-[#C9A961]" />
                          Prepared Customer Draft (Pending Approval)
                        </span>
                        <span className="text-[10px] text-[#C9A961] italic">No autonomous dispatch</span>
                      </div>
                      <p className="text-[#D1D1DB] bg-[#181820] p-2 rounded-lg border border-[#C9A961]/25 italic">
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
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#C9A961] text-[#0A0A0B] hover:bg-[#D4B872] font-semibold hover:bg-indigo-500 transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
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
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleReviewAiMessage(pendingDraftMsg.id, 'APPROVED')}
                          disabled={reviewingMessageId === pendingDraftMsg.id}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1"
                        >
                          {reviewingMessageId === pendingDraftMsg.id && <Loader2 className="h-3 w-3 animate-spin" />}
                          <Check className="h-3 w-3" /> Approve Draft
                        </button>
                        <button
                          onClick={() => handleReviewAiMessage(pendingDraftMsg.id, 'REJECTED')}
                          disabled={reviewingMessageId === pendingDraftMsg.id}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-semibold hover:bg-rose-200 disabled:opacity-50"
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
                            ? 'bg-indigo-50 text-indigo-950 border border-[#C9A961]/30'
                            : 'bg-[#C9A961] text-[#0A0A0B] hover:bg-[#D4B872] font-semibold'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5 text-[10px] font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="opacity-80">{msg.senderType}</span>
                            {isAi && msg.approvalStatus === 'PENDING_APPROVAL' && (
                              <span className="text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded text-[9px]">
                                Pending Approval
                              </span>
                            )}
                            {isAi && msg.approvalStatus === 'APPROVED' && (
                              <span className="text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.2 rounded text-[9px]">
                                Approved
                              </span>
                            )}
                          </div>

                          {/* Outbound Delivery Status Badge */}
                          {!isCustomer && msg.deliveryStatus && msg.deliveryStatus !== 'NOT_APPLICABLE' && (
                            <div className="flex items-center gap-1">
                              {msg.deliveryStatus === 'QUEUED' && (
                                <span className="text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5 animate-pulse" /> Outbox Queued
                                </span>
                              )}
                              {msg.deliveryStatus === 'SENDING' && (
                                <span className="text-blue-800 bg-blue-100/90 border border-blue-300 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Sending...
                                </span>
                              )}
                              {msg.deliveryStatus === 'SENT' && (
                                <span className="text-sky-800 bg-sky-100/90 border border-sky-300 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Send className="h-2.5 w-2.5" /> Dispatched
                                </span>
                              )}
                              {msg.deliveryStatus === 'DELIVERED' && (
                                <span className="text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Delivered
                                </span>
                              )}
                              {msg.deliveryStatus === 'FAILED' && (
                                <span className="text-rose-800 bg-rose-100/90 border border-rose-300 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <AlertCircle className="h-2.5 w-2.5" /> Failed
                                </span>
                              )}
                              {msg.deliveryStatus === 'RETRY_PENDING' && (
                                <span className="text-orange-800 bg-orange-100/90 border border-orange-300 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Retry Pending
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* Delivery Failure Notice & Authorized Retry Button */}
                        {!isCustomer && msg.deliveryStatus === 'FAILED' && (
                          <div className="mt-2 pt-2 border-t border-rose-200/50 flex flex-col gap-1.5">
                            <div className="text-[10px] text-rose-800 bg-rose-50 border border-rose-200 rounded p-1.5">
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
                          <div className="mt-2 pt-2 border-t border-[#C9A961]/30/60 flex items-center gap-2">
                            <button
                              onClick={() => handleReviewAiMessage(msg.id, 'APPROVED')}
                              disabled={reviewingMessageId === msg.id}
                              className="px-2 py-1 rounded bg-[#C9A961] text-[#0A0A0B] hover:bg-[#D4B872] font-semibold text-[10px] font-bold hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1"
                            >
                              {reviewingMessageId === msg.id && <Loader2 className="h-3 w-3 animate-spin" />}
                              <Check className="h-3 w-3" /> Approve Draft
                            </button>
                            <button
                              onClick={() => handleReviewAiMessage(msg.id, 'REJECTED')}
                              disabled={reviewingMessageId === msg.id}
                              className="px-2 py-1 rounded bg-rose-100 text-rose-700 text-[10px] font-bold hover:bg-rose-200 disabled:opacity-50"
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
                className="flex-1 rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sendingAdvisorMessage || !advisorMessage.trim()}
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
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

          {/* ── Demo / Development Only: Customer Inquiry Simulation Panel ── */}
          {!import.meta.env.PROD && (
            <div className="rounded-2xl bg-amber-50/60 border border-amber-200/80 p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 uppercase tracking-wider">
                    Dev / Demo Only
                  </span>
                  <h3 className="text-xs font-bold text-amber-950">
                    Customer Inquiry Simulator
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSimulator(!showSimulator)}
                  className="text-[11px] font-medium text-amber-800 hover:text-amber-900 underline"
                >
                  {showSimulator ? 'Hide Simulator' : 'Show Simulator'}
                </button>
              </div>
              <p className="text-[11px] text-amber-800/90 leading-relaxed">
                Injects simulated customer text into the thread to test AI qualification and draft generation. This tool is disabled in production.
              </p>
              {showSimulator && (
                <form onSubmit={handleSimulateCustomerMessage} className="pt-2 flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter simulated buyer inquiry (e.g. 'Looking for 3BHK in Austin under $800k')..."
                    value={simulatedCustomerMessage}
                    onChange={(e) => setSimulatedCustomerMessage(e.target.value)}
                    className="flex-1 rounded-xl border border-amber-500/40 bg-[#181820] px-3 py-2 text-xs text-[#F5F5F7] focus:border-amber-500 focus:outline-none placeholder:text-[#6E6E7A]"
                  />
                  <button
                    type="submit"
                    disabled={sendingSimulatedMessage || !simulatedCustomerMessage.trim()}
                    className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    {sendingSimulatedMessage ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Simulate Inquiry</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── Follow-Up Tasks & Reminders Card ── */}
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ListTodo className="h-4 w-4 text-[#C9A961]" />
                  Follow-Up Tasks &amp; Reminders
                </h2>
                {tasks.some((t) => t.status === 'OPEN' && (t.isOverdue || new Date(t.dueDate).getTime() < Date.now())) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
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
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-[#635bff] border border-[#C9A961]/30 hover:bg-indigo-100 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#635bff] hover:underline"
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
                          ? 'border-rose-200 bg-rose-50/40'
                          : t.status === 'COMPLETED'
                          ? 'border-emerald-200 bg-emerald-50/20'
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertTriangle className="h-3 w-3" /> Overdue
                            </span>
                          )}
                          {t.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </span>
                          )}
                          {t.status === 'CANCELLED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-[#1E1E26] text-[#9A9AA5] border border-white/[0.08]">
                              <XCircle className="h-3 w-3" /> Cancelled
                            </span>
                          )}
                          {t.callLogId && (
                            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-indigo-50 text-indigo-700 border border-[#C9A961]/25">
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
                              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-50"
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
                              className="p-1 rounded-lg text-[#6E6E7A] hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
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
                        <div className="text-[10px] text-emerald-700 bg-emerald-50/60 px-2 py-1 rounded border border-emerald-100 flex items-center justify-between">
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

          {/* ── Phone Call History Card ── */}
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <PhoneCall className="h-4 w-4 text-[#C9A961]" />
                Phone Call History
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#9A9AA5] font-medium">
                  {callLogs.length} {callLogs.length === 1 ? 'call' : 'calls'}
                </span>
                <button
                  onClick={handleOpenLogCallModal}
                  disabled={!canLogCall}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-[#635bff] border border-[#C9A961]/30 hover:bg-indigo-100 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!canLogCall ? 'Only assigned advisor or owner can record calls' : 'Record new phone call'}
                >
                  <Phone className="h-3 w-3" />
                  + Log Call
                </button>
              </div>
            </div>

            {callLogs.length === 0 ? (
              <div className="rounded-xl bg-[#181820] p-5 text-center text-xs text-[#9A9AA5] border border-white/[0.06] space-y-2">
                <p>No phone calls recorded yet.</p>
                {canLogCall && (
                  <button
                    onClick={handleOpenLogCallModal}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#635bff] hover:underline"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    Record your first call with this lead
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {callLogs.map((c) => {
                  const badge = getOutcomeBadge(c.outcome);
                  const durationStr = formatDuration(c.durationSeconds);
                  const isInbound = c.direction === 'INBOUND';
                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl border border-white/[0.08] bg-[#181820]/60 text-xs space-y-1.5 hover:bg-[#181820] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {isInbound ? (
                            <span className="inline-flex items-center gap-1 text-teal-700 font-bold text-[11px]">
                              <PhoneIncoming className="h-3.5 w-3.5 text-teal-600" /> Inbound
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-indigo-700 font-bold text-[11px]">
                              <PhoneOutgoing className="h-3.5 w-3.5 text-[#C9A961]" /> Outbound
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#6E6E7A]">
                          {new Date(c.calledAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#9A9AA5]">
                        <span>Advisor: {c.user?.name || c.user?.email || 'Unknown'}</span>
                        {durationStr && <span className="font-medium text-[#9A9AA5]">Duration: {durationStr}</span>}
                      </div>

                      {c.notes && (
                        <p className="text-[11px] text-[#F5F5F7] bg-[#181820] p-2 rounded-lg border border-white/[0.06] whitespace-pre-wrap">
                          {c.notes}
                        </p>
                      )}

                      {c.followUpNeeded && (
                        <div className="flex items-center justify-between gap-1.5 text-[10px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-200/60">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-amber-600" />
                            <span>Follow-up Scheduled</span>
                            {c.followUpDate && (
                              <span className="text-amber-700 font-normal">
                                • Due: {new Date(c.followUpDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          {c.followUpTask ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                c.followUpTask.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : c.followUpTask.status === 'CANCELLED'
                                  ? 'bg-[#1E1E26] text-[#9A9AA5] border-white/[0.08]'
                                  : (c.followUpTask.isOverdue || new Date(c.followUpTask.dueDate).getTime() < Date.now())
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : 'bg-indigo-100 text-indigo-800 border-[#C9A961]/30'
                              }`}
                            >
                              Task: {c.followUpTask.status === 'OPEN' && (c.followUpTask.isOverdue || new Date(c.followUpTask.dueDate).getTime() < Date.now()) ? 'OVERDUE' : c.followUpTask.status}
                            </span>
                          ) : (
                            <button
                              onClick={handleOpenAddTaskModal}
                              disabled={!canManageTasks}
                              className="text-[9px] font-bold text-indigo-700 hover:underline disabled:opacity-50"
                            >
                              + Create Task
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: AI Verified Property Matches & Buyer Memory (4 Cols) ── */}
        <div className="lg:col-span-4 space-y-4">
          {/* ── Persistent Buyer Memory Panel (Phase 2E) ── */}
          <div className="rounded-2xl bg-[#141418] border border-white/[0.08] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#C9A961]" />
                Persistent Buyer Memory
              </h2>
              <div className="flex items-center gap-1.5">
                {memoryData?.memory?.eligibility?.eligibleForFollowUp ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active Lead
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Suppressed
                  </span>
                )}
                <button
                  onClick={reloadMemory}
                  disabled={loadingMemory}
                  className="p-1 rounded-lg text-[#6E6E7A] hover:text-[#C9A961] hover:bg-[#1E1E26] transition-colors"
                  title="Refresh memory"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingMemory ? 'animate-spin text-[#C9A961]' : ''}`} />
                </button>
              </div>
            </div>

            {memoryError ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {memoryError}
              </div>
            ) : !memoryData ? (
              <div className="p-6 text-center text-[#6E6E7A] text-xs">
                {loadingMemory ? 'Loading persistent buyer memory...' : 'No memory assembled.'}
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* 1. Confirmed Database Facts (Authoritative DB) */}
                <div className="p-3 rounded-xl border border-emerald-200/80 bg-emerald-50/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#F5F5F7] flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Confirmed Requirements
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Authoritative DB
                    </span>
                  </div>
                  {memoryData.memory.requirements?.confirmed ? (
                    <div className="text-[11px] text-[#D1D1DB] space-y-1 pt-1">
                      <div>
                        <span className="text-[#9A9AA5] font-medium">Budget: </span>
                        <strong>
                          ${memoryData.memory.requirements.confirmed.minBudget?.toLocaleString() ?? 'Any'} – $
                          {memoryData.memory.requirements.confirmed.maxBudget?.toLocaleString() ?? 'Any'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#9A9AA5] font-medium">Locations: </span>
                        <span>
                          {memoryData.memory.requirements.confirmed.preferredLocations?.join(', ') || 'Any preferred location'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>
                          <span className="text-[#9A9AA5] font-medium">Beds: </span>
                          {memoryData.memory.requirements.confirmed.minBedrooms ?? 'Any'}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="text-[#9A9AA5] font-medium">Type: </span>
                          {memoryData.memory.requirements.confirmed.propertyType || 'Any'}
                        </span>
                      </div>
                      {memoryData.memory.requirements.confirmed.lastConfirmedAt && (
                        <div className="text-[10px] text-[#6E6E7A] pt-0.5">
                          Confirmed: {new Date(memoryData.memory.requirements.confirmed.lastConfirmedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#6E6E7A] italic">No confirmed requirements in database yet.</p>
                  )}
                </div>

                {/* 2. Pending Proposals (Pending Approval) */}
                {memoryData.memory.requirements?.pendingProposals?.length > 0 && (
                  <div className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 text-[11px]">
                        Pending Requirement Proposals ({memoryData.memory.requirements.pendingProposals.length})
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        Pending Proposal
                      </span>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {memoryData.memory.requirements.pendingProposals.map((p: any) => (
                        <div key={p.id} className="text-[11px] bg-[#181820] p-2 rounded-lg border border-amber-500/30 space-y-0.5">
                          <p className="font-semibold text-[#F5F5F7]">{p.reason}</p>
                          <p className="text-[10px] text-[#9A9AA5] italic">"{p.sourceEvidence}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Site Visits: Confirmed vs Proposed Slots */}
                <div className="p-3 rounded-xl border border-white/[0.08] bg-[#181820]/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#F5F5F7] text-[11px]">Site Visit Pipeline</span>
                    <span className="text-[10px] text-[#9A9AA5] font-medium">
                      {memoryData.memory.siteVisits?.confirmed?.length || 0} visits recorded
                    </span>
                  </div>

                  {/* Confirmed visits */}
                  {memoryData.memory.siteVisits?.confirmed?.length > 0 ? (
                    <div className="space-y-1.5">
                      {memoryData.memory.siteVisits.confirmed.slice(0, 3).map((v: any) => (
                        <div key={v.id} className="bg-[#181820] p-2 rounded-lg border border-white/[0.08] text-[11px] flex items-center justify-between gap-1">
                          <div>
                            <span className="font-bold text-[#F5F5F7]">{v.propertyTitle}</span>
                            <div className="text-[10px] text-[#9A9AA5]">
                              {new Date(v.startAt).toLocaleDateString()} • {v.status}
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            v.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                            v.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {v.provenance === 'CONFIRMED_VISIT' ? 'CONFIRMED' : v.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#6E6E7A] italic">No scheduled or completed visits.</p>
                  )}

                  {/* Proposed visits */}
                  {memoryData.memory.siteVisits?.pendingProposals?.length > 0 && (
                    <div className="pt-1 border-t border-white/[0.08]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-indigo-700">Proposed Tour Slots</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-[#C9A961]/30">
                          PROPOSED (NOT BOOKED)
                        </span>
                      </div>
                      {memoryData.memory.siteVisits.pendingProposals.map((pv: any, i: number) => (
                        <div key={i} className="text-[10px] text-[#9A9AA5] bg-indigo-50/40 p-1.5 rounded border border-[#C9A961]/25">
                          Proposed slot: {pv.proposedSlot} ({pv.status})
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Conversation State & Questions */}
                <div className="p-3 rounded-xl border border-white/[0.08] bg-[#181820]/60 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#F5F5F7] text-[11px]">Conversation Health</span>
                    <span className="text-[10px] text-[#9A9AA5] font-medium">
                      {memoryData.memory.conversationState?.state || 'IDLE'}
                    </span>
                  </div>

                  {memoryData.memory.conversationState?.unansweredQuestion?.isUnanswered ? (
                    <div className="bg-rose-50 p-2 rounded-lg border border-rose-200 text-[11px] text-rose-800 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Unanswered Question</span>
                        <span className="text-[10px] font-bold text-rose-600">
                          {memoryData.memory.conversationState.unansweredQuestion.hoursPending}h pending
                        </span>
                      </div>
                      <p className="italic text-[10px]">
                        "{memoryData.memory.conversationState.unansweredQuestion.content}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#9A9AA5]">
                      Last buyer activity:{' '}
                      {memoryData.memory.conversationState?.lastActivityAt
                        ? new Date(memoryData.memory.conversationState.lastActivityAt).toLocaleDateString()
                        : 'No activity recorded'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
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
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {Math.round(m.matchScore * 100)}% Match
                      </span>
                    </div>

                    <div className="text-[#D1D1DB] font-semibold flex items-center gap-3 text-[11px]">
                      <span>${m.property.price.toLocaleString()}</span>
                      <span>•</span>
                      <span>{m.property.bedrooms} Beds / {m.property.bathrooms} Baths</span>
                    </div>

                    {/* ── Verified Match Reasons ── */}
                    <div className="text-[11px] text-[#9A9AA5] bg-[#181820] p-2 rounded-lg border border-white/[0.06] space-y-1">
                      <p className="font-bold text-[#F5F5F7] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Match Breakdown:
                      </p>
                      <p className="whitespace-pre-wrap text-[10.5px] leading-relaxed">{m.matchReason}</p>
                    </div>

                    {/* ── Failed Soft Criteria Tags ── */}
                    {m.failedCriteria?.length > 0 && (
                      <div className="text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded-md border border-amber-500/30">
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
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-[#C9A961]/30">
                {timelineTotal} {timelineTotal === 1 ? 'event' : 'events'}
              </span>
            </h2>
            <p className="text-xs text-[#9A9AA5] mt-0.5">
              Canonical chronological history across lead lifecycle, calls, follow-up tasks, site visits, and assignments.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 bg-[#1E1E26] p-1 rounded-xl text-xs font-semibold">
              {(
                [
                  { id: 'ALL', label: 'All Activity' },
                  { id: 'CALLS', label: 'Calls' },
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
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600" />
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

      {/* ── Log Phone Call Modal ── */}
      {showLogCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a2540]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#141418] p-5 border border-white/[0.12] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-[#635bff]" />
                Record Phone Call Log
              </h3>
              <button
                type="button"
                onClick={() => setShowLogCallModal(false)}
                className="text-[#6E6E7A] hover:text-[#D1D1DB] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#9A9AA5]">
              Record manual phone call details with <span className="font-semibold text-[#F5F5F7]">{lead.fullName}</span>. Track outcomes, discussion context, and follow-up requirements.
            </p>

            {/* Error Banner */}
            {callFormError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="font-medium">{callFormError}</div>
              </div>
            )}

            <form onSubmit={handleConfirmLogCall} className="space-y-3.5 text-xs">
              {/* Call Direction */}
              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1.5">
                  Call Direction *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCallDirection('OUTBOUND')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      callDirection === 'OUTBOUND'
                        ? 'border-[#635bff] bg-indigo-50/70 text-[#635bff]'
                        : 'border-white/[0.08] bg-[#181820] text-[#D1D1DB] hover:bg-[#1E1E26]'
                    }`}
                  >
                    <PhoneOutgoing className="h-3.5 w-3.5" />
                    Outbound Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setCallDirection('INBOUND')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      callDirection === 'INBOUND'
                        ? 'border-teal-500 bg-teal-50/70 text-teal-700'
                        : 'border-white/[0.08] bg-[#181820] text-[#D1D1DB] hover:bg-[#1E1E26]'
                    }`}
                  >
                    <PhoneIncoming className="h-3.5 w-3.5" />
                    Inbound Call
                  </button>
                </div>
              </div>

              {/* Call Outcome */}
              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Call Outcome *
                </label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value as CallOutcome)}
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                >
                  <option value="CONNECTED">Connected (Spoke with Lead)</option>
                  <option value="CALLBACK_REQUESTED">Callback Requested</option>
                  <option value="VOICEMAIL">Left Voicemail</option>
                  <option value="NO_ANSWER">No Answer</option>
                  <option value="BUSY">Line Busy</option>
                  <option value="WRONG_NUMBER">Wrong Number</option>
                  <option value="OTHER">Other (Notes Required)</option>
                </select>
              </div>

              {/* Date & Time + Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Call Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={callTimestamp}
                    onChange={(e) => setCallTimestamp(e.target.value)}
                    max={getLocalIsoString(new Date(Date.now() + 5 * 60 * 1000))}
                    required
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#D1D1DB] mb-1">
                    Duration in Seconds <span className="text-[#6E6E7A] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 180 (for 3m)"
                    value={callDurationSeconds}
                    onChange={(e) => setCallDurationSeconds(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                  />
                </div>
              </div>

              {/* Call Notes */}
              <div>
                <label className="block font-semibold text-[#D1D1DB] mb-1">
                  Call Notes{' '}
                  {callOutcome === 'OTHER' ? (
                    <span className="text-rose-600 font-bold">* (Required for "Other")</span>
                  ) : (
                    <span className="text-[#6E6E7A] font-normal">(Optional)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder={
                    callOutcome === 'OTHER'
                      ? 'Detailed notes required to explain the "Other" outcome...'
                      : 'Discussion points, customer sentiment, budget updates, next steps...'
                  }
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                />
              </div>

              {/* Follow-up Section */}
              <div className="p-3 rounded-xl border border-white/[0.08] bg-[#181820]/60 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#F5F5F7]">
                  <input
                    type="checkbox"
                    checked={callFollowUpNeeded}
                    onChange={(e) => setCallFollowUpNeeded(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#635bff] focus:ring-indigo-500"
                  />
                  <span>Follow-up required for this lead</span>
                </label>

                {callFollowUpNeeded && (
                  <div className="pt-2 border-t border-white/[0.06]">
                    <label className="block font-semibold text-[#D1D1DB] mb-1">
                      Follow-up Due Date &amp; Time <span className="text-[#6E6E7A] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={callFollowUpDate}
                      onChange={(e) => setCallFollowUpDate(e.target.value)}
                      min={getLocalIsoString()}
                      className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs bg-[#181820] text-[#F5F5F7] focus:border-[#C9A961] focus:outline-none"
                    />
                    <p className="text-[10px] text-[#9A9AA5] mt-1">Must be set to a future date and time.</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowLogCallModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-white/[0.08] text-xs font-semibold text-[#9A9AA5] hover:bg-[#181820]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingCall}
                  className="px-3.5 py-1.5 rounded-xl bg-[#635bff] text-white text-xs font-bold hover:bg-[#5247db] flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loggingCall && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Call Log
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
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
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
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
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
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
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
                  className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
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
                  className="px-3.5 py-1.5 rounded-xl bg-[#635bff] text-white text-xs font-bold hover:bg-[#5247db] flex items-center gap-1.5 disabled:opacity-50"
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
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
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
                      {p.title} (${p.price.toLocaleString()} • {p.city})
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
                  <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Slot Available
                  </span>
                ) : availabilityStatus && !availabilityStatus.available ? (
                  <span className="text-rose-700 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <XCircle className="h-3 w-3 text-rose-600" /> Overlap Conflict
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
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
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
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Deal #{convertSuccess.deal.id.slice(0, 8)} Created
                  </div>
                  <p className="text-xs text-emerald-700 mb-3">
                    Lead <span className="font-semibold">{lead?.fullName}</span> has been converted to an active deal.
                  </p>

                  <div className="bg-[#181820] rounded-lg p-3 space-y-1.5 border border-emerald-100 text-xs text-[#D1D1DB]">
                    <div className="flex justify-between">
                      <span className="text-[#9A9AA5]">Property Address:</span>
                      <span className="font-semibold">{convertSuccess.deal.propertyAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9A9AA5]">Status:</span>
                      <span className="font-semibold text-emerald-700">{convertSuccess.deal.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#9A9AA5]">Contingency Pipeline:</span>
                      <span className="font-semibold text-indigo-700">
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
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5"
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
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Early Stage Lead:</span> This lead is in stage{' '}
                      <span className="font-bold">{lead?.status}</span>. Converting prior to full qualification requires an explicit override reason.
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Lead stage qualifies for deal conversion under standard policy.</span>
                  </div>
                )}

                {/* Error Banner */}
                {convertError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
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
                      className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
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
                    className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
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
                      className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">Seller Name (Optional)</label>
                    <input
                      type="text"
                      value={convertSellerName}
                      onChange={(e) => setConvertSellerName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
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
                      className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#D1D1DB] mb-1">Timezone</label>
                    <select
                      value={convertTimezone}
                      onChange={(e) => setConvertTimezone(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] px-3 py-2 text-xs focus:border-[#C9A961] focus:outline-none"
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
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={eligibilityOverride}
                        onChange={(e) => setEligibilityOverride(e.target.checked)}
                        className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="font-semibold text-amber-900">
                        Confirm eligibility override for this lead
                      </span>
                    </label>

                    {eligibilityOverride && (
                      <div>
                        <label className="block font-semibold text-amber-900 mb-1">
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
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
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
