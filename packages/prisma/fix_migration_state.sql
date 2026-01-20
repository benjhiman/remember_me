-- Script para limpiar y corregir el estado de la migración fallida
-- Ejecutar esto directamente en la base de datos de Railway

-- 1. Ver el estado actual
SELECT 
    "migration_name", 
    "started_at", 
    "finished_at", 
    "rolled_back_at",
    "applied_steps_count"
FROM "_prisma_migrations"
WHERE "migration_name" = '20260115000006_add_meta_oauth_metadata';

-- 2. Eliminar el registro problemático (descomentar para ejecutar)
-- DELETE FROM "_prisma_migrations"
-- WHERE "migration_name" = '20260115000006_add_meta_oauth_metadata';

-- 3. O marcar como no aplicada para que Prisma la reintente (descomentar para ejecutar)
-- UPDATE "_prisma_migrations" 
-- SET "finished_at" = NULL, 
--     "rolled_back_at" = NULL, 
--     "started_at" = NULL,
--     "applied_steps_count" = 0
-- WHERE "migration_name" = '20260115000006_add_meta_oauth_metadata';
