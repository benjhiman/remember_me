# 🚨 URGENTE: Deshabilitar Healthcheck en Railway Worker

## El Problema

El worker está fallando con:
```
Healthcheck failed!
1/1 replicas never became healthy!
```

**Razón**: Railway está intentando hacer healthcheck en `/api/health`, pero el worker **NO tiene servidor HTTP**.

## Solución: 3 Pasos Simples

### Paso 1: Ir a Settings del Worker

1. Abre Railway Dashboard
2. Selecciona tu proyecto
3. Haz clic en el servicio **`remember_me/worker`** (o el nombre de tu worker)
4. Haz clic en la pestaña **"Settings"** (Configuración)

### Paso 2: Ir a Sección Deploy

1. En Settings, busca la sección **"Deploy"**
2. Haz clic en **"Deploy"** para expandirla

### Paso 3: Limpiar Healthcheck Path

1. Busca el campo **"Healthcheck Path"**
2. **BORRA TODO** el contenido del campo (debe quedar completamente vacío)
3. Si hay un campo **"Healthcheck Timeout"**, también déjalo vacío
4. Haz clic en **"Save"** o **"Update"** (guardar)

### Paso 4: Redeploy

1. Ve a la pestaña **"Deployments"**
2. Haz clic en **"Redeploy"** en el último deployment
3. O espera a que Railway detecte el cambio automáticamente

## Verificación

Después del redeploy, verifica los logs del worker. Deberías ver:

```
[worker] Deployment diagnostics:
[worker] commit=<hash>
[worker] buildTime=<timestamp>
[worker] cwd=/app/apps/api
[worker] entry=/app/apps/api/dist/worker.main.js
[redis][worker] mode=enabled urlPresent=true host=redis.railway.internal:6379
```

**Si ves estos logs, el worker está funcionando correctamente ✅**

## ¿Por qué pasa esto?

- **API Service**: Tiene servidor HTTP → necesita healthcheck → `/api/health` funciona ✅
- **Worker Service**: NO tiene servidor HTTP → healthcheck falla → debe deshabilitarse ✅

## Nota Adicional

Si no puedes encontrar el campo "Healthcheck Path" en Railway:
- Puede estar en una sección diferente (busca en todas las secciones de Settings)
- Puede requerir permisos de administrador
- Contacta a Railway support si no encuentras la opción

## Screenshot de Referencia

La configuración debería verse así:
```
Settings → Deploy
├── Healthcheck Path: [vacío] ← DEBE ESTAR VACÍO
├── Healthcheck Timeout: [vacío] ← DEBE ESTAR VACÍO
└── ...
```
