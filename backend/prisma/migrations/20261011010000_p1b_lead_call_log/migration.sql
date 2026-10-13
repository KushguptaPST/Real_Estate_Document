-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('CONNECTED', 'NO_ANSWER', 'BUSY', 'CALLBACK_REQUESTED', 'VOICEMAIL', 'WRONG_NUMBER', 'OTHER');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CALL_LOGGED';

-- CreateTable
CREATE TABLE "lead_call_logs" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER,
    "notes" TEXT,
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_call_logs_leadId_calledAt_idx" ON "lead_call_logs"("leadId", "calledAt");

-- CreateIndex
CREATE INDEX "lead_call_logs_organizationId_calledAt_idx" ON "lead_call_logs"("organizationId", "calledAt");

-- CreateIndex
CREATE INDEX "lead_call_logs_userId_idx" ON "lead_call_logs"("userId");

-- AddForeignKey
ALTER TABLE "lead_call_logs" ADD CONSTRAINT "lead_call_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_call_logs" ADD CONSTRAINT "lead_call_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_call_logs" ADD CONSTRAINT "lead_call_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

