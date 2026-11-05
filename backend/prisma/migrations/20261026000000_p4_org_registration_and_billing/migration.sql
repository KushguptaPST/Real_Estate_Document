-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "subscriptionTier" TEXT NOT NULL DEFAULT 'SOLO',
ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "planExpiresAt" TIMESTAMP(3),
ADD COLUMN "stateJurisdiction" TEXT DEFAULT 'CA';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "googleId" DROP NOT NULL,
ADD COLUMN "passwordHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeSubscriptionId_key" ON "organizations"("stripeSubscriptionId");
