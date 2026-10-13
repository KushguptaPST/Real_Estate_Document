-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE_FORM', 'PORTAL_INQUIRY', 'WHATSAPP', 'EMAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MODIFIED');

-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('AUTOPILOT', 'DRAFT_ONLY', 'HUMAN_TAKEOVER', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'WEB_CHAT');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('CUSTOMER', 'AGENT', 'AI');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EDITED');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'UNDER_CONTRACT', 'SOLD', 'OFF_MARKET');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('PURCHASE_AGREEMENT', 'COUNTER_OFFER', 'ADDENDUM', 'INSPECTION_REPORT', 'HOA_DISCLOSURE', 'TITLE_COMMITMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "IndexStatus" AS ENUM ('PENDING', 'INDEXING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ChunkSource" AS ENUM ('text', 'ocr');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'DELIVERED', 'BOUNCED', 'DROPPED');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('calendar', 'business');

-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'MISSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DOCUMENT_UPLOADED', 'EXTRACTION_STARTED', 'EXTRACTION_COMPLETED', 'DEADLINE_CONFIRMED', 'DEADLINE_EDITED', 'DEADLINE_ACTIVATED', 'ALERT_SENT', 'DEAL_CREATED', 'DEAL_UPDATED', 'ASSISTANT_QUERY', 'DOCUMENT_INDEXED', 'EMAIL_SENT_TEST', 'EMAIL_INBOUND_RECEIVED', 'LEAD_CREATED', 'LEAD_UPDATED', 'LEAD_REQUIREMENTS_EXTRACTED', 'HUMAN_TAKEOVER_TOGGLED', 'PROPERTY_CREATED', 'PROPERTY_MATCHED', 'TASK_EXTRACTED', 'TASK_APPROVED', 'TASK_COMPLETED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "pictureUrl" TEXT,
    "organizationId" TEXT,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE_FORM',
    "externalId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_requirements" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "minBudget" DOUBLE PRECISION,
    "maxBudget" DOUBLE PRECISION,
    "preferredLocations" TEXT[],
    "propertyType" TEXT,
    "minBedrooms" INTEGER,
    "maxBedrooms" INTEGER,
    "possessionTimeline" TEXT,
    "notes" TEXT,
    "rawAiExtraction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_requirement_proposals" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organizationId" TEXT,
    "proposedMinBudget" DOUBLE PRECISION,
    "proposedMaxBudget" DOUBLE PRECISION,
    "proposedLocations" TEXT[],
    "proposedPropertyType" TEXT,
    "proposedMinBedrooms" INTEGER,
    "proposedMaxBedrooms" INTEGER,
    "proposedTimeline" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourceMessageId" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "lead_requirement_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_threads" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organizationId" TEXT,
    "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL',
    "state" "ConversationState" NOT NULL DEFAULT 'AUTOPILOT',
    "isHumanTakeover" BOOLEAN NOT NULL DEFAULT false,
    "takeoverBy" TEXT,
    "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "organizationId" TEXT,
    "senderType" "SenderType" NOT NULL,
    "senderId" TEXT,
    "content" TEXT NOT NULL,
    "suggestedAction" JSONB,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" DOUBLE PRECISION NOT NULL,
    "propertyType" TEXT NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "possessionDate" TIMESTAMP(3),
    "features" TEXT[],
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_matches" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "organizationId" TEXT,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "aiExplanationConfidence" DOUBLE PRECISION,
    "matchReason" TEXT NOT NULL,
    "failedCriteria" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_tasks" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION,
    "assignedTo" TEXT,
    "isHumanReviewed" BOOLEAN NOT NULL DEFAULT false,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_proposals" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "organizationId" TEXT,
    "sourceDocumentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "proposedDueDate" TIMESTAMP(3) NOT NULL,
    "proposedAmount" DOUBLE PRECISION,
    "sourceQuote" TEXT,
    "sourcePage" INTEGER,
    "confidence" DOUBLE PRECISION,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "task_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "organizationId" TEXT,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_documents" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "leadId" TEXT,
    "propertyAddress" TEXT NOT NULL,
    "buyerName" TEXT,
    "sellerName" TEXT,
    "acceptanceDate" TIMESTAMP(3),
    "status" "DealStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "inboundAlias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "organizationId" TEXT,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER,
    "docType" "DocType" NOT NULL DEFAULT 'OTHER',
    "effectiveDate" TIMESTAMP(3),
    "pageCount" INTEGER,
    "indexStatus" "IndexStatus" NOT NULL DEFAULT 'PENDING',
    "indexedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "organizationId" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "sectionTitle" TEXT,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "source" "ChunkSource" NOT NULL DEFAULT 'text',
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "organizationId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "suggestedFollowUps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "organizationId" TEXT,
    "recipients" JSONB NOT NULL,
    "window3d" BOOLEAN NOT NULL DEFAULT true,
    "window1d" BOOLEAN NOT NULL DEFAULT true,
    "windowDayOf" BOOLEAN NOT NULL DEFAULT true,
    "windowMissed" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "organizationId" TEXT,
    "deadlineId" TEXT,
    "recipient" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contingency_clauses" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "organizationId" TEXT,
    "clauseType" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "boundingBox" JSONB,
    "confidence" DOUBLE PRECISION,
    "numberOfDays" INTEGER,
    "dayType" "DayType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contingency_clauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadlines" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "organizationId" TEXT,
    "clauseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "computedDate" TIMESTAMP(3) NOT NULL,
    "confirmedDate" TIMESTAMP(3),
    "dayType" "DayType" NOT NULL DEFAULT 'calendar',
    "status" "DeadlineStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "alertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "organizationId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "actor" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "leads_organizationId_status_idx" ON "leads"("organizationId", "status");

-- CreateIndex
CREATE INDEX "leads_email_phone_idx" ON "leads"("email", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "leads_organizationId_email_key" ON "leads"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_organizationId_phone_key" ON "leads"("organizationId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "lead_requirements_leadId_key" ON "lead_requirements"("leadId");

-- CreateIndex
CREATE INDEX "lead_requirement_proposals_leadId_status_idx" ON "lead_requirement_proposals"("leadId", "status");

-- CreateIndex
CREATE INDEX "lead_requirement_proposals_organizationId_idx" ON "lead_requirement_proposals"("organizationId");

-- CreateIndex
CREATE INDEX "conversation_threads_leadId_idx" ON "conversation_threads"("leadId");

-- CreateIndex
CREATE INDEX "conversation_threads_organizationId_idx" ON "conversation_threads"("organizationId");

-- CreateIndex
CREATE INDEX "conversation_messages_threadId_idx" ON "conversation_messages"("threadId");

-- CreateIndex
CREATE INDEX "conversation_messages_organizationId_idx" ON "conversation_messages"("organizationId");

-- CreateIndex
CREATE INDEX "properties_organizationId_price_bedrooms_status_idx" ON "properties"("organizationId", "price", "bedrooms", "status");

-- CreateIndex
CREATE INDEX "property_matches_organizationId_idx" ON "property_matches"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "property_matches_leadId_propertyId_key" ON "property_matches"("leadId", "propertyId");

-- CreateIndex
CREATE INDEX "transaction_tasks_dealId_status_idx" ON "transaction_tasks"("dealId", "status");

-- CreateIndex
CREATE INDEX "transaction_tasks_organizationId_idx" ON "transaction_tasks"("organizationId");

-- CreateIndex
CREATE INDEX "task_proposals_dealId_status_idx" ON "task_proposals"("dealId", "status");

-- CreateIndex
CREATE INDEX "task_proposals_organizationId_idx" ON "task_proposals"("organizationId");

-- CreateIndex
CREATE INDEX "webhook_events_organizationId_provider_idx" ON "webhook_events"("organizationId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_externalEventId_key" ON "webhook_events"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "kb_documents_organizationId_idx" ON "kb_documents"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_inboundAlias_key" ON "deals"("inboundAlias");

-- CreateIndex
CREATE INDEX "deals_organizationId_idx" ON "deals"("organizationId");

-- CreateIndex
CREATE INDEX "documents_dealId_idx" ON "documents"("dealId");

-- CreateIndex
CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");

-- CreateIndex
CREATE INDEX "document_chunks_dealId_documentId_idx" ON "document_chunks"("dealId", "documentId");

-- CreateIndex
CREATE INDEX "document_chunks_dealId_pageNumber_idx" ON "document_chunks"("dealId", "pageNumber");

-- CreateIndex
CREATE INDEX "document_chunks_organizationId_idx" ON "document_chunks"("organizationId");

-- CreateIndex
CREATE INDEX "assistant_conversations_dealId_idx" ON "assistant_conversations"("dealId");

-- CreateIndex
CREATE INDEX "assistant_conversations_organizationId_idx" ON "assistant_conversations"("organizationId");

-- CreateIndex
CREATE INDEX "assistant_messages_conversationId_idx" ON "assistant_messages"("conversationId");

-- CreateIndex
CREATE INDEX "assistant_messages_organizationId_idx" ON "assistant_messages"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_dealId_key" ON "notification_settings"("dealId");

-- CreateIndex
CREATE INDEX "notification_settings_organizationId_idx" ON "notification_settings"("organizationId");

-- CreateIndex
CREATE INDEX "email_logs_dealId_idx" ON "email_logs"("dealId");

-- CreateIndex
CREATE INDEX "email_logs_organizationId_idx" ON "email_logs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_deadlineId_template_key" ON "email_logs"("deadlineId", "template");

-- CreateIndex
CREATE INDEX "contingency_clauses_organizationId_idx" ON "contingency_clauses"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "deadlines_clauseId_key" ON "deadlines"("clauseId");

-- CreateIndex
CREATE INDEX "deadlines_organizationId_idx" ON "deadlines"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_requirements" ADD CONSTRAINT "lead_requirements_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_requirement_proposals" ADD CONSTRAINT "lead_requirement_proposals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_threads" ADD CONSTRAINT "conversation_threads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "conversation_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_matches" ADD CONSTRAINT "property_matches_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_matches" ADD CONSTRAINT "property_matches_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_tasks" ADD CONSTRAINT "transaction_tasks_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_proposals" ADD CONSTRAINT "task_proposals_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contingency_clauses" ADD CONSTRAINT "contingency_clauses_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contingency_clauses" ADD CONSTRAINT "contingency_clauses_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "contingency_clauses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

