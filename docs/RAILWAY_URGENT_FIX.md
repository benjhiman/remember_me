# 🚨 URGENTE: Railway No Deploya Commit Nuevo - Solución Inmediata

## PROBLEMA DETECTADO

En las screenshots veo que el servicio Worker tiene:
- ✅ Dockerfile Path correcto: `apps/api/Dockerfile.worker`
- ❌ **Custom Start Command**: `cd apps/api && pnpm start:worker` ← **ESTE ES EL PROBLEMA**

El Custom Start Command está **sobrescribiendo** el CMD del Dockerfile, lo que hace que Railway:
1. No use el código compilado del Dockerfile
2. Ejecute `pnpm start:worker` que puede estar usando código viejo
3. No respete el build del Dockerfile

## SOLUCIÓN INMEDIATA (5 minutos)

### PASO 1: Eliminar Custom Start Command

1. Ve a **Railway Dashboard** → **remember_me/worker** → **Settings** → **Deploy**
2. Busca la sección **"Custom Start Command"**
3. **BORRA** el contenido: `cd apps/api && pnpm start:worker`
4. **DEJA EL CAMPO VACÍO** (o elimina el campo si es posible)
5. **GUARDA** los cambios

⚠️ **CRÍTICO**: El Dockerfile.worker ya tiene `CMD ["node", "dist/worker.main.js"]` configurado. NO necesitas Custom Start Command.

### PASO 2: Verificar Build Settings

1. Ve a **Settings** → **Build**
2. Verifica:
   - ✅ **Builder**: `Dockerfile`
   - ✅ **Dockerfile Path**: `apps/api/Dockerfile.worker`
   - ✅ **Custom Start Command**: **VACÍO** (o no existe)

### PASO 3: Forzar Redeploy SIN Cache

1. Ve a **Deployments** tab
2. Click en **"..."** (tres puntos) del último deployment
3. Selecciona **"Redeploy"**
4. En el modal, selecciona:
   - **"Deploy from GitHub"**
   - **Branch**: `main`
   - **Commit**: `e765cb9` (o el más reciente)
   - ✅ **Marca la opción "Clear build cache"** si existe

### PASO 4: Verificar Build Logs

Después del redeploy, ve a **Build Logs** y busca:
```
commit=e765cb9
buildTime=2026-02-21T...
```

Si ves un commit viejo, Railway está usando cache. Solución:
- Repite PASO 3 pero asegúrate de limpiar cache
- O espera 2-3 minutos y vuelve a intentar

### PASO 5: Verificar Deploy Logs

Después del deploy, ve a **Deploy Logs** y busca:
```
[worker] Deployment diagnostics:
[worker] commit=e765cb9
[worker] buildTime=2026-02-21T02:20:49Z
[worker] cwd=/app/apps/api
[worker] entry=/app/apps/api/dist/worker.main.js
[redis][worker] mode=enabled urlPresent=true host=redis.railway.internal:6379
```

✅ **Si ves `commit=e765cb9`**: El código nuevo está corriendo
❌ **Si ves un commit viejo**: Railway todavía está usando código viejo

## Por Qué Esto Funciona

El Dockerfile.worker tiene:
```dockerfile
CMD ["node", "dist/worker.main.js"]
```

Este comando:
1. Usa el código **compilado** del build
2. Ejecuta el entrypoint correcto (`worker.main.js`)
3. Respeta todas las validaciones de Redis que agregamos

El Custom Start Command `cd apps/api && pnpm start:worker`:
1. Intenta ejecutar `pnpm start:worker` que puede no existir o usar código sin compilar
2. No respeta el build del Dockerfile
3. Puede estar usando código viejo de node_modules

## Checklist Final

- [ ] Custom Start Command está **VACÍO** (eliminado)
- [ ] Dockerfile Path: `apps/api/Dockerfile.worker`
- [ ] Redeploy forzado desde GitHub (commit `e765cb9`)
- [ ] Build Logs muestran commit `e765cb9`
- [ ] Deploy Logs muestran `[worker] commit=e765cb9`
- [ ] NO aparece `ECONNREFUSED 127.0.0.1:6379`

## Si Sigue Sin Funcionar

1. **Desconecta y reconecta GitHub**:
   - Settings → Source → Disconnect
   - Connect GitHub → `benjhiman/remember_me` → Branch `main`
   - Enable Auto Deploy

2. **Verifica que Railway detecta los nuevos commits**:
   - Ve a Deployments
   - Deberías ver el commit `e765cb9` en la lista
   - Si no aparece, Railway no está detectando los pushes

3. **Contacta Railway Support** con:
   - Screenshot de Build Settings (sin Custom Start Command)
   - Screenshot de Build Logs (mostrando commit)
   - Screenshot de Deploy Logs (mostrando commit)
