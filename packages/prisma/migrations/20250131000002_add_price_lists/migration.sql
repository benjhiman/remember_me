-- CreateTable
CREATE TABLE IF NOT EXISTS "PriceList" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PriceListItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "itemGroupKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseSku" TEXT,
    "basePrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PriceListItemOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListItemId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListItemOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceList_organizationId_idx" ON "PriceList"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PriceList_organizationId_name_key" ON "PriceList"("organizationId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceListItem_organizationId_idx" ON "PriceListItem"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceListItem_priceListId_idx" ON "PriceListItem"("priceListId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceListItem_itemGroupKey_idx" ON "PriceListItem"("itemGroupKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PriceListItem_priceListId_itemGroupKey_key" ON "PriceListItem"("priceListId", "itemGroupKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceListItemOverride_organizationId_idx" ON "PriceListItemOverride"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceListItemOverride_priceListItemId_idx" ON "PriceListItemOverride"("priceListItemId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PriceListItemOverride_priceListItemId_variantKey_key" ON "PriceListItemOverride"("priceListItemId", "variantKey");

-- AddForeignKey
ALTER TABLE "PriceList" ADD CONSTRAINT IF NOT EXISTS "PriceList_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT IF NOT EXISTS "PriceListItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItem" ADD CONSTRAINT IF NOT EXISTS "PriceListItem_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItemOverride" ADD CONSTRAINT IF NOT EXISTS "PriceListItemOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceListItemOverride" ADD CONSTRAINT IF NOT EXISTS "PriceListItemOverride_priceListItemId_fkey" FOREIGN KEY ("priceListItemId") REFERENCES "PriceListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
