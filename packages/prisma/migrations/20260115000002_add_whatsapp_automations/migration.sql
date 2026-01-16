-- CreateEnum
CREATE TYPE "WhatsAppAutomationTrigger" AS ENUM ('LEAD_CREATED', 'SALE_RESERVED', 'SALE_PAID', 'NO_REPLY_24H');
CREATE TYPE "WhatsAppAutomationAction" AS ENUM ('SEND_TEMPLATE', 'SEND_TEXT');

-- AlterEnum (add AUTOMATION_ACTION to IntegrationJobType)
ALTER TYPE "IntegrationJobType" ADD VALUE 'AUTOMATION_ACTION';

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
