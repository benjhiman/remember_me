-- Add assignedToId and taxId to Customer table (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Customer' 
        AND column_name = 'assignedToId'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "assignedToId" TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Customer' 
        AND column_name = 'taxId'
    ) THEN
        ALTER TABLE "Customer" ADD COLUMN "taxId" TEXT;
    END IF;
END $$;

-- CreateIndex (idempotent) for assignedToId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'Customer_organizationId_assignedToId_idx'
    ) THEN
        CREATE INDEX "Customer_organizationId_assignedToId_idx" ON "Customer"("organizationId", "assignedToId");
    END IF;
END $$;

-- Add unique constraint for email (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Customer_organizationId_email_key' 
        AND conrelid = 'Customer'::regclass
    ) THEN
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_email_key" UNIQUE ("organizationId", "email");
    END IF;
END $$;

-- AddForeignKey (idempotent) for assignedToId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Customer_assignedToId_fkey' 
        AND conrelid = 'Customer'::regclass
    ) THEN
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedToId_fkey" 
        FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable (idempotent) CommissionConfig
CREATE TABLE IF NOT EXISTS "CommissionConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable (idempotent) CommissionPerModel
CREATE TABLE IF NOT EXISTS "CommissionPerModel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemGroupKey" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionPerModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent) for CommissionConfig
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'CommissionConfig_organizationId_idx'
    ) THEN
        CREATE INDEX "CommissionConfig_organizationId_idx" ON "CommissionConfig"("organizationId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'CommissionConfig_sellerId_idx'
    ) THEN
        CREATE INDEX "CommissionConfig_sellerId_idx" ON "CommissionConfig"("sellerId");
    END IF;
END $$;

-- CreateIndex (idempotent) for CommissionPerModel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'CommissionPerModel_organizationId_idx'
    ) THEN
        CREATE INDEX "CommissionPerModel_organizationId_idx" ON "CommissionPerModel"("organizationId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'CommissionPerModel_sellerId_idx'
    ) THEN
        CREATE INDEX "CommissionPerModel_sellerId_idx" ON "CommissionPerModel"("sellerId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname = 'CommissionPerModel_itemGroupKey_idx'
    ) THEN
        CREATE INDEX "CommissionPerModel_itemGroupKey_idx" ON "CommissionPerModel"("itemGroupKey");
    END IF;
END $$;

-- AddForeignKey (idempotent) for CommissionConfig
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionConfig_organizationId_fkey' 
        AND conrelid = 'CommissionConfig'::regclass
    ) THEN
        ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionConfig_sellerId_fkey' 
        AND conrelid = 'CommissionConfig'::regclass
    ) THEN
        ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_sellerId_fkey" 
        FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (idempotent) for CommissionPerModel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionPerModel_organizationId_fkey' 
        AND conrelid = 'CommissionPerModel'::regclass
    ) THEN
        ALTER TABLE "CommissionPerModel" ADD CONSTRAINT "CommissionPerModel_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionPerModel_sellerId_fkey' 
        AND conrelid = 'CommissionPerModel'::regclass
    ) THEN
        ALTER TABLE "CommissionPerModel" ADD CONSTRAINT "CommissionPerModel_sellerId_fkey" 
        FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddUniqueConstraint (idempotent) for CommissionConfig
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionConfig_organizationId_sellerId_key' 
        AND conrelid = 'CommissionConfig'::regclass
    ) THEN
        ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_organizationId_sellerId_key" UNIQUE ("organizationId", "sellerId");
    END IF;
END $$;

-- AddUniqueConstraint (idempotent) for CommissionPerModel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionPerModel_organizationId_sellerId_itemGroupKey_key' 
        AND conrelid = 'CommissionPerModel'::regclass
    ) THEN
        ALTER TABLE "CommissionPerModel" ADD CONSTRAINT "CommissionPerModel_organizationId_sellerId_itemGroupKey_key" UNIQUE ("organizationId", "sellerId", "itemGroupKey");
    END IF;
END $$;
