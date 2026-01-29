-- AlterTable
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "seedSource" TEXT,
ADD COLUMN IF NOT EXISTS "seedVersion" INTEGER,
ADD COLUMN IF NOT EXISTS "sortKey" VARCHAR(64);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Item_organizationId_sortKey_idx" ON "Item"("organizationId", "sortKey");
