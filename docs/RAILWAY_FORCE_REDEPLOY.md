# Railway: Forzar Redeploy del Commit Nuevo

## Problema
Railway solo muestra "Redeploy" sin opciones para seleccionar commit o limpiar cache.

## Soluciones (en orden de prioridad)

### SOLUCIÓN 1: Verificar que Railway Detecta el Commit Nuevo

1. Ve a **Railway Dashboard** → **remember_me/worker** → **Deployments**
2. Revisa la lista de deployments
3. Busca si aparece el commit `d7e1232` en la lista
   - Si **SÍ aparece**: Railway lo detectó, solo haz click en ese deployment y selecciona "Redeploy"
   - Si **NO aparece**: Railway no está detectando los nuevos commits (ve a Solución 2)

### SOLUCIÓN 2: Desconectar y Reconectar GitHub (Forzar Detección)

1. Ve a **Settings** → **Source**
2. Click en **"Disconnect"** (botón rojo)
3. Espera 5 segundos
4. Click en **"Connect GitHub Repo"**
5. Selecciona: `benjhiman/remember_me`
6. Selecciona branch: `main`
7. Enable **"Auto Deploy"**
8. Click **"Connect"**

Esto debería:
- Forzar a Railway a escanear todos los commits recientes
- Crear deployments para cada commit nuevo detectado

### SOLUCIÓN 3: Trigger Deploy con Commit Dummy

Si Railway no detecta los commits automáticamente, fuerza un trigger:

```bash
# En tu terminal local
git commit --allow-empty -m "trigger: force railway redeploy"
git push origin main
```

Esto:
- Crea un commit vacío (no cambia código)
- Trigger el webhook de Railway
- Fuerza a Railway a detectar y deployar

### SOLUCIÓN 4: Verificar Webhook de GitHub

1. Ve a **GitHub** → `benjhiman/remember_me` → **Settings** → **Webhooks**
2. Busca un webhook de Railway (debería tener URL de `railway.app`)
3. Verifica:
   - ✅ Estado: **Active** (verde)
   - ✅ Eventos: **Just the push event** o **Push**
   - ✅ Última entrega: Debería mostrar un delivery reciente

Si el webhook no existe o está inactivo:
- Railway no está recibiendo notificaciones de GitHub
- Ve a Railway → Settings → Source → Reconnect GitHub

### SOLUCIÓN 5: Usar Railway CLI (Si Tienes Acceso)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link al proyecto
railway link

# Ver deployments disponibles
railway status

# Deploy desde commit específico
railway up --detach
```

### SOLUCIÓN 6: Verificar Build Settings (Cache)

Si Railway está usando cache viejo:

1. Ve a **Settings** → **Build**
2. Busca opciones de cache (puede estar en "Advanced" o "Build Options")
3. Si hay opción "Clear cache" o "Disable cache", actívala
4. Guarda y haz redeploy

### SOLUCIÓN 7: Crear Nuevo Deployment Manualmente

1. Ve a **Deployments** tab
2. Busca el botón **"New Deployment"** o **"Deploy"** (arriba a la derecha)
3. Si existe, click ahí
4. Debería darte opciones para:
   - Seleccionar branch
   - Seleccionar commit
   - Limpiar cache

## Verificación Post-Redeploy

Después de cualquier solución, verifica:

1. **Build Logs**: Debería mostrar:
   ```
   commit=d7e1232
   buildTime=2026-02-21T...
   ```

2. **Deploy Logs**: Debería mostrar:
   ```
   [worker] commit=d7e1232
   [worker] buildTime=2026-02-21T02:20:49Z
   ```

3. **NO debe aparecer**: `ECONNREFUSED 127.0.0.1:6379`

## Si Nada Funciona

1. Toma screenshots de:
   - Railway → Deployments (mostrando la lista completa)
   - Railway → Settings → Source
   - GitHub → Settings → Webhooks (mostrando webhook de Railway)
   - Railway → Build Logs (del último deployment)
   - Railway → Deploy Logs (del worker)

2. Contacta Railway Support con:
   - Descripción: "Worker service not deploying latest commit, stuck on old commit"
   - Screenshots adjuntos
   - Último commit esperado: `d7e1232`
   - Commit que está corriendo: (el que ves en logs)
