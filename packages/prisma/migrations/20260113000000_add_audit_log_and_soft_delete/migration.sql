-- CreateEnum: AuditAction (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'AuditAction'
  ) THEN
    CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'PAY', 'CANCEL', 'RESERVE', 'CONFIRM', 'RELEASE', 'SHIP', 'DELIVER', 'ASSIGN', 'ADJUST');
  END IF;
END $$;

-- CreateEnum: AuditEntityType (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'AuditEntityType'
  ) THEN
    CREATE TYPE "AuditEntityType" AS ENUM ('Lead', 'StockItem', 'Sale', 'PricingRule', 'Pipeline', 'Stage', 'StockReservation', 'SaleItem', 'Note', 'Task');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Pipeline" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Stage" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StockItem" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PricingRule" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "metadataJson" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
