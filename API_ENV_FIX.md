# Fix: Carga de Variables de Entorno - API

## Problema Resuelto

El API no cargaba `apps/api/.env` cuando se ejecutaba desde la raíz del monorepo porque `ConfigModule.forRoot()` buscaba el `.env` en el CWD actual.

## Cambios Aplicados

### 1. `apps/api/src/app.module.ts`

**Cambio:** Agregado `envFilePath` con path.resolve para cargar siempre `apps/api/.env`

```typescript
// Resolve .env path relative to apps/api directory
// Works from any CWD: finds apps/api/.env whether running from root or apps/api
const envFilePath = (() => {
  const apiDir = path.resolve(__dirname, '../..');
  const envFile = path.join(apiDir, '.env');
  return envFile;
})();

ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: envFilePath,
})
```

### 2. `apps/api/src/main.ts`

**Cambio:** Agregada verificación de JWT_SECRET al iniciar

```typescript
// Verify critical environment variables are loaded
const configService = app.get(ConfigService);
const jwtSecret = configService.get<string>('JWT_SECRET');

if (!jwtSecret) {
  console.warn('⚠️  WARNING: JWT_SECRET missing: env not loaded correctly');
  console.warn('   Expected .env file at: apps/api/.env');
  console.warn('   Current working directory:', process.cwd());
} else {
  console.log('✅ Environment variables loaded successfully');
}
```

### 3. `apps/api/src/app.controller.ts`

**Cambio:** Agregado endpoint de diagnóstico público `/api/debug/config`

```typescript
@Public()
@Get('debug/config')
getConfigDebug() {
  const jwtSecret = this.configService.get<string>('JWT_SECRET');
  const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
  const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
  
  return {
    ok: true,
    envLoaded: true,
    nodeEnv,
    hasJwtSecret: !!jwtSecret,
    hasJwtRefreshSecret: !!jwtRefreshSecret,
    jwtSecretLength: jwtSecret ? jwtSecret.length : 0,
    jwtRefreshSecretLength: jwtRefreshSecret ? jwtRefreshSecret.length : 0,
    timestamp: new Date().toISOString(),
  };
}
```

## Archivos Modificados

1. `apps/api/src/app.module.ts` - Agregado envFilePath con path.resolve
2. `apps/api/src/main.ts` - Agregada verificación de JWT_SECRET
3. `apps/api/src/app.controller.ts` - Agregado endpoint `/api/debug/config`

## Verificación

### Comando 1: Levantar API desde raíz

```bash
# Desde /Users/benjamingroisman/Desktop/remember_me
cd /Users/benjamingroisman/Desktop/remember_me
pnpm --filter @remember-me/api dev
```

**Esperado en logs (al iniciar):**
```
✅ Environment variables loaded successfully
🚀 API server running on: http://localhost:4000/api
```

**Si falta JWT_SECRET:**
```
⚠️  WARNING: JWT_SECRET missing: env not loaded correctly
   Expected .env file at: apps/api/.env
   Current working directory: /Users/benjamingroisman/Desktop/remember_me
```

### Comando 2: Verificar endpoint de diagnóstico (público)

```bash
curl http://localhost:4000/api/debug/config
```

**Response esperado:**
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

**Si `hasJwtSecret: false` → El .env no se cargó correctamente**

### Comando 3: Probar endpoint protegido con token

```bash
# 1. Registrar usuario
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'

# 2. Login para obtener token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }' | jq -r '.accessToken')

# Verificar que tenemos token
echo "Token: ${TOKEN:0:20}..." # Muestra primeros 20 chars

# 3. Probar endpoint protegido
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/test-org
```

**Response esperado:**
```json
{
  "message": "Current organization endpoint test",
  "organizationId": "...",
  "timestamp": "..."
}
```

**Si retorna 401 → JWT_SECRET no está configurado correctamente**

**Nota:** Si el usuario ya existe, puedes saltar el registro y hacer solo login.

## Script de Prueba Automatizado

```bash
# Ejecutar script de prueba completo
./scripts/test-api-env.sh http://localhost:4000/api
```

Este script:
1. Verifica `/api/debug/config` (público)
2. Verifica que `hasJwtSecret: true`
3. Prueba registro + login
4. Prueba endpoint protegido con token

## Troubleshooting

### Si `hasJwtSecret: false` en `/api/debug/config`

1. **Verificar que `apps/api/.env` existe:**
   ```bash
   ls -la apps/api/.env
   ```

2. **Verificar contenido:**
   ```bash
   grep JWT_SECRET apps/api/.env
   ```

3. **Verificar path en logs:**
   - Al iniciar, el log muestra el CWD actual
   - El path resuelto debería ser: `[ruta]/apps/api/.env`

### Si endpoints protegidos retornan 401

1. **Verificar JWT_SECRET está cargado:**
   ```bash
   curl http://localhost:4000/api/debug/config | jq '.hasJwtSecret'
   # Debe ser: true
   ```

2. **Verificar token es válido:**
   - El token debe venir de `/api/auth/login` o `/api/auth/select-organization`
   - El header debe ser: `Authorization: Bearer <token>`

3. **Verificar logs del servidor:**
   - Buscar errores de JWT validation
   - Verificar que JwtStrategy está usando el secret correcto

## Confirmación Final

Todos estos comandos deben funcionar:

```bash
# 1. Health (público)
curl http://localhost:4000/api/health
# ✅ {"status":"ok",...}

# 2. Debug config (público)
curl http://localhost:4000/api/debug/config
# ✅ {"hasJwtSecret":true,...}

# 3. Auth flow
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}'
# ✅ Retorna accessToken

# 4. Protected endpoint (con token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/test-org
# ✅ Retorna organizationId (no 401)
```

**Si todos pasan → Fix completo ✅**
