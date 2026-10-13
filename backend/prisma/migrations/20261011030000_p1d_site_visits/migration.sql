-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'SITE_VISIT_SCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE 'SITE_VISIT_RESCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE 'SITE_VISIT_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'SITE_VISIT_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'SITE_VISIT_NO_SHOW';

-- AlterTable
ALTER TABLE "lead_tasks" ADD COLUMN "siteVisitId" TEXT;

-- CreateTable
CREATE TABLE "site_visits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "propertyId" TEXT,
    "assignedUserId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "meetingLocation" TEXT,
    "notes" TEXT,
    "outcomeNotes" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "noShowAt" TIMESTAMP(3),
    "noShowById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_tasks_siteVisitId_key" ON "lead_tasks"("siteVisitId");

-- CreateIndex
CREATE INDEX "lead_tasks_siteVisitId_idx" ON "lead_tasks"("siteVisitId");

-- CreateIndex
CREATE INDEX "site_visits_organizationId_status_startAt_endAt_idx" ON "site_visits"("organizationId", "status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "site_visits_assignedUserId_status_startAt_endAt_idx" ON "site_visits"("assignedUserId", "status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "site_visits_leadId_status_startAt_idx" ON "site_visits"("leadId", "status", "startAt");

-- CreateIndex
CREATE INDEX "site_visits_propertyId_idx" ON "site_visits"("propertyId");

-- AddForeignKey
ALTER TABLE "lead_tasks" ADD CONSTRAINT "lead_tasks_siteVisitId_fkey" FOREIGN KEY ("siteVisitId") REFERENCES "site_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_noShowById_fkey" FOREIGN KEY ("noShowById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
