-- CreateTable
CREATE TABLE "lead_assignment_history" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "previousUserId" TEXT,
    "assignedUserId" TEXT,
    "changedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_assignment_history_leadId_createdAt_idx" ON "lead_assignment_history"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_assignment_history_organizationId_idx" ON "lead_assignment_history"("organizationId");

-- CreateIndex
CREATE INDEX "lead_assignment_history_assignedUserId_idx" ON "lead_assignment_history"("assignedUserId");

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_previousUserId_fkey" FOREIGN KEY ("previousUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignment_history" ADD CONSTRAINT "lead_assignment_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
