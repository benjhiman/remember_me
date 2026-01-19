# Migraciones de Prisma en Railway

## Comandos de Migración

### En Railway (dev/staging/production)

**IMPORTANTE:** En Railway, usar **SOLO** `prisma migrate deploy`:

```bash
pnpm -w prisma migrate deploy --schema=./packages/prisma/schema.prisma
```

Este comando:
- Aplica las migraciones pendientes en orden
- No genera nuevas migraciones
- Es seguro para ejecutar en producción
- Funciona incluso si hay drift parcial (migraciones aplicadas parcialmente)

### En desarrollo local

Para desarrollo local, usar `prisma migrate dev`:

```bash
pnpm -w prisma migrate dev --schema=./packages/prisma/schema.prisma
```

Este comando:
- Genera nuevas migraciones basadas en cambios del schema
- Aplica las migraciones automáticamente
- **NO usar en Railway** - puede causar conflictos

## Migraciones Idempotentes

Todas las migraciones han sido modificadas para ser idempotentes, especialmente las operaciones con enums de PostgreSQL:

- **CREATE TYPE**: Verifica si el enum existe antes de crearlo
- **ALTER TYPE ADD VALUE**: Verifica si el valor existe antes de agregarlo

Esto permite que `prisma migrate deploy` se ejecute múltiples veces sin fallar, incluso si:
- Hay drift en dev/staging (migraciones aplicadas parcialmente)
- Un enum o enum label ya existe
- Hay migraciones que fallaron parcialmente

## Recuperación de Drift

Si el drift es grande y las migraciones fallan repetidamente:

1. **Opción recomendada**: Resetear la base de datos de staging
   ```bash
   # En Railway, usar el panel para resetear la DB
   # Luego ejecutar migrate deploy
   pnpm -w prisma migrate deploy --schema=./packages/prisma/schema.prisma
   ```

2. **Opción alternativa**: Aplicar migraciones manualmente
   - Revisar qué migraciones están aplicadas en `_prisma_migrations`
   - Aplicar las faltantes manualmente si es necesario

## Verificación

Para verificar que las migraciones están correctas:

```bash
# Validar el schema
pnpm -w prisma validate --schema=./packages/prisma/schema.prisma

# Ver el estado de las migraciones (requiere conexión a DB)
pnpm -w prisma migrate status --schema=./packages/prisma/schema.prisma
```

## Notas Técnicas

- Las migraciones usan bloques `DO $$ ... $$` de PostgreSQL para operaciones idempotentes
- Se consultan `pg_type`, `pg_enum` y `pg_namespace` para verificar existencia
- Todos los enums se crean en el schema `public`
- Los valores de enum se agregan solo si no existen en `pg_enum`
