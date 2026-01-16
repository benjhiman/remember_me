# Staging Deploy Guide

Guía completa para desplegar Remember Me en staging (production-like).

## Arquitectura

```
┌─────────────┐
│     API     │  (HTTP server, WORKER_MODE=0, JOB_RUNNER_ENABLED=false)
│   :4000     │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────┐      ┌──────────┐
│ Postgres │      │  Redis   │
│   :5432  │      │  :6379   │
└──────────┘      └────┬─────┘
                       │
                       ▼
                ┌─────────────┐
                │   Worker    │  (No HTTP, WORKER_MODE=1, JOB_RUNNER_ENABLED=true)
                │ (BullMQ)    │
                └─────────────┘
```

### Componentes

- **API**: Servidor HTTP NestJS que maneja requests, webhooks, endpoints
- **Worker**: Procesa jobs de BullMQ (envío de mensajes, webhooks, Meta spend)
- **Redis**: Cola BullMQ + rate limiting
- **Postgres**: Base de datos principal

## Requisitos

- Docker & Docker Compose
- Variables de entorno configuradas (`.env.docker`)

## Variables de Entorno Mínimas

### Requeridas

```bash
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=remember_me

# JWT
JWT_SECRET=<min-32-chars-secret>

# Token Encryption (producción)
TOKEN_ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# Metrics
METRICS_TOKEN=<secure-random-token>
```

### Recomendadas

```bash
# Queue
QUEUE_MODE=bullmq
REDIS_URL=redis://redis:6379
RATE_LIMIT_REDIS_URL=redis://redis:6379
BULLMQ_QUEUE_NAME=integration-jobs
INTEGRATION_WORKER_CONCURRENCY=5

# Rate Limiting
RATE_LIMIT_ENABLED=true

# WhatsApp (opcional para tests)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=

# Meta/Instagram (opcional para tests)
META_APP_ID=
META_APP_SECRET=
META_PAGE_ACCESS_TOKEN=
INSTAGRAM_PAGE_ID=

# Test Mode (para smoke e2e)
STAGING_TEST_MODE=true
EXTERNAL_HTTP_MODE=mock  # mock | real
```

Ver `.env.docker.example` para lista completa.

## Deploy Steps

### 1. Preparar variables de entorno

```bash
cp .env.docker.example .env.docker
# Editar .env.docker con valores reales
```

### 2. Build imágenes

```bash
pnpm docker:build
```

### 3. Levantar servicios

```bash
pnpm docker:up
```

### 4. Verificar health

```bash
# API health
curl http://localhost:4000/api/health/extended

# Métricas Prometheus
curl -H "X-Metrics-Token: <METRICS_TOKEN>" http://localhost:4000/api/metrics

# Job metrics (requiere auth)
curl -H "Authorization: Bearer <JWT>" http://localhost:4000/api/integrations/jobs/metrics
```

### 5. Ejecutar smoke e2e tests

```bash
pnpm smoke:e2e
```

## Health Checks

### API Health

- `GET /api/health` - Básico
- `GET /api/health/extended` - Extendido (DB, uptime, version)

**Respuesta esperada:**
```json
{
  "status": "ok",
  "db": "ok",
  "uptime": 3600,
  "version": "1.0.0",
  "env": "staging"
}
```

### Job Metrics

- `GET /api/integrations/jobs/metrics` - Métricas de jobs (requiere auth ADMIN/OWNER)

**Respuesta esperada:**
```json
{
  "pendingCount": 0,
  "processingCount": 0,
  "failedCount": 0,
  "oldestPendingAgeMs": null,
  "lastRunAt": "2024-01-16T10:00:00Z",
  "lastRunDurationMs": 1234
}
```

### Prometheus Metrics

- `GET /api/metrics` - Métricas Prometheus (requiere `X-Metrics-Token` header)

**Formato:** Prometheus exposition format (text/plain)

## Escalabilidad

### Worker Concurrency

Ajustar `INTEGRATION_WORKER_CONCURRENCY` en `.env.docker`:

```bash
INTEGRATION_WORKER_CONCURRENCY=10  # Procesar 10 jobs simultáneamente
```

**Recomendaciones:**
- Desarrollo: 1-2
- Staging: 5
- Producción: 10-20 (según carga)

### Redis

Para alta carga, considerar Redis cluster o Redis Sentinel:

```bash
REDIS_URL=redis://redis-sentinel:26379?sentinelMaster=mymaster
```

### Postgres

Para producción, usar Postgres managed service (RDS, Cloud SQL, etc.) y actualizar `DATABASE_URL`.

### Escalar Workers

Para múltiples workers:

```yaml
# docker-compose.staging.yml
worker1:
  # ... same config as worker
worker2:
  # ... same config as worker
```

BullMQ maneja distribución automática de jobs entre workers.

## Checklist Pre-Deploy

- [ ] `.env.docker` configurado con secrets reales
- [ ] `JWT_SECRET` mínimo 32 caracteres
- [ ] `TOKEN_ENCRYPTION_KEY` base64 válido (32 bytes)
- [ ] `METRICS_TOKEN` configurado
- [ ] `QUEUE_MODE=bullmq` (staging/prod)
- [ ] `RATE_LIMIT_ENABLED=true`
- [ ] Health checks pasando
- [ ] Smoke e2e tests pasando
- [ ] Logs sin errores críticos
- [ ] Redis conectado (verificar logs)
- [ ] Worker procesando jobs (verificar `/api/integrations/jobs/metrics`)

## Troubleshooting

### Worker no procesa jobs

1. Verificar logs: `docker-compose logs worker`
2. Verificar Redis: `docker-compose exec redis redis-cli ping`
3. Verificar job metrics: `GET /api/integrations/jobs/metrics`
4. Verificar `QUEUE_MODE=bullmq` en worker
5. Verificar `JOB_RUNNER_ENABLED=true` en worker

### API no responde

1. Verificar health: `GET /api/health/extended`
2. Verificar logs: `docker-compose logs api`
3. Verificar DB conexión: `docker-compose exec db psql -U postgres -d remember_me -c "SELECT 1"`
4. Verificar puerto: `netstat -an | grep 4000`

### Redis connection failed

1. Verificar Redis está corriendo: `docker-compose ps redis`
2. Verificar URL: `REDIS_URL=redis://redis:6379`
3. Verificar network: `docker-compose network ls`

Ver también `docs/RUNBOOK.md` para troubleshooting operativo.
