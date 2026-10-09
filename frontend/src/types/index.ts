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
