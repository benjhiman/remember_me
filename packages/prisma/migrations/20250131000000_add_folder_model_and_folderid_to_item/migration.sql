-- CreateTable: Folder
CREATE TABLE IF NOT EXISTS "Folder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Folder organizationId
CREATE INDEX IF NOT EXISTS "Folder_organizationId_idx" ON "Folder"("organizationId");

-- CreateUniqueConstraint: Folder organizationId_name
CREATE UNIQUE INDEX IF NOT EXISTS "Folder_organizationId_name_key" ON "Folder"("organizationId", "name");

-- AddForeignKey: Folder -> Organization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Folder_organizationId_fkey'
    ) THEN
        ALTER TABLE "Folder" ADD CONSTRAINT "Folder_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddColumn: Item.folderId
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "folderId" TEXT;

-- CreateIndex: Item folderId
CREATE INDEX IF NOT EXISTS "Item_folderId_idx" ON "Item"("folderId");

-- CreateIndex: Item organizationId_folderId
CREATE INDEX IF NOT EXISTS "Item_organizationId_folderId_idx" ON "Item"("organizationId", "folderId");

-- AddForeignKey: Item -> Folder
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Item_folderId_fkey'
    ) THEN
        ALTER TABLE "Item" ADD CONSTRAINT "Item_folderId_fkey" 
        FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
