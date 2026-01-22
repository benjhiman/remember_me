# Fixes de Producción - Web App

## Resumen de Cambios

Este documento describe los cambios realizados para hacer la web app 100% funcional en producción (Vercel) contra la API (Railway).

### Root Causes Identificados

1. **"Failed to fetch" y deslogueos random:**
   - Falta de timeout en requests
   - Manejo inadecuado de errores de red (CORS, DNS, timeout)
   - Refresh token no se reintentaba correctamente
   - No se diferenciaban tipos de errores

2. **Routing /inbox:**
   - `/inbox` redirigía automáticamente a `/inbox/whatsapp` sin opción
   - No había forma de volver o cambiar de canal desde `/inbox/whatsapp`

3. **Persistencia de sesión:**
   - No se manejaba `redirectTo` en login
   - Errores de auth no redirigían correctamente

## Cambios Implementados

### A) Auth Robusta

**1. Nuevo AuthClient (`apps/web/lib/api/auth-client.ts`):**
- ✅ Timeout configurable (30s)
- ✅ Diferenciación de tipos de error (CORS, DNS, Network, Timeout, Auth, Server)
- ✅ Refresh token automático con reintento único
- ✅ Request ID tracking
- ✅ Credentials support (`credentials: 'include'`)
- ✅ Manejo robusto de errores con mensajes claros

**2. Login mejorado:**
- ✅ Maneja `redirectTo` query param
- ✅ Redirige a la ruta original después de login

**3. Persistencia de sesión:**
- ✅ Tokens guardados en Zustand con persist
- ✅ Refresh automático en 401
- ✅ Limpieza de sesión y redirect a login con `redirectTo`

### B) Routing / Navigation

**1. Página `/inbox` (`apps/web/app/inbox/page.tsx`):**
- ✅ Selector de canal (WhatsApp, Instagram, Unified)
- ✅ NO auto-redirige
- ✅ UI clara con cards para cada canal

**2. Componente `InboxHeader` (`apps/web/components/inbox/inbox-header.tsx`):**
- ✅ Botón "Volver a Inbox"
- ✅ Selector de canal (dropdown)
- ✅ Preserva query params al cambiar de canal

**3. Página `/inbox/whatsapp`:**
- ✅ Header con botón Back y selector de canal
- ✅ Navegación mejorada

### C) Manejo de Errores

**1. Componente `ErrorBoundary` (`apps/web/components/error-boundary.tsx`):**
- ✅ Captura errores de React
- ✅ UI amigable con opciones de reintentar o ir a login
- ✅ Muestra Request ID si está disponible

**2. Componente `ApiErrorBanner` (`apps/web/components/api-error-banner.tsx`):**
- ✅ Banner para errores de API
- ✅ Mensajes específicos por tipo de error
- ✅ Dismissible

### D) Seguridad / Hardening

**1. Dev Login:**
- ✅ Ya protegido por ENV vars (`DEV_QUICK_LOGIN_ENABLED`)
- ✅ Route handler retorna 404 si no está habilitado
- ✅ Página verifica `NODE_ENV` y `NEXT_PUBLIC_DEV_QUICK_LOGIN_ENABLED`

## Variables de Entorno Requeridas

### Vercel (Frontend)

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.iphonealcosto.com/api
```

**Opcional (solo para dev):**
```bash
DEV_QUICK_LOGIN_ENABLED=true  # Solo en desarrollo
DEV_QUICK_LOGIN_KEY=tu_key_segura
```

### Railway (Backend)

```bash
CORS_ORIGINS=https://app.iphonealcosto.com
FRONTEND_URL=https://app.iphonealcosto.com
```

**Verificar que también estén configuradas:**
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DATABASE_URL`
- Etc.

## Verificación Post-Deploy

### Checklist de Smoke Test

1. **Login:**
   - [ ] Login funciona correctamente
   - [ ] No aparece "Failed to fetch"
   - [ ] Redirige a `/inbox` después de login
   - [ ] Si hay `redirectTo`, redirige a esa ruta

2. **Navegación:**
   - [ ] Sidebar funciona correctamente
   - [ ] Se puede navegar a `/inbox`, `/leads`, `/sales`, etc. sin logout
   - [ ] Breadcrumbs se muestran correctamente

3. **Inbox:**
   - [ ] `/inbox` muestra selector de canal (no auto-redirige)
   - [ ] `/inbox/whatsapp` tiene botón "Volver a Inbox"
   - [ ] Selector de canal funciona en `/inbox/whatsapp`
   - [ ] Se puede cambiar entre canales sin problemas

4. **Persistencia de Sesión:**
   - [ ] Al refrescar página en `/inbox/whatsapp`, mantiene sesión
   - [ ] Al abrir `/leads` directo (deep link), funciona sin logout
   - [ ] Si el token expira, hace refresh automático

5. **Manejo de Errores:**
   - [ ] Si API cae, muestra UI de error amigable (no crashea)
   - [ ] Errores muestran mensajes claros
   - [ ] Request ID se muestra cuando está disponible

6. **Dev Login (solo en dev):**
   - [ ] `/dev/login` solo funciona si `DEV_QUICK_LOGIN_ENABLED=true`
   - [ ] En producción, retorna 404

## Comandos de Build

```bash
# Verificar que compile
pnpm --filter @remember-me/web build

# Verificar tipos
pnpm --filter @remember-me/web type-check
```

## Troubleshooting

### "Failed to fetch" persiste

1. Verificar `NEXT_PUBLIC_API_BASE_URL` en Vercel
2. Verificar CORS en Railway (`CORS_ORIGINS`)
3. Verificar que la API esté accesible desde Vercel
4. Revisar logs de Vercel y Railway

### Deslogueos random

1. Verificar que `JWT_SECRET` y `JWT_REFRESH_SECRET` estén configurados
2. Verificar tiempos de expiración de tokens
3. Revisar logs del AuthClient (en consola del navegador)

### `/inbox` sigue redirigiendo

1. Verificar que `apps/web/app/inbox/page.tsx` existe y no tiene redirect
2. Limpiar cache de Next.js: `.next` folder
3. Redeploy en Vercel

### CORS errors

1. Verificar `CORS_ORIGINS` en Railway incluye `https://app.iphonealcosto.com`
2. Verificar que `credentials: 'include'` esté en las requests (ya implementado)
3. Verificar headers de respuesta del backend

## Archivos Modificados

- `apps/web/lib/api/auth-client.ts` (nuevo)
- `apps/web/lib/api/client.ts` (modificado - ahora re-exporta)
- `apps/web/app/inbox/page.tsx` (nuevo - selector de canal)
- `apps/web/app/inbox/whatsapp/page.tsx` (modificado - header con back)
- `apps/web/app/(auth)/login/page.tsx` (modificado - redirectTo)
- `apps/web/app/dev/login/page.tsx` (modificado - verificación de ENV)
- `apps/web/components/inbox/inbox-header.tsx` (nuevo)
- `apps/web/components/error-boundary.tsx` (nuevo)
- `apps/web/components/api-error-banner.tsx` (nuevo)

## Próximos Pasos (Opcional)

1. Agregar tests E2E con Playwright/Cypress
2. Implementar retry automático para errores de red
3. Agregar métricas de errores (Sentry, etc.)
4. Implementar offline detection
5. Agregar loading states más granulares
