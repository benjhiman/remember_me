# Railway Deploy - Resumen Ejecutivo

## ✅ Cambios Aplicados

### Archivos Modificados

1. **`apps/api/nest-cli.json`**
   - Agregado `builder: "tsc"` en compilerOptions
   - Configurado para usar TypeScript compiler directamente

2. **`apps/api/tsconfig.json`**
   - Agregado `rootDir: "./src"` explícitamente

3. **`apps/api/tsconfig.build.json`**
   - **REESCRITO COMPLETAMENTE** - Ahora es independiente (no extiende tsconfig.json del root)
   - Configuración completa para build de producción
   - `outDir: "./dist"`, `rootDir: "./src"`

4. **`apps/api/package.json`**
   - Cambiado `build` de `nest build` a `tsc -p tsconfig.build.json`
   - Agregado `build:api` - ejecuta build + prisma generate + prisma deploy
   - Agregado `build:worker` - ejecuta build + prisma generate
   - Agregado `start:api` - `NODE_ENV=production node dist/main.js`
   - Agregado `start:worker` - `NODE_ENV=production WORKER_MODE=1 JOB_RUNNER_ENABLED=true node dist/worker.main.js`
   - Actualizado `migrate:deploy` y `prisma:generate` para usar pnpm --filter

5. **`packages/prisma/package.json`**
   - Agregado script `db:migrate:deploy` - `prisma migrate deploy`

### Verificación

- ✅ Build genera `apps/api/dist/main.js`
- ✅ Build genera `apps/api/dist/worker.main.js`
- ✅ Scripts de build/start funcionan correctamente
- ✅ Prisma migrations se ejecutan en build:api

---

## 🚂 Railway: Comandos por Servicio

### Service A: API (HTTP)

#### Install Command
```bash
pnpm install --frozen-lockfile
```

#### Build Command
```bash
cd apps/api && pnpm build:api
```

**Este comando ejecuta:**
1. `tsc -p tsconfig.build.json` - Compila TypeScript
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

**Este comando ejecuta:**
1. `tsc -p tsconfig.build.json` - Compila TypeScript
2. `pnpm prisma:generate` - Genera Prisma Client

**NOTA:** El Worker NO ejecuta migrations (solo las lee). Las migrations se ejecutan solo en el API service.

#### Start Command
```bash
cd apps/api && pnpm start:worker
```

**Equivalente a:**
```bash
cd apps/api && NODE_ENV=production WORKER_MODE=1 JOB_RUNNER_ENABLED=true node dist/worker.main.js
```

---

## 🔐 Variables de Entorno por Servicio

### API Service

| Variable | Required | Valor |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | Min 32 chars (generar con `openssl rand -base64 32`) |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars (generar con `openssl rand -base64 32`) |
| `CORS_ORIGINS` | ✅ | Comma-separated (ej: `https://app.iphonealcosto.com`) |
| `FRONTEND_URL` | ✅ | Frontend base URL (ej: `https://app.iphonealcosto.com`) |
| `NODE_ENV` | ✅ | `production` |
| `PORT` | ⚠️ | Railway lo setea automáticamente |
| `WORKER_MODE` | ✅ | `0` |
| `JOB_RUNNER_ENABLED` | ✅ | `false` |
| `QUEUE_MODE` | ✅ | `bullmq` |
| `RATE_LIMIT_ENABLED` | ✅ | `true` |
| `WHATSAPP_APP_SECRET` | ⚠️ | Si usas WhatsApp webhooks |
| `META_APP_SECRET` | ⚠️ | Si usas Instagram/Meta Lead Ads |
| `METRICS_TOKEN` | ⚠️ | Token para `/api/metrics` |

### Worker Service

| Variable | Required | Valor |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | **MISMO que API** |
| `REDIS_URL` | ✅ | **MISMO que API** |
| `JWT_SECRET` | ✅ | **MISMO que API** |
| `JWT_REFRESH_SECRET` | ✅ | **MISMO que API** |
| `NODE_ENV` | ✅ | `production` |
| `WORKER_MODE` | ✅ | `1` |
| `JOB_RUNNER_ENABLED` | ✅ | `true` |
| `QUEUE_MODE` | ✅ | `bullmq` |
| `INTEGRATION_WORKER_CONCURRENCY` | ⚠️ | Default: `5` |

---

## ✅ Checklist Post-Deploy

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

Desde el frontend (Vercel), hacer request:

```javascript
fetch('https://<api-domain>/api/health', {
  credentials: 'include'
})
```

**Esperado:** No errores de CORS en console

### 4. Jobs Processing

```bash
# Obtener token
TOKEN=$(curl -s -X POST https://<api-domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' | jq -r '.accessToken')

# Verificar jobs
curl -H "Authorization: Bearer $TOKEN" \
  https://<api-domain>/api/integrations/jobs/metrics
```

**Esperado:** JSON con `pending`, `processing`, `done`, `failed`

### 5. Database Migrations

Verificar en logs del API service (durante build):

```
✅ Prisma migrations applied successfully
```

O en DB:
```sql
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;
```

---

## 📋 Configuración en Railway UI

### Service A: API

1. **Settings → Deploy**
   - Install: `pnpm install --frozen-lockfile`
   - Build: `cd apps/api && pnpm build:api`
   - Start: `cd apps/api && pnpm start:api`

2. **Settings → Networking**
   - ✅ Habilitar "Generate Domain" o custom domain

3. **Variables → Environment Variables**
   - Agregar todas las variables listadas arriba (API)

### Service B: Worker

1. **Settings → Deploy**
   - Install: `pnpm install --frozen-lockfile`
   - Build: `cd apps/api && pnpm build:worker`
   - Start: `cd apps/api && pnpm start:worker`

2. **Settings → Networking**
   - ❌ NO habilitar "Generate Domain" (worker no expone HTTP)

3. **Variables → Environment Variables**
   - Agregar todas las variables listadas arriba (Worker)

---

## 🔧 Troubleshooting

### Error: "Cannot find module .../dist/main"

**Solución:**
1. Verificar que Build Command ejecutó sin errores
2. Verificar que `apps/api/dist/main.js` existe
3. Verificar que Start Command es: `cd apps/api && pnpm start:api`

### Error: "Prisma Client not generated"

**Solución:**
1. Verificar que Build Command incluye `pnpm prisma:generate`
2. Verificar que `packages/prisma` tiene acceso a `DATABASE_URL`

### Worker no procesa jobs

**Solución:**
1. Verificar `WORKER_MODE=1` y `JOB_RUNNER_ENABLED=true`
2. Verificar `REDIS_URL` es correcto
3. Verificar logs muestran "BullMQ worker created"

---

## ✅ Estado Final

- ✅ Build genera `apps/api/dist/main.js` y `apps/api/dist/worker.main.js`
- ✅ Scripts de build/start listos para Railway
- ✅ Prisma migrations se ejecutan automáticamente en API build
- ✅ Worker no ejecuta migrations (solo generate)
- ✅ Variables de entorno documentadas
- ✅ Health checks definidos

**Listo para deploy en Railway** 🚀
