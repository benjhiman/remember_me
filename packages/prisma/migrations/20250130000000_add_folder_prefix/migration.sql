-- CreateTable
CREATE TABLE IF NOT EXISTS "FolderPrefix" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolderPrefix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FolderPrefix_organizationId_prefix_key" ON "FolderPrefix"("organizationId", "prefix");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FolderPrefix_organizationId_idx" ON "FolderPrefix"("organizationId");

-- AddForeignKey
ALTER TABLE "FolderPrefix" ADD CONSTRAINT IF NOT EXISTS "FolderPrefix_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
