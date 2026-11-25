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
import { swrCache } from '@/utils/swrCache';

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
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  getConfig: () => request<{ demoLoginEnabled: boolean }>('/auth/config'),
  checkEmail: (email: string) => request<{ exists: boolean }>(`/auth/check-email?email=${encodeURIComponent(email)}`),
  registerOrg: (data: {
    ownerName: string;
    email: string;
    password?: string;
    organizationName: string;
    stateJurisdiction?: string;
    planTier?: 'SOLO' | 'TEAM' | 'ENTERPRISE';
  }) =>
    request<{
      token: string;
      user: User;
      organization: { id: string; name: string; subscriptionTier: string; stateJurisdiction: string };
    }>('/auth/register-org', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  loginWithPassword: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  signInWithGoogle: (credential: string, inviteToken?: string) =>
    request<{ token: string; user: User; isNewWorkspace?: boolean }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential, ...(inviteToken ? { inviteToken } : {}) }),
    }),
  signInAsDemoAgent: (role?: 'AGENT' | 'OWNER') =>
    request<{ token: string; user: User }>('/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ role: role || 'AGENT' }),
    }),
  me: () => request<{ user: User }>('/auth/me'),
};

// ── Deals ─────────────────────────────────────────────────────────────────────

const DEALS_CACHE_KEY = 'deals:list';

export const dealsApi = {
  list: () => swrCache.fetch(DEALS_CACHE_KEY, () => request<Deal[]>('/deals')),
  getCached: () => swrCache.get<Deal[]>(DEALS_CACHE_KEY) ?? null,
  prefetch: () => swrCache.prefetch(DEALS_CACHE_KEY, () => request<Deal[]>('/deals')),
  get: (id: string) => request<Deal>(`/deals/${id}`),
  create: async (data: CreateDealInput) => {
    const deal = await request<Deal>('/deals', { method: 'POST', body: JSON.stringify(data) });
    swrCache.invalidate('deals:');
    swrCache.invalidate('billing:');
    return deal;
  },
  update: async (id: string, data: Partial<CreateDealInput>) => {
    const deal = await request<Deal>(`/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    swrCache.invalidate('deals:');
    return deal;
  },
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

export interface LeadsListParams {
  search?: string;
  status?: string;
  priority?: string;
  assignedUserId?: string | null;
  unassigned?: boolean;
  unassignedOnly?: boolean;
}

function buildLeadsListKey(params?: LeadsListParams) {
  const cleanParams: Record<string, string> = {};
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
        cleanParams[k] = String(v);
      }
    });
  }
  const query = new URLSearchParams(cleanParams).toString();
  return { key: `leads:list:${query}`, query };
}

export const leadsApi = {
  list: (params?: LeadsListParams) => {
    const { key, query } = buildLeadsListKey(params);
    return swrCache.fetch(key, () => request<Lead[]>(`/leads${query ? `?${query}` : ''}`));
  },
  getCached: (params?: LeadsListParams) =>
    swrCache.get<Lead[]>(buildLeadsListKey(params).key) ?? null,
  prefetch: () => {
    const { key, query } = buildLeadsListKey();
    swrCache.prefetch(key, () => request<Lead[]>(`/leads${query ? `?${query}` : ''}`));
  },
  get: (id: string) => request<Lead>(`/leads/${id}`),
  create: async (data: { fullName: string; email?: string; phone?: string; enquiryText?: string; source?: string }) => {
    const lead = await request<Lead>('/leads', { method: 'POST', body: JSON.stringify(data) });
    swrCache.invalidate('leads:');
    return lead;
  },
  importCsv: async (rows: Array<Record<string, unknown>>) => {
    const res = await request<{ importedCount: number; skippedCount: number; errors: Array<{ row: number; reason: string }> }>(
      '/leads/import',
      { method: 'POST', body: JSON.stringify({ rows }) },
    );
    swrCache.invalidate('leads:');
    return res;
  },
  update: async (id: string, data: any) => {
    const lead = await request<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    swrCache.invalidate('leads:');
    return lead;
  },
  claim: async (id: string, reason?: string) => {
    const lead = await request<Lead>(`/leads/${id}/claim`, { method: 'POST', body: JSON.stringify({ reason }) });
    swrCache.invalidate('leads:');
    return lead;
  },
  release: async (id: string, reason?: string) => {
    const lead = await request<Lead>(`/leads/${id}/release`, { method: 'POST', body: JSON.stringify({ reason }) });
    swrCache.invalidate('leads:');
    return lead;
  },
  reassign: async (id: string, targetUserId: string | null, reason?: string) => {
    const lead = await request<Lead>(`/leads/${id}/reassign`, { method: 'POST', body: JSON.stringify({ targetUserId, reason }) });
    swrCache.invalidate('leads:');
    return lead;
  },
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
  getProposals: (id: string) =>
    request<any[]>(`/leads/${id}/proposals`),
  acceptProposal: (id: string, proposalId: string) =>
    request<any>(`/leads/${id}/proposals/${proposalId}/accept`, { method: 'POST' }),
  rejectProposal: (id: string, proposalId: string) =>
    request<any>(`/leads/${id}/proposals/${proposalId}/reject`, { method: 'POST' }),
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

function buildPropertiesListKey(params?: { search?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; city?: string; status?: string }) {
  const cleanParams: Record<string, string> = {};
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== 'undefined') {
        cleanParams[k] = String(v);
      }
    });
  }
  const query = new URLSearchParams(cleanParams).toString();
  return { key: `properties:list:${query}`, query };
}

export const propertiesApi = {
  list: (params?: { search?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; city?: string; status?: string }) => {
    const { key, query } = buildPropertiesListKey(params);
    return swrCache.fetch(key, () => request<any[]>(`/properties${query ? `?${query}` : ''}`));
  },
  getCached: (params?: { search?: string; minPrice?: number; maxPrice?: number; bedrooms?: number; city?: string; status?: string }) =>
    swrCache.get<any[]>(buildPropertiesListKey(params).key) ?? null,
  prefetch: () => {
    const { key, query } = buildPropertiesListKey();
    swrCache.prefetch(key, () => request<any[]>(`/properties${query ? `?${query}` : ''}`));
  },
  create: async (data: any) => {
    const prop = await request<any>('/properties', { method: 'POST', body: JSON.stringify(data) });
    swrCache.invalidate('properties:');
    swrCache.invalidate('org:onboarding');
    return prop;
  },
  update: async (id: string, data: any) => {
    const prop = await request<any>(`/properties/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    swrCache.invalidate('properties:');
    return prop;
  },
  importCsv: async (rows: Array<Record<string, unknown>>) => {
    const res = await request<{ importedCount: number; skippedCount: number; errors: Array<{ row: number; reason: string }> }>(
      '/properties/import',
      { method: 'POST', body: JSON.stringify({ rows }) },
    );
    swrCache.invalidate('properties:');
    swrCache.invalidate('org:onboarding');
    return res;
  },
  uploadBrochure: async (file: File): Promise<{ url: string; filename: string; sizeBytes: number }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await send('/properties/brochure', { method: 'POST', body: form });
    return res.json();
  },
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
  listMembers: () => swrCache.fetch('org:members', () => request<User[]>('/org/members')),
  getCachedMembers: () => swrCache.get<User[]>('org:members') ?? null,
  listInvitations: () =>
    swrCache.fetch('org:invitations', () =>
      request<
        Array<{
          id: string;
          email: string;
          role: 'OWNER' | 'AGENT';
          status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
          expiresAt: string;
          createdAt: string;
        }>
      >('/org/invitations'),
    ),
  getCachedInvitations: () =>
    swrCache.get<
      Array<{
        id: string;
        email: string;
        role: 'OWNER' | 'AGENT';
        status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
        expiresAt: string;
        createdAt: string;
      }>
    >('org:invitations') ?? null,
  sendInvitation: async (data: { email: string; role: 'OWNER' | 'AGENT' }) => {
    const res = await request<{
      invitation: {
        id: string;
        email: string;
        role: 'OWNER' | 'AGENT';
        status: string;
        expiresAt: string;
        createdAt: string;
      };
      inviteUrl: string;
      emailSent: boolean;
      emailError?: string;
    }>('/org/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    swrCache.invalidate('org:');
    return res;
  },
  removeMember: async (userId: string) => {
    await request<void>(`/org/members/${userId}`, { method: 'DELETE' });
    swrCache.invalidate('org:');
    swrCache.invalidate('billing:');
  },
  changeMemberRole: async (userId: string, role: 'OWNER' | 'AGENT') => {
    const user = await request<User>(`/org/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    swrCache.invalidate('org:');
    return user;
  },
  revokeInvitation: async (invitationId: string) => {
    await request<void>(`/org/invitations/${invitationId}`, { method: 'DELETE' });
    swrCache.invalidate('org:');
  },
  getChannels: () =>
    swrCache.fetch('org:channels', () =>
      request<{
        id: string;
        organizationId: string;
        whatsappPhoneNumberId: string | null;
        whatsappWabaId: string | null;
        hasWhatsappToken: boolean;
        whatsappVerifyToken: string | null;
        telegramBotUsername: string | null;
        hasTelegramToken: boolean;
        telegramWebhookSecret: string | null;
        widgetPublicKey: string;
        widgetAllowedOrigins: string[];
        widgetTitle: string;
        widgetGreeting: string;
        widgetThemeColor: string;
        defaultCurrency: string;
        defaultTimezone: string;
        callingWindowStart: string;
        callingWindowEnd: string;
      }>('/org/channels'),
    ),
  getCachedChannels: () => swrCache.get<any>('org:channels') ?? null,
  prefetchTeam: () => {
    swrCache.prefetch('org:members', () => request<User[]>('/org/members'));
    swrCache.prefetch('org:invitations', () => request<any[]>('/org/invitations'));
    swrCache.prefetch('org:channels', () => request<any>('/org/channels'));
  },
  updateChannels: (data: Record<string, unknown>) =>
    request<{ updated: boolean; widgetPublicKey: string; widgetAllowedOrigins: string[] }>('/org/channels', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getOnboarding: () =>
    swrCache.fetch('org:onboarding', () =>
      request<{
        organizationId: string;
        organizationName: string;
        planTier: string;
        subscriptionStatus: string;
        walletBalance: number;
        onboardingCompleted: boolean;
        onboardingStep: number;
        checklist: {
          paymentActive: boolean;
          walletFunded: boolean;
          whatsappConnected: boolean;
          plivoSubaccountReady: boolean;
          plivoDidAssigned: boolean;
          plivoComplianceStatus: string;
          telegramConnected: boolean;
          widgetConfigured: boolean;
          hasInventory: boolean;
          hasAdvisorPhone: boolean;
        };
        details: {
          whatsappPhoneNumberId: string | null;
          whatsappProvider: string | null;
          plivoSubaccountId: string | null;
          plivoComplianceAppId: string | null;
          plivoNumbers: Array<{ id: string; phoneNumber: string; city: string | null; isPrimary: boolean }>;
          telegramBotUsername: string | null;
          telegramWebhookSecret: string | null;
          widgetPublicKey: string;
          widgetAllowedOrigins: string[];
          widgetTitle: string;
          widgetGreeting: string;
          widgetThemeColor: string;
          propertyCount: number;
          advisorWithPhoneCount: number;
          totalAdvisors: number;
          metaAppId: string | null;
          metaConfigId: string | null;
        };
      }>('/org/onboarding'),
    ),
  getCachedOnboarding: () => swrCache.get<any>('org:onboarding') ?? null,
  prefetchOnboarding: () => {
    swrCache.prefetch('org:onboarding', () => request<any>('/org/onboarding'));
  },
  completeOnboarding: async () => {
    const res = await request<{ onboardingCompleted: boolean }>('/org/onboarding/complete', { method: 'POST' });
    swrCache.invalidate('org:');
    return res;
  },
  updateWorkspaceProfile: (data: {
    organizationName: string;
    stateJurisdiction?: string;
    planTier?: 'SOLO' | 'TEAM' | 'ENTERPRISE';
  }) =>
    request<{
      organization: {
        id: string;
        name: string;
        stateJurisdiction: string;
        subscriptionTier: string;
        subscriptionStatus: string;
      };
    }>('/org/workspace-profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateBranding: (data: {
    organizationName?: string;
    widgetTitle?: string;
    widgetGreeting?: string;
    widgetThemeColor?: string;
    defaultCurrency?: 'INR' | 'USD' | 'AED' | 'GBP';
    defaultTimezone?: string;
  }) =>
    request<{ organizationName: string }>('/org/branding', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateMemberPhone: (userId: string, phone: string) =>
    request<{ id: string; phone: string }>(`/org/members/${userId}/phone`, {
      method: 'PATCH',
      body: JSON.stringify({ phone }),
    }),
  connectWhatsApp: (data: {
    code?: string;
    phoneNumberId: string;
    wabaId: string;
    whatsappProvider?: 'COEXISTENCE' | 'DEDICATED' | 'BSP_MANAGED';
  }) =>
    request<{ connected: boolean; whatsappPhoneNumberId: string; whatsappProvider: string }>(
      '/org/whatsapp/embedded-signup',
      { method: 'POST', body: JSON.stringify(data) },
    ),
  assignPlatformWhatsApp: () =>
    request<{ connected: boolean; whatsappPhoneNumberId: string; whatsappProvider: string; isSimulated: boolean }>(
      '/org/whatsapp/assign-platform-number',
      { method: 'POST' },
    ),
  connectTelegram: async (botToken: string) => {
    const res = await request<{ connected: boolean; telegramBotUsername: string; webhookRegistered: boolean }>(
      '/org/telegram/connect',
      { method: 'POST', body: JSON.stringify({ botToken }) },
    );
    swrCache.invalidate('org:');
    return res;
  },
  submitPlivoKyc: (data: {
    legalEntityName: string;
    documentType: 'GST_CERTIFICATE' | 'COI' | 'UDYAM';
    registrationNumber: string;
    authorizedSignatoryName: string;
    businessAddress: string;
    city: string;
  }) =>
    request<{ complianceApplicationId: string; status: string; subaccountId: string }>(
      '/org/plivo/compliance',
      { method: 'POST', body: JSON.stringify(data) },
    ),
  provisionPlivoNumber: (data: { phoneNumber?: string; city: string; alias?: string }) =>
    request<{
      number: { id: string; phoneNumber: string; city: string };
      subaccountId: string;
      callForwardingCode: string;
      isSimulated: boolean;
    }>('/org/plivo/provision-number', { method: 'POST', body: JSON.stringify(data) }),
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

// ── Billing & Subscriptions API ───────────────────────────────────────────────

export interface SubscriptionStatusResponse {
  organizationId: string;
  organizationName: string;
  tier: 'SOLO' | 'TEAM' | 'ENTERPRISE';
  status: string;
  stateJurisdiction: string;
  planExpiresAt: string | null;
  hasStripeCustomer: boolean;
  planDetails: {
    id: string;
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    maxAgents: number;
    maxDeals: number | null;
    features: string[];
  };
  usage: {
    activeDeals: number;
    maxDeals: number | null;
    seatsUsed: number;
    maxSeats: number;
  };
}

export const billingApi = {
  getSubscription: () => swrCache.fetch('billing:subscription', () => request<SubscriptionStatusResponse>('/billing/subscription')),
  getCachedSubscription: () => swrCache.get<SubscriptionStatusResponse>('billing:subscription') ?? null,
  prefetchSubscription: () => {
    swrCache.prefetch('billing:subscription', () => request<SubscriptionStatusResponse>('/billing/subscription'));
  },
  getPlans: () => request<{ plans: any[] }>('/billing/plans'),
  createCheckoutSession: (params: {
    plan: 'SOLO' | 'TEAM' | 'ENTERPRISE';
    isAnnual?: boolean;
    successUrl?: string;
    cancelUrl?: string;
  }) =>
    request<{ url: string; mock: boolean }>('/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  createPortalSession: (returnUrl?: string) =>
    request<{ url: string; mock: boolean }>('/billing/portal', {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
    }),
  devUpgrade: (plan: 'SOLO' | 'TEAM' | 'ENTERPRISE') =>
    request<{ success: boolean; subscriptionTier: string; subscriptionStatus: string }>('/billing/dev-upgrade', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    }),
  getRazorpayConfig: () =>
    request<{ configured: boolean; keyId: string | null; currency: 'INR' }>('/billing/razorpay/config'),
  createRazorpayOrder: (
    data:
      | { type: 'WALLET_TOPUP'; amountInr: number }
      | { type: 'SUBSCRIPTION_PLAN'; plan: 'SOLO' | 'TEAM' | 'ENTERPRISE'; isAnnual?: boolean },
  ) =>
    request<{
      orderId: string;
      amountPaise: number;
      amountInr: number;
      currency: 'INR';
      keyId: string;
      isSimulated: boolean;
      description: string;
      organizationName: string;
      prefill: { name?: string; email?: string };
    }>('/billing/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifyRazorpayPayment: async (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    type: 'WALLET_TOPUP' | 'SUBSCRIPTION_PLAN';
    amountInr?: number;
    plan?: 'SOLO' | 'TEAM' | 'ENTERPRISE';
    isAnnual?: boolean;
  }) => {
    const res = await request<{
      verified: boolean;
      type: 'WALLET_TOPUP' | 'SUBSCRIPTION_PLAN';
      newBalance?: number;
      includedCreditsInr?: number;
      subscriptionTier?: string;
      subscriptionStatus?: string;
    }>('/billing/razorpay/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    swrCache.invalidate('billing:');
    swrCache.invalidate('wallet:');
    swrCache.invalidate('org:');
    return res;
  },
};

// ── Feature 12: Pre-Paid Metered Telephony & Messaging Wallet API ──────────

export interface WalletTransaction {
  id: string;
  timestamp: string;
  type: 'CREDIT' | 'DEBIT';
  category: 'VOICE_CALL' | 'WHATSAPP_QUALIFICATION' | 'VOICE_CLONE_PROFILE' | 'DEPOSIT' | 'AUTO_RECHARGE' | 'REFUND';
  description: string;
  amount: number;
  balanceAfter: number;
  metadata?: Record<string, any>;
}

export interface WalletStateResponse {
  organizationId: string;
  balance: number;
  currency: 'INR' | 'USD';
  autoRecharge: {
    enabled: boolean;
    threshold: number;
    rechargeAmount: number;
  };
  unitRates: {
    voicePerMinute: number;
    whatsappPerLead: number;
    voiceCloneProfile: number;
  };
  transactions: WalletTransaction[];
  stats: {
    totalSpent: number;
    voiceMinutesBilled: number;
    leadsQualified: number;
    totalDeposited: number;
  };
}

export const walletApi = {
  getWallet: () => swrCache.fetch('wallet:state', () => request<WalletStateResponse>('/billing/wallet')),
  getCached: () => swrCache.get<WalletStateResponse>('wallet:state') ?? null,
  prefetch: () => {
    swrCache.prefetch('wallet:state', () => request<WalletStateResponse>('/billing/wallet'));
  },
  depositCredits: async (amount: number, options?: { successUrl?: string; cancelUrl?: string }) => {
    const res = await request<{ success: boolean; newBalance: number; transaction: WalletTransaction; checkoutUrl?: string; isSimulated: boolean }>('/billing/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amount, ...options }),
    });
    swrCache.invalidate('wallet:');
    return res;
  },
  updateAutoRecharge: async (data: { enabled?: boolean; threshold?: number; rechargeAmount?: number }) => {
    const res = await request<{ success: boolean; autoRecharge: any }>('/billing/wallet/auto-recharge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    swrCache.invalidate('wallet:');
    return res;
  },
  simulateDeduction: (data: { type: 'VOICE_CALL' | 'WHATSAPP_QUALIFICATION'; durationSeconds?: number; leadName?: string }) =>
    request<{ success: boolean; transaction: WalletTransaction; currentBalance: number }>('/billing/wallet/simulate-deduction', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Feature 10: Autonomous AI Voice Agent & Telephony API ────────────────────

export interface OutboundCallInput {
  leadId: string;
  phone: string;
  fromNumber?: string;
}

export interface OutboundCallResponse {
  success: boolean;
  callUuid?: string;
  isSimulated?: boolean;
  message?: string;
  error?: string;
}

export interface TestCallResponse {
  success: boolean;
  message: string;
  callUuid?: string;
  isSimulated?: boolean;
}

export const voiceApi = {
  dispatchOutboundCall: (data: OutboundCallInput) =>
    request<OutboundCallResponse>('/voice/plivo/outbound', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerTestCall: (phone: string) =>
    request<TestCallResponse>('/voice/plivo/test-call', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  transferCall: (data: { callUuid: string; leadId: string; advisorPhone: string; advisorName?: string }) =>
    request<{ success: boolean; message: string }>('/voice/plivo/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Feature 11: High-Scale Batch Campaign Dialing API ────────────────────────

export interface CampaignLogItem {
  id: string;
  leadName: string;
  phone: string;
  outcome: 'LIVE_HUMAN_ANSWERED' | 'AMD_VOICEMAIL_DROP' | 'BUSY_RETRY' | 'VISIT_CONFIRMED' | 'WARM_TRANSFER';
  timestamp: string;
  notes: string;
}

export interface CampaignStateResponse {
  campaign: {
    id: string;
    name: string;
    status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
    concurrencyTrunks: number;
    totalLeads: number;
    callsDialed: number;
    liveHumansConnected: number;
    voicemailsDetected: number;
    busyOrNoAnswer: number;
    siteVisitsLocked: number;
    warmTransfersRequested: number;
    startedAt?: string;
    logs: CampaignLogItem[];
  };
  systemCapacity: {
    maxTrunksAllowed: number;
    carrierDidsActive: number;
    dndComplianceActive: boolean;
    callingWindow: string;
  };
}

export const campaignsApi = {
  getStats: () => request<CampaignStateResponse>('/campaigns/stats'),
  startCampaign: (data?: { concurrencyTrunks?: number; campaignName?: string }) =>
    request<{ success: boolean; message: string; campaign: any }>('/campaigns/start', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  pauseCampaign: () =>
    request<{ success: boolean; message: string; campaign: any }>('/campaigns/pause', {
      method: 'POST',
    }),
  importLeads: (leads: Array<{ fullName: string; phone: string; budget?: string; preferredLocation?: string }>) =>
    request<{ success: boolean; importedCount: number; totalCampaignLeads: number }>('/campaigns/import', {
      method: 'POST',
      body: JSON.stringify({ leads }),
    }),
};

// ── Super-Admin Mission Control API (Real PostgreSQL Telemetry & Ops) ─────────

export interface PlatformConfigData {
  id: string;
  primaryTtsEngine: 'eleven_flash_v2_5' | 'cartesia_sonic' | 'edge_neural';
  primaryLlmModel: string;
  outboundDialerPaused: boolean;
  maxPlatformConcurrency: number;
  autoFailoverEnabled: boolean;
  consecutiveTtsFailures: number;
  lastFailoverAt?: string | null;
  failoverReason?: string | null;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface AdminAuditLogRow {
  id: string;
  adminEmail: string;
  organizationId?: string | null;
  action: string;
  note?: string | null;
  createdAt: string;
  organization?: { name: string } | null;
}

export interface AdminOverviewResponse {
  kpis: {
    totalOrgs: number;
    activePaidOrgs: number;
    suspendedOrgs: number;
    totalUsers: number;
    activeDids: number;
    activeCallsNow: number;
    pendingKycCount: number;
    totalWalletLiabilityInr: number;
    monthlySubscriptionMrrInr: number;
    extraTopups30dInr: number;
    grossRevenue30dInr: number;
    totalCogs30dInr: number;
    netProfit30dInr: number;
    grossMarginPct: number;
    totalCallMinutes30d: number;
    totalCalls30d: number;
    totalAgentRuns30d: number;
    aiLatencyP50Ms: number;
    aiLatencyP95Ms: number;
  };
  providerBreakdown: Array<{
    provider: string;
    costInr: number;
    eventsCount: number;
    totalUnits: number;
  }>;
  config: PlatformConfigData;
  auditLogs: AdminAuditLogRow[];
}

export interface AdminTenantSummary {
  id: string;
  name: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  isSuspended: boolean;
  suspendedReason?: string | null;
  stateJurisdiction?: string | null;
  createdAt: string;
  planExpiresAt?: string | null;
  owner: { name: string | null; email: string; phone: string | null } | null;
  seatsUsed: number;
  maxSeats: number;
  dealsCount: number;
  leadsCount: number;
  activeDids: number;
  plivoSubaccountId: string | null;
  plivoComplianceStatus: string;
  whatsappConnected: boolean;
  walletBalance: number;
  totalSpent: number;
  monthlyRevenueInr: number;
  cogs30dInr: number;
  profit30dInr: number;
  callMinutes30d: number;
  runningCampaigns: number;
}

export interface AdminTenantDetail {
  organization: any;
  costByProvider30d: Array<{ provider: string; costInr: number; eventsCount: number }>;
  recentCalls: Array<{
    id: string;
    callUuid: string;
    direction: string;
    toNumber: string;
    status: string;
    outcome?: string | null;
    durationSeconds: number;
    createdAt: string;
  }>;
  recentTraces: Array<{
    id: string;
    channel: string;
    specialist: string;
    intent: string;
    latencyMs: number;
    modelUsed: string;
    guardrailFlags: string[];
    createdAt: string;
  }>;
  auditLogs: AdminAuditLogRow[];
}

export const adminApi = {
  getOverview: () => request<AdminOverviewResponse>('/admin/overview'),
  getTenants: (search?: string) =>
    request<{ tenants: AdminTenantSummary[] }>(
      `/admin/tenants${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  getTenantDetail: (orgId: string) => request<AdminTenantDetail>(`/admin/tenants/${orgId}`),
  updateKyc: (orgId: string, data: { status: 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED'; note?: string }) =>
    request<{ success: boolean; channel: any }>(`/admin/tenants/${orgId}/kyc`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  adjustWallet: (orgId: string, data: { amountInr: number; reason: string }) =>
    request<{ success: boolean; newBalance: number }>(`/admin/tenants/${orgId}/wallet`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateOrgStatus: (orgId: string, data: { isSuspended: boolean; reason?: string }) =>
    request<{ success: boolean; organization: any }>(`/admin/tenants/${orgId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  pauseTenantCampaigns: (orgId: string) =>
    request<{ success: boolean; pausedCount: number }>(`/admin/tenants/${orgId}/pause-campaigns`, {
      method: 'POST',
    }),
  updateConfig: (data: {
    primaryTtsEngine?: 'eleven_flash_v2_5' | 'cartesia_sonic' | 'edge_neural';
    primaryLlmModel?: string;
    outboundDialerPaused?: boolean;
    maxPlatformConcurrency?: number;
    autoFailoverEnabled?: boolean;
    note?: string;
  }) =>
    request<{ success: boolean; config: PlatformConfigData }>('/admin/config', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};



