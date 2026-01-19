-- CreateEnum: WhatsAppTemplateCategory (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'WhatsAppTemplateCategory'
  ) THEN
    CREATE TYPE "WhatsAppTemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');
  END IF;
END $$;

-- CreateEnum: WhatsAppTemplateStatus (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'WhatsAppTemplateStatus'
  ) THEN
    CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'DISABLED');
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
    CREATE TYPE "IntegrationJobType" AS ENUM ('SEND_MESSAGE', 'PROCESS_WEBHOOK', 'SYNC_ACCOUNT', 'RETRY');
  END IF;
END $$;

-- AlterEnum: Add 'SEND_MESSAGE_TEMPLATE' to IntegrationJobType (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'IntegrationJobType'
      AND e.enumlabel = 'SEND_MESSAGE_TEMPLATE'
  ) THEN
    ALTER TYPE "IntegrationJobType" ADD VALUE 'SEND_MESSAGE_TEMPLATE';
  END IF;
END $$;

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'es_AR',
    "category" "WhatsAppTemplateCategory" NOT NULL,
    "componentsJson" JSONB NOT NULL,
    "status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'PENDING',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_organizationId_name_language_key" ON "WhatsAppTemplate"("organizationId", "name", "language");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_organizationId_status_idx" ON "WhatsAppTemplate"("organizationId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_organizationId_category_idx" ON "WhatsAppTemplate"("organizationId", "category");

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
