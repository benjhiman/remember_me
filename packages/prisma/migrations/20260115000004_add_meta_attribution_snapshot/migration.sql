-- CreateEnum: AttributionSource (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'AttributionSource'
  ) THEN
    CREATE TYPE "AttributionSource" AS ENUM ('META_LEAD_ADS');
  END IF;
END $$;

-- CreateTable
CREATE TABLE "MetaAttributionSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "leadId" TEXT,
    "source" "AttributionSource" NOT NULL DEFAULT 'META_LEAD_ADS',
    "campaignId" TEXT,
    "adsetId" TEXT,
    "adId" TEXT,
    "formId" TEXT,
    "pageId" TEXT,
    "leadgenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAttributionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaAttributionSnapshot_saleId_key" ON "MetaAttributionSnapshot"("saleId");

-- CreateIndex
CREATE INDEX "MetaAttributionSnapshot_organizationId_campaignId_idx" ON "MetaAttributionSnapshot"("organizationId", "campaignId");

-- CreateIndex
CREATE INDEX "MetaAttributionSnapshot_organizationId_adId_idx" ON "MetaAttributionSnapshot"("organizationId", "adId");

-- CreateIndex
CREATE INDEX "MetaAttributionSnapshot_organizationId_createdAt_idx" ON "MetaAttributionSnapshot"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "MetaAttributionSnapshot_organizationId_source_idx" ON "MetaAttributionSnapshot"("organizationId", "source");

-- AddForeignKey
ALTER TABLE "MetaAttributionSnapshot" ADD CONSTRAINT "MetaAttributionSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAttributionSnapshot" ADD CONSTRAINT "MetaAttributionSnapshot_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAttributionSnapshot" ADD CONSTRAINT "MetaAttributionSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
