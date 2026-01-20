# Resolver Error P3009 - Migración Fallida

## Problema

Prisma detecta que la migración `20260115000006_add_meta_oauth_metadata` falló y bloquea nuevas migraciones con el error:

```
Error: P3009
migrate found failed migrations in the target database, new migrations will not be applied.
The `20260115000006_add_meta_oauth_metadata` migration started at [timestamp] failed
```

## Solución Rápida (Recomendada)

### Paso 1: Resolver el estado fallido

**Opción A - Usando Railway CLI:**
```bash
# Conectar a la base de datos
railway connect postgres

# Ejecutar el script de resolución
\i packages/prisma/resolve_failed_migration.sql
```

**Opción B - Usando psql directamente:**
```bash
# Si tienes DATABASE_URL configurado
psql $DATABASE_URL -f packages/prisma/resolve_failed_migration.sql

# O copiar y pegar el contenido del script en psql
```

**Opción C - Usando Prisma CLI:**
```bash
# Marcar la migración como resuelta
pnpm -w prisma migrate resolve --rolled-back 20260115000006_add_meta_oauth_metadata --schema=./packages/prisma/schema.prisma
```

### Paso 2: Aplicar las migraciones nuevamente

```bash
pnpm -w prisma migrate deploy --schema=./packages/prisma/schema.prisma
```

La migración ahora es completamente idempotente y debería ejecutarse sin problemas.

## Solución Manual (Si las opciones anteriores no funcionan)

1. Conecta a la base de datos de Railway
2. Ejecuta manualmente:

```sql
-- Limpiar el estado fallido
UPDATE "_prisma_migrations" 
SET "finished_at" = NULL, 
    "rolled_back_at" = NULL, 
    "started_at" = NULL,
    "applied_steps_count" = 0
WHERE "migration_name" = '20260115000006_add_meta_oauth_metadata' 
  AND "finished_at" IS NULL;

-- Verificar
SELECT "migration_name", "started_at", "finished_at", "rolled_back_at"
FROM "_prisma_migrations"
WHERE "migration_name" = '20260115000006_add_meta_oauth_metadata';
```

3. Ejecuta `prisma migrate deploy` nuevamente

## Verificación

Después de resolver, verifica el estado:

```bash
pnpm -w prisma migrate status --schema=./packages/prisma/schema.prisma
```

Debería mostrar todas las migraciones como aplicadas o pendientes (no fallidas).

## Cambios Realizados

La migración `20260115000006_add_meta_oauth_metadata` ahora es completamente idempotente:

✅ Verifica que la tabla `ConnectedAccount` existe antes de modificarla  
✅ Verifica que la columna `metadataJson` no existe antes de agregarla  
✅ Verifica que el índice único no existe antes de crearlo  

Esto permite que la migración se ejecute múltiples veces sin fallar, incluso si:
- La tabla no existe (se omite silenciosamente)
- La columna ya existe (se omite)
- El índice ya existe (se omite)

## Otras Migraciones Mejoradas

También se hicieron idempotentes:
- `20260115000000_add_message_status_tracking` - Operaciones ALTER TABLE y CREATE INDEX
- `20260115000003_add_unified_inbox` - Operación ALTER TABLE para conversationId

Esto previene errores similares en el futuro.
