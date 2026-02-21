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
   - Configures Railway to use `apps/api/Dockerfile`
   - Sets health check to `/api/health`
   - Defines restart policy

2. **`apps/api/Dockerfile`**
   - Multi-stage build for monorepo
   - Builds Prisma client and API
   - Production runtime image

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

### 1. Check Railway Logs

After deployment, check logs for:
```
📦 Deployed commit: <7-char-hash>
🚀 API server running on: http://localhost:4000/api
```

The commit hash should match the latest commit on `main`.

### 2. Check Health Endpoint

```bash
curl -I https://api.iphonealcosto.com/api/health
```

Response should include:
- `HTTP/1.1 200 OK`
- `X-App-Commit: <commit-hash>` (7 characters)

### 3. Verify Commit Hash

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
   - Railway → Settings → Source
   - Verify repo and branch are correct
   - Reconnect if needed

2. **Check Build Logs**:
   - Railway → Deployments → Latest → View Logs
   - Look for build errors

3. **Check Dockerfile**:
   - Ensure `apps/api/Dockerfile` exists
   - Verify `railway.toml` points to correct path

4. **Force Redeploy**:
   - Use `DEPLOY_TRIGGER.txt` method above
   - Or manually trigger in Railway dashboard

### Wrong Commit Deployed

1. **Check Railway Logs**:
   - Look for `📦 Deployed commit: <hash>`
   - Compare with `git log origin/main`

2. **Verify Branch**:
   - Railway → Settings → Source
   - Ensure branch is `main`

3. **Clear Cache**:
   - Railway may cache Docker layers
   - Force rebuild by updating `DEPLOY_TRIGGER.txt`

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

- `apps/api/Dockerfile` - Build configuration
- `railway.toml` - Railway service configuration
- `apps/api/package.json` - Build scripts
- `package.json` (root) - Monorepo scripts
