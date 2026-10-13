-- AlterTable
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "deals_leadId_key" ON "deals"("leadId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "deals_propertyId_idx" ON "deals"("propertyId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'deals_propertyId_fkey'
    ) THEN
        ALTER TABLE "deals" ADD CONSTRAINT "deals_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
