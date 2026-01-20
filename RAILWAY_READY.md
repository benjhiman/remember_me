# ✅ Railway Configuration - READY TO DEPLOY

## 📋 Resumen de Cambios

### Archivos Modificados

1. ✅ `apps/api/nest-cli.json` - Configurado builder tsc
2. ✅ `apps/api/tsconfig.json` - Agregado rootDir explícito
3. ✅ `apps/api/tsconfig.build.json` - **REESCRITO** - Configuración independiente para build
4. ✅ `apps/api/package.json` - Scripts build:api, build:worker, start:api, start:worker
5. ✅ `packages/prisma/package.json` - Script db:migrate:deploy

### Verificación Local

```bash
cd apps/api && pnpm build
# ✅ Genera dist/main.js y dist/worker.main.js
```

---

## 🚂 RAILWAY: Comandos Copy/Paste

### Service A: API (HTTP)

**Install Command:**
```
pnpm install --frozen-lockfile
```

**Build Command:**
```
cd apps/api && pnpm build:api
```

**Start Command:**
```
cd apps/api && pnpm start:api
```

---

### Service B: Worker (Background Jobs)

**Install Command:**
```
pnpm install --frozen-lockfile
```

**Build Command:**
```
cd apps/api && pnpm build:worker
```

**Start Command:**
```
cd apps/api && pnpm start:worker
```

---

## 🔐 Variables de Entorno - Copy/Paste

### API Service

```
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
REDIS_URL=redis://:password@host:6379
JWT_SECRET=[generar con: openssl rand -base64 32]
JWT_REFRESH_SECRET=[generar con: openssl rand -base64 32]
CORS_ORIGINS=https://app.iphonealcosto.com
FRONTEND_URL=https://app.iphonealcosto.com
NODE_ENV=production
WORKER_MODE=0
JOB_RUNNER_ENABLED=false
QUEUE_MODE=bullmq
RATE_LIMIT_ENABLED=true
WHATSAPP_APP_SECRET=[de Meta Developer Console]
META_APP_SECRET=[de Meta Developer Console]
METRICS_TOKEN=[generar con: openssl rand -base64 32]
```

### Worker Service

```
DATABASE_URL=[MISMO que API]
REDIS_URL=[MISMO que API]
JWT_SECRET=[MISMO que API]
JWT_REFRESH_SECRET=[MISMO que API]
NODE_ENV=production
WORKER_MODE=1
JOB_RUNNER_ENABLED=true
QUEUE_MODE=bullmq
INTEGRATION_WORKER_CONCURRENCY=5
```

---

## ✅ Checklist Post-Deploy

### 1. API Health
```bash
curl https://<api-domain>/api/health/extended
```
**Esperado:** `{"status":"ok","db":"ok",...}`

### 2. Worker Logs
En Railway → Worker → Logs, buscar:
```
🚀 Worker started (no HTTP server)
Worker mode: 1
Job runner enabled: true
```

### 3. CORS Test
Desde frontend:
```javascript
fetch('https://<api-domain>/api/health', { credentials: 'include' })
```
**Esperado:** No errores CORS

### 4. Jobs Metrics
```bash
TOKEN=$(curl -s -X POST https://<api-domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}' | jq -r '.accessToken')

curl -H "Authorization: Bearer $TOKEN" \
  https://<api-domain>/api/integrations/jobs/metrics
```
**Esperado:** JSON con jobs stats

### 5. Database Migrations
En logs del API (durante build):
```
✅ Prisma migrations applied successfully
```

---

## 📚 Documentación Completa

- `RAILWAY_CONFIG.md` - Documentación completa y detallada
- `RAILWAY_DEPLOY_SUMMARY.md` - Resumen ejecutivo con todos los cambios

---

## 🎯 Estado Final

- ✅ Build funciona correctamente
- ✅ `dist/main.js` y `dist/worker.main.js` se generan
- ✅ Scripts listos para Railway
- ✅ Prisma migrations automáticas en API
- ✅ Variables documentadas
- ✅ Health checks definidos

**🚀 LISTO PARA DEPLOY**
