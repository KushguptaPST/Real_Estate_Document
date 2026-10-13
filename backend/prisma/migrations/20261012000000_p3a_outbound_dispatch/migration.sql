-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_APPLICABLE', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRY_PENDING');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_DISPATCH_QUEUED';
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_DELIVERED';
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_DISPATCH_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_BOUNCED';
ALTER TYPE "AuditAction" ADD VALUE 'MESSAGE_RETRY_REQUESTED';

-- AlterTable
ALTER TABLE "conversation_messages" ADD COLUMN "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "failedAt" TIMESTAMP(3),
ADD COLUMN "providerMessageId" TEXT,
ADD COLUMN "deliveryError" TEXT,
ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "conversation_messages_idempotencyKey_key" ON "conversation_messages"("idempotencyKey");
CREATE INDEX "conversation_messages_providerMessageId_idx" ON "conversation_messages"("providerMessageId");
CREATE INDEX "conversation_messages_deliveryStatus_idx" ON "conversation_messages"("deliveryStatus");

-- CreateTable
CREATE TABLE "outbox_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "messageId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'EMAIL',
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_jobs_messageId_key" ON "outbox_jobs"("messageId");
CREATE UNIQUE INDEX "outbox_jobs_idempotencyKey_key" ON "outbox_jobs"("idempotencyKey");
CREATE INDEX "outbox_jobs_status_nextAttemptAt_idx" ON "outbox_jobs"("status", "nextAttemptAt");
CREATE INDEX "outbox_jobs_organizationId_idx" ON "outbox_jobs"("organizationId");
CREATE INDEX "outbox_jobs_providerMessageId_idx" ON "outbox_jobs"("providerMessageId");

-- AddForeignKey
ALTER TABLE "outbox_jobs" ADD CONSTRAINT "outbox_jobs_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
