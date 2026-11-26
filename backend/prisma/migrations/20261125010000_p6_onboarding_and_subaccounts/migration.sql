-- AlterTable
ALTER TABLE "organization_channels" ADD COLUMN     "bspAppId" TEXT,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "plivoComplianceAppId" TEXT,
ADD COLUMN     "plivoComplianceStatus" TEXT DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "whatsappProvider" TEXT;

-- AlterTable
ALTER TABLE "organization_wallets" ALTER COLUMN "balance" SET DEFAULT 0.0,
ALTER COLUMN "autoRechargeEnabled" SET DEFAULT false,
ALTER COLUMN "totalDeposited" SET DEFAULT 0.0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone" TEXT;

