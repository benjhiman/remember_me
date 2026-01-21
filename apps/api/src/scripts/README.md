# Scripts de Utilidad

## seed-owner.ts

Script idempotente para crear un usuario OWNER en producción (Railway) directamente en la DB vía Prisma.

### Uso Local

1. Configurar variables de entorno:
```bash
export OWNER_EMAIL=admin@example.com
export OWNER_PASSWORD=SecurePass123!
export OWNER_ORG_NAME="Mi Organización"
export OWNER_ORG_SLUG=mi-organizacion
```

2. Ejecutar el script:
```bash
pnpm --filter @remember-me/api seed:owner
```

### Uso en Railway

#### Opción 1: Railway CLI

1. Configurar variables de entorno en Railway Dashboard:
   - `OWNER_EMAIL`
   - `OWNER_PASSWORD`
   - `OWNER_ORG_NAME`
   - `OWNER_ORG_SLUG`

2. Ejecutar desde terminal:
```bash
railway run pnpm --filter @remember-me/api seed:owner
```

#### Opción 2: Railway Shell

1. Abrir Railway Shell desde el dashboard
2. Configurar variables de entorno:
```bash
export OWNER_EMAIL=admin@example.com
export OWNER_PASSWORD=SecurePass123!
export OWNER_ORG_NAME="Mi Organización"
export OWNER_ORG_SLUG=mi-organizacion
```

3. Ejecutar:
```bash
cd apps/api
pnpm seed:owner
```

### Variables de Entorno

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `OWNER_EMAIL` | No | `admin@example.com` | Email del usuario OWNER |
| `OWNER_PASSWORD` | **Sí** | - | Password (mínimo 8 caracteres) |
| `OWNER_ORG_NAME` | No | `Default Organization` | Nombre de la organización |
| `OWNER_ORG_SLUG` | No | `default-org` | Slug único de la organización |

### Comportamiento

El script es **idempotente**, lo que significa que:

- Si el usuario ya existe (por email), no lo recrea
- Si la organización ya existe (por slug), no la recrea
- Si el membership ya existe, verifica que el role sea OWNER (y lo actualiza si no lo es)
- Si el membership no existe, lo crea con role OWNER

### Seguridad

- El password se hashea con bcrypt (cost 12)
- El script valida que el password tenga al menos 8 caracteres
- No se actualiza el password de usuarios existentes automáticamente (comentado por seguridad)

### Salida

El script muestra:
- Estado de cada operación (creación/actualización)
- IDs generados
- Resumen final con todos los IDs relevantes

Ejemplo de salida:
```
🚀 Iniciando seed de OWNER...
   Email: admin@example.com
   Org: Mi Organización (mi-organizacion)
   ✓ Usuario creado: clx1234567890
   ✓ Organización creada: clx0987654321
   ✓ Membership creado como OWNER: clx1122334455

✅ Seed completado exitosamente:
   User ID: clx1234567890
   User Email: admin@example.com
   Organization ID: clx0987654321
   Organization Slug: mi-organizacion
   Role: OWNER
```

### Troubleshooting

**Error: "OWNER_PASSWORD debe tener al menos 8 caracteres"**
- Asegúrate de configurar `OWNER_PASSWORD` con al menos 8 caracteres

**Error de conexión a la DB**
- Verifica que `DATABASE_URL` esté configurada correctamente
- En Railway, verifica que el servicio de PostgreSQL esté activo

**Error de Prisma Client no generado**
- Ejecuta: `pnpm --filter @remember-me/prisma db:generate`
