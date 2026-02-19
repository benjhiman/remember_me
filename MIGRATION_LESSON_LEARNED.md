# Lección Aprendida: Errores de Migración Prisma

## ❌ Error Original

```
Error: P3018
A migration failed to apply. New migrations cannot be applied before the error is recovered from.
Database error code: 42P01
ERROR: relation "customer" does not exist
```

**Causa raíz:** La migración intentaba modificar una tabla (`Customer`) que nunca fue creada.

---

## 🔍 Problemas Identificados

### 1. **Tabla no existe**
- La tabla `Customer` estaba definida en `schema.prisma` pero nunca se creó en ninguna migración
- La migración `20260217000000` intentaba agregar columnas y constraints a una tabla inexistente

### 2. **Uso de `regclass` sin verificación**
- El código usaba `'Customer'::regclass` que **falla inmediatamente** si la tabla no existe
- No hay forma de capturar este error dentro de un `DO $$` block

### 3. **Falta de verificación de existencia de tabla**
- Las operaciones asumían que la tabla existía
- No había verificación previa usando `information_schema.tables`

---

## ✅ Solución Implementada

### 1. **Crear tabla si no existe**
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Customer'
    ) THEN
        CREATE TABLE "Customer" (
            -- todos los campos del schema
        );
        -- foreign keys e índices iniciales
    END IF;
END $$;
```

### 2. **Reemplazar `regclass` con `information_schema`**
**❌ ANTES (falla si tabla no existe):**
```sql
WHERE conname = 'Customer_assignedToId_fkey' 
AND conrelid = 'Customer'::regclass
```

**✅ DESPUÉS (seguro):**
```sql
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'Customer'
) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Customer_assignedToId_fkey'
    AND table_name = 'Customer'
)
```

### 3. **Verificar existencia antes de modificar**
Todas las operaciones ahora verifican:
1. Que la tabla existe
2. Que la columna existe (si aplica)
3. Que el constraint/index no existe
4. Solo entonces aplican el cambio

---

## 📋 Reglas para Migraciones Idempotentes

### ✅ SIEMPRE hacer:

1. **Verificar existencia de tabla antes de modificar:**
   ```sql
   IF EXISTS (
       SELECT 1 FROM information_schema.tables 
       WHERE table_name = 'TableName'
   ) THEN
       -- operaciones seguras
   END IF;
   ```

2. **Usar `information_schema` en lugar de `regclass`:**
   - `information_schema.tables` para verificar tablas
   - `information_schema.columns` para verificar columnas
   - `information_schema.table_constraints` para verificar constraints
   - `pg_indexes` para verificar índices

3. **Crear tabla completa si no existe:**
   - Incluir todos los campos del schema
   - Incluir foreign keys iniciales
   - Incluir índices iniciales

4. **Verificar duplicados antes de constraints únicos:**
   ```sql
   IF NOT EXISTS (
       SELECT 1 FROM "Table" 
       WHERE column IS NOT NULL 
       GROUP BY column 
       HAVING COUNT(*) > 1
   ) THEN
       ALTER TABLE "Table" ADD CONSTRAINT ... UNIQUE (...);
   END IF;
   ```

### ❌ NUNCA hacer:

1. **Usar `regclass` sin verificar existencia:**
   ```sql
   -- ❌ MAL - falla si tabla no existe
   WHERE conrelid = 'TableName'::regclass
   ```

2. **Asumir que una tabla existe:**
   ```sql
   -- ❌ MAL - falla si tabla no existe
   ALTER TABLE "Table" ADD COLUMN ...
   ```

3. **Crear migraciones que dependen de tablas no creadas:**
   - Siempre crear la tabla primero
   - O verificar que existe antes de modificar

---

## 🎯 Checklist para Nuevas Migraciones

Antes de crear una migración, verificar:

- [ ] ¿La tabla existe? Si no, crear primero
- [ ] ¿Uso `information_schema` en lugar de `regclass`?
- [ ] ¿Verifico existencia de tabla antes de modificar?
- [ ] ¿Verifico existencia de columna antes de agregar constraint?
- [ ] ¿Verifico duplicados antes de constraint único?
- [ ] ¿Todas las operaciones están dentro de `DO $$` blocks con verificaciones?
- [ ] ¿La migración es completamente idempotente?

---

## 🔧 Comandos Útiles

### Verificar si una tabla existe:
```sql
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'TableName'
);
```

### Verificar si una columna existe:
```sql
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'TableName' 
    AND column_name = 'columnName'
);
```

### Verificar si un constraint existe:
```sql
SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'constraint_name'
    AND table_name = 'TableName'
);
```

### Verificar si un índice existe:
```sql
SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'index_name'
);
```

---

## 📝 Notas Finales

- **Siempre** crear migraciones idempotentes
- **Nunca** asumir que una tabla/columna/constraint existe
- **Siempre** usar `information_schema` para verificaciones seguras
- **Nunca** usar `regclass` sin verificar existencia primero
- **Siempre** probar la migración en un ambiente limpio antes de deployar

**Esta lección debe aplicarse a TODAS las migraciones futuras.**
