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
    CREATE TYPE "IntegrationProvider" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK');
  END IF;
END $$;

-- Ensure MessageDirection exists (idempotent for dev/staging drift)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'MessageDirection'
  ) THEN
    CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
  END IF;
END $$;

-- CreateEnum: MessageStatus (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'MessageStatus'
  ) THEN
    CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "status" "MessageStatus" DEFAULT 'QUEUED',
ADD COLUMN     "externalMessageId" TEXT,
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_externalMessageId_key" ON "MessageLog"("externalMessageId") WHERE "externalMessageId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "MessageLog_externalMessageId_idx" ON "MessageLog"("externalMessageId");
