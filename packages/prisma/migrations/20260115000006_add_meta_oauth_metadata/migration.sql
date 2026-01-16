-- AlterEnum (add REFRESH_META_TOKEN to IntegrationJobType)
ALTER TYPE "IntegrationJobType" ADD VALUE 'REFRESH_META_TOKEN';

-- AlterTable (add metadataJson to ConnectedAccount)
ALTER TABLE "ConnectedAccount" ADD COLUMN "metadataJson" JSONB;

-- CreateIndex (add unique constraint for organizationId + provider + externalAccountId)
CREATE UNIQUE INDEX "ConnectedAccount_organizationId_provider_externalAccountId_key" ON "ConnectedAccount"("organizationId", "provider", "externalAccountId");
