// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types — mirrors the Prisma schema on the backend.
// Keep in sync with backend/prisma/schema.prisma
// ─────────────────────────────────────────────────────────────────────────────

export type DealStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED';
export type DayType = 'calendar' | 'business';
export type DeadlineStatus = 'PENDING' | 'CONFIRMED' | 'ACTIVE' | 'MISSED' | 'COMPLETED';
export type DocType =
  | 'PURCHASE_AGREEMENT'
  | 'COUNTER_OFFER'
  | 'ADDENDUM'
  | 'INSPECTION_REPORT'
  | 'HOA_DISCLOSURE'
  | 'TITLE_COMMITMENT'
  | 'OTHER';

export type IndexStatus = 'PENDING' | 'INDEXING' | 'READY' | 'FAILED';

export type AuditAction =
  | 'DOCUMENT_UPLOADED'
  | 'EXTRACTION_STARTED'
  | 'EXTRACTION_COMPLETED'
  | 'DEADLINE_CONFIRMED'
  | 'DEADLINE_EDITED'
  | 'DEADLINE_ACTIVATED'
  | 'ALERT_SENT'
  | 'DEAL_CREATED'
  | 'DEAL_UPDATED'
  | 'ASSISTANT_QUERY'
  | 'DOCUMENT_INDEXED'
  | 'EMAIL_SENT_TEST'
  | 'EMAIL_INBOUND_RECEIVED';

export interface Deal {
  id: string;
  leadId?: string | null;
  propertyId?: string | null;
  propertyAddress: string;
  buyerName: string | null;
  sellerName: string | null;
  acceptanceDate: string | null; // ISO 8601
  status: DealStatus;
  timezone?: string;
  inboundAlias?: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: Document[];
  deadlines?: Deadline[];
  clauses?: ContingencyClause[];
  _count?: { deadlines: number };
}

export interface Document {
  id: string;
  dealId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number | null;
  docType?: DocType;
  effectiveDate?: string | null;
  pageCount?: number | null;
  indexStatus?: IndexStatus;
  indexedAt?: string | null;
  uploadedAt: string;
}

export interface ContingencyClause {
  id: string;
  dealId: string;
  documentId: string;
  clauseType: string;
  rawText: string;
  pageNumber: number | null;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  confidence: number | null;
  numberOfDays: number | null;
  dayType: DayType | null;
  createdAt: string;
}

export interface Deadline {
  id: string;
  dealId: string;
  clauseId: string;
  label: string;
  computedDate: string;    // ISO 8601
  confirmedDate: string | null;
  dayType: DayType;
  status: DeadlineStatus;
  confirmedBy: string | null;
  confirmedAt: string | null;
  alertSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  clause?: ContingencyClause;
}

export interface AuditLog {
  id: string;
  dealId: string;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  previousValue: unknown;
  newValue: unknown;
  actor: string | null;
  note: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

// ─── API request/response helpers ─────────────────────────────────────────────
export interface CreateDealInput {
  propertyAddress: string;
  buyerName?: string;
  sellerName?: string;
  acceptanceDate?: string; // ISO 8601
}

export interface ConfirmDeadlineInput {
  confirmedDate: string; // ISO 8601
  confirmedBy?: string;
  activate?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  organizationId?: string;
  role?: 'OWNER' | 'AGENT';
}

// ─── Assistant Types (B Contract) ─────────────────────────────────────────────

export interface Citation {
  id: number;
  sourceType: 'document' | 'deadline' | 'deal';
  documentId?: string;
  documentName?: string;
  deadlineId?: string;
  deadlineLabel?: string;
  pageNumber?: number;
  section?: string;
  quote?: string; // Verbatim quote verified server-side
  relevanceExplanation?: string;
  confidence: number;
  isOcr?: boolean;
  isOverridden?: boolean;
  isConfirmed?: boolean;
}

export interface OverrideInfo {
  original: string;
  overriddenBy: string;
  reason?: string;
}

export interface AssistantAnswer {
  conversationId: string;
  messageId: string;
  answer: string;
  found: boolean;
  isDirectlyAnswerable: boolean;
  confidence: number;
  overrides: OverrideInfo[];
  citations: Citation[];
  suggestedFollowUps: string[];
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  dealId: string;
  userId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: AssistantMessage[];
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[] | null;
  suggestedFollowUps: string[] | null;
  createdAt: string;
}

export interface AssistantStatusEvent {
  stage: 'retrieving' | 'reasoning' | 'verifying';
  message: string;
}

export interface SuggestedQuestionsResponse {
  suggestions: string[];
}

export interface DealRiskItem {
  type: 'unconfirmed_deadline' | 'missing_document' | 'conflict_override' | 'low_confidence_clause';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  citations?: Citation[];
}

export interface DealSummaryResponse {
  executiveSummary: string;
  keyEntities: {
    propertyAddress: string;
    buyerName: string | null;
    sellerName: string | null;
    acceptanceDate: string | null;
    totalDocuments: number;
  };
  contingencyMatrix: Array<{
    label: string;
    status: DeadlineStatus;
    targetDate: string;
    dayType: DayType;
    sourceDocument: string | null;
    pageNumber: number | null;
    isConfirmed: boolean;
  }>;
  riskMatrix: DealRiskItem[];
  overrides: OverrideInfo[];
  citations: Citation[];
}

export interface ExecutiveSummary {
  overview: string;
  risks: Array<{
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
    title: string;
    description: string;
    citationIds: string[];
  }>;
  citations: Array<{
    id: number;
    sourceType: 'document' | 'deadline' | 'deal';
    deadlineId?: string;
    relevanceExplanation?: string;
    confidence?: number;
  }>;
}

export interface IndexStatusResponse {
  dealId: string;
  status: IndexStatus;
  indexedCount: number;
  totalCount: number;
  documents: Array<{
    id: string;
    filename: string;
    docType: DocType;
    indexStatus: IndexStatus;
    pageCount: number | null;
    chunkCount: number;
  }>;
}

// ─── Notification Types (A Contract) ──────────────────────────────────────────

export interface NotificationWindows {
  d3: boolean;
  d1: boolean;
  dayOf: boolean;
  missed: boolean;
}

export interface NotificationSetting {
  id: string;
  dealId: string;
  recipients: string[];
  window3d: boolean;
  window1d: boolean;
  windowDayOf: boolean;
  windowMissed: boolean;
  enabled: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateNotificationSettingsInput {
  recipients: string[];
  windows: NotificationWindows;
  enabled: boolean;
  timezone: string;
}

export type EmailLogStatus = 'SENT' | 'DELIVERED' | 'BOUNCED' | 'DROPPED';

export interface EmailLog {
  id: string;
  dealId: string;
  deadlineId: string | null;
  recipient: string;
  template: '3d' | '1d' | 'dayOf' | 'missed' | 'summary' | 'docs_received';
  status: EmailLogStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string;
  deadline?: Deadline;
}

export interface EmailPreviewRequest {
  template: '3d' | '1d' | 'dayOf' | 'missed' | 'summary' | 'docs_received';
  deadlineId?: string;
}

export interface EmailPreviewResponse {
  subject: string;
  html: string;
  text: string;
}

export interface InboundAddressResponse {
  inboundEmail: string;
  domain: string;
  dealId: string;
  dealAddress: string;
  instructions: string;
}

export interface SendTestEmailRequest {
  to: string;
}

export interface SendSummaryRequest {
  to: string[];
}

// ─── Real Estate Sales Copilot — Lead & Assignment Types ──────────────────────

export type LeadSource = 'WEBSITE_FORM' | 'PORTAL_INQUIRY' | 'WHATSAPP' | 'EMAIL' | 'MANUAL';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';
export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ProposalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';

export interface LeadRequirement {
  id: string;
  leadId: string;
  minBudget: number | null;
  maxBudget: number | null;
  preferredLocations: string[];
  propertyType: string | null;
  minBedrooms: number | null;
  maxBedrooms: number | null;
  possessionTimeline: string | null;
  notes: string | null;
  rawAiExtraction?: any;
  createdAt: string;
  updatedAt: string;
}

export interface LeadRequirementProposal {
  id: string;
  leadId: string;
  organizationId?: string | null;
  proposedMinBudget: number | null;
  proposedMaxBudget: number | null;
  proposedLocations: string[];
  proposedPropertyType: string | null;
  proposedMinBedrooms: number | null;
  proposedMaxBedrooms: number | null;
  proposedTimeline: string | null;
  confidence: number | null;
  sourceMessageId?: string | null;
  status: ProposalStatus;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export interface LeadAssignmentHistory {
  id: string;
  leadId: string;
  organizationId: string;
  previousUserId: string | null;
  assignedUserId: string | null;
  changedById: string | null;
  reason: string | null;
  createdAt: string;
  previousUser?: { id: string; name: string | null; email: string } | null;
  assignedUser?: { id: string; name: string | null; email: string } | null;
  changedBy?: { id: string; name: string | null; email: string } | null;
}

export type CallDirection = 'INBOUND' | 'OUTBOUND';

export type CallOutcome =
  | 'CONNECTED'
  | 'NO_ANSWER'
  | 'BUSY'
  | 'CALLBACK_REQUESTED'
  | 'VOICEMAIL'
  | 'WRONG_NUMBER'
  | 'OTHER';

export interface LeadCallLog {
  id: string;
  leadId: string;
  organizationId: string;
  userId: string;
  direction: CallDirection;
  outcome: CallOutcome;
  calledAt: string;
  durationSeconds: number | null;
  notes: string | null;
  followUpNeeded: boolean;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
  };
  followUpTask?: LeadTask | null;
}

export interface CreateCallLogInput {
  direction: CallDirection;
  outcome: CallOutcome;
  calledAt?: string;
  durationSeconds?: number | null;
  notes?: string | null;
  followUpNeeded?: boolean;
  followUpDate?: string | null;
}

export interface Lead {
  id: string;
  organizationId?: string | null;
  source: LeadSource;
  externalId?: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  assignedUserId: string | null;
  assignedUser?: { id: string; name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
  requirements?: LeadRequirement | null;
  proposals?: LeadRequirementProposal[];
  assignmentHistory?: LeadAssignmentHistory[];
  callLogs?: LeadCallLog[];
  tasks?: LeadTask[];
  siteVisits?: SiteVisit[];
  deal?: Deal | null;
  daysSinceLastActivity?: number;
  isInactiveWarning?: boolean;
  _count?: {
    matches?: number;
    conversations?: number;
    tasks?: number;
  };
}

export type LeadTaskType =
  | 'CALL'
  | 'MESSAGE'
  | 'SITE_VISIT'
  | 'SEND_DETAILS'
  | 'DOCUMENT_FOLLOW_UP'
  | 'OTHER';

export type LeadTaskStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';

export interface LeadTask {
  id: string;
  leadId: string;
  organizationId: string;
  taskType: LeadTaskType;
  title: string;
  description: string | null;
  dueDate: string;
  status: LeadTaskStatus;
  priority: LeadPriority;
  assignedUserId: string;
  createdById: string;
  completedAt: string | null;
  completedById: string | null;
  callLogId: string | null;
  siteVisitId?: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
  lead?: {
    id: string;
    fullName: string;
    status: LeadStatus;
    priority: LeadPriority;
  };
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
  };
  createdByUser?: {
    id: string;
    name: string | null;
    email: string;
  };
  completedUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface CreateLeadTaskInput {
  taskType?: LeadTaskType;
  title: string;
  description?: string | null;
  dueDate: string;
  priority?: LeadPriority;
  assignedUserId?: string;
}

export interface UpdateLeadTaskInput {
  taskType?: LeadTaskType;
  title?: string;
  description?: string | null;
  dueDate?: string;
  priority?: LeadPriority;
  assignedUserId?: string;
}

export type SiteVisitStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface SiteVisit {
  id: string;
  leadId: string;
  organizationId: string;
  propertyId: string | null;
  assignedUserId: string;
  createdById: string;
  startAt: string;
  endAt: string;
  status: SiteVisitStatus;
  meetingLocation: string | null;
  notes: string | null;
  outcomeNotes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledById: string | null;
  completedAt: string | null;
  completedById: string | null;
  noShowAt: string | null;
  noShowById: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    fullName: string;
    status: LeadStatus;
    priority: LeadPriority;
  };
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    price: number;
  } | null;
  assignedUser?: {
    id: string;
    name: string | null;
    email: string;
  };
  createdByUser?: {
    id: string;
    name: string | null;
    email: string;
  };
  cancelledUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  completedUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  leadTask?: {
    id: string;
    title: string;
    status: LeadTaskStatus;
    dueDate: string;
    priority: LeadPriority;
  } | null;
}

export interface ScheduleSiteVisitInput {
  propertyId?: string | null;
  startAt: string;
  endAt?: string;
  durationMinutes?: number;
  meetingLocation?: string | null;
  notes?: string | null;
  assignedUserId?: string;
}

export interface RescheduleSiteVisitInput {
  startAt?: string;
  endAt?: string;
  durationMinutes?: number;
  meetingLocation?: string | null;
  notes?: string | null;
  propertyId?: string | null;
  assignedUserId?: string;
}

// ─── P1E: Unified Lead Activity Timeline ─────────────────────────────────────

export type TimelineCategory = 'ALL' | 'CALLS' | 'TASKS' | 'VISITS' | 'OWNERSHIP';

export interface TimelineEvent {
  id: string;
  eventType:
    | 'LEAD_CREATED'
    | 'LEAD_CLAIMED'
    | 'LEAD_RELEASED'
    | 'LEAD_REASSIGNED'
    | 'CALL_LOGGED'
    | 'TASK_CREATED'
    | 'TASK_COMPLETED'
    | 'TASK_CANCELLED'
    | 'SITE_VISIT_SCHEDULED'
    | 'SITE_VISIT_COMPLETED'
    | 'SITE_VISIT_CANCELLED'
    | 'SITE_VISIT_NO_SHOW';
  category: 'OWNERSHIP' | 'CALLS' | 'TASKS' | 'VISITS';
  timestamp: string;
  actor: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  title: string;
  description?: string | null;
  outcome?: string | null;
  metadata?: Record<string, any>;
  entityId: string;
  entityType: 'Lead' | 'LeadAssignmentHistory' | 'LeadCallLog' | 'LeadTask' | 'SiteVisit';
}

export interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  limit: number;
  offset: number;
}

// ─── P1E: Advisor Action Queue ────────────────────────────────────────────────

export type ActionQueueBucket = 'all' | 'overdue' | 'today' | 'upcoming' | 'attention' | 'completed';

export interface ActionQueueItem {
  id: string;
  actionType: 'TASK' | 'SITE_VISIT' | 'ATTENTION_LEAD';
  bucket: 'overdue' | 'today' | 'upcoming' | 'attention' | 'completed';
  title: string;
  description?: string | null;
  priority: LeadPriority;
  dueDate: string;
  attentionReason?: string | null;
  lead: {
    id: string;
    fullName: string;
    status: LeadStatus;
    priority: LeadPriority;
    email?: string | null;
    phone?: string | null;
  };
  assignedUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  leadTaskId?: string | null;
  siteVisitId?: string | null;
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    price: number;
  } | null;
  completedAt?: string | null;
  completedByUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
}

export interface ActionQueueSummary {
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
  attentionCount: number;
  completedCount: number;
  totalActive: number;
}

export interface ActionQueueResponse {
  summary: ActionQueueSummary;
  items: ActionQueueItem[];
  timezone: string;
  advisorId?: string | null;
}
