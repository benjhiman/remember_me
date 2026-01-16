-- CreateEnum
CREATE TYPE "MetaSpendLevel" AS ENUM ('CAMPAIGN', 'ADSET', 'AD');

-- AlterEnum (add FETCH_META_SPEND to IntegrationJobType)
ALTER TYPE "IntegrationJobType" ADD VALUE 'FETCH_META_SPEND';

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
