-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "PriceList" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "PriceListItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "itemGroupKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseSku" TEXT,
    "basePrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "PriceListItemOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "priceListItemId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceListItemOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent - drop if exists first to avoid conflicts)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceList_organizationId_idx' AND tablename = 'PriceList') THEN
        CREATE INDEX "PriceList_organizationId_idx" ON "PriceList"("organizationId");
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceList_organizationId_name_key' AND tablename = 'PriceList') THEN
        CREATE UNIQUE INDEX "PriceList_organizationId_name_key" ON "PriceList"("organizationId", "name");
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceListItem_organizationId_idx' AND tablename = 'PriceListItem') THEN
        CREATE INDEX "PriceListItem_organizationId_idx" ON "PriceListItem"("organizationId");
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceListItem_priceListId_idx' AND tablename = 'PriceListItem') THEN
        CREATE INDEX "PriceListItem_priceListId_idx" ON "PriceListItem"("priceListId");
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceListItem_itemGroupKey_idx' AND tablename = 'PriceListItem') THEN
        CREATE INDEX "PriceListItem_itemGroupKey_idx" ON "PriceListItem"("itemGroupKey");
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceListItem_priceListId_itemGroupKey_key' AND tablename = 'PriceListItem') THEN
        CREATE UNIQUE INDEX "PriceListItem_priceListId_itemGroupKey_key" ON "PriceListItem"("priceListId", "itemGroupKey");
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceListItemOverride_organizationId_idx' AND tablename = 'PriceListItemOverride') THEN
        CREATE INDEX "PriceListItemOverride_organizationId_idx" ON "PriceListItemOverride"("organizationId");
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceListItemOverride_priceListItemId_idx' AND tablename = 'PriceListItemOverride') THEN
        CREATE INDEX "PriceListItemOverride_priceListItemId_idx" ON "PriceListItemOverride"("priceListItemId");
    END IF;
END $$;

-- CreateIndex (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PriceListItemOverride_priceListItemId_variantKey_key' AND tablename = 'PriceListItemOverride') THEN
        CREATE UNIQUE INDEX "PriceListItemOverride_priceListItemId_variantKey_key" ON "PriceListItemOverride"("priceListItemId", "variantKey");
    END IF;
END $$;

-- AddForeignKey (idempotent - drop if exists first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PriceList_organizationId_fkey' 
        AND conrelid = 'PriceList'::regclass
    ) THEN
        ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PriceListItem_organizationId_fkey' 
        AND conrelid = 'PriceListItem'::regclass
    ) THEN
        ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PriceListItem_priceListId_fkey' 
        AND conrelid = 'PriceListItem'::regclass
    ) THEN
        ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_priceListId_fkey" 
        FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PriceListItemOverride_organizationId_fkey' 
        AND conrelid = 'PriceListItemOverride'::regclass
    ) THEN
        ALTER TABLE "PriceListItemOverride" ADD CONSTRAINT "PriceListItemOverride_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PriceListItemOverride_priceListItemId_fkey' 
        AND conrelid = 'PriceListItemOverride'::regclass
    ) THEN
        ALTER TABLE "PriceListItemOverride" ADD CONSTRAINT "PriceListItemOverride_priceListItemId_fkey" 
        FOREIGN KEY ("priceListItemId") REFERENCES "PriceListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
