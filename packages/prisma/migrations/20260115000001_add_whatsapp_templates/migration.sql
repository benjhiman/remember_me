-- CreateEnum
CREATE TYPE "WhatsAppTemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'DISABLED');

-- AlterEnum (add SEND_MESSAGE_TEMPLATE to IntegrationJobType)
ALTER TYPE "IntegrationJobType" ADD VALUE 'SEND_MESSAGE_TEMPLATE';

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
