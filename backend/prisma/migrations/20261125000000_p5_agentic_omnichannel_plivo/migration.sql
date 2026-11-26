-- CreateEnum
CREATE TYPE "LeadLifecycleStage" AS ENUM ('NEW_INBOUND', 'DISCOVERY', 'MATCHED', 'COLLATERAL_SENT', 'VISIT_PROPOSED', 'VISIT_BOOKED', 'ADVISOR_HANDOFF', 'DEAL_NEGOTIATION', 'NURTURE', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('IDLE', 'RUNNING', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CampaignEnrollmentStatus" AS ENUM ('PENDING', 'DIALING', 'CONNECTED', 'VOICEMAIL', 'RETRY_SCHEDULED', 'COMPLETED', 'FAILED', 'DND_SKIPPED');

-- CreateEnum
CREATE TYPE "VoiceCallStatus" AS ENUM ('INITIATED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "AgentSpecialist" AS ENUM ('SUPERVISOR', 'QUALIFIER', 'MATCHER', 'CLOSER', 'DOCS_RAG', 'ESCALATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CAMPAIGN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'VOICE_CALL_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'VOICE_CALL_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'COLLATERAL_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'WIDGET_SESSION_CREATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'TELEGRAM';
ALTER TYPE "LeadSource" ADD VALUE 'VOICE_CALL';
ALTER TYPE "LeadSource" ADD VALUE 'WEB_WIDGET';
ALTER TYPE "LeadSource" ADD VALUE 'CSV_CAMPAIGN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageChannel" ADD VALUE 'TELEGRAM';
ALTER TYPE "MessageChannel" ADD VALUE 'VOICE_CALL';
ALTER TYPE "MessageChannel" ADD VALUE 'WEB_WIDGET';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "doNotCall" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredLanguage" TEXT,
ADD COLUMN     "stage" "LeadLifecycleStage" NOT NULL DEFAULT 'NEW_INBOUND';

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "brochureUrl" TEXT,
ADD COLUMN     "builderName" TEXT,
ADD COLUMN     "floorPlanUrl" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "microMarket" TEXT,
ADD COLUMN     "negotiationMarginNote" TEXT,
ADD COLUMN     "possessionStatus" TEXT,
ADD COLUMN     "reraNumber" TEXT;

-- CreateTable
CREATE TABLE "organization_channels" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "whatsappPhoneNumberId" TEXT,
    "whatsappWabaId" TEXT,
    "whatsappAccessToken" TEXT,
    "whatsappVerifyToken" TEXT,
    "telegramBotToken" TEXT,
    "telegramBotUsername" TEXT,
    "telegramWebhookSecret" TEXT,
    "widgetPublicKey" TEXT NOT NULL,
    "widgetAllowedOrigins" TEXT[],
    "widgetTitle" TEXT NOT NULL DEFAULT 'AI Property Advisor',
    "widgetGreeting" TEXT NOT NULL DEFAULT 'Hi! Looking for a property? Tell me your preferred location, budget, or configuration.',
    "widgetThemeColor" TEXT NOT NULL DEFAULT '#0F172A',
    "plivoSubaccountId" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "callingWindowStart" TEXT NOT NULL DEFAULT '09:30',
    "callingWindowEnd" TEXT NOT NULL DEFAULT '19:30',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plivo_numbers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "plivoAlias" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plivo_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "micro_market_adjacencies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceMarket" TEXT NOT NULL,
    "adjacentMarket" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION,
    "commuteNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "micro_market_adjacencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'IDLE',
    "concurrencyTrunks" INTEGER NOT NULL DEFAULT 10,
    "scriptGoal" TEXT,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "callsDialed" INTEGER NOT NULL DEFAULT 0,
    "liveHumansConnected" INTEGER NOT NULL DEFAULT 0,
    "voicemailsDetected" INTEGER NOT NULL DEFAULT 0,
    "busyOrNoAnswer" INTEGER NOT NULL DEFAULT 0,
    "siteVisitsLocked" INTEGER NOT NULL DEFAULT 0,
    "warmTransfersRequested" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_enrollments" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "CampaignEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAmdResult" TEXT,
    "lastCallUuid" TEXT,
    "notes" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_call_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT,
    "campaignId" TEXT,
    "callUuid" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "status" "VoiceCallStatus" NOT NULL DEFAULT 'INITIATED',
    "amdResult" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "recordingUrl" TEXT,
    "transcript" JSONB,
    "summary" TEXT,
    "outcome" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_traces" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "threadId" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "specialist" "AgentSpecialist" NOT NULL,
    "intent" TEXT NOT NULL,
    "stageBefore" "LeadLifecycleStage" NOT NULL,
    "stageAfter" "LeadLifecycleStage" NOT NULL,
    "toolsExecuted" JSONB,
    "guardrailFlags" TEXT[],
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_run_traces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_wallets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 500.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "autoRechargeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rechargeThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
    "rechargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 200.0,
    "voiceMinutesBilled" INTEGER NOT NULL DEFAULT 0,
    "leadsQualified" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeposited" DOUBLE PRECISION NOT NULL DEFAULT 500.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger_entries" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_channels_organizationId_key" ON "organization_channels"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_channels_whatsappPhoneNumberId_key" ON "organization_channels"("whatsappPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_channels_telegramWebhookSecret_key" ON "organization_channels"("telegramWebhookSecret");

-- CreateIndex
CREATE UNIQUE INDEX "organization_channels_widgetPublicKey_key" ON "organization_channels"("widgetPublicKey");

-- CreateIndex
CREATE UNIQUE INDEX "plivo_numbers_phoneNumber_key" ON "plivo_numbers"("phoneNumber");

-- CreateIndex
CREATE INDEX "plivo_numbers_organizationId_isActive_idx" ON "plivo_numbers"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "micro_market_adjacencies_organizationId_sourceMarket_idx" ON "micro_market_adjacencies"("organizationId", "sourceMarket");

-- CreateIndex
CREATE UNIQUE INDEX "micro_market_adjacencies_organizationId_sourceMarket_adjace_key" ON "micro_market_adjacencies"("organizationId", "sourceMarket", "adjacentMarket");

-- CreateIndex
CREATE INDEX "campaigns_organizationId_status_idx" ON "campaigns"("organizationId", "status");

-- CreateIndex
CREATE INDEX "campaign_enrollments_status_nextAttemptAt_idx" ON "campaign_enrollments"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "campaign_enrollments_organizationId_campaignId_idx" ON "campaign_enrollments"("organizationId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_enrollments_campaignId_leadId_key" ON "campaign_enrollments"("campaignId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_call_sessions_callUuid_key" ON "voice_call_sessions"("callUuid");

-- CreateIndex
CREATE INDEX "voice_call_sessions_organizationId_createdAt_idx" ON "voice_call_sessions"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "voice_call_sessions_leadId_idx" ON "voice_call_sessions"("leadId");

-- CreateIndex
CREATE INDEX "voice_call_sessions_campaignId_idx" ON "voice_call_sessions"("campaignId");

-- CreateIndex
CREATE INDEX "agent_run_traces_organizationId_createdAt_idx" ON "agent_run_traces"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_run_traces_leadId_createdAt_idx" ON "agent_run_traces"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_wallets_organizationId_key" ON "organization_wallets"("organizationId");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_walletId_createdAt_idx" ON "wallet_ledger_entries"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "leads_organizationId_stage_idx" ON "leads"("organizationId", "stage");

-- AddForeignKey
ALTER TABLE "organization_channels" ADD CONSTRAINT "organization_channels_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plivo_numbers" ADD CONSTRAINT "plivo_numbers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "micro_market_adjacencies" ADD CONSTRAINT "micro_market_adjacencies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_enrollments" ADD CONSTRAINT "campaign_enrollments_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_enrollments" ADD CONSTRAINT "campaign_enrollments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_enrollments" ADD CONSTRAINT "campaign_enrollments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_call_sessions" ADD CONSTRAINT "voice_call_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_call_sessions" ADD CONSTRAINT "voice_call_sessions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_call_sessions" ADD CONSTRAINT "voice_call_sessions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_traces" ADD CONSTRAINT "agent_run_traces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_run_traces" ADD CONSTRAINT "agent_run_traces_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_wallets" ADD CONSTRAINT "organization_wallets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "organization_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

