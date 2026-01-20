-- Script para resolver migración fallida P3009
-- Ejecutar este script directamente en la base de datos de Railway antes de ejecutar migrate deploy
-- 
-- Uso:
--   psql $DATABASE_URL -f packages/prisma/resolve_failed_migration.sql
--   O desde Railway CLI: railway connect postgres -> copiar y pegar este script

-- Marcar la migración como resuelta (permite que Prisma reintente)
-- Esto limpia el estado fallido y permite que la migración idempotente se ejecute nuevamente
UPDATE "_prisma_migrations" 
SET "finished_at" = NULL, 
    "rolled_back_at" = NULL, 
    "started_at" = NULL,
    "applied_steps_count" = 0
WHERE "migration_name" = '20260115000006_add_meta_oauth_metadata' 
  AND "finished_at" IS NULL;

-- Verificar el estado después de la actualización
SELECT 
    "migration_name", 
    "started_at", 
    "finished_at", 
    "rolled_back_at",
    "applied_steps_count"
FROM "_prisma_migrations"
WHERE "migration_name" = '20260115000006_add_meta_oauth_metadata';
