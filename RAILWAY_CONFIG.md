# Railway Configuration - remember_me Monorepo

## Estructura del Proyecto

- **Monorepo:** pnpm workspaces
- **API:** `apps/api` (NestJS)
- **Worker:** `apps/api/src/worker.main.ts` (mismo código, modo worker)
- **Prisma:** `packages/prisma`

## Servicios Railway

### Service A: API (HTTP)

#### Install Command
```bash
pnpm install --frozen-lockfile
```

#### Build Command
```bash
cd apps/api && pnpm build:api
```

**Nota:** Este comando ejecuta:
1. `nest build` - Compila TypeScript a JavaScript
2. `pnpm prisma:generate` - Genera Prisma Client
3. `pnpm prisma:deploy` - Ejecuta migrations en producción

#### Start Command
```bash
cd apps/api && pnpm start:api
```

**Equivalente a:**
```bash
cd apps/api && NODE_ENV=production node dist/main.js
```

#### Variables de Entorno (API)

| Variable | Required | Descripción | Ejemplo |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql://user:pass@host:5432/db?schema=public` |
| `REDIS_URL` | ✅ | Redis connection string | `redis://:password@host:6379` |
| `JWT_SECRET` | ✅ | Secret para JWT tokens (min 32 chars) | `[generar con openssl rand -base64 32]` |
| `JWT_REFRESH_SECRET` | ✅ | Secret para refresh tokens (min 32 chars) | `[generar con openssl rand -base64 32]` |
| `CORS_ORIGINS` | ✅ | Comma-separated frontend origins | `https://app.iphonealcosto.com` |
| `FRONTEND_URL` | ✅ | Frontend base URL | `https://app.iphonealcosto.com` |
| `NODE_ENV` | ✅ | Debe ser `production` | `production` |
| `PORT` | ⚠️ | Puerto HTTP (Railway lo setea automáticamente) | `4000` |
| `WORKER_MODE` | ✅ | Debe ser `0` para API | `0` |
| `JOB_RUNNER_ENABLED` | ✅ | Debe ser `false` para API | `false` |
| `QUEUE_MODE` | ✅ | `bullmq` para producción | `bullmq` |
| `RATE_LIMIT_ENABLED` | ✅ | `true` para producción | `true` |
| `WHATSAPP_APP_SECRET` | ⚠️ | Requerido si usas WhatsApp webhooks | `[de Meta Developer Console]` |
| `META_APP_SECRET` | ⚠️ | Requerido si usas Instagram/Meta Lead Ads | `[de Meta Developer Console]` |
| `METRICS_TOKEN` | ⚠️ | Token para `/api/metrics` endpoint | `[generar con openssl rand -base64 32]` |

#### Health Check

**Endpoint:** `GET /api/health/extended`

**Response esperado:**
```json
{
  "status": "ok",
  "db": "ok",
  "uptime": 123,
  "version": "1.0.0",
  "env": "production"
}
```

---

### Service B: Worker (Background Jobs)

#### Install Command
```bash
pnpm install --frozen-lockfile
```

#### Build Command
```bash
cd apps/api && pnpm build:worker
```

**Nota:** Este comando ejecuta:
1. `nest build` - Compila TypeScript a JavaScript
2. `pnpm prisma:generate` - Genera Prisma Client

**IMPORTANTE:** El Worker NO ejecuta migrations (solo las lee). Las migrations se ejecutan solo en el API service.

#### Start Command
```bash
cd apps/api && pnpm start:worker
```

**Equivalente a:**
```bash
cd apps/api && NODE_ENV=production WORKER_MODE=1 JOB_RUNNER_ENABLED=true node dist/worker.main.js
```

#### Variables de Entorno (Worker)

| Variable | Required | Descripción | Ejemplo |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (MISMO que API) | `postgresql://user:pass@host:5432/db?schema=public` |
| `REDIS_URL` | ✅ | Redis connection string (MISMO que API) | `redis://:password@host:6379` |
| `JWT_SECRET` | ✅ | Mismo que API (para validación de tokens) | `[mismo que API]` |
| `JWT_REFRESH_SECRET` | ✅ | Mismo que API | `[mismo que API]` |
| `NODE_ENV` | ✅ | Debe ser `production` | `production` |
| `WORKER_MODE` | ✅ | Debe ser `1` para Worker | `1` |
| `JOB_RUNNER_ENABLED` | ✅ | Debe ser `true` para Worker | `true` |
| `QUEUE_MODE` | ✅ | `bullmq` para producción | `bullmq` |
| `INTEGRATION_WORKER_CONCURRENCY` | ⚠️ | Número de jobs concurrentes (default: 5) | `5` |

#### Health Check

**Nota:** El Worker NO expone HTTP por defecto. Si necesitas verificar que está corriendo:

1. **Logs en Railway:** Buscar `🚀 Worker started (no HTTP server)`
2. **Métricas en API:** `GET /api/integrations/jobs/metrics` (requiere auth)

**Logs esperados al iniciar:**
```
🚀 Worker started (no HTTP server)
Worker mode: 1
Job runner enabled: true
Worker running in continuous mode. Job runner will process jobs automatically.
```

---

## Configuración en Railway UI

### Service A: API

1. **Settings → Deploy**
   - **Install Command:** `pnpm install --frozen-lockfile`
   - **Build Command:** `cd apps/api && pnpm build:api`
   - **Start Command:** `cd apps/api && pnpm start:api`

2. **Settings → Networking**
   - ✅ Habilitar "Generate Domain" o configurar custom domain
   - ✅ El servicio debe exponer HTTP en el PORT que Railway asigna

3. **Variables → Environment Variables**
   - Agregar todas las variables listadas arriba (API)

### Service B: Worker

1. **Settings → Deploy**
   - **Install Command:** `pnpm install --frozen-lockfile`
   - **Build Command:** `cd apps/api && pnpm build:worker`
   - **Start Command:** `cd apps/api && pnpm start:worker`

2. **Settings → Networking**
   - ❌ NO habilitar "Generate Domain" (el worker no expone HTTP)
   - O si Railway lo requiere, puedes habilitarlo pero no se usará

3. **Variables → Environment Variables**
   - Agregar todas las variables listadas arriba (Worker)

---

## Prisma Migrations en Producción

### Cómo Funciona

1. **En el API Service:**
   - El comando `build:api` ejecuta `pnpm prisma:deploy`
   - Esto ejecuta `prisma migrate deploy` que:
     - ✅ Aplica migrations pendientes
     - ✅ Es idempotente (puede ejecutarse múltiples veces)
     - ✅ NO crea nuevas migrations (solo aplica existentes)
     - ✅ Es seguro para producción

2. **En el Worker Service:**
   - Solo ejecuta `prisma generate` (no migrations)
   - El Worker lee la DB pero no la modifica (solo jobs)

### Migrations Idempotentes

Las migrations ya están configuradas para ser idempotentes:
- `CREATE TYPE` con `IF NOT EXISTS`
- `ALTER TYPE ADD VALUE` con verificación de existencia
- `ALTER TABLE ADD COLUMN` con `IF NOT EXISTS`

### Si una Migration Falla

Si `prisma migrate deploy` falla con P3009 (migration failed):

1. **Opción 1 (Recomendada):** Marcar como rolled-back
   ```bash
   pnpm --filter @remember-me/prisma prisma migrate resolve --rolled-back <migration_name> --schema=./packages/prisma/schema.prisma
   ```

2. **Opción 2:** Eliminar manualmente de `_prisma_migrations` (solo si estás seguro)

---

## Checklist Post-Deploy

### 1. API Health Check

```bash
curl https://<api-domain>/api/health/extended
```

**Esperado:**
- Status: `200 OK`
- Body: `{"status":"ok","db":"ok",...}`

### 2. Worker Logs

En Railway → Worker Service → Logs, buscar:

```
✅ 🚀 Worker started (no HTTP server)
✅ Worker mode: 1
✅ Job runner enabled: true
✅ Worker running in continuous mode
```

### 3. CORS desde Frontend

Desde el frontend (Vercel), hacer request a API:

```javascript
fetch('https://<api-domain>/api/health', {
  credentials: 'include'
})
```

**Esperado:** No errores de CORS en console

### 4. Jobs Processing

```bash
# Obtener token primero
TOKEN=$(curl -s -X POST https://<api-domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' | jq -r '.accessToken')

# Verificar jobs metrics
curl -H "Authorization: Bearer $TOKEN" \
  https://<api-domain>/api/integrations/jobs/metrics
```

**Esperado:** JSON con `pending`, `processing`, `done`, `failed`

### 5. Database Migrations

Verificar en logs del API service (durante build):

```
✅ Prisma migrations applied successfully
```

O verificar en DB:
```sql
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;
```

---

## Troubleshooting

### Error: "Cannot find module .../dist/main"

**Causa:** El build no generó el dist correctamente o el path es incorrecto.

**Solución:**
1. Verificar que `nest build` se ejecutó sin errores
2. Verificar que `apps/api/dist/main.js` existe
3. Verificar que el Start Command es: `cd apps/api && pnpm start:api`

### Error: "Prisma Client not generated"

**Causa:** `prisma generate` no se ejecutó.

**Solución:**
1. Verificar que el Build Command incluye `pnpm prisma:generate`
2. Verificar que `packages/prisma` tiene acceso a `DATABASE_URL`

### Error: "Migration failed (P3009)"

**Causa:** Una migration falló previamente y quedó marcada como failed.

**Solución:**
1. Ver `packages/prisma/RESOLVE_P3009.md` (si existe)
2. Marcar migration como rolled-back: `prisma migrate resolve --rolled-back <name>`
3. Re-deploy

### Worker no procesa jobs

**Causa:** Variables de entorno incorrectas o Redis desconectado.

**Solución:**
1. Verificar `WORKER_MODE=1` y `JOB_RUNNER_ENABLED=true`
2. Verificar `REDIS_URL` es correcto
3. Verificar logs del worker muestran "BullMQ worker created"

---

## Comandos de Verificación Local (antes de deploy)

```bash
# 1. Build API
cd apps/api && pnpm build:api
# Verificar: ls dist/main.js debe existir

# 2. Build Worker
cd apps/api && pnpm build:worker
# Verificar: ls dist/worker.main.js debe existir

# 3. Test start API (local)
cd apps/api && NODE_ENV=production node dist/main.js
# Debe iniciar sin errores

# 4. Test start Worker (local)
cd apps/api && NODE_ENV=production WORKER_MODE=1 JOB_RUNNER_ENABLED=true node dist/worker.main.js
# Debe iniciar sin errores y mostrar "Worker started"
```

---

## Resumen de Archivos Modificados

1. ✅ `apps/api/nest-cli.json` - Configuración de build output
2. ✅ `apps/api/tsconfig.json` - Agregado `rootDir: "./src"`
3. ✅ `apps/api/package.json` - Scripts `build:api`, `build:worker`, `start:api`, `start:worker`
4. ✅ `packages/prisma/package.json` - Script `db:migrate:deploy`

---

## Estado Final

- ✅ Build genera `apps/api/dist/main.js` y `apps/api/dist/worker.main.js`
- ✅ Scripts de build/start listos para Railway
- ✅ Prisma migrations se ejecutan automáticamente en API build
- ✅ Worker no ejecuta migrations (solo generate)
- ✅ Variables de entorno documentadas
- ✅ Health checks definidos

**Listo para deploy en Railway** 🚀
