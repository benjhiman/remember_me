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
    CREATE TYPE "IntegrationJobType" AS ENUM ('SEND_MESSAGE', 'PROCESS_WEBHOOK', 'SYNC_ACCOUNT', 'RETRY', 'SEND_MESSAGE_TEMPLATE', 'AUTOMATION_ACTION', 'FETCH_META_SPEND');
  END IF;
END $$;

-- AlterEnum: Add 'REFRESH_META_TOKEN' to IntegrationJobType (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'IntegrationJobType'
      AND e.enumlabel = 'REFRESH_META_TOKEN'
  ) THEN
    ALTER TYPE "IntegrationJobType" ADD VALUE 'REFRESH_META_TOKEN';
  END IF;
END $$;

-- AlterTable (add metadataJson to ConnectedAccount)
ALTER TABLE "ConnectedAccount" ADD COLUMN "metadataJson" JSONB;

-- CreateIndex (add unique constraint for organizationId + provider + externalAccountId)
CREATE UNIQUE INDEX "ConnectedAccount_organizationId_provider_externalAccountId_key" ON "ConnectedAccount"("organizationId", "provider", "externalAccountId");
