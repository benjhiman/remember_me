# Production Smoke Tests

Smoke tests para verificar que los servicios críticos están funcionando después de un deploy.

## Requisitos

- Node.js 18+ (para `fetch` nativo)
- TypeScript (opcional, los scripts están en TS pero pueden ejecutarse con `tsx` o compilarse)
- Credenciales de usuario de prueba en producción

## Scripts

### 1. API Smoke Tests (`scripts/prod-smoke.ts`)

Prueba los endpoints críticos de la API con autenticación real.

#### Variables de Entorno

```bash
# Requeridas
export TEST_EMAIL="usuario@example.com"
export TEST_PASSWORD="password123"

# Opcionales (tienen defaults)
export API_BASE_URL="https://api.iphonealcosto.com"
```

#### Endpoints Probados

1. **Health Checks** (públicos):
   - `GET /api/health`
   - `GET /api/health/extended`

2. **Autenticación**:
   - `POST /api/auth/login` con `TEST_EMAIL` y `TEST_PASSWORD`
   - Si el usuario tiene múltiples organizaciones, selecciona automáticamente la primera
   - Maneja `requiresOrgSelection` y `tempToken`

3. **Endpoints Autenticados** (con `accessToken` y `X-Organization-Id`):
   - `GET /api/leads?limit=1`
   - `GET /api/stock?limit=1`
   - `GET /api/sales?limit=1`
   - `GET /api/dashboard/overview?from=...&to=...` (últimos 30 días)

#### Ejecución

```bash
# Con tsx (recomendado)
npx tsx scripts/prod-smoke.ts

# O compilar primero
npx tsc scripts/prod-smoke.ts --outDir dist/scripts --module esnext --target es2022
node dist/scripts/prod-smoke.js
```

#### Output Esperado

```
🚀 Starting Production Smoke Tests

API Base URL: https://api.iphonealcosto.com
Test Email: ***@example.com

================================================================================
RESULTS
================================================================================

✅ GET /api/health [200] - 45ms
✅ GET /api/health/extended [200] - 67ms
✅ POST /api/auth/login [200] - 123ms
✅ GET /api/leads?limit=1 [200] - 89ms
✅ GET /api/stock?limit=1 [200] - 78ms
✅ GET /api/sales?limit=1 [200] - 92ms
✅ GET /api/dashboard/overview?from=...&to=... [200] - 145ms

--------------------------------------------------------------------------------
Total: 7 | Passed: 7 | Failed: 0
--------------------------------------------------------------------------------

✅ All tests passed
```

#### Exit Code

- `0` si todos los tests pasan
- `!= 0` si algún test falla

---

### 2. Web Smoke Tests (`scripts/web-smoke.ts`)

Prueba que el frontend esté accesible y respondiendo.

#### Variables de Entorno

```bash
# Opcional (tiene default)
export WEB_BASE_URL="https://app.iphonealcosto.com"
```

#### Endpoints Probados

1. `GET /` - Página principal
2. `GET /login` - Página de login

#### Ejecución

```bash
# Con tsx (recomendado)
npx tsx scripts/web-smoke.ts

# O compilar primero
npx tsc scripts/web-smoke.ts --outDir dist/scripts --module esnext --target es2022
node dist/scripts/web-smoke.js
```

#### Output Esperado

```
🚀 Starting Web Smoke Tests

Web Base URL: https://app.iphonealcosto.com

================================================================================
RESULTS
================================================================================

✅ GET / [200] - 234ms
✅ GET /login [200] - 198ms

--------------------------------------------------------------------------------
Total: 2 | Passed: 2 | Failed: 0
--------------------------------------------------------------------------------

✅ All tests passed
```

#### Exit Code

- `0` si todos los tests pasan
- `!= 0` si algún test falla

---

## Integración con CI/CD

### GitHub Actions

```yaml
name: Smoke Tests

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  smoke-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g tsx
      - run: npx tsx scripts/prod-smoke.ts
        env:
          API_BASE_URL: ${{ secrets.API_BASE_URL }}
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}

  smoke-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g tsx
      - run: npx tsx scripts/web-smoke.ts
        env:
          WEB_BASE_URL: ${{ secrets.WEB_BASE_URL }}
```

### Railway / Post-Deploy

Agregar como script post-deploy en Railway:

```json
{
  "scripts": {
    "postdeploy": "npx tsx scripts/prod-smoke.ts"
  }
}
```

---

## Troubleshooting

### Error: "TEST_EMAIL and TEST_PASSWORD must be set"

**Solución**: Asegúrate de exportar las variables de entorno antes de ejecutar el script:

```bash
export TEST_EMAIL="usuario@example.com"
export TEST_PASSWORD="password123"
npx tsx scripts/prod-smoke.ts
```

### Error: "Login failed - cannot continue with authenticated tests"

**Posibles causas**:
1. Credenciales incorrectas
2. Usuario no existe en producción
3. Usuario no tiene organizaciones asignadas
4. API no está accesible

**Solución**: Verifica las credenciales y que el usuario exista en producción.

### Error: "fetch failed" o timeout

**Posibles causas**:
1. API no está accesible desde el entorno de ejecución
2. Problemas de red
3. Firewall bloqueando requests

**Solución**: Verifica conectividad y que la API esté accesible públicamente.

### Status Code 401 en endpoints autenticados

**Posibles causas**:
1. Token expirado (poco probable en smoke tests)
2. `X-Organization-Id` header faltante o incorrecto
3. Usuario no tiene permisos en la organización

**Solución**: Verifica que el usuario tenga acceso a la organización seleccionada.

---

## Notas

- Los smoke tests **NO** modifican datos (solo lectura)
- Los tests usan `limit=1` para minimizar carga
- El dashboard usa los últimos 30 días por defecto
- Los scripts son idempotentes y pueden ejecutarse múltiples veces

---

## Mantenimiento

- Actualizar endpoints si se agregan nuevos módulos críticos
- Mantener credenciales de prueba actualizadas
- Revisar timeouts si la API es lenta
