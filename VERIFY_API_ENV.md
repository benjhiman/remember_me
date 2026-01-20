# Verificación Rápida - API Environment Variables

## Comandos de Prueba (Ejecutar en Orden)

### 1. Levantar API desde raíz del monorepo

```bash
cd /Users/benjamingroisman/Desktop/remember_me
pnpm --filter @remember-me/api dev
```

**✅ Esperado en logs:**
```
✅ Environment variables loaded successfully
🚀 API server running on: http://localhost:4000/api
```

**❌ Si ves:**
```
⚠️  WARNING: JWT_SECRET missing: env not loaded correctly
```
→ El `.env` no se cargó. Verificar que `apps/api/.env` existe.

---

### 2. Verificar endpoint de diagnóstico (público)

```bash
curl http://localhost:4000/api/debug/config | jq '.'
```

**✅ Esperado:**
```json
{
  "ok": true,
  "envLoaded": true,
  "nodeEnv": "development",
  "hasJwtSecret": true,
  "hasJwtRefreshSecret": true,
  "jwtSecretLength": 45,
  "jwtRefreshSecretLength": 45,
  "timestamp": "2024-01-19T..."
}
```

**❌ Si `hasJwtSecret: false` → El .env no se cargó correctamente**

---

### 3. Probar endpoint protegido con token

```bash
# Login (crear usuario si no existe)
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }' | jq -r '.accessToken')

# Si el usuario no existe, registrarlo primero:
# curl -X POST http://localhost:4000/api/auth/register \
#   -H "Content-Type: application/json" \
#   -d '{"email":"test@example.com","password":"TestPassword123!","name":"Test"}'

# Probar endpoint protegido
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/test-org
```

**✅ Esperado:**
```json
{
  "message": "Current organization endpoint test",
  "organizationId": "...",
  "timestamp": "..."
}
```

**❌ Si retorna 401 → JWT_SECRET no está configurado o token inválido**

---

## Script Automatizado

```bash
./scripts/test-api-env.sh http://localhost:4000/api
```

Este script ejecuta todos los tests arriba y valida que todo funcione.

---

## Troubleshooting Rápido

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `hasJwtSecret: false` | `.env` no cargado | Verificar que `apps/api/.env` existe |
| Log muestra "JWT_SECRET missing" | Path incorrecto | El fix debería resolverlo automáticamente |
| 401 en endpoints protegidos | JWT_SECRET undefined | Verificar `/api/debug/config` muestra `hasJwtSecret: true` |
| Token inválido | JWT_SECRET diferente | Usar mismo JWT_SECRET para generar y validar |

---

## Archivos Modificados

1. ✅ `apps/api/src/app.module.ts` - Agregado `envFilePath` con path.resolve
2. ✅ `apps/api/src/main.ts` - Agregada verificación de JWT_SECRET
3. ✅ `apps/api/src/app.controller.ts` - Agregado endpoint `/api/debug/config`

**Build:** ✅ Compila sin errores
**Linting:** ✅ Sin errores
