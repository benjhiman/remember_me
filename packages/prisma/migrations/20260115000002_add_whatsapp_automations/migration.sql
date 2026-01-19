-- CreateEnum: WhatsAppAutomationTrigger (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'WhatsAppAutomationTrigger'
  ) THEN
    CREATE TYPE "WhatsAppAutomationTrigger" AS ENUM ('LEAD_CREATED', 'SALE_RESERVED', 'SALE_PAID', 'NO_REPLY_24H');
  END IF;
END $$;

-- CreateEnum: WhatsAppAutomationAction (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'WhatsAppAutomationAction'
  ) THEN
    CREATE TYPE "WhatsAppAutomationAction" AS ENUM ('SEND_TEMPLATE', 'SEND_TEXT');
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
    CREATE TYPE "IntegrationJobType" AS ENUM ('SEND_MESSAGE', 'PROCESS_WEBHOOK', 'SYNC_ACCOUNT', 'RETRY', 'SEND_MESSAGE_TEMPLATE');
  END IF;
END $$;

-- AlterEnum: Add 'AUTOMATION_ACTION' to IntegrationJobType (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'IntegrationJobType'
      AND e.enumlabel = 'AUTOMATION_ACTION'
  ) THEN
    ALTER TYPE "IntegrationJobType" ADD VALUE 'AUTOMATION_ACTION';
  END IF;
END $$;

-- CreateTable
CREATE TABLE "WhatsAppAutomationRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "WhatsAppAutomationTrigger" NOT NULL,
    "action" "WhatsAppAutomationAction" NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cooldownHours" INTEGER NOT NULL DEFAULT 24,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppAutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppAutomationRule_organizationId_trigger_enabled_idx" ON "WhatsAppAutomationRule"("organizationId", "trigger", "enabled");

-- CreateIndex
CREATE INDEX "WhatsAppAutomationRule_organizationId_enabled_idx" ON "WhatsAppAutomationRule"("organizationId", "enabled");

-- AddForeignKey
ALTER TABLE "WhatsAppAutomationRule" ADD CONSTRAINT "WhatsAppAutomationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
