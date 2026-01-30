-- AlterEnum: Add 'RELEASED' to ReservationStatus (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ReservationStatus'
      AND e.enumlabel = 'RELEASED'
  ) THEN
    ALTER TYPE "ReservationStatus" ADD VALUE 'RELEASED';
  END IF;
END $$;

-- AlterTable: Add itemId, customerName, releasedAt to StockReservation
-- Make stockItemId nullable
ALTER TABLE "StockReservation" 
  ADD COLUMN IF NOT EXISTS "itemId" TEXT,
  ADD COLUMN IF NOT EXISTS "customerName" TEXT,
  ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);

-- Make stockItemId nullable (if not already)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'StockReservation' 
    AND column_name = 'stockItemId' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "StockReservation" ALTER COLUMN "stockItemId" DROP NOT NULL;
  END IF;
END $$;

-- Add foreign key constraint for itemId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'StockReservation_itemId_fkey'
  ) THEN
    ALTER TABLE "StockReservation" 
    ADD CONSTRAINT "StockReservation_itemId_fkey" 
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "StockReservation_itemId_idx" ON "StockReservation"("itemId");

-- Add relation to Item model (this is handled by Prisma, but we ensure the index exists)