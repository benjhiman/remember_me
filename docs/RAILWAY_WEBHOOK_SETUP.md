# Railway Webhook Setup Manual

## Problema
GitHub no tiene webhooks configurados, por lo que Railway no recibe notificaciones cuando haces push a `main`.

## Solución: Configurar Webhook Manualmente

### PASO 1: Obtener URL del Webhook de Railway

Railway genera una URL de webhook cuando conectas un repositorio. Hay dos formas de obtenerla:

#### Opción A: Desde Railway Dashboard (Recomendado)

1. Ve a **Railway Dashboard** → Tu Proyecto → **Settings** → **Source**
2. Si ya está conectado a GitHub:
   - Debería mostrar la URL del webhook
   - O click en **"Edit"** o **"Configure"** para ver la URL
3. Si NO está conectado:
   - Click en **"Connect GitHub Repo"**
   - Selecciona `benjhiman/remember_me`
   - Branch: `main`
   - Enable **"Auto Deploy"**
   - Railway generará automáticamente el webhook

#### Opción B: Desde Railway API (Si tienes acceso CLI)

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link proyecto
railway link

# Ver configuración (puede mostrar webhook URL)
railway status
```

### PASO 2: Crear Webhook en GitHub

Una vez que tengas la URL del webhook de Railway:

1. Ve a **GitHub** → `benjhiman/remember_me` → **Settings** → **Webhooks**
2. Click en **"Add webhook"** (botón verde)
3. Configura el webhook:
   - **Payload URL**: Pega la URL que obtuviste de Railway
     - Formato típico: `https://api.railway.app/v1/webhooks/...` o similar
   - **Content type**: `application/json`
   - **Secret**: (opcional, pero recomendado si Railway lo requiere)
   - **Which events would you like to trigger this webhook?**:
     - Selecciona **"Just the push event"** (recomendado)
     - O **"Let me select individual events"** y marca solo **"Push"**
   - **Active**: ✅ Debe estar marcado
4. Click en **"Add webhook"**

### PASO 3: Verificar que el Webhook Funciona

1. Después de crear el webhook, GitHub mostrará una lista de webhooks
2. Click en el webhook que acabas de crear
3. Scroll hacia abajo hasta **"Recent Deliveries"**
4. Haz un push de prueba:
   ```bash
   git commit --allow-empty -m "test: verify webhook"
   git push origin main
   ```
5. Vuelve a GitHub → Webhooks → Click en tu webhook
6. En **"Recent Deliveries"**, deberías ver:
   - Un delivery reciente con estado **200** (verde) = ✅ Funciona
   - Un delivery con estado **4xx/5xx** (rojo) = ❌ Error, revisa la URL

### PASO 4: Verificar que Railway Detecta el Push

1. Después del push de prueba, ve a **Railway Dashboard**
2. Ve a **remember_me/worker** → **Deployments**
3. Deberías ver un nuevo deployment iniciándose automáticamente
4. Si no aparece, el webhook no está funcionando correctamente

## Si Railway No Proporciona URL de Webhook

Si Railway no te da una URL de webhook explícita, significa que Railway maneja los webhooks internamente cuando conectas GitHub. En este caso:

### Solución Alternativa: Reconectar GitHub en Railway

1. Ve a **Railway Dashboard** → Tu Proyecto → **Settings** → **Source**
2. Si ya está conectado:
   - Click en **"Disconnect"**
   - Espera 10 segundos
3. Click en **"Connect GitHub Repo"**
4. Selecciona: `benjhiman/remember_me`
5. Branch: `main`
6. Enable **"Auto Deploy"**
7. Click **"Connect"**

Esto debería:
- Crear automáticamente el webhook en GitHub
- Configurar Railway para recibir notificaciones
- Habilitar auto-deploy

### Verificar que Railway Creó el Webhook

Después de reconectar:

1. Ve a **GitHub** → `benjhiman/remember_me` → **Settings** → **Webhooks**
2. Deberías ver un webhook nuevo creado por Railway
3. El webhook debería tener:
   - URL: Algo como `https://api.railway.app/...` o similar
   - Estado: **Active** (verde)
   - Eventos: **Push**

## Troubleshooting

### Webhook no aparece en GitHub después de conectar Railway

1. Verifica que tienes permisos de administrador en el repo de GitHub
2. Verifica que Railway tiene acceso a GitHub (puede requerir autorización OAuth)
3. Intenta desconectar y reconectar en Railway

### Webhook existe pero Railway no detecta pushes

1. Verifica que el webhook está **Active** en GitHub
2. Revisa **"Recent Deliveries"** en GitHub:
   - Si hay deliveries con error (4xx/5xx), la URL puede estar mal
   - Si no hay deliveries recientes, el webhook no se está activando
3. Verifica que estás haciendo push a la branch correcta (`main`)
4. Verifica que Railway está configurado para escuchar la branch `main`

### Railway no muestra opción de webhook URL

Railway puede manejar webhooks internamente. En este caso:
- Solo necesitas conectar GitHub en Railway Settings → Source
- Railway creará el webhook automáticamente
- No necesitas crear el webhook manualmente en GitHub

## Checklist Final

- [ ] Railway está conectado a `benjhiman/remember_me` (branch `main`)
- [ ] Auto Deploy está habilitado en Railway
- [ ] Webhook existe en GitHub (creado por Railway o manualmente)
- [ ] Webhook está **Active** en GitHub
- [ ] Webhook tiene evento **Push** configurado
- [ ] Recent Deliveries muestra deliveries recientes con estado 200
- [ ] Railway detecta nuevos commits y crea deployments automáticamente
