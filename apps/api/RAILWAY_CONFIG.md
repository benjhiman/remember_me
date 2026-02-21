# Railway Configuration Guide

## Redis Configuration

### Overview
The application uses Redis for:
- BullMQ job queue (integration jobs)
- Rate limiting (optional)

### Environment Variables

#### `REDIS_URL` (Required for Redis features)
- **Description**: Full Redis connection URL
- **Format**: `redis://[username]:[password]@[host]:[port]` or `rediss://...` for TLS
- **Example**: `redis://default:password@redis.railway.internal:6379`
- **Required**: Only if you want to enable Redis-based features

### Behavior

#### When `REDIS_URL` is NOT set:
- ✅ Application starts normally (no crash)
- ✅ BullMQ queue adapter is **disabled**
- ✅ Job processing falls back to DB-based mode (if `QUEUE_MODE=db`)
- ✅ Rate limiting uses in-memory store (if not using Redis)
- ⚠️ Logs a **single warning** at startup: `"[redis] REDIS_URL not set, redis features disabled"`
- ❌ **No connection attempts** to `127.0.0.1:6379` (prevents ECONNREFUSED spam)

#### When `REDIS_URL` IS set:
- ✅ BullMQ queue adapter initializes (if `QUEUE_MODE=bullmq` and `WORKER_MODE=1`)
- ✅ Redis connection is established
- ✅ Job processing uses Redis queue

### Railway Setup

1. **Add Redis Service** (if needed):
   - In Railway dashboard, add a Redis service
   - Railway will provide `REDIS_URL` automatically

2. **Configure Environment Variables**:
   - If using Redis: Railway auto-injects `REDIS_URL`
   - If NOT using Redis: **Do not set `REDIS_URL`** (app will work without it)

3. **Queue Mode**:
   - `QUEUE_MODE=db` (default): Uses database for job queue (no Redis needed)
   - `QUEUE_MODE=bullmq`: Requires `REDIS_URL` and `WORKER_MODE=1`

### Troubleshooting

#### Error: `connect ECONNREFUSED 127.0.0.1:6379`
- **Cause**: Code is trying to connect to localhost Redis
- **Solution**: Ensure `REDIS_URL` is either:
  - **Set** to a valid Railway Redis URL, OR
  - **Not set at all** (app will disable Redis features gracefully)

#### Redis connection spam in logs
- **Cause**: Old code attempting reconnection loops
- **Solution**: Current code checks `REDIS_URL` before any connection attempt
- **Verification**: Check logs for single warning: `"[redis] REDIS_URL not set, redis features disabled"`

### Code Locations

- **BullMQ Adapter**: `apps/api/src/integrations/jobs/queue/bullmq-queue.adapter.ts`
  - Checks `REDIS_URL` in `onModuleInit()`
  - Only initializes if `REDIS_URL` exists
  - Logs warning once if missing

- **Job Runner**: `apps/api/src/integrations/jobs/job-runner.service.ts`
  - Only starts if `WORKER_MODE=1` and `JOB_RUNNER_ENABLED=true`
  - Uses DB mode if `QUEUE_MODE=db` (no Redis needed)

### Best Practices

1. **Production**: Set `REDIS_URL` only if you need Redis features
2. **Development**: Can use local Redis or leave unset (DB mode)
3. **Testing**: App should work without Redis (graceful degradation)
