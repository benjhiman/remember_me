# BullMQ Migration Guide

## Overview

Fase 5.2 migra el sistema de colas de IntegrationJobs de DB-backed a BullMQ (Redis) con fallback automático a DB.

## Architecture

### Queue Adapters

- **DbQueueAdapter**: Implementación actual (DB-backed)
- **BullMqQueueAdapter**: Nueva implementación usando BullMQ + Redis
- **IntegrationQueueService**: Selecciona el adapter según `QUEUE_MODE`

### Queue Modes

- `QUEUE_MODE=db` (default): Usa DB queue (comportamiento actual)
- `QUEUE_MODE=bullmq`: Usa BullMQ (Redis), fallback a DB si Redis no disponible

## Environment Variables

### Required

```bash
# Queue mode: 'db' or 'bullmq' (default: 'db')
QUEUE_MODE=db

# Redis connection (reuses RATE_LIMIT_REDIS_URL if available, otherwise REDIS_URL)
REDIS_URL=redis://localhost:6379
# OR
RATE_LIMIT_REDIS_URL=redis://localhost:6379

# BullMQ queue name (default: 'integration-jobs')
BULLMQ_QUEUE_NAME=integration-jobs
```

### Optional

```bash
# Worker concurrency for BullMQ (default: 5)
INTEGRATION_WORKER_CONCURRENCY=5
```

## Local Development

### Start Redis

```bash
docker-compose up -d redis
```

### Run in DB Mode (default)

```bash
cd apps/api
QUEUE_MODE=db pnpm dev
```

### Run in BullMQ Mode

```bash
cd apps/api
QUEUE_MODE=bullmq REDIS_URL=redis://localhost:6379 pnpm dev
```

### Run Worker (BullMQ Mode)

```bash
cd apps/api
WORKER_MODE=1 QUEUE_MODE=bullmq REDIS_URL=redis://localhost:6379 pnpm dev
```

## Docker Compose

Redis ya está configurado en `docker-compose.yml`. Para usar BullMQ:

```yaml
services:
  api:
    environment:
      QUEUE_MODE: bullmq
      REDIS_URL: redis://redis:6379
      # OR reuse RATE_LIMIT_REDIS_URL if already configured
      RATE_LIMIT_REDIS_URL: redis://redis:6379

  worker:
    environment:
      WORKER_MODE: 1
      QUEUE_MODE: bullmq
      REDIS_URL: redis://redis:6379
      INTEGRATION_WORKER_CONCURRENCY: 5
```

## Migration Steps

### Phase 1: Dual Write (Testing)

1. **Keep `QUEUE_MODE=db`** (default)
2. Monitor logs for queue operations
3. Verify all jobs process correctly

### Phase 2: BullMQ Mode (Staging)

1. **Set `QUEUE_MODE=bullmq`** in staging
2. Verify Redis connectivity
3. Monitor BullMQ worker logs
4. Check job processing metrics

### Phase 3: Production Rollout

1. **Enable BullMQ in production**
2. Monitor for 24-48 hours
3. Verify no job losses
4. Monitor Redis memory usage

### Rollback Plan

If issues occur, immediately set:

```bash
QUEUE_MODE=db
```

The system will automatically fallback to DB queue mode. No data loss.

## Behavior Differences

### DB Mode (Current)

- Jobs stored in `IntegrationJob` table
- Worker polls DB every `JOB_RUNNER_INTERVAL_MS` (default 5s)
- Backoff: 2^attempt minutes (cap 60 min)
- Exactly-once not guaranteed (idempotency at application level)

### BullMQ Mode (New)

- Jobs stored in DB + BullMQ (dual write)
- Worker processes jobs from BullMQ queue immediately when available
- Backoff: exponential (2 minutes * 2^attempt), matches DB behavior
- Deduplication via deterministic `jobId` when `dedupeKey` provided
- Better concurrency control (configurable via `INTEGRATION_WORKER_CONCURRENCY`)

## Monitoring

### Check Queue Status

```bash
# DB Mode
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/integrations/jobs/metrics

# BullMQ Mode (via Redis CLI)
redis-cli
> LLEN bull:integration-jobs:wait
> LLEN bull:integration-jobs:active
> LLEN bull:integration-jobs:failed
```

### Logs

```bash
# API logs
QUEUE_MODE=bullmq - logs show "Using BullMQ queue adapter"

# Worker logs
WORKER_MODE=1 QUEUE_MODE=bullmq - logs show "Starting BullMQ worker with concurrency X"
```

## Troubleshooting

### Redis Connection Failed

- **Symptom**: Logs show "BullMQ enqueue failed, falling back to DB"
- **Solution**: Check Redis is running, verify `REDIS_URL` is correct

### Jobs Not Processing (BullMQ Mode)

- **Check**: Worker is running (`WORKER_MODE=1`)
- **Check**: `QUEUE_MODE=bullmq` in worker environment
- **Check**: Redis connectivity from worker
- **Fallback**: Set `QUEUE_MODE=db` temporarily

### High Memory Usage (Redis)

- Monitor Redis memory: `redis-cli INFO memory`
- Consider increasing `maxmemory` in Redis config
- Review job retention (`removeOnComplete: true`, `removeOnFail: false`)

## Performance Considerations

### DB Mode

- Suitable for low-medium volume (< 1000 jobs/min)
- Single worker instance recommended
- Latency: 0-5s (polling interval)

### BullMQ Mode

- Suitable for high volume (> 1000 jobs/min)
- Multiple worker instances supported
- Latency: < 100ms (near real-time)
- Better horizontal scaling

## Backoff and Retries

### Configuration

- **Max Attempts**: 5 (both modes)
- **Backoff**: Exponential (2 min, 4 min, 8 min, 16 min, 32 min)
- **Cap**: 60 minutes (DB mode only, BullMQ uses 32 min max)

### Behavior

- Jobs retry automatically on failure
- Backoff increases with each attempt
- After 5 attempts, job marked as `FAILED`
- Failed jobs remain in DB for inspection

## Testing

```bash
# Run all queue-related tests
cd apps/api
pnpm test -- integration-queue
pnpm test -- db-queue.adapter
pnpm test -- bullmq-queue.adapter
pnpm test -- job-runner-bullmq
```

## API Compatibility

✅ **No breaking changes**: All endpoints remain the same.

The migration is transparent to API consumers. Only internal queue implementation changes.
