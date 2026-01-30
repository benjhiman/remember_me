-- CreateTable (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'FolderPrefix'
    ) THEN
        CREATE TABLE "FolderPrefix" (
            "id" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            "prefix" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "FolderPrefix_pkey" PRIMARY KEY ("id")
        );
    END IF;
END $$;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "FolderPrefix_organizationId_prefix_key" ON "FolderPrefix"("organizationId", "prefix");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "FolderPrefix_organizationId_idx" ON "FolderPrefix"("organizationId");

-- AddForeignKey (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
        AND constraint_name = 'FolderPrefix_organizationId_fkey'
        AND table_name = 'FolderPrefix'
    ) THEN
        ALTER TABLE "FolderPrefix" 
        ADD CONSTRAINT "FolderPrefix_organizationId_fkey" 
        FOREIGN KEY ("organizationId") 
        REFERENCES "Organization"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;
