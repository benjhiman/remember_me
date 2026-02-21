# Railway No Detecta Commits - Solución Urgente

## Problema
Railway no está detectando nuevos commits automáticamente.

## Solución Paso a Paso

### 1. Verificar que el commit esté en GitHub

```bash
# Verificar último commit local
git log --oneline -1

# Verificar que esté pusheado
git push origin main

# Verificar en GitHub web
# Ve a: https://github.com/benjhiman/remember_me/commits/main
# Confirma que el último commit está ahí
```

### 2. Verificar Conexión GitHub en Railway

1. **Ve a Railway Dashboard**: https://railway.app
2. **Selecciona tu proyecto**: `remember_me`
3. **Ve al servicio Worker**: Click en `remember_me/worker` (o el nombre de tu servicio worker)
4. **Settings → Source**:
   - Verifica que dice: `Connected to GitHub`
   - Repository: `benjhiman/remember_me`
   - Branch: `main`
   - Auto Deploy: `Enabled`

### 3. Si NO está conectado o dice "Disconnected":

1. Click en **"Connect GitHub"** o **"Reconnect"**
2. Autoriza Railway a acceder al repositorio
3. Selecciona: `benjhiman/remember_me`
4. Selecciona branch: `main`
5. Guarda

### 4. Si ESTÁ conectado pero no deploya:

**Opción A: Redeploy Manual**
1. Ve a Railway Dashboard → Worker Service
2. Click en **"Deployments"** (o pestaña "Deploys")
3. Click en **"New Deployment"** o **"Redeploy"**
4. Selecciona el commit más reciente
5. Click en **"Deploy"**

**Opción B: Forzar Webhook**
1. Ve a GitHub: https://github.com/benjhiman/remember_me/settings/hooks
2. Busca el webhook de Railway (debería tener URL como `https://api.railway.app/webhook/...`)
3. Si NO existe, Railway necesita reconectarse (ver paso 3)
4. Si existe, click en "Recent Deliveries" y verifica que el último push esté ahí
5. Si el último push NO está, el webhook está roto → Reconecta Railway

**Opción C: Crear un commit dummy para forzar**
```bash
# Crear un cambio mínimo que fuerce el webhook
echo "# Force deploy $(date)" >> apps/api/FORCE_DEPLOY.txt
git add apps/api/FORCE_DEPLOY.txt
git commit -m "chore: force Railway redeploy"
git push origin main
```

### 5. Verificar Webhook en GitHub (CRÍTICO)

1. Ve a: https://github.com/benjhiman/remember_me/settings/hooks
2. Deberías ver un webhook de Railway
3. Si NO hay webhook → Railway no está conectado correctamente
4. Si hay webhook pero dice "Failed" → Click en "Redeliver" para el último evento

### 6. Verificar Variables de Entorno en Railway

Asegúrate de que el Worker Service tenga:
- `REDIS_URL` configurada (NO localhost)
- `WORKER_MODE=1`
- `JOB_RUNNER_ENABLED=true`
- `NODE_ENV=production`

### 7. Si NADA funciona: Deploy Manual desde Railway CLI

```bash
# Instalar Railway CLI (si no lo tienes)
npm i -g @railway/cli

# Login
railway login

# Link al proyecto
railway link

# Deploy manual
railway up
```

## Checklist de Verificación

- [ ] Commit pusheado a GitHub (verificar en web)
- [ ] Railway conectado a GitHub (Settings → Source)
- [ ] Webhook existe en GitHub (Settings → Hooks)
- [ ] Auto Deploy habilitado en Railway
- [ ] Dockerfile path correcto: `apps/api/Dockerfile.worker`
- [ ] Custom Start Command VACÍO (no debe tener nada)

## Comandos de Emergencia

Si necesitas forzar un deploy AHORA:

```bash
# 1. Verificar último commit
git log --oneline -1

# 2. Forzar push
git push origin main --force-with-lease

# 3. Crear commit dummy si es necesario
echo "$(date)" >> .railway-force-deploy
git add .railway-force-deploy
git commit -m "chore: force Railway deploy $(date +%s)"
git push origin main
```

## Contacto Railway Support

Si nada funciona:
1. Ve a Railway Dashboard → Settings → Support
2. Crea un ticket explicando que los webhooks no están funcionando
3. Incluye:
   - Repository: `benjhiman/remember_me`
   - Service: Worker
   - Último commit que no se deployó
