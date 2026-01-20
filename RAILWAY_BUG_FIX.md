# Fix: Railway Production Bug - API Mode Initialization

## Problemas Resueltos

### 1. ✅ NO_REPLY scanner ejecutándose en API mode
**Problema:** `NO_REPLY_24H scanner enabled` aparecía en logs de API aunque `JOB_RUNNER_ENABLED=false`.

**Fix:** 
- Agregado flag unificado `isJobRunnerEnabled = isWorkerMode && enabled`
- Scanners ahora verifican `isJobRunnerEnabled` en lugar de solo `isWorkerMode`
- Logs claros indicando que scanners están deshabilitados en API mode

### 2. ✅ BullMQ inicializándose en API mode
**Problema:** `BullMQ queue adapter initialized` aparecía en logs de API aunque `WORKER_MODE=0`.

**Fix:**
- `BullMqQueueAdapter.onModuleInit()` ahora verifica `WORKER_MODE=1` Y `JOB_RUNNER_ENABLED=true` antes de inicializar
- Constructor ya no crea conexión Redis (movido a `onModuleInit`)
- `IntegrationQueueService` verifica worker mode antes de usar BullMQ adapter

### 3. ✅ Redis localhost en producción
**Problema:** `ECONNREFUSED 127.0.0.1:6379` aparecía en logs de producción.

**Fix:**
- Eliminado fallback a `localhost:6379` en producción en `BullMqQueueAdapter`
- Eliminado fallback a `localhost:6379` en producción en `RateLimitService`
- En producción, si falta `REDIS_URL`, lanza error claro (no fallback)

---

## Archivos Modificados

### 1. `apps/api/src/integrations/jobs/job-runner.service.ts`
**Cambios:**
- Agregado flag unificado `isJobRunnerEnabled = isWorkerMode && enabled`
- Scanners (NO_REPLY, Meta Spend, Token Refresh) ahora verifican `isJobRunnerEnabled`
- Logs mejorados indicando por qué scanners están deshabilitados

**Lógica anterior:**
```typescript
if (this.noReplyScanEnabled && this.isWorkerMode) {
  // Ejecutar scanner
}
```

**Lógica nueva:**
```typescript
if (this.noReplyScanEnabled && this.isJobRunnerEnabled) {
  // Ejecutar scanner
} else if (this.noReplyScanEnabled && !this.isJobRunnerEnabled) {
  this.logger.log(`NO_REPLY_24H scanner disabled in ${mode} mode (only runs when job runner is enabled in Worker mode).`);
}
```

### 2. `apps/api/src/integrations/jobs/queue/bullmq-queue.adapter.ts`
**Cambios:**
- Constructor ya no inicializa Redis connection (movido a `onModuleInit`)
- `onModuleInit()` verifica `WORKER_MODE=1` Y `JOB_RUNNER_ENABLED=true` antes de inicializar
- Eliminado fallback a localhost en producción
- Propiedades `enabled` y `redisConnection` cambiadas de `readonly` a mutables

**Lógica anterior:**
```typescript
constructor() {
  // Inicializar Redis connection aquí
  this.redisConnection = redisUrl || 'redis://localhost:6379';
}
```

**Lógica nueva:**
```typescript
constructor() {
  // No inicializar nada aquí
  this.enabled = false;
  this.redisConnection = '';
}

async onModuleInit() {
  const isWorkerMode = workerMode === '1' || workerMode === 'true';
  const isJobRunnerEnabled = isWorkerMode && (jobRunnerEnabled === 'true' || jobRunnerEnabled !== 'false');
  const shouldInitialize = queueMode === 'bullmq' && isWorkerMode && isJobRunnerEnabled;
  
  if (!shouldInitialize) {
    this.logger.log(`BullMQ queue adapter skipped (API mode - ...)`);
    return;
  }
  
  // Solo aquí inicializar Redis connection
}
```

### 3. `apps/api/src/integrations/jobs/queue/integration-queue.service.ts`
**Cambios:**
- `onModuleInit()` verifica worker mode antes de seleccionar BullMQ adapter
- En API mode, siempre usa DB adapter (aunque `QUEUE_MODE=bullmq`)

**Lógica nueva:**
```typescript
async onModuleInit() {
  const isWorkerMode = workerMode === '1' || workerMode === 'true';
  const isJobRunnerEnabled = isWorkerMode && (jobRunnerEnabled === 'true' || jobRunnerEnabled !== 'false');
  
  if (this.queueMode === 'bullmq' && isWorkerMode && isJobRunnerEnabled) {
    // Usar BullMQ
  } else {
    // Usar DB adapter (API mode)
    this.logger.log('Using DB queue adapter (API mode - BullMQ skipped)');
  }
}
```

### 4. `apps/api/src/common/rate-limit/rate-limit.service.ts`
**Cambios:**
- Eliminado fallback a `localhost:6379` en producción
- Usa `RATE_LIMIT_REDIS_URL` o `REDIS_URL` como fallback
- En producción, si falta ambos, lanza error claro

**Lógica nueva:**
```typescript
constructor() {
  const rateLimitRedisUrl = this.configService.get<string>('RATE_LIMIT_REDIS_URL');
  const redisUrl = this.configService.get<string>('REDIS_URL');
  const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
  
  if (rateLimitRedisUrl) {
    this.redisUrl = rateLimitRedisUrl;
  } else if (redisUrl) {
    this.redisUrl = redisUrl;
  } else {
    if (nodeEnv === 'production') {
      throw new Error('RATE_LIMIT_REDIS_URL or REDIS_URL is required for rate limiting in production.');
    }
    this.redisUrl = 'redis://localhost:6379'; // Solo en development
  }
}
```

---

## Variables de Entorno

### API Service (Railway)
```env
WORKER_MODE=0                    # REQUIRED: 0 para API
JOB_RUNNER_ENABLED=false        # REQUIRED: false para API
REDIS_URL=redis://...           # REQUIRED: Para rate limiting
RATE_LIMIT_REDIS_URL=redis://... # Opcional (fallback a REDIS_URL)
QUEUE_MODE=bullmq               # REQUIRED: bullmq para producción
NODE_ENV=production             # REQUIRED
```

### Worker Service (Railway)
```env
WORKER_MODE=1                   # REQUIRED: 1 para Worker
JOB_RUNNER_ENABLED=true         # REQUIRED: true para Worker
REDIS_URL=redis://...           # REQUIRED: MISMO que API
QUEUE_MODE=bullmq               # REQUIRED: bullmq para producción
NODE_ENV=production             # REQUIRED
```

**Nota:** En producción, si falta `REDIS_URL`, el sistema lanzará un error claro (no fallback a localhost).

---

## Logs Esperados

### API Service (Railway)
**Logs esperados:**
```
✅ Environment variables loaded successfully
Job runner disabled in API mode (WORKER_MODE=0, JOB_RUNNER_ENABLED=false)
NO_REPLY_24H scanner disabled in API mode (only runs when job runner is enabled in Worker mode).
Meta Spend fetch scheduler disabled in API mode (only runs when job runner is enabled in Worker mode).
Meta Token refresh scheduler disabled in API mode (only runs when job runner is enabled in Worker mode).
BullMQ queue adapter skipped (API mode - QUEUE_MODE=bullmq, WORKER_MODE=0, JOB_RUNNER_ENABLED=false)
Using DB queue adapter (API mode - BullMQ skipped)
[RateLimitService] Redis connected for rate limiting
```

**NO debe aparecer:**
- ❌ `NO_REPLY_24H scanner enabled`
- ❌ `Starting NO_REPLY_24H scan`
- ❌ `BullMQ queue adapter initialized`
- ❌ `Using BullMQ queue adapter`
- ❌ `ECONNREFUSED 127.0.0.1:6379`

### Worker Service (Railway)
**Logs esperados:**
```
Worker mode: 1
Job runner enabled: true
Starting job runner in WORKER mode with interval 5000ms (queue mode: bullmq)
BullMQ queue adapter initialized (queue: integration-jobs)
Using BullMQ queue adapter
Starting BullMQ worker with concurrency 5
NO_REPLY_24H scanner enabled. Scanning every 300000ms.
```

**NO debe aparecer:**
- ❌ `ECONNREFUSED 127.0.0.1:6379`

---

## Health Endpoints

**Verificación:**
```bash
curl https://api.iphonealcosto.com/api/health
# Esperado: 200 OK, {"status":"ok","timestamp":"..."}

curl https://api.iphonealcosto.com/api/health/extended
# Esperado: 200 OK, {"status":"ok","db":"ok",...}
```

**Estado:** ✅ Endpoints siguen siendo públicos (no requieren autenticación)

---

## Resumen de Cambios

| Archivo | Cambio Principal |
|---------|-----------------|
| `job-runner.service.ts` | Flag unificado `isJobRunnerEnabled`, scanners verifican este flag |
| `bullmq-queue.adapter.ts` | Constructor no inicializa Redis, `onModuleInit()` verifica worker mode |
| `integration-queue.service.ts` | Verifica worker mode antes de usar BullMQ adapter |
| `rate-limit.service.ts` | Eliminado fallback a localhost en producción |

**Build:** ✅ Compila sin errores  
**Linting:** ✅ Sin errores  
**Health endpoints:** ✅ Públicos (200 OK)

---

## Validación

### Antes del Fix:
```
[JobRunnerService] Job runner disabled in API mode
[JobRunnerService] NO_REPLY_24H scanner enabled. ❌
[JobRunnerService] Starting NO_REPLY_24H scan... ❌
Error: connect ECONNREFUSED 127.0.0.1:6379 ❌
[BullMqQueueAdapter] BullMQ queue adapter initialized ❌
[IntegrationQueueService] Using BullMQ queue adapter ❌
```

### Después del Fix:
```
[JobRunnerService] Job runner disabled in API mode ✅
[JobRunnerService] NO_REPLY_24H scanner disabled in API mode ✅
[BullMqQueueAdapter] BullMQ queue adapter skipped (API mode - ...) ✅
[IntegrationQueueService] Using DB queue adapter (API mode - BullMQ skipped) ✅
[RateLimitService] Redis connected for rate limiting ✅
```

---

## Estado Final

- ✅ Scanners NO se ejecutan en API mode
- ✅ BullMQ NO se inicializa en API mode
- ✅ Redis nunca usa localhost en producción
- ✅ Health endpoints siguen siendo públicos
- ✅ Build compila sin errores

**Listo para deploy en Railway** 🚀
