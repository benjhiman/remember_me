# Prisma Migration Recovery - Diagnóstico y Fix

## Problema: P3009 - Migración Fallida

**Migración fallida:** `20250124130000_add_purchase_stock_application`  
**Error:** P3009 - migrate found failed migrations  
**Estado:** started_at: 2026-01-25 04:39:59.786286 UTC, finished_at: NULL, rolled_back_at: NULL

---

## A) Causa Raíz

La migración `20250124130000_add_purchase_stock_application` intenta:

1. **ALTER TABLE "PurchaseLine" ADD COLUMN "stockItemId" TEXT**
2. **CREATE TABLE "PurchaseStockApplication"** con constraints e índices
3. **CREATE INDEX** en varias tablas
4. **ALTER TABLE ADD CONSTRAINT** (foreign keys)

**Causas típicas de fallo:**
- La columna `stockItemId` ya existe en `PurchaseLine` (duplicado)
- La tabla `PurchaseStockApplication` ya existe parcialmente
- Los índices ya existen (conflicto de nombres)
- Los foreign keys ya existen (constraint duplicado)
- Timeout o lock durante la transacción

---

## B) Queries SQL de Diagnóstico

Ejecutar en Railway PostgreSQL:

```sql
-- 1. Ver estado de la migración fallida
SELECT 
  migration_name, 
  started_at, 
  finished_at, 
  rolled_back_at, 
  applied_steps_count, 
  logs
FROM "_prisma_migrations"
WHERE migration_name = '20250124130000_add_purchase_stock_application'
ORDER BY started_at DESC
LIMIT 1;

-- 2. Verificar si PurchaseStockApplication table existe
SELECT to_regclass('public."PurchaseStockApplication"') AS purchase_stock_app_table;

-- 3. Verificar si PurchaseLine.stockItemId column existe
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'PurchaseLine' 
    AND column_name = 'stockItemId'
) AS has_stock_item_id_column;

-- 4. Verificar índices de PurchaseStockApplication
SELECT indexname, indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename = 'PurchaseStockApplication'
ORDER BY indexname;

-- 5. Verificar foreign keys de PurchaseStockApplication
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'PurchaseStockApplication'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 6. Verificar índice PurchaseLine_stockItemId_idx
SELECT EXISTS (
  SELECT 1 FROM pg_indexes 
  WHERE schemaname = 'public' 
    AND indexname = 'PurchaseLine_stockItemId_idx'
) AS has_stock_item_id_index;

-- 7. Verificar foreign key PurchaseLine_stockItemId_fkey
SELECT EXISTS (
  SELECT 1 FROM information_schema.table_constraints 
  WHERE table_schema = 'public' 
    AND table_name = 'PurchaseLine'
    AND constraint_name = 'PurchaseLine_stockItemId_fkey'
) AS has_stock_item_id_fk;
```

---

## C) Fix Seguro (Sin Data Loss)

### Opción 1: Si los cambios YA están aplicados (RECOMENDADO)

Si las queries de diagnóstico muestran que:
- ✅ `PurchaseStockApplication` table existe
- ✅ `PurchaseLine.stockItemId` column existe
- ✅ Todos los índices existen
- ✅ Todos los foreign keys existen

**Entonces:** Marcar la migración como aplicada (los cambios ya están en la DB).

```bash
pnpm --filter @remember-me/prisma exec prisma migrate resolve --applied 20250124130000_add_purchase_stock_application
```

### Opción 2: Si los cambios NO están aplicados

**NO hacer:**
- ❌ `prisma migrate reset` (pierde datos)
- ❌ `prisma db push` (puede causar inconsistencias)

**Hacer:**
1. Crear una migración hotfix idempotente:

```sql
-- packages/prisma/migrations/20260125000000_fix_purchase_stock_application/migration.sql

-- Idempotent: solo crear si no existe
DO $$
BEGIN
  -- Add column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'PurchaseLine' 
      AND column_name = 'stockItemId'
  ) THEN
    ALTER TABLE "PurchaseLine" ADD COLUMN "stockItemId" TEXT;
  END IF;
END $$;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS "PurchaseStockApplication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedByUserId" TEXT NOT NULL,
    CONSTRAINT "PurchaseStockApplication_pkey" PRIMARY KEY ("id")
);

-- Create indexes if not exists (using CREATE INDEX IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "PurchaseStockApplication_purchaseId_key" ON "PurchaseStockApplication"("purchaseId");
CREATE INDEX IF NOT EXISTS "PurchaseStockApplication_organizationId_appliedAt_idx" ON "PurchaseStockApplication"("organizationId", "appliedAt");
CREATE INDEX IF NOT EXISTS "PurchaseStockApplication_purchaseId_idx" ON "PurchaseStockApplication"("purchaseId");
CREATE INDEX IF NOT EXISTS "PurchaseLine_stockItemId_idx" ON "PurchaseLine"("stockItemId");

-- Add foreign keys if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'PurchaseLine_stockItemId_fkey'
  ) THEN
    ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_stockItemId_fkey" 
      FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Similar para otros foreign keys...
```

2. Marcar la migración fallida como rolled-back:
```bash
pnpm --filter @remember-me/prisma exec prisma migrate resolve --rolled-back 20250124130000_add_purchase_stock_application
```

3. Aplicar la hotfix:
```bash
pnpm --filter @remember-me/prisma db:migrate:deploy
```

---

## D) Implementación Automática

El script `apps/api/scripts/prisma-recover.ts` ahora:

1. ✅ Detecta TODAS las migraciones fallidas (no solo TARGET_MIGRATION)
2. ✅ Audita específicamente `20250124130000_add_purchase_stock_application`
3. ✅ Verifica si los cambios ya están aplicados (tablas, columnas, índices, FKs)
4. ✅ Si están aplicados → marca como `applied` automáticamente
5. ✅ Si NO están aplicados → aborta con instrucciones claras (fail fast)

**Logging defensivo:**
- Muestra estado completo de la migración
- Lista todos los cambios verificados
- Proporciona instrucciones si requiere intervención manual

---

## Notas de Seguridad

### ❌ NO HACER:
- `prisma migrate reset` → **PIERDE TODOS LOS DATOS**
- `prisma db push --force-reset` → **PIERDE TODOS LOS DATOS**
- Borrar manualmente tablas/columnas sin verificar dependencias
- Marcar como `applied` sin verificar que los cambios existen

### ✅ HACER:
- Verificar siempre con SQL real antes de marcar como `applied`
- Usar migraciones idempotentes (IF NOT EXISTS / IF EXISTS)
- Hacer backup antes de cambios manuales
- Probar en staging primero

### 🔒 Prevención:
- El script `prisma-recover.ts` ahora detecta automáticamente migraciones fallidas
- Verifica cambios antes de marcar como aplicado
- Aborta si no puede resolver de forma segura
- Logging completo para debugging

---

## Comandos de Fix Manual (Si es necesario)

```bash
# 1. Ver estado
pnpm --filter @remember-me/prisma exec prisma migrate status

# 2. Si cambios están aplicados:
pnpm --filter @remember-me/prisma exec prisma migrate resolve --applied 20250124130000_add_purchase_stock_application

# 3. Si cambios NO están aplicados (crear hotfix primero):
pnpm --filter @remember-me/prisma exec prisma migrate resolve --rolled-back 20250124130000_add_purchase_stock_application
pnpm --filter @remember-me/prisma db:migrate:deploy
```

---

**Última actualización:** 2026-01-25  
**Script automático:** `apps/api/scripts/prisma-recover.ts`
