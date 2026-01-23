# Production Baseline - Safe Point v1

**Fecha de congelación:** Enero 2025  
**Commit:** `3f7dcda`  
**Tag:** `prod-baseline-v1`

---

## 📋 OBJETIVO

Este documento define el "safe point" de producción: un estado conocido y validado que garantiza que lo que funciona hoy NO se rompa en futuros cambios.

**Regla de oro:** Antes de hacer cambios grandes, ejecutar `./scripts/prod-check.sh` y confirmar que todo está verde.

---

## 🏗️ ARQUITECTURA DE SERVICIOS

### Servicios en Producción

1. **API (Backend)**
   - URL: `https://api.iphonealcosto.com`
   - Stack: NestJS + Prisma + PostgreSQL
   - Health: `GET /api/health` y `GET /api/health/extended`

2. **Web (Frontend)**
   - URL: `https://app.iphonealcosto.com`
   - Stack: Next.js 14 (App Router) + React
   - Health: HTTP 200 en `/` o `/login`

3. **Worker (Background Jobs)**
   - Stack: NestJS Worker + BullMQ + Redis
   - Health: Validado mediante métricas/jobs (no tiene endpoint HTTP directo)

4. **Database**
   - PostgreSQL en Railway
   - Validado en `/api/health/extended` (campo `db`)

5. **Redis**
   - Railway Redis
   - Usado para: BullMQ, rate limiting
   - Validado indirectamente (si jobs funcionan, Redis está OK)

---

## ✅ CHECKLIST PRE-MERGE (Antes de mergear a `main`)

### Infraestructura
- [ ] Build de API pasa: `pnpm --filter @remember-me/api build`
- [ ] Build de Web pasa: `pnpm --filter @remember-me/web build`
- [ ] No hay errores de TypeScript: `pnpm type-check`
- [ ] No hay errores de linting críticos: `pnpm lint`

### Endpoints de Salud
- [ ] `GET /api/health` responde `200` con `{ status: "ok", timestamp: "..." }`
- [ ] `GET /api/health/extended` responde `200` con:
  - `status: "ok"`
  - `db: "ok"` (no "error")
  - `uptime: number`
  - `version: string`
  - `env: "production"` (en prod)

### Base de Datos
- [ ] Prisma migrations aplicadas: `pnpm --filter @remember-me/prisma db:migrate deploy`
- [ ] Schema sincronizado: `pnpm --filter @remember-me/prisma db:push` (dev) o migrations (prod)
- [ ] No hay errores de conexión en logs

### Autenticación
- [ ] Login funciona: `POST /api/auth/login` con credenciales válidas
- [ ] Refresh token funciona: `POST /api/auth/refresh`
- [ ] JWT validation funciona: Request autenticada devuelve datos correctos

### Multi-Org
- [ ] Filtrado por `organizationId` funciona en queries principales
- [ ] `X-Organization-Id` header se respeta
- [ ] Usuarios no pueden acceder a datos de otras orgs

### Frontend
- [ ] Build de Next.js pasa sin errores SSR
- [ ] Login page carga (HTTP 200)
- [ ] RouteGuard funciona (redirige a `/login` si no autenticado)
- [ ] No hay errores de `window`/`document` en SSR

---

## ✅ CHECKLIST POST-DEPLOY (Después de deploy a producción)

### Verificación Inmediata (0-5 minutos)
- [ ] API health: `curl https://api.iphonealcosto.com/api/health` → `200 OK`
- [ ] API extended: `curl https://api.iphonealcosto.com/api/health/extended` → `db: "ok"`
- [ ] Web carga: `curl https://app.iphonealcosto.com` → `200 OK`
- [ ] Login page carga: `curl https://app.iphonealcosto.com/login` → `200 OK`

### Verificación Funcional (5-15 minutos)
- [ ] Login funciona con credenciales reales
- [ ] Dashboard carga (requiere auth)
- [ ] Una operación CRUD básica funciona (ej: listar leads)
- [ ] No hay errores 500 en logs (Railway/Vercel)

### Verificación de Jobs (15-30 minutos)
- [ ] Worker procesa jobs (verificar logs de Railway Worker)
- [ ] No hay jobs fallidos acumulándose
- [ ] Redis está conectado (si jobs funcionan, Redis OK)

### Verificación de Integraciones (30-60 minutos)
- [ ] Webhooks de WhatsApp/Instagram llegan (si aplica)
- [ ] Meta API sync funciona (si aplica)
- [ ] No hay errores de rate limiting excesivos

---

## 🔍 ENDPOINTS DE SALUD

### 1. API Health (Básico)

**Endpoint:** `GET /api/health`  
**Auth:** No requerida (`@Public()`)  
**Response esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-23T00:00:00.000Z"
}
```

**Criterio de éxito:**
- HTTP Status: `200`
- `status === "ok"`
- `timestamp` es ISO string válido

**Criterio de fallo:**
- HTTP Status: `!= 200`
- `status !== "ok"`
- Timeout (> 10 segundos)

---

### 2. API Health Extended

**Endpoint:** `GET /api/health/extended`  
**Auth:** No requerida (`@Public()`)  
**Response esperada:**
```json
{
  "status": "ok",
  "db": "ok",
  "uptime": 3600,
  "version": "1.0.0",
  "env": "production"
}
```

**Criterio de éxito:**
- HTTP Status: `200`
- `status === "ok"`
- `db === "ok"` (no "error")
- `uptime` es número positivo
- `version` es string no vacío
- `env` es "production" (en prod)

**Criterio de fallo:**
- HTTP Status: `!= 200`
- `status !== "ok"`
- `db === "error"` (DB no conectada)
- Timeout (> 10 segundos)

---

### 3. Web Health (Frontend)

**Endpoint:** `GET /` o `GET /login`  
**Auth:** No requerida  
**Response esperada:**
- HTTP Status: `200`
- HTML válido (no error page)
- No redirects inesperados

**Criterio de éxito:**
- HTTP Status: `200`
- Response contiene HTML
- No hay errores 500/502/503

**Criterio de fallo:**
- HTTP Status: `!= 200`
- Response es error page
- Timeout (> 10 segundos)

---

### 4. Worker Health (Indirecto)

**Validación:**
- Worker no tiene endpoint HTTP directo
- Se valida mediante:
  - Logs de Railway Worker (debe estar corriendo)
  - Jobs procesándose (verificar BullMQ dashboard si existe)
  - No hay errores acumulados en logs

**Criterio de éxito:**
- Worker está corriendo (logs activos)
- Jobs se procesan (no hay queue acumulándose)
- No hay errores críticos en logs

**Criterio de fallo:**
- Worker no está corriendo
- Jobs fallan repetidamente
- Queue acumulándose sin procesar

---

## 🚨 QUÉ SIGNIFICA "PROD ESTÁ SANA"

### Estado: ✅ HEALTHY

**Condiciones:**
1. `GET /api/health` → `200 OK`
2. `GET /api/health/extended` → `db: "ok"`
3. Web carga → `200 OK`
4. Login funciona con credenciales válidas
5. Una operación CRUD básica funciona
6. No hay errores 500 en logs (últimos 15 minutos)
7. Worker está corriendo (logs activos)

**Acción:** ✅ Todo OK, se puede proceder con cambios.

---

### Estado: ⚠️ DEGRADED

**Condiciones:**
- Health endpoints responden, pero:
  - Alguna integración externa falla (Meta API, WhatsApp, etc.)
  - Jobs se procesan lentamente
  - Rate limiting activo pero no crítico

**Acción:** ⚠️ Investigar, pero no crítico. Puede continuar con cambios no relacionados.

---

### Estado: ❌ UNHEALTHY

**Condiciones:**
1. `GET /api/health` → `!= 200` o timeout
2. `GET /api/health/extended` → `db: "error"`
3. Web no carga → `!= 200` o timeout
4. Login falla con credenciales válidas
5. Errores 500 repetidos en logs
6. Worker no está corriendo

**Acción:** 🚨 **STOP**. No hacer cambios. Investigar y resolver primero.

---

## 📝 SCRIPT DE VERIFICACIÓN

**Script:** `./scripts/prod-check.sh`

**Uso:**
```bash
# Verificar producción
./scripts/prod-check.sh https://api.iphonealcosto.com https://app.iphonealcosto.com

# Con token de smoke test (opcional)
SMOKE_TOKEN=xxx ./scripts/prod-check.sh https://api.iphonealcosto.com https://app.iphonealcosto.com
```

**Qué valida:**
1. API `/api/health` → `200 OK`
2. API `/api/health/extended` → `db: "ok"`
3. Web carga → `200 OK`
4. (Opcional) Request autenticada → `200 OK`

**Exit code:**
- `0` = Todo OK
- `!= 0` = Algo falló

---

## 🔄 INTEGRACIÓN CI (Opcional)

**Estado:** Preparado pero no activo por defecto.

**Activar cuando:**
- Queramos validar producción en cada PR
- Tengamos credenciales de smoke test seguras
- Tengamos infraestructura CI estable

**Ejemplo (GitHub Actions):**
```yaml
# .github/workflows/prod-baseline.yml
name: Production Baseline Check
on:
  workflow_dispatch:  # Manual trigger
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check Production
        run: |
          chmod +x ./scripts/prod-check.sh
          ./scripts/prod-check.sh \
            https://api.iphonealcosto.com \
            https://app.iphonealcosto.com
        env:
          SMOKE_TOKEN: ${{ secrets.SMOKE_TOKEN }}
```

---

## 📌 BASELINE CONGELADO

**Tag:** `prod-baseline-v1`  
**Commit:** `3f7dcda`  
**Fecha:** Enero 2025

**Qué significa:**
- Este commit representa un estado conocido y funcional
- Si algo se rompe, podemos volver a este punto
- Todos los checks de este documento pasan en este commit

**Cómo usar:**
```bash
# Ver baseline
git show prod-baseline-v1

# Volver a baseline (si es necesario)
git checkout prod-baseline-v1

# Ver qué cambió desde baseline
git log prod-baseline-v1..main
```

---

## 🎯 REGLAS DE USO

1. **Antes de cambios grandes:** Ejecutar `./scripts/prod-check.sh` y confirmar verde
2. **Después de deploy:** Ejecutar checklist post-deploy
3. **Si algo falla:** Revisar este documento y validar cada punto
4. **Si prod está unhealthy:** STOP, no hacer cambios hasta resolver

---

## 📚 REFERENCIAS

- Script de verificación: `./scripts/prod-check.sh`
- Smoke tests existentes: `./scripts/prod-smoke.ts`
- Health endpoints: `apps/api/src/app.controller.ts`
- Observabilidad: `apps/api/src/OBSERVABILITY.md`

---

**Última actualización:** Enero 2025  
**Mantenido por:** Tech Lead
