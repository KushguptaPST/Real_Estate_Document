/**
 * Typed API client — thin fetch wrapper pointing at the Express backend.
 * All requests go through VITE_API_URL (default: http://localhost:3001/api).
 */

import type {
  Deal,
  CreateDealInput,
  Document as Doc,
  Deadline,
  ConfirmDeadlineInput,
  AuditLog,
  PaginatedResponse,
  User,
  NotificationSetting,
  UpdateNotificationSettingsInput,
  EmailLog,
  EmailPreviewRequest,
  EmailPreviewResponse,
  InboundAddressResponse,
  AssistantAnswer,
  AssistantConversation,
  SuggestedQuestionsResponse,
  DealSummaryResponse,
  IndexStatusResponse,
  Lead,
  LeadAssignmentHistory,
  LeadCallLog,
  CreateCallLogInput,
  LeadTask,
  CreateLeadTaskInput,
  UpdateLeadTaskInput,
  SiteVisit,
  ScheduleSiteVisitInput,
  RescheduleSiteVisitInput,
  TimelineResponse,
  TimelineCategory,
  ActionQueueResponse,
  ActionQueueBucket,
} from '@/types';
import { authHeaders, notifyUnauthorized } from './session';

const BASE_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001/api';

async function send(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  }).catch(() => {
    // fetch only rejects on network failure (server down, offline, CORS)
    throw new Error("We couldn't reach the server. Check your connection and try again.");
  });

  if (!res.ok) {
    if (res.status === 401) notifyUnauthorized();
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
  }

  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  getConfig: () => request<{ demoLoginEnabled: boolean }>('/auth/config'),
  signInWithGoogle: (credential: string, inviteToken?: string) =>
    request<{ token: string; user: User }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, ...(inviteToken ? { inviteToken } : {}) }),
    }),
  signInAsDemoAgent: () =>
    request<{ token: string; user: User }>('/auth/demo', {
      method: 'POST',
    }),
  me: () => request<{ user: User }>('/auth/me'),
};

// ── Deals ─────────────────────────────────────────────────────────────────────

export const dealsApi = {
  list: () => request<Deal[]>('/deals'),
  get:  (id: string) => request<Deal>(`/deals/${id}`),
  create: (data: CreateDealInput) =>
    request<Deal>('/deals', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<CreateDealInput>) =>
    request<Deal>(`/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const documentsApi = {
  list: (dealId: string) => request<Doc[]>(`/deals/${dealId}/documents`),
  upload: async (dealId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    // Do NOT set Content-Type — browser sets it with boundary automatically
    const res = await send(`/deals/${dealId}/documents`, { method: 'POST', body: form });
    return res.json();
  },
};

// ── Deadlines ─────────────────────────────────────────────────────────────────

export const deadlinesApi = {
  list: (dealId: string) => request<Deadline[]>(`/deals/${dealId}/deadlines`),
  confirm: (dealId: string, deadlineId: string, data: ConfirmDeadlineInput) =>
    request<Deadline>(`/deals/${dealId}/deadlines/${deadlineId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ── Audit ─────────────────────────────────────────────────────────────────────

export const auditApi = {
  list: (dealId: string, page = 1, limit = 50) =>
    request<PaginatedResponse<AuditLog>>(
      `/deals/${dealId}/audit?page=${page}&limit=${limit}`,
    ),
};

// ── Notifications (Email Contract) ────────────────────────────────────────────

export const notificationsApi = {
  getSettings: (dealId: string) =>
    request<NotificationSetting>(`/deals/${dealId}/notifications/settings`),
  updateSettings: (dealId: string, data: UpdateNotificationSettingsInput) =>
    request<NotificationSetting>(`/deals/${dealId}/notifications/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  sendTestEmail: (dealId: string, to: string) =>
    request<{ sent: boolean; message: string }>(`/deals/${dealId}/notifications/test`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    }),
  sendSummaryEmail: (dealId: string, to: string[]) =>
    request<{ sent: boolean; count: number }>(`/deals/${dealId}/notifications/summary`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    }),
  previewTemplate: (dealId: string, data: EmailPreviewRequest) =>
    request<EmailPreviewResponse>(`/deals/${dealId}/notifications/preview`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLogs: (dealId: string) =>
    request<EmailLog[]>(`/deals/${dealId}/notifications/log`),
  getInboundAddress: (dealId: string) =>
    request<InboundAddressResponse>(`/deals/${dealId}/notifications/inbound-address`),
};

// ── Assistant (AI Knowledge Assistant Contract) ───────────────────────────────

export const assistantApi = {
  ask: (dealId: string, data: { question: string; conversationId?: string }) =>
    request<AssistantAnswer>(`/deals/${dealId}/assistant/ask`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSuggestions: (dealId: string) =>
    request<SuggestedQuestionsResponse>(`/deals/${dealId}/assistant/suggestions`),
  getSummary: (dealId: string) =>
    request<DealSummaryResponse>(`/deals/${dealId}/assistant/summary`),
  listConversations: (dealId: string) =>
    request<AssistantConversation[]>(`/deals/${dealId}/assistant/conversations`),
  getConversation: (dealId: string, conversationId: string) =>
    request<AssistantConversation>(`/deals/${dealId}/assistant/conversations/${conversationId}`),
  reindex: (dealId: string) =>
    request<{ message: string; documentCount: number }>(`/deals/${dealId}/assistant/reindex`, {
      method: 'POST',
    }),
  getIndexStatus: (dealId: string) =>
    request<IndexStatusResponse>(`/deals/${dealId}/assistant/index-status`),
};

// ── Feature 1: AI Leads API ───────────────────────────────────────────────────

export const leadsApi = {
  list: (params?: {
    search?: string;
    status?: string;
    priority?: string;
    assignedUserId?: string | null;
    unassigned?: boolean;
    unassignedOnly?: boolean;
  }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
          cleanParams[k] = String(v);
        }
      });
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<Lead[]>(`/leads${query ? `?${query}` : ''}`);
  },
  get: (id: string) => request<Lead>(`/leads/${id}`),
  create: (data: { fullName: string; email?: string; phone?: string; enquiryText?: string; source?: string }) =>
    request<Lead>('/leads', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) =>
    request<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  claim: (id: string, reason?: string) =>
    request<Lead>(`/leads/${id}/claim`, { method: 'POST', body: JSON.stringify({ reason }) }),
  release: (id: string, reason?: string) =>
    request<Lead>(`/leads/${id}/release`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reassign: (id: string, targetUserId: string | null, reason?: string) =>
    request<Lead>(`/leads/${id}/reassign`, { method: 'POST', body: JSON.stringify({ targetUserId, reason }) }),
  getAssignments: (id: string) =>
    request<LeadAssignmentHistory[]>(`/leads/${id}/assignments`),
  logCall: (id: string, data: CreateCallLogInput) =>
    request<LeadCallLog>(`/leads/${id}/calls`, { method: 'POST', body: JSON.stringify(data) }),
  getCalls: (id: string, params?: { limit?: number; offset?: number }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      if (params.limit !== undefined) cleanParams.limit = String(params.limit);
      if (params.offset !== undefined) cleanParams.offset = String(params.offset);
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<LeadCallLog[]>(`/leads/${id}/calls${query ? `?${query}` : ''}`);
  },
  getTasks: (id: string, status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<LeadTask[]>(`/leads/${id}/tasks${query}`);
  },
  createTask: (id: string, data: CreateLeadTaskInput) =>
    request<LeadTask>(`/leads/${id}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (leadId: string, taskId: string, data: UpdateLeadTaskInput) =>
    request<LeadTask>(`/leads/${leadId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  completeTask: (leadId: string, taskId: string) =>
    request<LeadTask>(`/leads/${leadId}/tasks/${taskId}/complete`, { method: 'POST' }),
  cancelTask: (leadId: string, taskId: string, reason?: string) =>
    request<LeadTask>(`/leads/${leadId}/tasks/${taskId}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getSiteVisits: (id: string) =>
    request<SiteVisit[]>(`/leads/${id}/site-visits`),
  scheduleSiteVisit: (id: string, data: ScheduleSiteVisitInput) =>
    request<SiteVisit>(`/leads/${id}/site-visits`, { method: 'POST', body: JSON.stringify(data) }),
  updateRequirements: (id: string, data: any) =>
    request<any>(`/leads/${id}/requirements`, { method: 'PATCH', body: JSON.stringify(data) }),
  extractRequirements: (id: string, enquiryText: string) =>
    request<any>(`/leads/${id}/extract`, { method: 'POST', body: JSON.stringify({ enquiryText }) }),
  getTimeline: (id: string, params?: { category?: TimelineCategory; limit?: number; offset?: number }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      if (params.category && params.category !== 'ALL') cleanParams.category = params.category;
      if (params.limit !== undefined) cleanParams.limit = String(params.limit);
      if (params.offset !== undefined) cleanParams.offset = String(params.offset);
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<TimelineResponse>(`/leads/${id}/timeline${query ? `?${query}` : ''}`);
  },
  getMemory: (id: string) =>
    request<{ memory: any; recommendation: any }>(`/leads/${id}/memory`),
  planFollowUp: (
    id: string,
    data?: {
      trigger?: string;
      title?: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      draftContent?: string;
    },
  ) =>
    request<any>(`/leads/${id}/follow-up/plan`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    }),
  convertToDeal: (
    id: string,
    data: {
      propertyId?: string;
      propertyAddress?: string;
      buyerName?: string;
      sellerName?: string;
      acceptanceDate?: string;
      timezone?: string;
      eligibilityOverride?: boolean;
      overrideReason?: string;
    },
  ) =>
    request<{
      deal: Deal;
      lead: Lead;
      contingencyStatus: string;
      initializedDeadlinesCount: number;
    }>(`/leads/${id}/convert-to-deal`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Feature 2: Conversation & Human Takeover API ──────────────────────────────

export const conversationsApi = {
  getThread: (leadId: string) => request<any>(`/leads/${leadId}/conversations`),
  simulateCustomerMessage: (leadId: string, content: string, channel = 'EMAIL') =>
    request<any>(`/leads/${leadId}/conversations/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, channel }),
    }),
  sendMessage: (leadId: string, content: string, channel = 'EMAIL') =>
    request<any>(`/leads/${leadId}/conversations/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, channel }),
    }),
  sendAdvisorMessage: (leadId: string, content: string, channel = 'EMAIL') =>
    request<any>(`/leads/${leadId}/conversations/messages/agent`, {
      method: 'POST',
      body: JSON.stringify({ content, channel }),
    }),

  toggleTakeover: (leadId: string, isHumanTakeover: boolean) =>
    request<any>(`/leads/${leadId}/conversations/takeover`, {
      method: 'POST',
      body: JSON.stringify({ isHumanTakeover }),
    }),
  toggleAutoPilot: (leadId: string, autoReplyEnabled: boolean) =>
    request<any>(`/leads/${leadId}/conversations/autopilot`, {
      method: 'POST',
      body: JSON.stringify({ autoReplyEnabled }),
    }),
  reviewMessage: (leadId: string, msgId: string, status: string, editedContent?: string) =>
    request<any>(`/leads/${leadId}/conversations/messages/${msgId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, editedContent }),
    }),
  retryMessage: (leadId: string, msgId: string) =>
    request<any>(`/leads/${leadId}/conversations/messages/${msgId}/retry`, {
      method: 'POST',
    }),
};

// ── Feature 3: Property Inventory & Matcher API ──────────────────────────────

export const propertiesApi = {
  list: (params?: { search?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; city?: string }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
          cleanParams[k] = String(v);
        }
      });
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<any[]>(`/properties${query ? `?${query}` : ''}`);
  },
  create: (data: any) => request<any>('/properties', { method: 'POST', body: JSON.stringify(data) }),
  getLeadMatches: (leadId: string) => request<any[]>(`/leads/${leadId}/matches`),
  refreshLeadMatches: (leadId: string) =>
    request<any>(`/leads/${leadId}/matches/refresh`, { method: 'POST' }),
};

// ── Feature 4: Transaction Obligations & Tasks API ───────────────────────────

export const tasksApi = {
  list: (dealId: string) => request<any[]>(`/deals/${dealId}/tasks`),
  extractFromDoc: (dealId: string, documentId: string) =>
    request<any[]>(`/deals/${dealId}/tasks/extract`, {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    }),
  reviewTask: (dealId: string, taskId: string, data: any) =>
    request<any>(`/deals/${dealId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ── Feature 5: Portfolio Knowledge Base API ──────────────────────────────────

export const knowledgeApi = {
  ask: (question: string) =>
    request<AssistantAnswer>('/knowledge/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
  getDocuments: () => request<any[]>('/knowledge/documents'),
};

// ── Feature 6: Organization & Team API ────────────────────────────────────────

export const organizationApi = {
  listMembers: () => request<User[]>('/organization/members'),
};

// ── Feature 7: Advisor Tasks API ──────────────────────────────────────────────

export const leadTasksApi = {
  list: (params?: {
    filter?: 'upcoming' | 'overdue' | 'completed' | 'all';
    status?: string;
    assignedUserId?: string;
    leadId?: string;
    limit?: number;
    offset?: number;
  }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          cleanParams[k] = String(v);
        }
      });
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<LeadTask[]>(`/tasks${query ? `?${query}` : ''}`);
  },
  update: (id: string, data: UpdateLeadTaskInput) =>
    request<LeadTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  complete: (id: string) =>
    request<LeadTask>(`/tasks/${id}/complete`, { method: 'POST' }),
  cancel: (id: string, reason?: string) =>
    request<LeadTask>(`/tasks/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  getActionQueue: (params?: {
    advisorId?: string;
    timezone?: string;
    bucket?: ActionQueueBucket;
    limit?: number;
    offset?: number;
  }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      if (params.advisorId) cleanParams.advisorId = params.advisorId;
      if (params.timezone) cleanParams.timezone = params.timezone;
      if (params.bucket && params.bucket !== 'all') cleanParams.bucket = params.bucket;
      if (params.limit !== undefined) cleanParams.limit = String(params.limit);
      if (params.offset !== undefined) cleanParams.offset = String(params.offset);
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<ActionQueueResponse>(`/tasks/action-queue${query ? `?${query}` : ''}`);
  },
};

// ── Feature 8: Real Estate Site Visits API ────────────────────────────────────

export const siteVisitsApi = {
  list: (params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    advisorId?: string;
    propertyId?: string;
    leadId?: string;
  }) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          cleanParams[k] = String(v);
        }
      });
    }
    const query = new URLSearchParams(cleanParams).toString();
    return request<SiteVisit[]>(`/site-visits${query ? `?${query}` : ''}`);
  },
  checkAvailability: (params: {
    startAt: string;
    endAt?: string;
    durationMinutes?: number;
    advisorId?: string;
    excludeVisitId?: string;
  }) => {
    const cleanParams: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleanParams[k] = String(v);
      }
    });
    const query = new URLSearchParams(cleanParams).toString();
    return request<{ available: boolean; advisorId: string; startAt: string; endAt: string }>(
      `/site-visits/availability?${query}`,
    );
  },
  reschedule: (id: string, data: RescheduleSiteVisitInput) =>
    request<SiteVisit>(`/site-visits/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancel: (id: string, reason?: string) =>
    request<SiteVisit>(`/site-visits/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  complete: (id: string, outcomeNotes?: string) =>
    request<SiteVisit>(`/site-visits/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ outcomeNotes }),
    }),
  markNoShow: (id: string, notes?: string) =>
    request<SiteVisit>(`/site-visits/${id}/no-show`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
};
