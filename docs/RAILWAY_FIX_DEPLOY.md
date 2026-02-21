# Railway: Fix Deployment Issues - Guía Urgente

## Problema Actual
Railway NO está deployando el commit nuevo (`e106f84`). El worker sigue corriendo código viejo.

## Solución Paso a Paso

### PASO 1: Verificar Conexión del Repositorio

1. Ve a **Railway Dashboard** → Tu Proyecto → **Settings** → **Source**
2. Verifica:
   - ✅ **Repository**: `benjhiman/remember_me`
   - ✅ **Branch**: `main`
   - ✅ **Auto Deploy**: **ENABLED** (debe estar activado)
   - ✅ **Root Directory**: Debe estar **VACÍO** (no poner `/apps/api`)

### PASO 2: Verificar Servicios Configurados

En Railway Dashboard, verifica que tienes **2 servicios**:

#### Servicio 1: API (remember_me/api o similar)
- **Settings** → **Build**:
  - ✅ **Dockerfile Path**: `apps/api/Dockerfile`
  - ✅ **Build Command**: (vacío, usa Dockerfile)
  - ✅ **Start Command**: (vacío, usa Dockerfile CMD)

#### Servicio 2: Worker (remember_me/worker)
- **Settings** → **Build**:
  - ✅ **Dockerfile Path**: `apps/api/Dockerfile.worker` ⚠️ **CRÍTICO**
  - ✅ **Build Command**: (vacío, usa Dockerfile)
  - ✅ **Start Command**: (vacío, usa Dockerfile CMD)

### PASO 3: Forzar Redeploy Manual

Si Railway no detecta el nuevo commit:

1. Ve a **Railway Dashboard** → Tu Proyecto
2. Para **cada servicio** (API y Worker):
   - Click en el servicio
   - Click en **"Deployments"** (o "Deploys")
   - Click en **"Redeploy"** o **"Deploy Latest"**
   - Selecciona **"Deploy from GitHub"** → Branch `main` → Commit `e106f84`

### PASO 4: Verificar Variables de Entorno

Para el servicio **Worker**, verifica estas variables:

1. Ve a **Worker Service** → **Variables**
2. Verifica que existe:
   - ✅ `REDIS_URL` = `redis://default:<password>@redis.railway.internal:6379`
   - ✅ `NODE_ENV` = `production`
   - ✅ `WORKER_MODE` = `1`
   - ✅ `JOB_RUNNER_ENABLED` = `true`
   - ✅ `QUEUE_MODE` = `bullmq` (si usas BullMQ)

⚠️ **CRÍTICO**: `REDIS_URL` NO debe contener `localhost` o `127.0.0.1`

### PASO 5: Verificar Build Logs

Después del redeploy, revisa los **Build Logs**:

1. Ve a **Worker Service** → **Deployments** → Último deployment → **Build Logs**
2. Busca:
   ```
   commit=e106f84
   buildTime=2026-02-21T...
   ```
3. Si ves un commit viejo, Railway está usando cache. Solución:
   - **Settings** → **Build** → **Clear Build Cache** (si existe)
   - O redeploy manual desde GitHub

### PASO 6: Verificar Deploy Logs (Runtime)

Después del deploy, revisa los **Deploy Logs** del Worker:

1. Ve a **Worker Service** → **Deploy Logs**
2. Busca estas líneas al inicio:
   ```
   [worker] Deployment diagnostics:
   [worker] commit=e106f84
   [worker] buildTime=2026-02-21T02:20:49Z
   [worker] cwd=/app/apps/api
   [worker] entry=/app/apps/api/dist/worker.main.js
   [redis][worker] mode=enabled urlPresent=true host=redis.railway.internal:6379
   ```

✅ **Si ves `commit=e106f84`**: El código nuevo está corriendo
❌ **Si ves un commit viejo**: Railway no deployó el código nuevo

### PASO 7: Si Railway Sigue Sin Deployar

#### Opción A: Desconectar y Reconectar GitHub
1. **Settings** → **Source** → **Disconnect**
2. **Connect GitHub** → Selecciona `benjhiman/remember_me`
3. Selecciona branch `main`
4. Enable **Auto Deploy**

#### Opción B: Crear Deploy Manual desde CLI
```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link proyecto
railway link

# Deploy manual
railway up
```

#### Opción C: Trigger Deploy vía Webhook
1. Ve a **Settings** → **Source** → **Webhooks**
2. Copia el webhook URL
3. Ve a GitHub → **Settings** → **Webhooks** → **Add webhook**
4. Pega el URL de Railway
5. Selecciona evento: **Just the push event**
6. Push un commit dummy para trigger:
   ```bash
   git commit --allow-empty -m "trigger railway deploy"
   git push origin main
   ```

### PASO 8: Verificar que Worker NO Intenta Conectar a Localhost

En los **Deploy Logs** del Worker, NO debe aparecer:
- ❌ `ECONNREFUSED 127.0.0.1:6379`
- ❌ `Error: connect ECONNREFUSED 127.0.0.1:6379`

Si aparece, significa:
1. Railway está corriendo código viejo (commit anterior a `e106f84`)
2. O `REDIS_URL` está mal configurado en Railway

### Checklist Final

- [ ] Railway está conectado a `benjhiman/remember_me` (branch `main`)
- [ ] Auto Deploy está **ENABLED**
- [ ] Worker service tiene Dockerfile Path: `apps/api/Dockerfile.worker`
- [ ] Worker service tiene `REDIS_URL` configurado (NO localhost)
- [ ] Build Logs muestran commit `e106f84`
- [ ] Deploy Logs muestran `[worker] commit=e106f84`
- [ ] NO aparece `ECONNREFUSED 127.0.0.1:6379` en logs

## Comandos Útiles

### Ver último commit en GitHub
```bash
git log --oneline -1
# Debe mostrar: e106f84 fix(worker): add aggressive localhost detection...
```

### Verificar que Railway puede acceder al repo
```bash
# En Railway Dashboard → Settings → Source
# Debe mostrar: benjhiman/remember_me (main)
```

### Forzar redeploy desde Railway Dashboard
1. Worker Service → Deployments → "..." → Redeploy
2. Selecciona: "Deploy from GitHub" → Branch: `main` → Commit: `e106f84`

## Contacto de Soporte

Si después de seguir estos pasos Railway sigue sin deployar:
1. Toma screenshots de:
   - Railway Dashboard → Settings → Source
   - Worker Service → Settings → Build
   - Worker Service → Variables (ocultar valores sensibles)
   - Build Logs del último deployment
   - Deploy Logs del worker
2. Contacta Railway Support con estos screenshots
