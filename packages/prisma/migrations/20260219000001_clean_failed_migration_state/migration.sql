-- Clean failed migration state and mark as rolled back
-- This allows Prisma to continue applying new migrations

DO $$
BEGIN
    -- Mark the failed migration as rolled back if it exists and is in failed state
    UPDATE "_prisma_migrations"
    SET rolled_back_at = NOW()
    WHERE migration_name = '20260217000000_add_customer_assigned_seller_and_commissions'
      AND finished_at IS NULL
      AND rolled_back_at IS NULL;
    
    -- Log the result
    IF FOUND THEN
        RAISE NOTICE 'Marked failed migration as rolled back';
    ELSE
        RAISE NOTICE 'Migration not found or already resolved';
    END IF;
END $$;
