# Railway: Conectar GitHub Correctamente

## ⚠️ IMPORTANTE: Confusión Aclarada

La pantalla de "Webhooks" en Railway es para webhooks **OUTBOUND** (Railway → otros servicios).
Lo que necesitamos es la conexión **GitHub → Railway**, que Railway maneja automáticamente.

## Solución: Conectar GitHub en Railway

### PASO 1: Ir a Source Settings (NO Webhooks)

1. Railway Dashboard → Tu Proyecto
2. Click en **"Settings"** tab (arriba)
3. En el sidebar izquierdo, busca **"Source"** (NO "Webhooks")
4. Click en **"Source"**

### PASO 2: Verificar o Conectar GitHub

En la sección "Source", deberías ver:

**Si YA está conectado:**
- Debería mostrar: `benjhiman/remember_me` con branch `main`
- Debería tener botones "Edit" y "Disconnect"

**Si NO está conectado:**
- Debería mostrar un botón **"Connect GitHub Repo"** o similar
- Click en ese botón

### PASO 3: Conectar el Repositorio

1. Si no está conectado, click en **"Connect GitHub Repo"**
2. Selecciona: `benjhiman/remember_me`
3. Selecciona branch: `main`
4. Enable **"Auto Deploy"** (toggle debe estar ON)
5. Click **"Connect"** o **"Save"**

### PASO 4: Verificar que Railway Creó el Webhook en GitHub

Después de conectar:

1. Ve a **GitHub** → `benjhiman/remember_me` → **Settings** → **Webhooks**
2. Deberías ver un webhook nuevo creado por Railway
3. El webhook debería tener:
   - **URL**: Algo como `https://api.railway.app/...` o `https://webhook.railway.app/...`
   - **Status**: Active (verde)
   - **Events**: Push

### PASO 5: Probar que Funciona

1. Haz un push de prueba:
   ```bash
   git commit --allow-empty -m "test: verify railway connection"
   git push origin main
   ```

2. Ve a **Railway Dashboard** → **remember_me/worker** → **Deployments**
3. Deberías ver un nuevo deployment iniciándose automáticamente
4. Si aparece, la conexión funciona ✅

## Si "Source" No Aparece en Settings

Si no ves "Source" en el sidebar de Settings:

1. Ve a **Railway Dashboard** → Tu Proyecto
2. Click en el servicio **"remember_me/worker"** (no el proyecto)
3. Click en **"Settings"** tab
4. En el sidebar, busca **"Source"**
5. Ahí deberías poder conectar GitHub

## Si Railway No Crea el Webhook Automáticamente

Si después de conectar GitHub en Railway, el webhook NO aparece en GitHub:

1. Verifica que tienes permisos de administrador en el repo de GitHub
2. Verifica que Railway tiene acceso a GitHub (puede requerir autorización OAuth)
3. Intenta desconectar y reconectar en Railway
4. Si persiste, contacta Railway Support

## Diferencia Entre Webhooks

- **Webhooks en Railway Settings**: Son para notificar a otros servicios (Discord, Slack, etc.) cuando Railway hace algo
- **Webhooks en GitHub Settings**: Son para que GitHub notifique a Railway cuando hay pushes
- **Source Connection en Railway**: Railway maneja automáticamente los webhooks de GitHub cuando conectas el repo

## Checklist

- [ ] Railway → Settings → Source muestra `benjhiman/remember_me` (branch `main`)
- [ ] Auto Deploy está habilitado (toggle ON)
- [ ] GitHub → Settings → Webhooks muestra un webhook de Railway
- [ ] Webhook en GitHub está Active (verde)
- [ ] Push a `main` trigger un deployment automático en Railway
