-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'AGENT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'AGENT',
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'AGENT',
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_api_keys" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'lead_intake',
    "createdById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_organizationId_email_idx" ON "invitations"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "organization_api_keys_keyHash_key" ON "organization_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "organization_api_keys_organizationId_idx" ON "organization_api_keys"("organizationId");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_api_keys" ADD CONSTRAINT "organization_api_keys_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data: every pre-existing organization gets exactly one OWNER — its earliest
-- member — so invite-only membership can be administered. Non-destructive:
-- only the new "role" column is written; no rows are deleted or reassigned.
UPDATE "users" SET "role" = 'OWNER'
WHERE "id" IN (
  SELECT DISTINCT ON ("organizationId") "id"
  FROM "users"
  WHERE "organizationId" IS NOT NULL
  ORDER BY "organizationId", "createdAt" ASC
);
