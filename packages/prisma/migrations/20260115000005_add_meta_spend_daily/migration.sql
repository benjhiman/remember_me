-- Ensure IntegrationProvider exists (idempotent for dev/staging drift)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'IntegrationProvider'
  ) THEN
    CREATE TYPE "IntegrationProvider" AS ENUM ('WHATSAPP','INSTAGRAM','FACEBOOK');
  END IF;
END $$;

-- CreateEnum: MetaSpendLevel (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'MetaSpendLevel'
  ) THEN
    CREATE TYPE "MetaSpendLevel" AS ENUM ('CAMPAIGN', 'ADSET', 'AD');
  END IF;
END $$;

-- Ensure IntegrationJobType exists (idempotent for dev/staging drift)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'IntegrationJobType'
  ) THEN
    CREATE TYPE "IntegrationJobType" AS ENUM ('SEND_MESSAGE', 'PROCESS_WEBHOOK', 'SYNC_ACCOUNT', 'RETRY', 'SEND_MESSAGE_TEMPLATE', 'AUTOMATION_ACTION');
  END IF;
END $$;

-- AlterEnum: Add 'FETCH_META_SPEND' to IntegrationJobType (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'IntegrationJobType'
      AND e.enumlabel = 'FETCH_META_SPEND'
  ) THEN
    ALTER TYPE "IntegrationJobType" ADD VALUE 'FETCH_META_SPEND';
  END IF;
END $$;


-- CreateTable
CREATE TABLE "MetaSpendDaily" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'INSTAGRAM',
    "date" DATE NOT NULL,
    "level" "MetaSpendLevel" NOT NULL,
    "campaignId" TEXT,
    "adsetId" TEXT,
    "adId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "spend" DECIMAL(18,2) NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaSpendDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaSpendDaily_organizationId_date_level_campaignId_adsetId_adId_key" ON "MetaSpendDaily"("organizationId", "date", "level", "campaignId", "adsetId", "adId");

-- CreateIndex
CREATE INDEX "MetaSpendDaily_organizationId_date_idx" ON "MetaSpendDaily"("organizationId", "date");

-- CreateIndex
CREATE INDEX "MetaSpendDaily_organizationId_campaignId_idx" ON "MetaSpendDaily"("organizationId", "campaignId");

-- CreateIndex
CREATE INDEX "MetaSpendDaily_organizationId_adId_idx" ON "MetaSpendDaily"("organizationId", "adId");

-- CreateIndex
CREATE INDEX "MetaSpendDaily_organizationId_provider_date_idx" ON "MetaSpendDaily"("organizationId", "provider", "date");

-- AddForeignKey
ALTER TABLE "MetaSpendDaily" ADD CONSTRAINT "MetaSpendDaily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
