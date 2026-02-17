-- Add isDefault column to Folder table
ALTER TABLE "Folder" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Create index for isDefault
CREATE INDEX IF NOT EXISTS "Folder_organizationId_isDefault_idx" ON "Folder"("organizationId", "isDefault");

-- Step 1: Create default "IPHONE" folder for each organization that doesn't have it
INSERT INTO "Folder" ("id", "organizationId", "name", "description", "isDefault", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid()::text as id,
  o.id as "organizationId",
  'IPHONE' as name,
  'Carpeta por defecto para items iPhone' as description,
  true as "isDefault",
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "Folder" f 
  WHERE f."organizationId" = o.id 
  AND f.name = 'IPHONE'
)
ON CONFLICT DO NOTHING;

-- Step 2: Update all existing items without folderId to point to their org's default "IPHONE" folder
UPDATE "Item" i
SET "folderId" = (
  SELECT f.id 
  FROM "Folder" f 
  WHERE f."organizationId" = i."organizationId" 
  AND f.name = 'IPHONE' 
  AND f."isDefault" = true
  LIMIT 1
)
WHERE i."folderId" IS NULL
AND EXISTS (
  SELECT 1 FROM "Folder" f 
  WHERE f."organizationId" = i."organizationId" 
  AND f.name = 'IPHONE'
);
