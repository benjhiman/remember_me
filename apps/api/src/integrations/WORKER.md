# Worker Separado - Guía de Uso

## Overview

El worker es un proceso separado que ejecuta jobs de forma asíncrona, mientras que el API solo maneja requests HTTP.

## Feature Flags Matrix

| Modo | WORKER_MODE | JOB_RUNNER_ENABLED (default) | Comportamiento |
|------|-------------|------------------------------|----------------|
| **API** | `0` o no set | `false` | Solo HTTP, NO procesa jobs |
| **API (override)** | `0` | `true` (explícito) | HTTP + procesa jobs (no recomendado en prod) |
| **Worker** | `1` o `true` | `true` | Solo procesa jobs, NO HTTP |
| **Worker (override)** | `1` | `false` (explícito) | Worker inactivo (útil para debugging) |

### Reglas

- **API mode**: `JOB_RUNNER_ENABLED` debe ser `false` por defecto en producción
- **Worker mode**: `JOB_RUNNER_ENABLED` es `true` por defecto (puede deshabilitarse explícitamente)
- **Producción**: Siempre usar worker separado, nunca procesar jobs en API

## Comandos

### Desarrollo Local

**API (solo HTTP):**
```bash
cd apps/api
pnpm api
# o
pnpm dev  # con watch mode
```

**Worker (solo jobs):**
```bash
cd apps/api
pnpm worker
# o con watch mode (requiere nodemon o similar)
```

**Worker (una sola ejecución - útil para cron/k8s job):**
```bash
cd apps/api
pnpm worker:once
```

### Producción

**API:**
```bash
cd apps/api
pnpm build
pnpm api:prod
# o
NODE_ENV=production node dist/main.js
```

**Worker (continuo):**
```bash
cd apps/api
pnpm build
pnpm worker:prod
# o
NODE_ENV=production WORKER_MODE=1 node dist/worker.main.js
```

**Worker (una vez - para cron/k8s):**
```bash
cd apps/api
pnpm build
pnpm worker:once:prod
# o
NODE_ENV=production WORKER_MODE=1 WORKER_RUN_ONCE=1 node dist/worker.main.js
```

## Variables de Entorno

### API

```bash
# Core
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...

# Job Runner (debe estar deshabilitado)
WORKER_MODE=0  # o no setear
JOB_RUNNER_ENABLED=false  # default en API mode
```

### Worker

```bash
# Core
NODE_ENV=production
DATABASE_URL=postgresql://...

# Worker Mode
WORKER_MODE=1
JOB_RUNNER_ENABLED=true  # default en worker mode

# Job Runner Config
JOB_RUNNER_INTERVAL_MS=5000
NO_REPLY_SCAN_ENABLED=true
NO_REPLY_SCAN_INTERVAL_MS=300000
META_SPEND_ENABLED=true
META_TOKEN_REFRESH_ENABLED=true

# Run Once (para cron/k8s)
WORKER_RUN_ONCE=1  # Si se setea, ejecuta un ciclo y sale
```

## Docker Compose

### Local Development

```yaml
services:
  db:
    image: postgres:16
    # ... config ...

  api:
    build: .
    command: ["node", "dist/main.js"]
    environment:
      WORKER_MODE: "0"
      JOB_RUNNER_ENABLED: "false"
    # ... config ...

  worker:
    build: .
    command: ["node", "dist/worker.main.js"]
    environment:
      WORKER_MODE: "1"
      JOB_RUNNER_ENABLED: "true"
    depends_on:
      - db
    # ... config ...
```

### Kubernetes Job (run once)

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: job-runner-once
spec:
  template:
    spec:
      containers:
      - name: worker
        image: remember-me-api:latest
        command: ["node", "dist/worker.main.js"]
        env:
        - name: WORKER_MODE
          value: "1"
        - name: WORKER_RUN_ONCE
          value: "1"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
      restartPolicy: Never
```

## Verificación

### Verificar que API NO procesa jobs

```bash
# En API
curl http://localhost:4000/api/health/extended
# Verificar logs: NO debe aparecer "Starting job runner"
```

### Verificar que Worker procesa jobs

```bash
# En Worker logs
# Debe aparecer: "Starting job runner in WORKER mode"
# Y cada 5s (o intervalo configurado): "job_runner_cycle_complete"
```

### Verificar estado del job runner

```bash
# Endpoint de métricas (desde API)
curl http://localhost:4000/api/integrations/jobs/metrics
# Debe retornar: lastRunAt, lastRunDurationMs (si worker está corriendo)
```

## Troubleshooting

### Worker no procesa jobs

1. Verificar `WORKER_MODE=1`
2. Verificar `JOB_RUNNER_ENABLED=true` (o no setear, default es true en worker)
3. Verificar logs: buscar "Starting job runner in WORKER mode"
4. Verificar DB: `SELECT * FROM job_runner_state;` debe tener `lastRunAt` reciente

### API procesa jobs (no debería)

1. Verificar `WORKER_MODE=0` o no setear
2. Verificar `JOB_RUNNER_ENABLED=false` (o no setear, default es false en API)
3. Verificar logs: NO debe aparecer "Starting job runner"

### Lock stuck

Si el worker crasheó y el lock quedó stuck:

```sql
-- Liberar advisory lock
SELECT pg_advisory_unlock_all();

-- Limpiar registro
DELETE FROM job_runner_lock;
```

## Migración desde Monolito

Si antes tenías `JOB_RUNNER_ENABLED=true` en API:

1. **Deshabilitar en API:**
   ```bash
   # En .env o docker-compose
   WORKER_MODE=0
   JOB_RUNNER_ENABLED=false
   ```

2. **Levantar Worker:**
   ```bash
   # En docker-compose o k8s
   WORKER_MODE=1
   JOB_RUNNER_ENABLED=true  # o dejar default
   ```

3. **Verificar:**
   - API logs: NO debe procesar jobs
   - Worker logs: SÍ debe procesar jobs
   - Métricas: `lastRunAt` se actualiza

## Próximos Pasos

- [ ] Fase 5.2: Migrar a BullMQ (Redis-based queue)
- [ ] Fase 5.3: Rate limiting por org
- [ ] Fase 5.4: Observabilidad avanzada
