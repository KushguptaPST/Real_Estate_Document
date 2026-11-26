-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "isSuspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedReason" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "pauseReason" TEXT;

-- CreateTable
CREATE TABLE "provider_cost_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "units" DOUBLE PRECISION NOT NULL,
    "unitType" TEXT NOT NULL,
    "costInr" DOUBLE PRECISION NOT NULL,
    "leadId" TEXT,
    "callSessionId" TEXT,
    "agentRunTraceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_cost_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "primaryTtsEngine" TEXT NOT NULL DEFAULT 'eleven_flash_v2_5',
    "primaryLlmModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "outboundDialerPaused" BOOLEAN NOT NULL DEFAULT false,
    "maxPlatformConcurrency" INTEGER NOT NULL DEFAULT 50,
    "autoFailoverEnabled" BOOLEAN NOT NULL DEFAULT true,
    "consecutiveTtsFailures" INTEGER NOT NULL DEFAULT 0,
    "lastFailoverAt" TIMESTAMP(3),
    "failoverReason" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_cost_events_organizationId_createdAt_idx" ON "provider_cost_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_cost_events_provider_createdAt_idx" ON "provider_cost_events"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_organizationId_createdAt_idx" ON "admin_audit_logs"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "provider_cost_events" ADD CONSTRAINT "provider_cost_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
