-- Add new fields to Item model: model, storageGb, condition, color
-- Also add OEM to ItemCondition enum

-- Step 1: Add OEM to ItemCondition enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'OEM' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ItemCondition')
  ) THEN
    ALTER TYPE "ItemCondition" ADD VALUE 'OEM';
  END IF;
END $$;

-- Step 2: Add new columns to Item table (all nullable for backward compatibility)
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "storageGb" INTEGER;
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "condition" "ItemCondition";
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "color" TEXT;

-- Step 3: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "Item_organizationId_model_idx" ON "Item"("organizationId", "model");
CREATE INDEX IF NOT EXISTS "Item_organizationId_brand_idx" ON "Item"("organizationId", "brand");
