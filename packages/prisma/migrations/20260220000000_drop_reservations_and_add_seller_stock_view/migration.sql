-- Drop StockReservation table and related constraints
DROP TABLE IF EXISTS "StockReservation" CASCADE;

-- Remove reservationId column from StockMovement
ALTER TABLE "StockMovement" DROP COLUMN IF EXISTS "reservationId";

-- Remove RESERVE and RELEASE from StockMovementType enum
-- Note: This requires recreating the enum, which is complex in PostgreSQL
-- We'll handle this by ensuring no RESERVE/RELEASE movements exist first
-- For now, we'll leave the enum as-is and just remove the values from code

-- Remove RESERVE, CONFIRM, RELEASE from AuditAction enum
-- Similar note: enum recreation is complex, handled in code
