-- Script para verificar el estado de la migración y los cambios en la base de datos

-- 1. Verificar el estado en _prisma_migrations
SELECT 
    "migration_name", 
    "started_at", 
    "finished_at", 
    "rolled_back_at",
    "applied_steps_count"
FROM "_prisma_migrations"
WHERE "migration_name" = '20260115000006_add_meta_oauth_metadata';

-- 2. Verificar si la tabla ConnectedAccount existe
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ConnectedAccount'
) AS connected_account_exists;

-- 3. Verificar si la columna metadataJson existe
SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ConnectedAccount'
      AND column_name = 'metadataJson'
) AS metadata_json_exists;

-- 4. Verificar si el índice existe
SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ConnectedAccount'
      AND indexname = 'ConnectedAccount_organizationId_provider_externalAccountId_key'
) AS unique_index_exists;
