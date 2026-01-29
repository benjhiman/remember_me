-- Add itemId to StockItem and make IMEI unique per organization

-- Step 1: Add itemId column (nullable first, will be made required after data migration)
ALTER TABLE "StockItem" ADD COLUMN IF NOT EXISTS "itemId" TEXT;

-- Step 2: Drop old unique constraint on imei (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StockItem_imei_key'
  ) THEN
    ALTER TABLE "StockItem" DROP CONSTRAINT "StockItem_imei_key";
  END IF;
END $$;

-- Step 3: Create new unique constraint on (organizationId, imei) for non-null IMEIs
-- Note: PostgreSQL unique constraints allow multiple NULLs, so this works for items without IMEI
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StockItem_organizationId_imei_key'
  ) THEN
    CREATE UNIQUE INDEX "StockItem_organizationId_imei_key" ON "StockItem"("organizationId", "imei")
    WHERE "imei" IS NOT NULL;
  END IF;
END $$;

-- Step 4: Add foreign key constraint to Item
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'StockItem_itemId_fkey'
  ) THEN
    ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 5: Add index on (organizationId, itemId)
CREATE INDEX IF NOT EXISTS "StockItem_organizationId_itemId_idx" ON "StockItem"("organizationId", "itemId");

-- Step 6: Drop old imei index if it exists (replaced by unique constraint)
DROP INDEX IF EXISTS "StockItem_imei_idx";

-- Note: itemId will remain nullable for now to allow existing data.
-- In a future migration, you can make it required after ensuring all StockItems have an itemId.
