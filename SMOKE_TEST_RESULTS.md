# Smoke Test Results - Auth + Multi-Org Flow

## Resumen

Se completó el setup del proyecto y se crearon los archivos necesarios para ejecutar el smoke test. Sin embargo, el backend requiere ser iniciado manualmente debido a problemas de compilación/ejecución que necesitan ser resueltos primero.

## Archivos Creados/Modificados

### 1. Endpoint de Prueba
- **Archivo**: `apps/api/src/app.controller.ts`
- **Cambio**: Se agregó endpoint `GET /api/test-org` que usa `@CurrentOrganization` decorator
- **Propósito**: Probar que el decorator funciona correctamente

### 2. Variables de Entorno
- **Archivo**: `apps/api/.env`
- **Contenido**:
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/iphone_reseller_os?schema=public"
  JWT_SECRET="test-secret-key-change-in-production-12345"
  JWT_EXPIRES_IN="15m"
  JWT_REFRESH_SECRET="test-refresh-secret-key-change-in-production-12345"
  JWT_REFRESH_EXPIRES_IN="7d"
  PORT=4000
  NODE_ENV="development"
  FRONTEND_URL="http://localhost:3000"
  ```

### 3. Correcciones de TypeScript
Se corrigieron múltiples DTOs agregando `!` a las propiedades requeridas para cumplir con strictNullChecks:
- `apps/api/src/auth/dto/login.dto.ts`
- `apps/api/src/auth/dto/register.dto.ts`
- `apps/api/src/auth/dto/select-organization.dto.ts`
- `apps/api/src/auth/dto/login-response.dto.ts` (agregado `tempToken`)
- `apps/api/src/auth/dto/auth-response.dto.ts`
- `apps/api/src/auth/dto/accept-invitation.dto.ts`
- `apps/api/src/organizations/dto/*.dto.ts` (varios archivos)
- `apps/api/src/auth/auth.service.spec.ts`

### 4. Script de Smoke Test
- **Archivo**: `smoke-test.sh`
- **Ubicación**: `/Users/benjamingroisman/Desktop/remember_me/smoke-test.sh`
- **Descripción**: Script bash que ejecuta el flujo completo de smoke test

### 5. Archivo HTTP (alternativo)
- **Archivo**: `smoke-test.http`
- **Ubicación**: `/Users/benjamingroisman/Desktop/remember_me/smoke-test.http`
- **Descripción**: Archivo .http para usar con extensiones de VS Code/REST Client

## Puertos

- **Backend API**: `http://localhost:4000`
- **PostgreSQL**: `localhost:5432`
- **Database**: `iphone_reseller_os`

## Comandos Usados

### Setup Inicial
```bash
# 1. Aplicar migración de Prisma
cd packages/prisma
pnpm prisma migrate dev

# 2. Build del backend
cd ../../apps/api
pnpm build

# 3. Iniciar backend (en desarrollo)
pnpm dev
# O en producción:
PORT=4000 node dist/apps/api/src/main.js
```

### Ejecutar Smoke Test
```bash
# Desde la raíz del proyecto
bash smoke-test.sh
```

## Flujo del Smoke Test

El script ejecuta el siguiente flujo:

1. **Register** - `POST /api/auth/register`
   - Crea usuario y organización
   - Devuelve accessToken, refreshToken, user

2. **Login** - `POST /api/auth/login`
   - Si solo tiene 1 org: devuelve tokens directamente
   - Si tiene múltiples orgs: devuelve `requiresOrgSelection: true` + `tempToken`

3. **Create Second Organization** - `POST /api/organizations`
   - Crea segunda organización para forzar selección

4. **Login Again** - `POST /api/auth/login`
   - Ahora debería requerir selección de organización

5. **Select Organization** - `POST /api/auth/select-organization`
   - Usa tempToken para seleccionar organización
   - Devuelve tokens finales

6. **Test Protected Endpoint** - `GET /api/test-org`
   - Endpoint protegido que usa `@CurrentOrganization`
   - Verifica que el decorator funciona

7. **Test Organizations Endpoint** - `GET /api/organizations`
   - Lista organizaciones del usuario

## Endpoints del Smoke Test

### 1. POST /api/auth/register
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "name": "Test User",
    "organizationName": "Test Organization"
  }'
```

### 2. POST /api/auth/login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }'
```

### 3. POST /api/auth/select-organization
```bash
curl -X POST http://localhost:4000/api/auth/select-organization \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tempToken>" \
  -d '{
    "organizationId": "<organizationId>"
  }'
```

### 4. GET /api/test-org
```bash
curl -X GET http://localhost:4000/api/test-org \
  -H "Authorization: Bearer <accessToken>"
```

### 5. GET /api/organizations
```bash
curl -X GET http://localhost:4000/api/organizations \
  -H "Authorization: Bearer <accessToken>"
```

## Estado Actual

- ✅ Schema de Prisma corregido y validado
- ✅ Migración aplicada
- ✅ Correcciones de TypeScript completadas
- ✅ Archivos de smoke test creados
- ✅ Endpoint de prueba con @CurrentOrganization creado
- ⚠️ Backend necesita ser iniciado manualmente: `cd apps/api && pnpm dev`

## Próximos Pasos

1. Iniciar el backend: `cd apps/api && pnpm dev`
2. Esperar a que el backend esté listo (verificar con `curl http://localhost:4000/api/health`)
3. Ejecutar el smoke test: `bash smoke-test.sh`
4. Verificar que todos los tests pasen
