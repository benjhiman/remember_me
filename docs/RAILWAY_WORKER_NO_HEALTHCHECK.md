# Railway Worker: Disable Healthcheck (URGENT)

## Problem

The worker service is failing deployment with:
```
Healthcheck failed!
Attempt #X failed with service unavailable
1/1 replicas never became healthy!
```

## Root Cause

Railway is trying to perform a healthcheck on `/api/health`, but the worker service **does NOT have an HTTP server**. Workers are background processes that process jobs, not web servers.

## Solution: Disable Healthcheck in Railway

### Step 1: Navigate to Worker Service Settings

1. Go to Railway Dashboard
2. Select your project
3. Click on **`remember_me/worker`** service (or your worker service name)
4. Click **Settings** tab
5. Click **Deploy** section

### Step 2: Clear Healthcheck Path

1. Find **"Healthcheck Path"** field
2. **Clear the field completely** (set to empty)
3. If there's a **"Healthcheck Timeout"** field, also clear it
4. Click **Save** or **Update**

### Step 3: Verify Configuration

After saving, verify:
- ✅ **Healthcheck Path**: (empty)
- ✅ **Healthcheck Timeout**: (empty or not set)

### Step 4: Redeploy

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Or wait for the next auto-deploy from `main` branch

## Expected Result

After disabling healthcheck:
- ✅ Worker deployment should succeed
- ✅ Worker logs should show: `[worker] Deployment diagnostics:`
- ✅ No more "Healthcheck failed!" errors
- ✅ Worker will run continuously processing jobs

## Why This Happens

- **API Service**: Has HTTP server → needs healthcheck → `/api/health` works ✅
- **Worker Service**: No HTTP server → healthcheck fails → must be disabled ✅

## Verification

After redeploy, check worker logs for:
```
[worker] Deployment diagnostics:
[worker] commit=<hash>
[worker] buildTime=<timestamp>
[worker] cwd=/app/apps/api
[worker] entry=/app/apps/api/dist/worker.main.js
[redis][worker] mode=enabled urlPresent=true host=redis.railway.internal:6379
```

If you see these logs, the worker is running correctly **without** a healthcheck.

## Related Files

- `apps/api/Dockerfile.worker` - Worker Dockerfile (no HEALTHCHECK instruction)
- `docs/DEPLOY_RAILWAY.md` - Full deployment guide
