-- Create Customer table if it doesn't exist (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Customer'
    ) THEN
        CREATE TABLE "Customer" (
            "id" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            "createdById" TEXT,
            "assignedToId" TEXT,
            "name" TEXT NOT NULL,
            "email" TEXT,
            "phone" TEXT,
            "taxId" TEXT,
            "city" TEXT,
            "address" TEXT,
            "instagram" TEXT,
            "web" TEXT,
            "notes" TEXT,
            "status" TEXT NOT NULL DEFAULT 'ACTIVE',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
        );
        
        -- Add foreign keys for Customer table
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdById_fkey" 
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedToId_fkey" 
        FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        
        -- Create indexes for Customer table
        CREATE INDEX "Customer_organizationId_createdAt_idx" ON "Customer"("organizationId", "createdAt");
        CREATE INDEX "Customer_organizationId_name_idx" ON "Customer"("organizationId", "name");
        CREATE INDEX "Customer_organizationId_status_idx" ON "Customer"("organizationId", "status");
        CREATE INDEX "Customer_organizationId_assignedToId_idx" ON "Customer"("organizationId", "assignedToId");
    END IF;
END $$;

-- Add assignedToId to Customer table if it doesn't exist (idempotent)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Customer'
    ) AND NOT EXISTS (
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
-- Only add if email column exists and constraint doesn't exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Customer'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Customer' 
        AND column_name = 'email'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Customer_organizationId_email_key'
        AND table_name = 'Customer'
    ) THEN
        -- Only add constraint if there are no duplicate emails
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

-- AddForeignKey (idempotent) for assignedToId
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Customer'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Customer' 
        AND column_name = 'assignedToId'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Customer_assignedToId_fkey'
        AND table_name = 'Customer'
    ) THEN
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedToId_fkey" 
        FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable (idempotent) CommissionConfig
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

-- CreateTable (idempotent) CommissionPerModel
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
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CommissionConfig'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CommissionConfig_organizationId_fkey'
        AND table_name = 'CommissionConfig'
    ) THEN
        ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CommissionConfig'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CommissionConfig_sellerId_fkey'
        AND table_name = 'CommissionConfig'
    ) THEN
        ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_sellerId_fkey" 
        FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (idempotent) for CommissionPerModel
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CommissionPerModel'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CommissionPerModel_organizationId_fkey'
        AND table_name = 'CommissionPerModel'
    ) THEN
        ALTER TABLE "CommissionPerModel" ADD CONSTRAINT "CommissionPerModel_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CommissionPerModel'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CommissionPerModel_sellerId_fkey'
        AND table_name = 'CommissionPerModel'
    ) THEN
        ALTER TABLE "CommissionPerModel" ADD CONSTRAINT "CommissionPerModel_sellerId_fkey" 
        FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddUniqueConstraint (idempotent) for CommissionConfig
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CommissionConfig'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CommissionConfig_organizationId_sellerId_key'
        AND table_name = 'CommissionConfig'
    ) THEN
        ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_organizationId_sellerId_key" UNIQUE ("organizationId", "sellerId");
    END IF;
END $$;

-- AddUniqueConstraint (idempotent) for CommissionPerModel
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'CommissionPerModel'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'CommissionPerModel_organizationId_sellerId_itemGroupKey_key'
        AND table_name = 'CommissionPerModel'
    ) THEN
        ALTER TABLE "CommissionPerModel" ADD CONSTRAINT "CommissionPerModel_organizationId_sellerId_itemGroupKey_key" UNIQUE ("organizationId", "sellerId", "itemGroupKey");
    END IF;
END $$;
