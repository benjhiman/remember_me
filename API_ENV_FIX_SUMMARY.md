# ✅ Fix Completo: Carga de Variables de Entorno - API

## Problema Resuelto

El API no cargaba `apps/api/.env` cuando se ejecutaba desde la raíz del monorepo porque `ConfigModule.forRoot()` buscaba el `.env` en el CWD actual.

## ✅ Cambios Aplicados

### 1. `apps/api/src/app.module.ts`
- ✅ Agregado `envFilePath` con path.resolve que busca `apps/api/.env` desde cualquier CWD
- ✅ Busca el proyecto root por `pnpm-workspace.yaml` y resuelve `apps/api/.env`
- ✅ Funciona tanto en desarrollo (desde `apps/api/src`) como en producción (desde `dist/apps/api/src`)

### 2. `apps/api/src/main.ts`
- ✅ Agregada verificación de `JWT_SECRET` al iniciar
- ✅ Log de advertencia si falta `JWT_SECRET`
- ✅ Log de confirmación si está cargado

### 3. `apps/api/src/app.controller.ts`
- ✅ Agregado endpoint público `/api/debug/config` para diagnóstico
- ✅ Retorna estado de carga de variables sin exponer secrets
- ✅ Muestra `hasJwtSecret`, `hasJwtRefreshSecret`, y longitudes

## 📋 Archivos Modificados

1. `apps/api/src/app.module.ts`
2. `apps/api/src/main.ts`
3. `apps/api/src/app.controller.ts`

## ✅ Validación

- ✅ **Build:** Compila sin errores
- ✅ **Linting:** Sin errores
- ✅ **TypeScript:** Sin errores de tipos

## 🧪 Comandos de Prueba

### Comando 1: Levantar API

```bash
cd /Users/benjamingroisman/Desktop/remember_me
pnpm --filter @remember-me/api dev
```

**Esperado:**
```
✅ Environment variables loaded successfully
🚀 API server running on: http://localhost:4000/api
```

### Comando 2: Verificar Config (Público)

```bash
curl http://localhost:4000/api/debug/config | jq '.'
```

**Esperado:**
```json
{
  "ok": true,
  "envLoaded": true,
  "hasJwtSecret": true,
  "hasJwtRefreshSecret": true,
  ...
}
```

### Comando 3: Probar Auth Flow

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!"}' \
  | jq -r '.accessToken')

# Endpoint protegido
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/test-org
```

**Esperado:** JSON con `organizationId` (no 401)

## 🚀 Script de Prueba Automatizado

```bash
./scripts/test-api-env.sh http://localhost:4000/api
```

Ejecuta todos los tests y valida end-to-end.

## 📚 Documentación

- `API_ENV_FIX.md` - Documentación completa del fix
- `VERIFY_API_ENV.md` - Guía rápida de verificación
- `scripts/test-api-env.sh` - Script de prueba automatizado

## ✅ Estado Final

- ✅ Variables de entorno se cargan desde `apps/api/.env` sin importar CWD
- ✅ `JWT_SECRET` está disponible para `JwtStrategy`
- ✅ Endpoints protegidos funcionan con `Authorization: Bearer <token>`
- ✅ `@Public()` sigue bypassing el guard
- ✅ Endpoint de diagnóstico disponible en `/api/debug/config`

**Fix completo y listo para usar** ✅
