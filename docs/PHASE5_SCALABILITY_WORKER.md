# Phase 5.1 — Worker Separado: Guía de Implementación

## Overview

El worker separado permite ejecutar jobs en un proceso independiente del API, mejorando la escalabilidad y separación de responsabilidades.

## Arquitectura

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   API App   │      │   Worker    │      │  PostgreSQL │
│  (NestJS)   │      │  (NestJS)   │      │     DB      │
│             │      │             │      │             │
│ - Endpoints │      │ - JobRunner │      │ - Jobs      │
│ - Webhooks  │      │ - Processors│      │ - Lock      │
│             │      │             │      │ - State     │
└─────────────┘      └─────────────┘      └─────────────┘
```

## Componentes

### 1. Worker Module (`apps/api/src/worker.module.ts`)

Módulo NestJS que solo carga lo necesario para procesar jobs:
- `PrismaModule` - Acceso a DB
- `LeadsModule` - Para automations
- `IntegrationsModule` - JobRunnerService y procesadores

**NO incluye:**
- Controllers HTTP
- Guards de autenticación
- Middleware de webhooks

### 2. Worker Entry Point (`apps/api/src/worker.main.ts`)

Entry point que:
- Crea `ApplicationContext` (sin HTTP server)
- Inicia `JobRunnerService` automáticamente
- Maneja graceful shutdown (SIGTERM/SIGINT)

### 3. Distributed Lock (`JobRunnerLockService`)

Usa PostgreSQL advisory locks para garantizar que solo un worker procese jobs a la vez:

- **Advisory Lock**: `pg_try_advisory_lock(1)` - Lock a nivel de DB
- **Lock Record**: Tabla `JobRunnerLock` para tracking y debugging
- **TTL**: Lock expira después de 2 intervalos (previene deadlocks)

### 4. State Tracking (`JobRunnerStateService`)

Persiste estado del último ciclo:
- `lastRunAt` - Timestamp del último ciclo
- `lastRunDurationMs` - Duración en milisegundos
- `lastRunJobCount` - Cantidad de jobs procesados
- `lastRunError` - Error si hubo

## Configuración

### Variables de Entorno

**API Mode (default):**
```bash
WORKER_MODE=0  # o no setear
JOB_RUNNER_ENABLED=false  # Deshabilitado por defecto en API
```

**Worker Mode:**
```bash
WORKER_MODE=1
JOB_RUNNER_ENABLED=true  # Habilitado por defecto en worker
JOB_RUNNER_INTERVAL_MS=5000
```

### Ejecutar Localmente

**API:**
```bash
cd apps/api
pnpm dev  # o pnpm start
```

**Worker:**
```bash
cd apps/api
WORKER_MODE=1 pnpm worker  # Development
# o
WORKER_MODE=1 pnpm worker:prod  # Production
```

### Docker Compose

```yaml
services:
  api:
    # ... config ...
    environment:
      WORKER_MODE: "0"
      JOB_RUNNER_ENABLED: "false"
    command: ["node", "dist/main.js"]

  worker:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      WORKER_MODE: "1"
      JOB_RUNNER_ENABLED: "true"
      JOB_RUNNER_INTERVAL_MS: "5000"
    command: ["node", "dist/worker.main.js"]
    depends_on:
      - db
```

## Database Schema

### JobRunnerLock

```sql
CREATE TABLE "job_runner_lock" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lockedBy" TEXT NOT NULL,  -- hostname-pid
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_runner_lock_pkey" PRIMARY KEY ("id")
);
```

### JobRunnerState

```sql
CREATE TABLE "job_runner_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastRunAt" TIMESTAMP(3),
    "lastRunDurationMs" INTEGER,
    "lastRunJobCount" INTEGER,
    "lastRunError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_runner_state_pkey" PRIMARY KEY ("id")
);
```

## Lock Mechanism

### PostgreSQL Advisory Locks

El lock usa `pg_try_advisory_lock(1)` que:
- ✅ Es atómico a nivel de DB
- ✅ Se libera automáticamente si la conexión se cierra
- ✅ Funciona entre múltiples instancias
- ✅ No requiere polling

### Flujo de Lock

1. Worker intenta `pg_try_advisory_lock(1)`
2. Si retorna `true` → Lock adquirido
3. Actualiza `JobRunnerLock` con `lockedBy` y `expiresAt`
4. Procesa jobs
5. Actualiza `JobRunnerState`
6. Libera lock con `pg_advisory_unlock(1)`
7. Borra registro de `JobRunnerLock`

### Cleanup de Locks Expirados

Antes de cada ciclo:
- Verifica si hay lock expirado (`expiresAt < now`)
- Si está expirado, lo libera automáticamente

## Observabilidad

### Logs Estructurados

Cada ciclo del job runner loggea:

```json
{
  "event": "job_runner_cycle_complete",
  "lockAcquired": true,
  "durationMs": 1500,
  "jobCount": 3,
  "error": null
}
```

### Métricas en `/api/integrations/jobs/metrics`

El endpoint ahora retorna:
- `lastRunAt` - Del `JobRunnerState`
- `lastRunDurationMs` - Del `JobRunnerState` (ya no es null)

## Testing

### Tests Unitarios

- `job-runner-lock.service.spec.ts` - Lock service
- `job-runner-state.service.spec.ts` - State service
- `job-runner.service.spec.ts` - JobRunnerService con lock

### Tests E2E

- `job-runner-lock.service.e2e.spec.ts` - Verifica exclusión mutua entre instancias

**Ejecutar tests:**
```bash
cd apps/api
pnpm test
```

## Troubleshooting

### Worker no procesa jobs

1. Verificar `WORKER_MODE=1`
2. Verificar `JOB_RUNNER_ENABLED=true`
3. Verificar logs: `lockAcquired: true`
4. Verificar DB: `SELECT * FROM job_runner_lock;`

### Lock stuck

Si un lock queda stuck (worker crasheó):

```sql
-- Liberar advisory lock manualmente
SELECT pg_advisory_unlock_all();

-- Limpiar registro
DELETE FROM job_runner_lock;
```

### Múltiples workers procesando

Verificar que el lock esté funcionando:
- Revisar `job_runner_lock` table
- Verificar que `lockedBy` sea consistente
- Verificar logs de ambos workers

## Deployment

### Staging/Production

1. **Build:**
   ```bash
   docker build -f apps/api/Dockerfile -t remember-me-api .
   ```

2. **Deploy API:**
   ```bash
   docker run -d \
     --name remember-me-api \
     -e WORKER_MODE=0 \
     -e JOB_RUNNER_ENABLED=false \
     remember-me-api \
     node dist/main.js
   ```

3. **Deploy Worker:**
   ```bash
   docker run -d \
     --name remember-me-worker \
     -e WORKER_MODE=1 \
     -e JOB_RUNNER_ENABLED=true \
     remember-me-api \
     node dist/worker.main.js
   ```

### Docker Compose

```bash
docker-compose -f docker-compose.staging.yml up -d
```

Esto levanta:
- `api` service (solo HTTP)
- `worker` service (solo jobs)
- `db` service

## Migración desde Monolito

Si ya tenías `JOB_RUNNER_ENABLED=true` en API:

1. **Fase 1**: Deshabilitar en API
   ```bash
   # En API
   JOB_RUNNER_ENABLED=false
   ```

2. **Fase 2**: Levantar worker
   ```bash
   # En Worker
   WORKER_MODE=1
   JOB_RUNNER_ENABLED=true
   ```

3. **Fase 3**: Verificar que jobs se procesan
   - Revisar logs del worker
   - Verificar `/api/integrations/jobs/metrics`

## Próximos Pasos

- [x] Fase 5.2: Migrar a BullMQ (Redis-based queue) - **COMPLETADO**
- [ ] Fase 5.3: Rate limiting por org
- [ ] Fase 5.4: Observabilidad avanzada (Prometheus)

## Referencia: Fase 5.2 (BullMQ)

Ver `apps/api/src/integrations/BULLMQ_MIGRATION.md` para detalles de la migración a BullMQ.

## Referencias

- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [NestJS Application Context](https://docs.nestjs.com/standalone-applications)
