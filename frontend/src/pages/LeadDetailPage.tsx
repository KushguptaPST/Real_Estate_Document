import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { leadsApi, conversationsApi, propertiesApi, organizationApi, siteVisitsApi, voiceApi } from '@/services/api';
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
  Mic,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { StatutoryDatePicker } from '@/components/ui/StatutoryDatePicker';
import { useToast } from '@/context/ToastContext';
import { formatIndianPrice, formatIndianPriceFull } from '@/utils/currency';
import { VoiceNotePlayer } from '@/components/VoiceNotePlayer';

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [lead, setLead] = useState<Lead | null>(null);
  const [thread, setThread] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [noShowConfirmVisit, setNoShowConfirmVisit] = useState<SiteVisit | null>(null);
  const [recordingNoShow, setRecordingNoShow] = useState(false);
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

  // Autonomous AI Voice & Test Dialer States
  const [showTestCallModal, setShowTestCallModal] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testingCall, setTestingCall] = useState(false);
  const [dispatchingCall, setDispatchingCall] = useState(false);
  const [activeCallSession, setActiveCallSession] = useState<{ callUuid?: string; isSimulated?: boolean } | null>(null);
  const [voiceNoteMessageIds, setVoiceNoteMessageIds] = useState<Record<string, boolean>>({});

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

  // ── Scroll Lock & Modal Escape Key Architecture (Eliminates Blank Shadows) ──
  const isAnyModalActive = Boolean(
    showConvertModal ||
    showScheduleVisitModal ||
    showRescheduleModal ||
    showOutcomeModal ||
    showCancelVisitModal ||
    showReleaseModal ||
    showReassignModal ||
    showAddTaskModal ||
    showTestCallModal ||
    showLogCallModal ||
    noShowConfirmVisit
  );

  useEffect(() => {
    if (isAnyModalActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalActive]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isAnyModalActive) {
        setShowConvertModal(false);
        setShowScheduleVisitModal(false);
        setShowRescheduleModal(false);
        setShowOutcomeModal(false);
        setShowCancelVisitModal(false);
        setShowReleaseModal(false);
        setShowReassignModal(false);
        setShowAddTaskModal(false);
        setShowTestCallModal(false);
        setShowLogCallModal(false);
        setNoShowConfirmVisit(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyModalActive]);

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
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-50 border-emerald-600 text-emerald-700',
          icon: PhoneCall,
        };
      case 'TASKS':
        return {
          label: 'Task',
          badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
          dotClass: 'bg-sky-50 border-sky-500 text-sky-700',
          icon: CheckSquare,
        };
      case 'VISITS':
        return {
          label: 'Site Visit',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dotClass: 'bg-emerald-50 border-emerald-500 text-emerald-700',
          icon: Building2,
        };
      case 'OWNERSHIP':
        return {
          label: 'Ownership',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          dotClass: 'bg-amber-50 border-amber-500 text-amber-700',
          icon: UserCheck,
        };
      default:
        return {
          label: 'Activity',
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
          dotClass: 'bg-slate-50 border-slate-500 text-slate-500',
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

  async function handleTriggerOutboundCall() {
    if (!lead?.phone) {
      setActionFeedback({
        type: 'warning',
        text: 'Lead does not have a phone number specified. Please add a phone number first.',
      });
      return;
    }
    try {
      setDispatchingCall(true);
      const res = await voiceApi.dispatchOutboundCall({
        leadId: lead.id,
        phone: lead.phone,
      });
      if (res.success) {
        setActiveCallSession({ callUuid: res.callUuid, isSimulated: res.isSimulated });
        setActionFeedback({
          type: 'success',
          text: res.isSimulated
            ? `[Dev Simulation] Autonomous outbound call dispatched to ${lead.phone}. Stream session initialized.`
            : `Live call placed via Plivo to ${lead.phone} (Call UUID: ${res.callUuid}). Audio WebSocket connected.`,
        });
        await loadLeadData();
      } else {
        setActionFeedback({
          type: 'error',
          text: res.error || 'Failed to dispatch outbound call',
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to trigger outbound call',
      });
    } finally {
      setDispatchingCall(false);
    }
  }

  async function handleTriggerTestCall(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhoneNumber.trim()) return;
    try {
      setTestingCall(true);
      const res = await voiceApi.triggerTestCall(testPhoneNumber.trim());
      if (res.success) {
        setShowTestCallModal(false);
        setActiveCallSession({ callUuid: res.callUuid, isSimulated: res.isSimulated });
        setActionFeedback({
          type: 'success',
          text: res.isSimulated
            ? `[Dev Simulation] Test dialer triggered for ${testPhoneNumber}. Check backend logs for duplex stream.`
            : `Call initiated! Your phone (${testPhoneNumber}) will ring in ~4 seconds. Pick up to test the AI voice agent.`,
        });
        await loadLeadData();
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        text: err.message || 'Failed to trigger test call',
      });
    } finally {
      setTestingCall(false);
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
        return { label: 'Connected', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'CALLBACK_REQUESTED':
        return { label: 'Callback Requested', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'VOICEMAIL':
        return { label: 'Left Voicemail', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'NO_ANSWER':
        return { label: 'No Answer', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'BUSY':
        return { label: 'Line Busy', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'WRONG_NUMBER':
        return { label: 'Wrong Number', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'OTHER':
      default:
        return { label: 'Other', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
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
        return { label: 'Call', icon: PhoneCall, bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'MESSAGE':
        return { label: 'Message', icon: MessageSquare, bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'SITE_VISIT':
        return { label: 'Property Tour', icon: Building2, bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'SEND_DETAILS':
        return { label: 'Send Details', icon: Send, bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'DOCUMENT_FOLLOW_UP':
        return { label: 'Doc Follow-Up', icon: FileCheck, bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'OTHER':
      default:
        return { label: 'Other', icon: CheckSquare, bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  }

  function getTaskPriorityBadge(priority: string) {
    switch (priority) {
      case 'URGENT':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  function getSiteVisitStatusBadge(status: SiteVisitStatus) {
    switch (status) {
      case 'SCHEDULED':
        return { label: 'Scheduled', bg: 'bg-sky-50 text-sky-800 border-sky-200' };
      case 'COMPLETED':
        return { label: 'Completed', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'CANCELLED':
        return { label: 'Cancelled', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
      case 'NO_SHOW':
        return { label: 'No Show', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
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
      toast.success('Site visit completed successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete visit');
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
      toast.success('Site visit cancelled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel visit');
    } finally {
      setCancellingVisit(false);
    }
  }

  function handleMarkNoShow(visit: SiteVisit) {
    setNoShowConfirmVisit(visit);
  }

  async function handleConfirmNoShow() {
    if (!noShowConfirmVisit) return;
    try {
      setRecordingNoShow(true);
      await siteVisitsApi.markNoShow(noShowConfirmVisit.id);
      setNoShowConfirmVisit(null);
      await loadLeadData();
      toast.warning('Site visit marked as No-Show');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record no-show');
    } finally {
      setRecordingNoShow(false);
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
      toast.success('Buyer requirements updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update requirements');
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
      toast.success('Advisor message sent');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send advisor message');
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
      toast.info('Simulated customer inquiry dispatched');
    } catch (err: any) {
      toast.error(err.message || 'Failed to simulate customer message');
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
      toast.info(nextState ? 'Human takeover active (AI auto-replies paused)' : 'AI Autonomous mode resumed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle human takeover');
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
      toast.info(nextState ? 'Auto-Pilot enabled' : 'Manual approval required');
    } catch (err: any) {
      toast.error(err.message || 'Failed to toggle Auto-Pilot mode');
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
      toast.success(`Draft message ${status.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to review message');
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
      toast.info('Message retry queued');
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry message dispatch');
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
      toast.success('Inventory matches refreshed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh matches');
    } finally {
      setRefreshingMatches(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-6 text-center text-rose-800">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-rose-700" />
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
    setEligibilityOverride(true);
    setOverrideReason('Advisor verified buyer offer acceptance and contingency milestones');

    // 1. Prioritize active property tour property, then matches, then first property in inventory
    const activeTourProperty = lead.siteVisits?.find((v) => v.property)?.property;
    const topMatch = matches[0]?.property;
    const fallbackProp = allProperties.length > 0 ? allProperties[0] : null;
    const targetProp = activeTourProperty || topMatch || fallbackProp;

    if (targetProp) {
      setConvertPropertyId(targetProp.id);
      const parts = [targetProp.address];
      if (targetProp.city && !targetProp.address.toLowerCase().includes(targetProp.city.toLowerCase())) {
        parts.push(targetProp.city);
      }
      if (targetProp.state && !targetProp.address.toLowerCase().includes(targetProp.state.toLowerCase())) {
        parts.push(targetProp.state);
      }
      setConvertAddress(parts.filter(Boolean).join(', '));
    } else {
      setConvertPropertyId('');
      setConvertAddress((lead as any).preferredPropertyAddress || '');
    }

    setConvertBuyerName(lead.fullName || '');
    setConvertSellerName('');
    const nowIso = new Date().toISOString().slice(0, 16);
    setConvertAcceptanceDate(nowIso);
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
    const finalReason = overrideReason.trim() || 'Advisor verified buyer offer acceptance and escrow instructions';

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
        eligibilityOverride: isEarlyStage ? true : undefined,
        overrideReason: isEarlyStage ? finalReason : undefined,
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Leads Dashboard
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <span
            className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
              lead.status === 'WON'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : lead.status === 'QUALIFIED'
                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                : lead.status === 'CONTACTED'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : lead.status === 'NEW'
                ? 'bg-sky-50 text-sky-800 border-sky-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {lead.status}
          </span>
          <span
            className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
              lead.priority === 'URGENT'
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : lead.priority === 'HIGH'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : lead.priority === 'MEDIUM'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
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
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' && <Check className="h-4 w-4 text-emerald-600" />}
            {actionFeedback.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
            {actionFeedback.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-600" />}
            <span className="font-semibold">{actionFeedback.text}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-bold hover:opacity-75 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Stagnant Inactivity Warning ── */}
      {lead.isInactiveWarning && !lead.siteVisits?.some(v => v.status === 'SCHEDULED') && (
        <div className="rounded-xl bg-amber-50 border border-amber-300/80 p-3.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 border border-amber-300/60 shrink-0">
              <Clock className="h-4 w-4 text-amber-800" />
            </div>
            <div>
              <span className="font-bold text-amber-950">Attention — Inactivity Warning:</span>{' '}
              <span className="text-amber-900">
                No qualifying advisor activity has been recorded on this lead for{' '}
                <span className="font-extrabold text-amber-950 underline decoration-amber-400 decoration-2">{lead.daysSinceLastActivity} days</span>.{' '}
                Owner review recommended.
              </span>
            </div>
          </div>
          {currentUser?.role === 'OWNER' && (
            <button
              onClick={() => setShowReassignModal(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-900 text-white hover:bg-black transition-colors w-fit shadow-xs cursor-pointer shrink-0"
            >
              Reassign Lead
            </button>
          )}
        </div>
      )}

      {/* ── Lead Title & Header ── */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{lead.fullName}</h1>
            <p className="text-xs text-slate-500">
              Source: <span className="font-semibold text-slate-700">{lead.source}</span> • Contact: {lead.email || lead.phone || 'None'}
            </p>
          </div>
        </div>

        {/* ── AI Mode & Human Takeover Controls ── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* AI Draft Mode Toggle */}
          <div className="flex flex-col gap-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="text-left">
                <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <Bot className="h-3 w-3 text-emerald-700" />
                  {thread?.autoReplyEnabled ? 'Autopilot: Instant Auto-Reply' : 'Copilot: Review Drafts First'}
                </p>
              </div>
              <button
                onClick={handleToggleAutoPilot}
                disabled={togglingAutoPilot}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                  thread?.autoReplyEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
                title="Click to switch between Instant Auto-Reply and Copilot Draft Mode"
              >
                {togglingAutoPilot && <Loader2 className="h-3 w-3 animate-spin" />}
                {thread?.autoReplyEnabled ? 'Autopilot Active' : 'Enable Autopilot'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              {thread?.autoReplyEnabled
                ? 'Conversation replies are auto-approved instantly. Database criteria changes require manual review.'
                : 'AI suggested replies are held for advisor review (Pending Approval).'}
            </p>
          </div>

          {/* Takeover Control */}
          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
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
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Advisor:</span>
          {lead.assignedUser ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
              {lead.assignedUser.name || lead.assignedUser.email}
              {lead.assignedUserId === currentUser?.id && ' (You)'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-300 border-dashed">
              <Inbox className="h-3.5 w-3.5 text-amber-700" />
              Unassigned Pool
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Deal Link or Convert Button */}
          {lead.deal ? (
            <Link
              to={`/deals/${lead.deal.id}`}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all"
              title="View converted deal"
            >
              <Briefcase className="h-3.5 w-3.5 text-emerald-700" />
              View Deal
              <ExternalLink className="h-3 w-3 text-emerald-700" />
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
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs bg-[#0A0A0A] hover:bg-black text-white border border-[#0A0A0A] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
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
                className="px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 bg-slate-50 text-slate-700 border border-slate-200 hover:text-rose-700 hover:border-rose-300 transition-all cursor-pointer"
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
              className="px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 bg-slate-50 text-slate-500 border border-slate-200 hover:text-slate-800 hover:border-slate-300 transition-all cursor-pointer"
              title="Reassign to another advisor"
            >
              <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
              Reassign Advisor
            </button>
          )}

          {/* AI Voice Agent Outbound Call Trigger */}
          <button
            onClick={handleTriggerOutboundCall}
            disabled={dispatchingCall || !lead.phone}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs bg-[#0A0A0A] hover:bg-slate-800 text-white disabled:opacity-50 transition-all cursor-pointer"
            title={lead.phone ? `Dispatch AI Voice Agent call to ${lead.phone}` : 'No phone number for this lead'}
          >
            {dispatchingCall ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PhoneCall className="h-3.5 w-3.5" />
            )}
            Call Lead (AI Voice)
          </button>

          {/* Test AI Voice Agent on My Cell Phone */}
          <button
            onClick={() => {
              setTestPhoneNumber(lead.phone || '');
              setShowTestCallModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all cursor-pointer shadow-2xs"
            title="Interactive test dialer: rings your personal cell phone to test voice latency & negotiation"
          >
            <Bot className="h-3.5 w-3.5 text-purple-600" />
            Test Voice Call
          </button>
        </div>
      </div>

      {/* ── 3-Column Layout: Requirements | Conversation | Inventory Matches ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left Column: Editable Requirements (4 Cols) ── */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-emerald-700" />
              Structured Requirements
            </h2>

            {(() => {
              const pendingReqProposals = memoryData?.memory?.requirements?.pendingProposals;
              if (!pendingReqProposals || pendingReqProposals.length === 0) return null;
              const latest = pendingReqProposals[0];
              return (
                <div className="mb-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <span className="font-bold text-amber-700 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      {pendingReqProposals.length} Proposal{pendingReqProposals.length > 1 ? 's' : ''} Ready
                    </span>
                    <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                      Apply latest criteria to this form & database
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAcceptProposal(latest)}
                    disabled={!!processingProposalId}
                    className="px-2.5 py-1 rounded-lg bg-[#0A0A0A] text-white hover:bg-slate-800 text-black font-extrabold text-[11px] shrink-0 transition-colors shadow-xs cursor-pointer flex items-center gap-1"
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
                  <label className="block font-semibold text-slate-700 mb-1">Min Budget ($ USD)</label>
                  <input
                    type="number"
                    placeholder="e.g. 750000 ($750K)"
                    value={minBudget}
                    onChange={(e) => setMinBudget(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                  />
                  {typeof minBudget === 'number' && minBudget > 0 && (
                    <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">{formatIndianPrice(minBudget)}</span>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Max Budget ($ USD)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1500000 ($1.5M)"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                  />
                  {typeof maxBudget === 'number' && maxBudget > 0 && (
                    <span className="text-[10px] text-emerald-700 font-mono mt-0.5 block">{formatIndianPrice(maxBudget)}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Preferred Locations</label>
                <input
                  type="text"
                  placeholder="Downtown, Westside"
                  value={locations}
                  onChange={(e) => setLocations(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Property Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
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
                  <label className="block font-semibold text-slate-700 mb-1">Min Bedrooms</label>
                  <input
                    type="number"
                    placeholder="e.g. 3"
                    value={minBedrooms}
                    onChange={(e) => setMinBedrooms(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Possession Timeline</label>
                <input
                  type="text"
                  placeholder="e.g. 60_DAYS or Immediate"
                  value={possessionTimeline}
                  onChange={(e) => setPossessionTimeline(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
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
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Property Site Visits
                <span className="text-[11px] text-slate-500 font-medium">
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
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
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
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                    <Building2 className="h-6 w-6 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-400">
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
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100 hover:shadow-xs transition-all text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-[11px]">
                                {startDate.toLocaleDateString([], {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                                {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {visit.property && (
                              <p className="font-semibold text-slate-800 text-[11px] flex items-center gap-1">
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
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            {visit.meetingLocation}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          <span>Advisor: {visit.assignedUser?.name || visit.assignedUser?.email || 'Assigned'}</span>
                          {visit.leadTask && (
                            <span className="text-slate-500">
                              Task: {visit.leadTask.status}
                            </span>
                          )}
                        </div>

                        {visit.outcomeNotes && (
                          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                            <span className="font-bold">Outcome: </span>
                            {visit.outcomeNotes}
                          </div>
                        )}

                        {visit.cancelReason && (
                          <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                            <span className="font-bold">Cancelled: </span>
                            {visit.cancelReason}
                          </div>
                        )}

                        {/* Action buttons if SCHEDULED */}
                        {visit.status === 'SCHEDULED' && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              onClick={() => handleOpenOutcomeModal(visit)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-bold text-[10px] transition-colors"
                            >
                              Complete Outcome
                            </button>
                            <button
                              onClick={() => handleOpenRescheduleModal(visit)}
                              className="px-2 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 font-semibold text-[10px] transition-colors"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleMarkNoShow(visit)}
                              className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 font-semibold text-[10px] transition-colors"
                            >
                              No-Show
                            </button>
                            <button
                              onClick={() => handleOpenCancelVisitModal(visit)}
                              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 font-semibold text-[10px] transition-colors ml-auto"
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
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <History className="h-4 w-4 text-emerald-700" />
                Assignment History
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {assignmentHistory.length} events
              </span>
            </h2>

            {assignmentHistory.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
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
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 text-[11px]">
                          {transitionLabel}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {item.reason && (
                        <p className="text-[11px] text-slate-500 italic">
                          "{item.reason}"
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">
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
                    ? 'border-rose-200 bg-rose-50'
                    : (activeEscalation?.urgency || openEscalationTask?.priority) === 'HIGH'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-2 rounded-xl ${
                        (activeEscalation?.urgency || openEscalationTask?.priority) === 'URGENT'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">Advisor Escalation Brief</h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            (activeEscalation?.urgency || openEscalationTask?.priority) === 'URGENT'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : (activeEscalation?.urgency || openEscalationTask?.priority) === 'HIGH'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {activeEscalation?.urgency || openEscalationTask?.priority || 'HIGH'} URGENCY
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Reason: <span className="font-semibold text-slate-700">{activeEscalation?.reason || 'HUMAN_INTERVENTION_REQUIRED'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-1.5">
                    {thread?.isHumanTakeover ? (
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" /> Takeover Active
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Awaiting Advisor
                      </span>
                    )}
                  </div>
                </div>

                {/* Trigger & Context */}
                <div className="mt-3 text-xs space-y-2">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Triggering Context
                    </span>
                    <p className="text-slate-800 font-medium whitespace-pre-wrap">
                      {activeEscalation?.explanation || openEscalationTask?.description || 'Buyer requested human advisor assistance.'}
                    </p>
                  </div>

                  {/* Recommended Next Action */}
                  {(activeEscalation?.recommendedAdvisorAction || openEscalationTask) && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1 mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Recommended Advisor Action
                      </span>
                      <p className="text-slate-800 font-medium">
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
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                      >
                        {expandedBrief ? 'Hide Detailed Evidence Brief' : 'View Grounded Context & Proposals Brief'}
                      </button>

                      {expandedBrief && (
                        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                          <div>
                            <span className="font-bold text-slate-700">Confirmed Requirements: </span>
                            <span className="text-slate-500">
                              {activeBrief.confirmedRequirements
                                ? `${activeBrief.confirmedRequirements.minBudget != null || activeBrief.confirmedRequirements.maxBudget != null ? `Budget: ${activeBrief.confirmedRequirements.minBudget ? formatIndianPrice(activeBrief.confirmedRequirements.minBudget) : '$0'} - ${activeBrief.confirmedRequirements.maxBudget ? formatIndianPrice(activeBrief.confirmedRequirements.maxBudget) : 'No max'}` : 'Budget: Flexible'} | Locations: ${activeBrief.confirmedRequirements.preferredLocations?.join(', ') || 'Any'} | Beds: ${activeBrief.confirmedRequirements.minBedrooms ?? 'Any'}`
                                : 'None confirmed yet in database'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Pending Requirement Proposals: </span>
                            <span className="text-slate-500">
                              {activeBrief.pendingRequirementProposal ? 'Requires Advisor Review (Pending Approval)' : 'None pending'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Confirmed Site Visits: </span>
                            <span className="text-slate-500">
                              {activeBrief.confirmedSiteVisits?.length > 0
                                ? activeBrief.confirmedSiteVisits.map((v: any) => `${v.propertyTitle} (${new Date(v.startTime).toLocaleDateString()})`).join(', ')
                                : 'No confirmed site visits yet'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700">Site Visit Proposals: </span>
                            <span className="text-slate-500">
                              {activeBrief.pendingSiteVisitProposal ? 'Proposed Tour Window (Pending Buyer Consent)' : 'None pending'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Controls */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
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
                        className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold hover:bg-rose-100 disabled:opacity-50"
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
                badge: 'bg-rose-50 text-rose-800 border-rose-200',
              },
              COMPLETED_VISIT_FOLLOW_UP: {
                label: 'Post-Walkthrough Feedback Due',
                badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              },
              VISIT_INTEREST_UNSCHEDULED: {
                label: 'Tour Interest Needs Scheduling',
                badge: 'bg-sky-50 text-sky-800 border-sky-200',
              },
              NEW_MATCHING_INVENTORY: {
                label: 'New Matching Inventory Ready',
                badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
              },
              INACTIVE_LEAD_CHECKIN: {
                label: 'Inactive Lead Periodic Check-in',
                badge: 'bg-amber-50 text-amber-800 border-amber-200',
              },
              ADVISOR_COMMITMENT_DUE: {
                label: 'Advisor Commitment Due',
                badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              },
            };

            const triggerConfig = rec.trigger ? triggerLabels[rec.trigger] : null;

            return (
              <div
                className={`rounded-2xl border p-5 shadow-sm transition-all relative overflow-hidden ${
                  rec.shouldFollowUp
                    ? 'bg-white border-slate-200 ring-1 ring-slate-200'
                    : 'bg-white border-slate-200 text-slate-500'
                }`}
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                      <MessageSquare className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        Follow-Up Recommendation
                        {rec.priority && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              rec.priority === 'HIGH' || rec.priority === 'URGENT'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {rec.priority}
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
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
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="font-semibold text-slate-800 leading-relaxed">{rec.reason}</p>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      <span className="font-bold text-emerald-700">Action: </span>
                      {rec.recommendedAction}
                    </p>
                  </div>

                  {rec.evidence && rec.evidence.length > 0 && (
                    <div className="text-[11px] text-slate-500 pl-3 border-l-2 border-[#C9A961]/50 space-y-1 py-0.5">
                      <span className="font-bold text-slate-700 block mb-1">Underlying Evidence:</span>
                      {rec.evidence.map((ev: string, idx: number) => {
                        const cleanEv = ev.replace(/\$undefined\s*-\s*\$undefined/, 'Flexible budget');
                        return (
                          <div key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-700 font-bold">•</span>
                            <span className="text-slate-700">{cleanEv}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>
                      Proposed Due:{' '}
                      <strong className="text-slate-800 font-mono">
                        {new Date(rec.suggestedDueDate).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                    </span>
                    {rec.alreadyPlanned && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                        Task Already Open
                      </span>
                    )}
                  </div>

                  {/* Suggested Draft Content Box */}
                  {rec.suggestedDraftContent && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Bot className="h-3.5 w-3.5 text-emerald-700" />
                          Prepared Customer Draft (Pending Approval)
                        </span>
                        <span className="text-[10px] text-emerald-700 italic font-medium">No autonomous dispatch</span>
                      </div>
                      <p className="text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200 italic text-xs leading-relaxed">
                        "{rec.suggestedDraftContent}"
                      </p>
                    </div>
                  )}

                  {/* Action Controls */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
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
                        <span className="text-[11px] text-slate-500 italic">
                          An active follow-up task is already assigned for this trigger.
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">
                          Follow-up suppressed by lead state or active engagement.
                        </span>
                      )}
                    </div>

                    {pendingDraftMsg && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReviewAiMessage(pendingDraftMsg.id, 'APPROVED')}
                          disabled={reviewingMessageId === pendingDraftMsg.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-1 transition-all cursor-pointer"
                        >
                          {reviewingMessageId === pendingDraftMsg.id && <Loader2 className="h-3 w-3 animate-spin" />}
                          <Check className="h-3 w-3" /> Approve Draft
                        </button>
                        <button
                          onClick={() => handleReviewAiMessage(pendingDraftMsg.id, 'REJECTED')}
                          disabled={reviewingMessageId === pendingDraftMsg.id}
                          className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold hover:bg-rose-100 disabled:opacity-50 transition-all cursor-pointer"
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
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col h-[360px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-emerald-700" />
                Customer Messages
              </h2>
              <span className="text-[11px] text-slate-500 font-medium">
                Channel: {lead?.externalId?.startsWith('telegram:') ? 'TELEGRAM' : thread?.channel || 'ALL'}
              </span>
            </div>

            {/* ── Messages Timeline ── */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 text-xs pr-1">
              {thread?.messages?.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
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
                            ? 'bg-slate-100 text-white'
                            : isAi
                            ? 'bg-slate-50 text-indigo-100 border border-indigo-500/30'
                            : 'bg-gradient-to-r from-[#C9A961] to-[#E5C985] text-slate-900 font-semibold'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5 text-[10px] font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="opacity-80">{msg.senderType}</span>
                            {msg.channel && (
                              <span className="text-[9px] text-slate-500 bg-white/[0.06] border border-slate-200 px-1 py-0.2 rounded font-mono">
                                {msg.channel === 'WEB_CHAT' && lead?.externalId?.startsWith('telegram:') ? 'TELEGRAM' : msg.channel}
                              </span>
                            )}
                            {isAi && msg.approvalStatus === 'PENDING_APPROVAL' && (
                              <span className="text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded text-[9px]">
                                Pending Approval
                              </span>
                            )}
                            {isAi && msg.approvalStatus === 'APPROVED' && (
                              <span className="text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded text-[9px]">
                                Approved
                              </span>
                            )}
                          </div>

                          {/* Outbound Delivery Status Badge */}
                          {!isCustomer && msg.deliveryStatus && msg.deliveryStatus !== 'NOT_APPLICABLE' && (
                            <div className="flex items-center gap-1">
                              {msg.deliveryStatus === 'QUEUED' && (
                                <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5 animate-pulse" /> Outbox Queued
                                </span>
                              )}
                              {msg.deliveryStatus === 'SENDING' && (
                                <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> Sending...
                                </span>
                              )}
                              {msg.deliveryStatus === 'SENT' && (
                                <span className="text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <Send className="h-2.5 w-2.5" /> Dispatched
                                </span>
                              )}
                              {msg.deliveryStatus === 'DELIVERED' && (
                                <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-2.5 w-2.5" /> Delivered
                                </span>
                              )}
                              {msg.deliveryStatus === 'FAILED' && (
                                <span className="text-rose-800 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <AlertCircle className="h-2.5 w-2.5" /> Failed
                                </span>
                              )}
                              {msg.deliveryStatus === 'RETRY_PENDING' && (
                                <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[9px] font-semibold inline-flex items-center gap-1">
                                  <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Retry Pending
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {/* ── Native WhatsApp Voice Memo Player (Section 3 & 7) ── */}
                        {msg.content?.trim() && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/20">
                            {voiceNoteMessageIds[msg.id] ? (
                              <VoiceNotePlayer
                                text={msg.content}
                                advisorName={currentUser?.name || 'Rahul'}
                                leadName={lead?.fullName}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setVoiceNoteMessageIds((prev) => ({ ...prev, [msg.id]: true }))
                                }
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200"
                              >
                                <Mic className="h-3 w-3" />
                                <span>Play Voice Note</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Delivery Failure Notice & Authorized Retry Button */}
                        {!isCustomer && msg.deliveryStatus === 'FAILED' && (
                          <div className="mt-2 pt-2 border-t border-rose-200 flex flex-col gap-1.5">
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
                          <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-2">
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
                              className="px-2 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold hover:bg-rose-100 disabled:opacity-50"
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
            <form onSubmit={handleSendAdvisorMessage} className="pt-3 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder={thread?.isHumanTakeover ? "Type message as Advisor..." : "Send advisor reply (will activate takeover)..."}
                value={advisorMessage}
                onChange={(e) => setAdvisorMessage(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
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

          {/* ── AI Voice Telephony & Call Cockpit Card (Section 5 & 11) ── */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                  <PhoneCall className="h-4 w-4 text-purple-600" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    Autonomous Voice Agent &amp; Calls
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Duplex streaming via Plivo &bull; Deepgram Nova-2 STT &bull; Cartesia / ElevenLabs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowLogCallModal(true)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Log a manual phone call"
                >
                  <Plus className="h-3 w-3" />
                  Log Call
                </button>
              </div>
            </div>

            {/* Quick Dialer Banner */}
            <div className="rounded-xl p-3.5 bg-gradient-to-r from-emerald-50/50 via-slate-50 to-emerald-50/30 border border-purple-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900">
                    Voice Agent: {lead.phone || 'No phone on file'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Sub-500ms real-time negotiation, property matching &amp; site visit booking over live phone.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleTriggerOutboundCall}
                  disabled={dispatchingCall || !lead.phone}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {dispatchingCall ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PhoneOutgoing className="h-3.5 w-3.5" />
                  )}
                  Call Now
                </button>
                <button
                  onClick={() => {
                    setTestPhoneNumber(lead.phone || '');
                    setShowTestCallModal(true);
                  }}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-white text-purple-700 border border-purple-300 hover:bg-purple-50 text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Test voice agent with your own mobile phone"
                >
                  <Bot className="h-3.5 w-3.5 text-purple-600" />
                  Test Sandbox
                </button>
              </div>
            </div>

            {/* Call History Stream */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                <span>Recent Calls ({callLogs.length})</span>
                {callLogs.length > 0 && (
                  <span>
                    Total Duration:{' '}
                    <strong className="text-slate-800">
                      {formatDuration(callLogs.reduce((acc, c) => acc + (c.durationSeconds || 0), 0))}
                    </strong>
                  </span>
                )}
              </div>

              {callLogs.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500 border border-slate-100 space-y-1">
                  <Phone className="h-5 w-5 mx-auto text-slate-400 mb-1" />
                  <p className="font-semibold text-slate-700">No calls recorded yet</p>
                  <p className="text-[11px]">
                    Dispatch an autonomous call or trigger the test dialer to begin live duplex voice sessions.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {callLogs.map((log) => {
                    const badge = getOutcomeBadge(log.outcome);
                    const isInbound = log.direction === 'INBOUND';
                    const DirIcon = isInbound ? PhoneIncoming : PhoneOutgoing;
                    return (
                      <div
                        key={log.id}
                        className="rounded-xl border border-slate-200/90 p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`p-1.5 rounded-lg border ${
                                isInbound
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-purple-50 text-purple-600 border-purple-200'
                              }`}
                            >
                              <DirIcon className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <span className="font-bold text-slate-900">
                                {isInbound ? 'Inbound Customer Call' : 'Outbound AI Advisor Call'}
                              </span>
                              <p className="text-[10px] text-slate-500 font-mono">
                                {new Date(log.calledAt).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {log.durationSeconds !== null && log.durationSeconds !== undefined && (
                              <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {formatDuration(log.durationSeconds)}
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </div>

                        {log.notes && (
                          <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100 mt-1 leading-relaxed">
                            {log.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Follow-Up Tasks & Reminders Card ── */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ListTodo className="h-4 w-4 text-emerald-700" />
                  Follow-Up Tasks &amp; Reminders
                </h2>
                {tasks.some((t) => t.status === 'OPEN' && (t.isOverdue || new Date(t.dueDate).getTime() < Date.now())) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 animate-pulse">
                    Overdue
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">
                  {tasks.filter((t) => t.status === 'OPEN').length} open
                </span>
                <button
                  onClick={handleOpenAddTaskModal}
                  disabled={!canManageTasks}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        ? 'bg-[#0A0A0A] text-white hover:bg-slate-800 font-semibold'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {tab === 'OPEN' ? 'Open' : tab === 'ALL' ? 'All' : tab === 'OVERDUE' ? 'Overdue' : 'Completed'} ({count})
                  </button>
                );
              })}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500 border border-slate-100 space-y-2">
                <p>No {taskTabFilter.toLowerCase()} tasks found.</p>
                {canManageTasks && taskTabFilter !== 'COMPLETED' && (
                  <button
                    onClick={handleOpenAddTaskModal}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
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
                          ? 'border-rose-200 bg-rose-50'
                          : t.status === 'COMPLETED'
                          ? 'border-emerald-200 bg-emerald-50'
                          : t.status === 'CANCELLED'
                          ? 'border-slate-200 bg-slate-50/30 opacity-75'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-50 text-rose-800 border border-rose-200">
                              <AlertTriangle className="h-3 w-3" /> Overdue
                            </span>
                          )}
                          {t.status === 'COMPLETED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </span>
                          )}
                          {t.status === 'CANCELLED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-500 border border-slate-200">
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
                              className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors flex items-center gap-1 disabled:opacity-50"
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
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
                              title="Cancel task"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className={`font-bold text-xs ${t.status === 'COMPLETED' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {t.title}
                        </h4>
                        {t.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 whitespace-pre-wrap">{t.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100/60">
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3 text-slate-400" />
                          Due: {new Date(t.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>Assignee: {t.assignedUser?.name || t.assignedUser?.email || 'Unassigned'}</span>
                      </div>

                      {t.status === 'COMPLETED' && t.completedAt && (
                        <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center justify-between">
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
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-emerald-700" />
                Verified Property Matches ({matches.length})
              </h2>
              <button
                onClick={handleRefreshMatches}
                disabled={refreshingMatches}
                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 transition-colors"
                title="Refresh matches"
              >
                <RefreshCw className={`h-4 w-4 ${refreshingMatches ? 'animate-spin text-slate-900' : ''}`} />
              </button>
            </div>

            {matches.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500 border border-slate-100">
                No inventory properties match current mandatory filters (budget &amp; bedrooms).
              </div>
            ) : (
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {matches.map((m: any) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/60 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900">{m.property.title}</h4>
                        <p className="text-[11px] text-slate-500">{m.property.address}, {m.property.city}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {Math.round(m.matchScore * 100)}% Match
                      </span>
                    </div>

                    <div className="text-slate-700 font-semibold flex items-center gap-3 text-[11px]">
                      <span title={formatIndianPriceFull(m.property.price)}>{formatIndianPrice(m.property.price)}</span>
                      <span>•</span>
                      <span>{m.property.bedrooms} Beds / {m.property.bathrooms} Baths</span>
                    </div>

                    {/* ── Verified Match Reasons ── */}
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 space-y-1">
                      <p className="font-bold text-slate-800 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-700" /> Match Breakdown:
                      </p>
                      <p className="whitespace-pre-wrap text-[10.5px] leading-relaxed">{m.matchReason}</p>
                    </div>

                    {/* ── Failed Soft Criteria Tags ── */}
                    {m.failedCriteria?.length > 0 && (
                      <div className="text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded-md border border-amber-200">
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
      <div className="mt-8 rounded-2xl bg-white border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-700" />
              Unified Activity Timeline
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {timelineTotal} {timelineTotal === 1 ? 'event' : 'events'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Canonical chronological history across lead lifecycle, follow-up tasks, site visits, and assignments.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
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
                        ? 'bg-[#0A0A0A] text-white shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-900'
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
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 transition-colors"
              title="Refresh timeline"
            >
              <RefreshCw className={`h-4 w-4 ${loadingTimeline ? 'animate-spin text-slate-900' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading / Error / Empty States */}
        {timelineError ? (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-700" />
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
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-700" />
            <p className="text-xs">Loading activity timeline...</p>
          </div>
        ) : timelineEvents.length === 0 ? (
          <div className="p-10 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
            <Clock className="h-8 w-8 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">No activity recorded for this category.</p>
            <p className="text-[11px] text-slate-400">
              Recorded phone calls, scheduled tasks, site visits, and assignment updates will appear here chronologically.
            </p>
          </div>
        ) : (
          <div className="relative pl-7 sm:pl-9 space-y-6 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {timelineEvents.map((evt) => {
              const cfg = getTimelineCategoryConfig(evt.category);
              const IconComp = cfg.icon;

              return (
                <div key={evt.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div
                    className={`absolute -left-7 sm:-left-9 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white shadow-xs ${cfg.dotClass}`}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </div>

                  {/* Timeline Event Card */}
                  <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4 hover:bg-slate-50 transition-colors space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{evt.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </span>
                        {evt.outcome && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                            {evt.outcome.startsWith('Scheduled for 20')
                              ? `Scheduled for ${new Date(evt.metadata?.startAt || evt.outcome.replace('Scheduled for ', '')).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}`
                              : evt.outcome}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
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
                      <p className="text-xs text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                        {evt.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/50 flex-wrap">
                      <span className="flex items-center gap-1 font-medium">
                        <User className="h-3 w-3 text-slate-400" />
                        Actor: {evt.actor?.name || evt.actor?.email || 'System'}
                      </span>

                      <div className="flex items-center gap-2">
                        {evt.metadata?.durationFormatted && (
                          <span className="font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Duration: {evt.metadata.durationFormatted}
                          </span>
                        )}
                        {evt.metadata?.meetingLocation && (
                          <span className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {evt.metadata.meetingLocation}
                          </span>
                        )}
                        {evt.metadata?.priority && (
                          <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
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
      {showReleaseModal && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowReleaseModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 border border-slate-200 shadow-2xl space-y-4 my-auto relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <LogOut className="h-4 w-4 text-amber-600" />
                Release Lead to Pool
              </h3>
              <button
                onClick={() => setShowReleaseModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Releasing this lead will remove the current assignment and return it to the organization's unassigned pool where other advisors can claim it.
            </p>

            <form onSubmit={handleConfirmRelease} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Release (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Workload rebalancing, out of territory"
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReleaseModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
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
        </div>,
        document.body
      )}

      {/* ── Reassign Lead Modal (Owner Only) ── */}
      {showReassignModal && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowReassignModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 border border-slate-200 shadow-2xl space-y-4 my-auto relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#635bff]" />
                Reassign Lead to Advisor
              </h3>
              <button
                onClick={() => setShowReassignModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select an advisor from your team or choose unassigned pool. Target advisor must have fewer than 25 active leads.
            </p>

            <form onSubmit={handleConfirmReassign} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Advisor *
                </label>
                <select
                  value={targetAdvisorId}
                  onChange={(e) => setTargetAdvisorId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reassignment Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Territory reassignment, performance distribution"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
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
        </div>,
        document.body
      )}



      {/* ── Add Follow-Up Task Modal ── */}
      {showAddTaskModal && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowAddTaskModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200/90 relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-emerald-700" />
                Schedule Follow-Up Task
              </h3>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4 text-xs">
              {taskFormError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-700" />
                  <span>{taskFormError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call lead to discuss 3BHK site visit options"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              {/* Task Type & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Task Type *
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as LeadTaskType)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-800 focus:border-slate-900 focus:outline-none font-medium"
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Priority *
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-800 focus:border-slate-900 focus:outline-none font-medium"
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Due Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                  />
                </div>
                {isOrgOwner && orgMembers.length > 0 ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Assigned Advisor
                    </label>
                    <select
                      value={taskAssignedUserId}
                      onChange={(e) => setTaskAssignedUserId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-800 focus:border-slate-900 focus:outline-none"
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
                    <label className="block font-semibold text-slate-700 mb-1">
                      Assignee
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentUser?.name || currentUser?.email || 'You'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-500"
                    />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description / Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Specific follow-up instructions, customer questions to answer, units to show..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
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
        </div>,
        document.body
      )}

      {/* ── Schedule Site Visit Modal ── */}
      {showScheduleVisitModal && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowScheduleVisitModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Schedule Property Site Visit
              </h3>
              <button
                onClick={() => setShowScheduleVisitModal(false)}
                className="text-slate-400 hover:text-slate-500 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleVisit} className="mt-4 space-y-4 text-xs">
              {visitFormError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-700" />
                  <span>{visitFormError}</span>
                </div>
              )}

              {/* Property Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Property <span className="text-slate-400 font-normal">(Optional)</span>
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-800 focus:border-emerald-500 focus:outline-none"
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
                  <label className="block font-semibold text-slate-700 mb-1">
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Duration *
                  </label>
                  <select
                    value={visitDurationMinutes}
                    onChange={(e) => {
                      const dur = Number(e.target.value);
                      setVisitDurationMinutes(dur);
                      checkVisitAvailability(visitStartAt, dur, visitAdvisorId);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-800 focus:border-emerald-500 focus:outline-none"
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
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                  Advisor Availability Check:
                </span>
                {checkingAvailability ? (
                  <span className="text-slate-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                  </span>
                ) : availabilityStatus?.available ? (
                  <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-700" /> Slot Available
                  </span>
                ) : availabilityStatus && !availabilityStatus.available ? (
                  <span className="text-rose-800 font-bold flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <XCircle className="h-3 w-3 text-rose-700" /> Overlap Conflict
                  </span>
                ) : (
                  <span className="text-slate-400">Select time to verify</span>
                )}
              </div>

              {/* Meeting Location */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Meeting Location / Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meet at building concierge / unit 4B"
                  value={visitLocation}
                  onChange={(e) => setVisitLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Assigned Advisor (if Owner) */}
              {isOrgOwner && orgMembers.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assigned Advisor
                  </label>
                  <select
                    value={visitAdvisorId}
                    onChange={(e) => {
                      setVisitAdvisorId(e.target.value);
                      checkVisitAvailability(visitStartAt, visitDurationMinutes, e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-800 focus:border-emerald-500 focus:outline-none"
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
                <label className="block font-semibold text-slate-700 mb-1">
                  Showing Notes <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Key items buyer wants to see (e.g. view, parking spot, kitchen finishes)..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleVisitModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
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
        </div>,
        document.body
      )}

      {/* ── Reschedule Site Visit Modal ── */}
      {showRescheduleModal && selectedVisit && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowRescheduleModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-6 relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-sky-600" />
                Reschedule Site Visit
              </h3>
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedVisit(null);
                }}
                className="text-slate-400 hover:text-slate-500 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRescheduleVisit} className="mt-4 space-y-4 text-xs">
              {rescheduleError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-700" />
                  <span>{rescheduleError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Date &amp; Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={rescheduleStartAt}
                    onChange={(e) => setRescheduleStartAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Duration *
                  </label>
                  <select
                    value={rescheduleDuration}
                    onChange={(e) => setRescheduleDuration(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-50 text-slate-800 focus:border-sky-500 focus:outline-none"
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
                <label className="block font-semibold text-slate-700 mb-1">
                  Location / Instructions
                </label>
                <input
                  type="text"
                  value={rescheduleLocation}
                  onChange={(e) => setRescheduleLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setSelectedVisit(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
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
        </div>,
        document.body
      )}

      {/* ── Record Visit Outcome Modal ── */}
      {showOutcomeModal && selectedVisit && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowOutcomeModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-6 relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Record Visit Outcome
              </h3>
              <button
                onClick={() => {
                  setShowOutcomeModal(false);
                  setSelectedVisit(null);
                }}
                className="text-slate-400 hover:text-slate-500 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteVisit} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-500 text-[11px]">
                Record the client’s impressions, interest level, and next steps for this showing.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Outcome Notes *
                </label>
                <textarea
                  required
                  rows={4}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="e.g. Buyer loved the master bedroom and view. Considering submitting an offer. Requested draft contract..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowOutcomeModal(false);
                    setSelectedVisit(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
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
        </div>,
        document.body
      )}

      {/* ── Cancel Visit Modal ── */}
      {showCancelVisitModal && selectedVisit && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowCancelVisitModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200/90 shadow-2xl p-6 relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-600" />
                Cancel Site Visit
              </h3>
              <button
                onClick={() => {
                  setShowCancelVisitModal(false);
                  setSelectedVisit(null);
                }}
                className="text-slate-400 hover:text-slate-500 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCancelVisit} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-500 text-[11px]">
                Are you sure you want to cancel this visit? This will release the advisor slot and cancel any linked task.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows={3}
                  value={cancelVisitReason}
                  onChange={(e) => setCancelVisitReason(e.target.value)}
                  placeholder="e.g. Buyer rescheduled for next weekend / Seller unable to provide access..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelVisitModal(false);
                    setSelectedVisit(null);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
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
        </div>,
        document.body
      )}

      {/* ── Phase 3B: Lead-to-Deal Conversion Modal ── */}
      {showConvertModal && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowConvertModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200/90 max-h-[90vh] overflow-y-auto my-auto relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {convertSuccess ? 'Deal Created Successfully' : 'Convert Lead to Deal'}
                  </h3>
                  <p className="text-xs text-slate-500">
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
                className="text-slate-400 hover:text-slate-500 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {convertSuccess ? (
              <div className="mt-5 space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    Deal #{convertSuccess.deal.id.slice(0, 8)} Created
                  </div>
                  <p className="text-xs text-emerald-800/90 mb-3">
                    Lead <span className="font-semibold text-emerald-950 font-bold">{lead?.fullName}</span> has been converted to an active deal.
                  </p>

                  <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 border border-emerald-200 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Property Address:</span>
                      <span className="font-semibold">{convertSuccess.deal.propertyAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status:</span>
                      <span className="font-semibold text-emerald-700">{convertSuccess.deal.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contingency Pipeline:</span>
                      <span className="font-semibold text-emerald-700">
                        {convertSuccess.contingencyInitialization?.status || 'PENDING_DOCUMENT_UPLOAD'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-800 mb-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Next Step: Upload Contract Document
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Contingency notification settings are configured. Upload the executed purchase agreement PDF on the deal page to automatically extract binding contingency deadlines.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConvertModal(false);
                      setConvertSuccess(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800">{lead?.fullName}</span>
                    <Badge variant={lead?.status === 'QUALIFIED' || lead?.status === 'PROPOSAL' ? 'success' : 'warning'}>
                      Stage: {lead?.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-500 flex gap-4">
                    {lead?.email && <span>{lead.email}</span>}
                    {lead?.phone && <span>{lead.phone}</span>}
                  </div>
                </div>

                {/* Deal Conversion Summary */}
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  <span>
                    Graduating <strong className="font-semibold text-slate-900">{lead?.fullName}</strong> into an active escrow transaction. A deal folder and contingency tracking timeline will be created.
                  </span>
                </div>

                {/* Error Banner */}
                {convertError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" />
                    <span>{convertError}</span>
                  </div>
                )}

                {/* Property Linking Option */}
                {(allProperties.length > 0 || convertPropertyId) && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Link Existing Property (Optional)
                    </label>
                    <select
                      value={convertPropertyId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        setConvertPropertyId(pid);
                        if (pid) {
                          const prop = allProperties.find((p) => p.id === pid) || (lead?.siteVisits?.find((v) => v.property?.id === pid)?.property);
                          if (prop) {
                            const parts = [prop.address];
                            if (prop.city && !prop.address.toLowerCase().includes(prop.city.toLowerCase())) {
                              parts.push(prop.city);
                            }
                            if (prop.state && !prop.address.toLowerCase().includes(prop.state.toLowerCase())) {
                              parts.push(prop.state);
                            }
                            setConvertAddress(parts.filter(Boolean).join(', '));
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                    >
                      <option value="">-- None (Manual Address) --</option>
                      {convertPropertyId && !allProperties.some((p) => p.id === convertPropertyId) && (
                        <option value={convertPropertyId}>
                          {lead?.siteVisits?.find((v) => v.property?.id === convertPropertyId)?.property?.title || 'Selected Toured Property'}
                        </option>
                      )}
                      {allProperties.map((p) => (
                        <option key={p.id} value={p.id} disabled={p.status === 'SOLD' || p.status === 'OFF_MARKET'}>
                          {p.title ? `${p.title} (${p.address})` : p.address} {p.city ? `• ${p.city}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Mandatory Property Address */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Property Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={convertAddress}
                    onChange={(e) => setConvertAddress(e.target.value)}
                    placeholder="e.g. 301 West Ave, Unit 3402, Austin, TX"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                  />
                </div>

                {/* Buyer & Seller Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Buyer Name</label>
                    <input
                      type="text"
                      value={convertBuyerName}
                      onChange={(e) => setConvertBuyerName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Seller Name (Optional)</label>
                    <input
                      type="text"
                      value={convertSellerName}
                      onChange={(e) => setConvertSellerName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Acceptance Date & Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Offer Acceptance Date (Day 0)
                    </label>
                    <StatutoryDatePicker
                      value={convertAcceptanceDate}
                      onChange={setConvertAcceptanceDate}
                      placeholder="Select Acceptance Date..."
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
                    <select
                      value={convertTimezone}
                      onChange={(e) => setConvertTimezone(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 text-xs focus:border-slate-900 focus:outline-none"
                    >
                      <option value="America/New_York">Eastern (America/New_York)</option>
                      <option value="America/Chicago">Central (America/Chicago)</option>
                      <option value="America/Denver">Mountain (America/Denver)</option>
                      <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
                    </select>
                  </div>
                </div>

                {/* Escrow Initialization Note */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                  <span>Escrow &amp; statutory contingency SLA tracking initialized automatically.</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-mono text-[11px]">50-State SLA Active</span>
                </div>

                {/* Form Footer */}
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConvertModal(false);
                      setConvertError(null);
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50"
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
        </div>,
        document.body
      )}

      {/* Styled Site Visit No-Show Confirmation Modal */}
      <ConfirmModal
        isOpen={!!noShowConfirmVisit}
        title="Confirm Site Visit No-Show"
        message={`Mark ${lead?.fullName || 'this lead'} as No-Show for the site visit on ${noShowConfirmVisit?.startAt ? new Date(noShowConfirmVisit.startAt).toLocaleDateString() : 'scheduled date'}?`}
        confirmLabel="Mark as No-Show"
        variant="warning"
        loading={recordingNoShow}
        onConfirm={handleConfirmNoShow}
        onCancel={() => setNoShowConfirmVisit(null)}
      />

      {/* ── Modal: "Call My Cell Phone Now" Test Sandbox (Section 11.4) ── */}
      {showTestCallModal && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowTestCallModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-md w-full space-y-4 relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                  <Bot className="h-5 w-5 text-purple-600" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Test AI Voice Agent</h3>
                  <p className="text-[11px] text-slate-500">
                    Live duplex streaming dialer &bull; Sub-500ms latency
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTestCallModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your mobile phone number below. Our server will initiate an outbound call via Plivo and bridge your voice directly into the Gemini real estate agent brain with sub-80ms interruption barge-in.
            </p>

            <form onSubmit={handleTriggerTestCall} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mobile Phone Number (E.164 with Country Code)
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 234-5678"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-mono text-sm px-3.5 py-2.5 focus:border-slate-900 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Defaulting to lead phone if available. You may enter any test number.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-800 space-y-1">
                <p className="font-bold flex items-center gap-1 text-slate-900">
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-600" /> Conversational Scenarios to Test:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  <li>"I'm looking for a 3-bedroom home in Austin under $1.2M."</li>
                  <li>"Can you clarify the earnest money deposit and inspection contingency deadlines?"</li>
                  <li>"Let's book a property tour for this Saturday at 11 AM."</li>
                  <li>Interrupt mid-sentence to test live speech barge-in.</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTestCallModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testingCall || !testPhoneNumber.trim()}
                  className="px-4 py-2 rounded-xl bg-[#0A0A0A] hover:bg-black text-white font-bold text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {testingCall ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Dialing Carrier...
                    </>
                  ) : (
                    <>
                      <PhoneCall className="h-3.5 w-3.5" />
                      Call My Phone Now
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal: "Log Manual Phone Call" ── */}
      {showLogCallModal && createPortal(
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowLogCallModal(false); }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-w-lg w-full space-y-4 relative my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                  <Phone className="h-5 w-5 text-emerald-700" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Manual Phone Call</h3>
                  <p className="text-[11px] text-slate-500">
                    Log an offline discussion, voicemail, or callback request
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogCallModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {callFormError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {callFormError}
              </div>
            )}

            <form onSubmit={handleConfirmLogCall} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Direction</label>
                  <select
                    value={callDirection}
                    onChange={(e) => setCallDirection(e.target.value as CallDirection)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 focus:border-slate-900 focus:outline-none"
                  >
                    <option value="OUTBOUND">Outbound (We Called Lead)</option>
                    <option value="INBOUND">Inbound (Lead Called Us)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Call Outcome</label>
                  <select
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value as CallOutcome)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 focus:border-slate-900 focus:outline-none"
                  >
                    <option value="CONNECTED">Connected &bull; Had Conversation</option>
                    <option value="CALLBACK_REQUESTED">Callback Requested</option>
                    <option value="VOICEMAIL">Left Voicemail</option>
                    <option value="NO_ANSWER">No Answer / Rang Out</option>
                    <option value="BUSY">Line Busy</option>
                    <option value="WRONG_NUMBER">Wrong Number</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Call Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={callTimestamp}
                    onChange={(e) => setCallTimestamp(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration (Seconds)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 180"
                    value={callDurationSeconds}
                    onChange={(e) => setCallDurationSeconds(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-3 py-2 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Discussion Notes / Summary</label>
                <textarea
                  rows={3}
                  placeholder="Summarize buyer requirements, discussed projects, and next steps..."
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 p-3 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={callFollowUpNeeded}
                    onChange={(e) => setCallFollowUpNeeded(e.target.checked)}
                    className="rounded text-emerald-700 focus:ring-slate-900/10"
                  />
                  <span>Schedule follow-up reminder from this call</span>
                </label>

                {callFollowUpNeeded && (
                  <div className="pt-2">
                    <label className="block text-slate-600 mb-1">Follow-Up Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={callFollowUpDate}
                      onChange={(e) => setCallFollowUpDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white text-slate-800 px-3 py-2 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLogCallModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loggingCall}
                  className="btn-stripe-primary text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loggingCall ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving Log...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Save Call Record
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
