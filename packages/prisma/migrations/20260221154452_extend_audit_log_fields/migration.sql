-- Extend AuditLog model with additional fields for enhanced audit tracking
-- Migration: 20260221154452_extend_audit_log_fields

-- Add new columns to AuditLog table
ALTER TABLE "AuditLog" 
  ADD COLUMN IF NOT EXISTS "actorRole" TEXT,
  ADD COLUMN IF NOT EXISTS "actorEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'api',
  ADD COLUMN IF NOT EXISTS "ip" TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- Add new indexes for performance
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_actorRole_createdAt_idx" ON "AuditLog"("organizationId", "actorRole", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_action_createdAt_idx" ON "AuditLog"("organizationId", "action", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_actorEmail_idx" ON "AuditLog"("actorEmail");
CREATE INDEX IF NOT EXISTS "AuditLog_ip_idx" ON "AuditLog"("ip");

-- Update existing indexes to use DESC for createdAt (if needed)
-- Note: Prisma doesn't support sort direction in indexes, so we keep the existing indexes
-- The DESC ordering will be handled in queries via orderBy

-- Add new enum values to AuditAction (idempotent)
DO $$
BEGIN
  -- Add new action types if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RESERVE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'RESERVE';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONFIRM' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'CONFIRM';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RELEASE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'RELEASE';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAYMENT_RECEIVED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_RECEIVED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PAYMENT_APPLIED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_APPLIED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STOCK_ADDED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'STOCK_ADDED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STOCK_CONFIRMED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'STOCK_CONFIRMED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STOCK_ADJUSTED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'STOCK_ADJUSTED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LOGIN_SUCCESS' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_SUCCESS';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LOGIN_FAILED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_FAILED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CUSTOMER_CREATED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_CREATED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CUSTOMER_UPDATED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'CUSTOMER_UPDATED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SALE_CREATED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'SALE_CREATED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SALE_UPDATED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'SALE_UPDATED';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SALE_STATUS_CHANGED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditAction')) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'SALE_STATUS_CHANGED';
  END IF;
END $$;

-- Add new enum values to AuditEntityType (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Payment' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditEntityType')) THEN
    ALTER TYPE "AuditEntityType" ADD VALUE 'Payment';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'StockMovement' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditEntityType')) THEN
    ALTER TYPE "AuditEntityType" ADD VALUE 'StockMovement';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'StockReservation' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditEntityType')) THEN
    ALTER TYPE "AuditEntityType" ADD VALUE 'StockReservation';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'User' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditEntityType')) THEN
    ALTER TYPE "AuditEntityType" ADD VALUE 'User';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Organization' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditEntityType')) THEN
    ALTER TYPE "AuditEntityType" ADD VALUE 'Organization';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Folder' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AuditEntityType')) THEN
    ALTER TYPE "AuditEntityType" ADD VALUE 'Folder';
  END IF;
END $$;
