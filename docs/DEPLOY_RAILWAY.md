# Railway Deployment Guide

## Overview

This document describes how Railway deploys the Remember Me API backend (`apps/api`) from the monorepo.

## Repository Structure

- **Monorepo**: Root contains `apps/`, `packages/`, `pnpm-workspace.yaml`
- **Backend**: `apps/api/` (NestJS application)
- **Build Output**: `apps/api/dist/` (TypeScript compiled to JavaScript)

## Railway Configuration

### Files

1. **`railway.toml`** (root)
   - Configures Railway API service to use `apps/api/Dockerfile`
   - Sets health check to `/api/health`
   - Defines restart policy
   - **Note**: Worker service requires separate configuration (see below)

2. **`apps/api/Dockerfile`**
   - Multi-stage build for monorepo
   - Builds Prisma client and API
   - Production runtime image
   - **Entrypoint**: `node dist/main.js` (API server)

3. **`apps/api/Dockerfile.worker`** (NEW)
   - Multi-stage build for worker (same build process as API)
   - Builds Prisma client and API
   - Production runtime image
   - **Entrypoint**: `node dist/worker.main.js` (Worker, no HTTP server)
   - **No port/healthcheck** (worker doesn't serve HTTP)

### GitHub Integration

Railway should be connected to:
- **Repository**: `https://github.com/benjhiman/remember_me`
- **Branch**: `main`
- **Auto-deploy**: Enabled (deploys on push to `main`)

### Verifying Railway Connection

1. Go to Railway dashboard → Your Project → Settings → Source
2. Verify:
   - **Repository**: `benjhiman/remember_me`
   - **Branch**: `main`
   - **Auto Deploy**: Enabled

If disconnected or pointing to wrong branch:
1. Click "Disconnect" (if connected to wrong repo/branch)
2. Click "Connect GitHub Repo"
3. Select `benjhiman/remember_me`
4. Select branch `main`
5. Enable "Auto Deploy"

## Build Process

Railway uses the Dockerfile at `apps/api/Dockerfile` which:

1. **Stage 1 (Builder)**:
   - Copies monorepo structure
   - Installs pnpm and dependencies
   - Generates Prisma client
   - Builds TypeScript (`pnpm build` in `apps/api`)

2. **Stage 2 (Runtime)**:
   - Copies built artifacts
   - Installs production dependencies only
   - Generates Prisma client for runtime
   - Starts with `node dist/main.js`

### Build Commands (for reference)

If Railway were to use Nixpacks instead of Dockerfile, it would run:
- **Install**: `pnpm install --frozen-lockfile`
- **Build**: `pnpm --filter @remember-me/prisma build && pnpm -C apps/api build && pnpm --filter @remember-me/prisma db:generate`
- **Start**: `pnpm -C apps/api start:api`

But we use Dockerfile for consistency.

### Build Arguments (Cache Busting)

Both Dockerfiles (`Dockerfile` and `Dockerfile.worker`) accept build arguments:
- `GIT_COMMIT`: Commit hash (default: `unknown`)
- `BUILD_TIME`: Build timestamp (default: current time)

**Railway automatically sets these** from environment variables:
- `GIT_COMMIT` from `RAILWAY_GIT_COMMIT_SHA`
- `BUILD_TIME` from build timestamp

These are used to:
1. Create `/app/BUILD_COMMIT.txt` in the image (for runtime verification)
2. Invalidate Docker cache (DEPLOY_TRIGGER.txt changes on every commit)

**Manual Build (for testing)**:
```bash
docker build \
  --build-arg GIT_COMMIT=$(git rev-parse HEAD) \
  --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -f apps/api/Dockerfile \
  -t remember-me-api .
```

## Environment Variables

Railway should have these environment variables set:

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT tokens
- `NODE_ENV=production`

### Optional
- `REDIS_URL` - Redis connection (if using BullMQ)
- `PORT` - Server port (default: 4000)
- `RAILWAY_GIT_COMMIT_SHA` - Auto-set by Railway (commit hash)

## Deployment Verification

### 1. Check Railway Logs (API Service)

After deployment, check API logs for:
```
📦 Deployed commit: <7-char-hash>
🚀 API server running on: http://localhost:4000/api
```

The commit hash should match the latest commit on `main`.

### 2. Check Railway Logs (Worker Service)

After deployment, check Worker logs for:
```
[worker] Deployment diagnostics:
[worker] commit=<7-char-hash>
[worker] cwd=/app/apps/api
[worker] entry=/app/apps/api/dist/worker.main.js
[redis][worker] REDIS_URL present: true
[redis][worker] Redis host: redis.railway.internal:6379
🚀 Worker started (no HTTP server)
```

**Critical checks:**
- ✅ Commit hash matches latest commit on `main`
- ✅ Entry point is `worker.main.js` (NOT `main.js`)
- ✅ Redis host is `redis.railway.internal:6379` (NOT `127.0.0.1` or `localhost`)
- ✅ NO errors: `ECONNREFUSED 127.0.0.1:6379`

### 3. Check Health Endpoint

```bash
curl -I https://api.iphonealcosto.com/api/health
```

Response should include:
- `HTTP/1.1 200 OK`
- `X-App-Commit: <commit-hash>` (7 characters)

### 4. Verify Commit Hash

```bash
# Get latest commit from GitHub
git log --oneline -1 origin/main

# Check Railway logs for deployed commit
# Should match the first 7 characters
```

## Manual Redeploy

If auto-deploy is not working:

### Option 1: Force via Git (Recommended)

Create a trigger file to force rebuild:

```bash
# Create trigger file
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) - Target commit: $(git rev-parse HEAD)" > apps/api/DEPLOY_TRIGGER.txt
git add apps/api/DEPLOY_TRIGGER.txt
git commit -m "deploy: trigger railway rebuild for latest api commit"
git push origin main
```

### Option 2: Railway Dashboard

1. Go to Railway dashboard → Your Project → Deployments
2. Click "Redeploy" on latest deployment
3. Or create new deployment from `main` branch

## Troubleshooting

### Railway Not Deploying

1. **Check GitHub Connection**:
   - Railway → Settings → Source (for each service)
   - Verify repo and branch are correct
   - Reconnect if needed

2. **Check Build Logs**:
   - Railway → Deployments → Latest → View Logs
   - Look for build errors

3. **Check Dockerfile**:
   - **API**: Ensure `apps/api/Dockerfile` exists
   - **Worker**: Ensure `apps/api/Dockerfile.worker` exists
   - Verify `railway.toml` points to correct path (API only)

4. **Worker Using Wrong Entrypoint**:
   - Railway → Worker Service → Settings → Build
   - Verify Dockerfile Path: `apps/api/Dockerfile.worker`
   - Verify Start Command is empty (uses Dockerfile CMD)
   - If using custom start command, ensure it's: `node dist/worker.main.js`

5. **Force Redeploy**:
   - Use `DEPLOY_TRIGGER.txt` method above
   - Or manually trigger in Railway dashboard (for each service)

### Wrong Commit Deployed

1. **Check Railway Logs**:
   - **API**: Look for `📦 Deployed commit: <hash>`
   - **Worker**: Look for `[worker] commit=<hash>`
   - Compare with `git log origin/main`

2. **Verify Branch**:
   - Railway → Settings → Source (for each service)
   - Ensure branch is `main`

3. **Clear Cache**:
   - Railway may cache Docker layers
   - Force rebuild by updating `DEPLOY_TRIGGER.txt`
   - Or manually trigger redeploy in Railway dashboard

### Worker Connecting to Localhost Redis

1. **Check Worker Logs**:
   - Look for `[redis][worker] Redis host: ...`
   - Should show `redis.railway.internal:6379` (NOT `127.0.0.1` or `localhost`)

2. **Verify REDIS_URL**:
   - Railway → Worker Service → Variables
   - Ensure `REDIS_URL` is set to Railway Redis URL
   - Should be: `redis://default:password@redis.railway.internal:6379` (or similar)

3. **Check Code**:
   - Worker logs should show `[worker] commit=<hash>` matching latest commit
   - If commit is old, worker is running old code → redeploy

4. **Verify Dockerfile**:
   - Ensure Railway Worker uses `apps/api/Dockerfile.worker`
   - NOT `apps/api/Dockerfile` (that's for API)

### Build Fails

Common issues:

1. **Prisma Client Not Generated**:
   - Dockerfile should run `pnpm prisma generate`
   - Check build logs for Prisma errors

2. **Missing Dependencies**:
   - Ensure `pnpm-lock.yaml` is up to date
   - Run `pnpm install` locally to verify

3. **TypeScript Errors**:
   - Run `pnpm -C apps/api type-check` locally
   - Fix errors before pushing

## Monitoring

### Health Check

Railway automatically checks `/api/health` every 30 seconds.

### Logs

View logs in Railway dashboard:
- **Real-time**: Railway → Deployments → Latest → Logs
- **Historical**: Railway → Metrics → Logs

### Metrics

Railway provides:
- CPU usage
- Memory usage
- Network traffic
- Request count

## Best Practices

1. **Always test locally** before pushing to `main`
2. **Monitor Railway logs** after deployment
3. **Verify commit hash** matches expected
4. **Check health endpoint** after deploy
5. **Keep `railway.toml` and `Dockerfile`** in sync with build process

## Related Files

- `apps/api/Dockerfile` - Build configuration (API service)
- `apps/api/Dockerfile.worker` - Build configuration (Worker service)
- `railway.toml` - Railway service configuration (API service)
- `apps/api/package.json` - Build scripts
- `package.json` (root) - Monorepo scripts

## Worker Service Setup (Railway Dashboard)

Since Railway doesn't support multi-service configuration in a single `railway.toml`, the worker service must be configured manually:

1. **Go to Railway Dashboard** → Your Project → Worker Service → Settings → Build

2. **Configure Build**:
   - **Dockerfile Path**: `apps/api/Dockerfile.worker`
   - **Build Command**: (leave empty)
   - **Start Command**: (leave empty - uses Dockerfile CMD)

3. **⚠️ CRITICAL: Disable Healthcheck** (Worker Service):
   - Railway → Worker Service → Settings → Deploy
   - **Healthcheck Path**: (leave EMPTY or set to empty string)
   - **Healthcheck Timeout**: (leave empty)
   - **Why**: Worker doesn't have an HTTP server, so healthcheck will always fail
   - **If healthcheck is enabled**: Worker will fail deployment with "Healthcheck failed!" error

4. **Environment Variables** (Worker Service):
   - `WORKER_MODE=1` (required)
   - `JOB_RUNNER_ENABLED=true` (required)
   - `REDIS_URL` (required if using BullMQ) - should be Railway Redis URL
   - `DATABASE_URL` (required)
   - `NODE_ENV=production` (required)
   - All other env vars as needed

5. **Verify Source**:
   - Railway → Worker Service → Settings → Source
   - Repository: `benjhiman/remember_me`
   - Branch: `main`
   - Auto Deploy: Enabled
