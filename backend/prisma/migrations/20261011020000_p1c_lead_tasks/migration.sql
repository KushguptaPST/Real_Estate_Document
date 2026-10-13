-- CreateEnum
CREATE TYPE "LeadTaskType" AS ENUM ('CALL', 'MESSAGE', 'SITE_VISIT', 'SEND_DETAILS', 'DOCUMENT_FOLLOW_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'LEAD_TASK_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEAD_TASK_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'LEAD_TASK_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'LEAD_TASK_CANCELLED';

-- CreateTable
CREATE TABLE "lead_tasks" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskType" "LeadTaskType" NOT NULL DEFAULT 'CALL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "LeadTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedUserId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "callLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_tasks_callLogId_key" ON "lead_tasks"("callLogId");

-- CreateIndex
CREATE INDEX "lead_tasks_organizationId_status_dueDate_idx" ON "lead_tasks"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "lead_tasks_assignedUserId_status_dueDate_idx" ON "lead_tasks"("assignedUserId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "lead_tasks_leadId_status_idx" ON "lead_tasks"("leadId", "status");

-- CreateIndex
CREATE INDEX "lead_tasks_callLogId_idx" ON "lead_tasks"("callLogId");

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "lead_call_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
