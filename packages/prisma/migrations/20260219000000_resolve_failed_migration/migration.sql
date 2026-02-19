-- Migration Resolution: Mark failed migration as applied and complete missing changes
-- This migration resolves the failed state of 20260217000000_add_customer_assigned_seller_and_commissions

-- First, ensure all changes from the failed migration are applied (idempotent)

-- Add assignedToId to Customer if it doesn't exist
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

-- Add taxId to Customer if it doesn't exist
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

-- Create index for assignedToId if it doesn't exist
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

-- Add unique constraint for email (only if no duplicates exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Customer' 
        AND column_name = 'email'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Customer_organizationId_email_key'
    ) THEN
        -- Check for duplicates before adding constraint
        IF NOT EXISTS (
            SELECT 1 FROM "Customer" 
            WHERE email IS NOT NULL 
            GROUP BY "organizationId", email 
            HAVING COUNT(*) > 1
        ) THEN
            ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_email_key" UNIQUE ("organizationId", "email");
        END IF;
    END IF;
END $$;

-- Add foreign key for assignedToId if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Customer_assignedToId_fkey'
    ) THEN
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedToId_fkey" 
        FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Create CommissionConfig table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CommissionConfig'
    ) THEN
        CREATE TABLE "CommissionConfig" (
            "id" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            "sellerId" TEXT NOT NULL,
            "mode" TEXT NOT NULL,
            "value" DECIMAL(10,2) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CommissionConfig_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Create CommissionPerModel table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CommissionPerModel'
    ) THEN
        CREATE TABLE "CommissionPerModel" (
            "id" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            "sellerId" TEXT NOT NULL,
            "itemGroupKey" TEXT NOT NULL,
            "value" DECIMAL(10,2) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CommissionPerModel_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- Create indexes for CommissionConfig
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

-- Create indexes for CommissionPerModel
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

-- Add foreign keys for CommissionConfig
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionConfig_organizationId_fkey'
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
    ) THEN
        ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_sellerId_fkey" 
        FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign keys for CommissionPerModel
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionPerModel_organizationId_fkey'
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
    ) THEN
        ALTER TABLE "CommissionPerModel" ADD CONSTRAINT "CommissionPerModel_sellerId_fkey" 
        FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Add unique constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionConfig_organizationId_sellerId_key'
    ) THEN
        ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_organizationId_sellerId_key" UNIQUE ("organizationId", "sellerId");
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CommissionPerModel_organizationId_sellerId_itemGroupKey_key'
    ) THEN
        ALTER TABLE "CommissionPerModel" ADD CONSTRAINT "CommissionPerModel_organizationId_sellerId_itemGroupKey_key" UNIQUE ("organizationId", "sellerId", "itemGroupKey");
    END IF;
END $$;
