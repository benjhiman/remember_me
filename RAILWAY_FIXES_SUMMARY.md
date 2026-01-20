# Fixes Aplicados - Railway Backend Issues

## Problemas Resueltos

### 1. ✅ Redis localhost hardcoded
**Problema:** BullMQ intentaba conectar a `127.0.0.1:6379` en producción.

**Fix aplicado:**
- `bullmq-queue.adapter.ts`: Eliminado fallback a `localhost:6379` en producción
- `job-runner.service.ts`: Eliminado fallback a `localhost:6379` en producción
- Ambos ahora usan `REDIS_URL` como primario, con fallbacks a otras variantes
- En producción, si falta `REDIS_URL`, lanza error (no intenta localhost)

### 2. ✅ BullMQ inicializándose en modo API
**Problema:** `BullMqQueueAdapter` se inicializaba incluso en modo API, causando conexiones Redis innecesarias.

**Fix aplicado:**
- `bullmq-queue.adapter.ts`: `onModuleInit()` ahora verifica `WORKER_MODE` y `JOB_RUNNER_ENABLED`
- Solo inicializa la queue si `QUEUE_MODE=bullmq` Y (`WORKER_MODE=1` OR `JOB_RUNNER_ENABLED=true`)
- En modo API, solo obtiene Redis URL pero no crea la conexión

### 3. ✅ JobRunner y schedulers corriendo en modo API
**Problema:** NO_REPLY scan, Meta Spend, y Meta Token Refresh corrían en modo API.

**Fix aplicado:**
- `job-runner.service.ts`: Todos los schedulers ahora verifican `isWorkerMode` antes de ejecutar
- NO_REPLY scan solo corre si `NO_REPLY_SCAN_ENABLED=true` Y `WORKER_MODE=1`
- Meta Spend scheduler solo corre si `META_SPEND_ENABLED=true` Y `WORKER_MODE=1`
- Meta Token Refresh scheduler solo corre si `META_TOKEN_REFRESH_ENABLED=true` Y `WORKER_MODE=1`

### 4. ✅ Health endpoints retornando 401
**Problema:** `/api/health` y `/api/health/extended` retornaban 401 aunque tenían `@Public()`.

**Fix aplicado:**
- `jwt-auth.guard.ts`: Tipo de retorno corregido para manejar Promise/Observable correctamente
- El guard ya respetaba `@Public()`, solo necesitaba el tipo correcto

---

## Archivos Modificados

1. **`apps/api/src/integrations/jobs/queue/bullmq-queue.adapter.ts`**
   - Constructor: Eliminado fallback a localhost en producción
   - `onModuleInit()`: Agregada verificación de `WORKER_MODE` y `JOB_RUNNER_ENABLED`
   - Solo inicializa queue en modo Worker

2. **`apps/api/src/integrations/jobs/job-runner.service.ts`**
   - `startBullWorker()`: Eliminado fallback a localhost en producción
   - `onModuleInit()`: Agregada verificación `isWorkerMode` para schedulers
   - NO_REPLY scan, Meta Spend, Meta Token Refresh solo corren en Worker mode

3. **`apps/api/src/common/guards/jwt-auth.guard.ts`**
   - `canActivate()`: Tipo de retorno corregido (removido tipo explícito que causaba error)

4. **`apps/api/src/app.controller.ts`**
   - No modificado (ya tenía `@Public()` correctamente)

---

## Lógica Cambiada

### Antes:
- BullMQ intentaba conectar a `localhost:6379` si no había `REDIS_URL`
- BullMQ se inicializaba siempre que `QUEUE_MODE=bullmq`, incluso en API mode
- Schedulers corrían en API mode si estaban habilitados
- Health endpoints podían fallar por tipo de retorno incorrecto

### Ahora:
- BullMQ **NUNCA** usa localhost en producción (lanza error si falta `REDIS_URL`)
- BullMQ solo se inicializa si `QUEUE_MODE=bullmq` Y (`WORKER_MODE=1` OR `JOB_RUNNER_ENABLED=true`)
- Schedulers solo corren en Worker mode (`WORKER_MODE=1`)
- Health endpoints funcionan correctamente con `@Public()`

---

## Variables de Entorno Esperadas

### API Service (Railway)
```env
# REQUIRED
REDIS_URL=redis://:password@host:6379          # Primario para BullMQ y rate limiting
RATE_LIMIT_REDIS_URL=redis://:password@host:6379  # Opcional (fallback a REDIS_URL)
WORKER_MODE=0                                  # REQUIRED: 0 para API
JOB_RUNNER_ENABLED=false                       # REQUIRED: false para API
QUEUE_MODE=bullmq                              # REQUIRED: bullmq para producción
NODE_ENV=production                            # REQUIRED

# Opcionales (fallbacks, no recomendados)
BULL_REDIS_URL=redis://...                    # Fallback a REDIS_URL
QUEUE_REDIS_URL=redis://...                    # Fallback a REDIS_URL
JOB_REDIS_URL=redis://...                     # Fallback a REDIS_URL
```

### Worker Service (Railway)
```env
# REQUIRED
REDIS_URL=redis://:password@host:6379          # MISMO que API
WORKER_MODE=1                                  # REQUIRED: 1 para Worker
JOB_RUNNER_ENABLED=true                        # REQUIRED: true para Worker
QUEUE_MODE=bullmq                              # REQUIRED: bullmq para producción
NODE_ENV=production                            # REQUIRED

# Opcionales
NO_REPLY_SCAN_ENABLED=true                    # Solo si quieres NO_REPLY scan
META_SPEND_ENABLED=true                       # Solo si quieres Meta Spend scheduler
META_TOKEN_REFRESH_ENABLED=true                # Solo si quieres Token Refresh scheduler
```

**Nota:** Todos los componentes Redis ahora usan `REDIS_URL` como primario. Los otros nombres (`BULL_REDIS_URL`, etc.) son solo fallbacks para compatibilidad.

---

## Comandos para Probar Localmente

### 1. Health endpoints (públicos)
```bash
# Health básico
curl http://localhost:4000/api/health

# Health extendido
curl http://localhost:4000/api/health/extended

# Debug config (público)
curl http://localhost:4000/api/debug/config
```

**Esperado:** Todos retornan `200 OK` sin token.

### 2. Verificar que API no conecta a Redis para jobs
```bash
# Levantar API en modo API (sin worker)
cd apps/api
WORKER_MODE=0 JOB_RUNNER_ENABLED=false QUEUE_MODE=bullmq REDIS_URL=redis://localhost:6379 pnpm dev

# Verificar logs - NO debe aparecer:
# - "Starting BullMQ worker"
# - "NO_REPLY_24H scanner enabled"
# - "Meta Spend fetch scheduler enabled"
# - "ECONNREFUSED 127.0.0.1:6379"

# Debe aparecer:
# - "BullMQ queue adapter skipped (QUEUE_MODE=bullmq, WORKER_MODE=0, JOB_RUNNER_ENABLED=false)"
# - "Job runner disabled in API mode"
```

### 3. Verificar que Worker sí conecta a Redis
```bash
# Levantar Worker
cd apps/api
WORKER_MODE=1 JOB_RUNNER_ENABLED=true QUEUE_MODE=bullmq REDIS_URL=redis://localhost:6379 pnpm dev

# Verificar logs - Debe aparecer:
# - "Starting BullMQ worker with concurrency X"
# - "BullMQ queue adapter initialized"
# - NO debe aparecer "ECONNREFUSED 127.0.0.1:6379"
```

---

## Validación en Railway

### API Service
**Logs esperados al iniciar:**
```
✅ Environment variables loaded successfully
🚀 API server running on: http://localhost:4000/api
BullMQ queue adapter skipped (QUEUE_MODE=bullmq, WORKER_MODE=0, JOB_RUNNER_ENABLED=false)
Job runner disabled in API mode (JOB_RUNNER_ENABLED=false)
NO_REPLY_24H scanner disabled in API mode (only runs in Worker mode).
```

**NO debe aparecer:**
- `ECONNREFUSED 127.0.0.1:6379`
- `Starting BullMQ worker`
- `NO_REPLY_24H scanner enabled`

### Worker Service
**Logs esperados al iniciar:**
```
🚀 Worker started (no HTTP server)
Worker mode: 1
Job runner enabled: true
Starting BullMQ worker with concurrency 5
BullMQ queue adapter initialized (queue: integration-jobs)
```

**NO debe aparecer:**
- `ECONNREFUSED 127.0.0.1:6379`

### Health Endpoints
```bash
curl https://api.iphonealcosto.com/api/health
# Esperado: 200 OK, {"status":"ok",...}

curl https://api.iphonealcosto.com/api/health/extended
# Esperado: 200 OK, {"status":"ok","db":"ok",...}
```

---

## Resumen de Cambios

| Archivo | Cambio Principal |
|---------|-----------------|
| `bullmq-queue.adapter.ts` | Eliminado localhost fallback, condicionada inicialización a Worker mode |
| `job-runner.service.ts` | Eliminado localhost fallback, schedulers solo en Worker mode |
| `jwt-auth.guard.ts` | Tipo de retorno corregido para @Public() |

**Build:** ✅ Compila sin errores  
**Linting:** ✅ Sin errores

---

## Estado Final

- ✅ Redis nunca usa localhost en producción
- ✅ BullMQ solo se inicializa en Worker mode
- ✅ Schedulers solo corren en Worker mode
- ✅ Health endpoints son públicos
- ✅ API mode no intenta conectar a Redis para jobs

**Listo para deploy en Railway** 🚀
