# Deploy Guide - Remember Me API

Guía paso a paso para deploy en staging y producción.

## Prerrequisitos

- Node.js >= 18
- pnpm >= 8
- PostgreSQL 16+
- Docker & Docker Compose (opcional, para staging)

## Variables de Entorno

Ver `apps/api/.env.example` para lista completa de variables.

**REQUERIDAS:**
- `DATABASE_URL`
- `JWT_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`
- `META_APP_ID`, `META_APP_SECRET` (si usas Meta/Instagram)

## Deploy Manual (Sin Docker)

### 1. Build

```bash
cd apps/api
pnpm install
pnpm prisma:generate
pnpm build
```

### 2. Migrations

```bash
# Aplicar migraciones
pnpm migrate:deploy
```

**Importante:** Las migraciones deben aplicarse ANTES de iniciar la aplicación.

### 3. Start

```bash
# Producción
NODE_ENV=production pnpm start:prod

# O con PM2
pm2 start dist/main.js --name remember-me-api
```

### 4. Verify

```bash
# Health check
curl http://localhost:4000/api/health

# Extended health (DB, env, version)
curl http://localhost:4000/api/health/extended
```

## Deploy con Docker (Staging)

### 1. Preparar .env

Crear `.env` en raíz del proyecto con todas las variables necesarias (ver `apps/api/.env.example`).

### 2. Build y Start

```bash
docker-compose -f docker-compose.staging.yml up -d --build
```

### 3. Migrations

```bash
# Ejecutar migraciones dentro del contenedor
docker-compose -f docker-compose.staging.yml exec api pnpm migrate:deploy
```

### 4. Verify

```bash
# Health check
curl http://localhost:4000/api/health

# Logs
docker-compose -f docker-compose.staging.yml logs -f api
```

## Smoke Tests Post-Deploy

Ejecutar estos tests después de cada deploy:

### 1. Health Check

```bash
curl http://localhost:4000/api/health/extended
```

**Esperado:** `{ status: "ok", database: { status: "connected" }, ... }`

### 2. Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

**Esperado:** `{ accessToken, refreshToken, user }` o `{ tempToken, organizations }`

### 3. Select Organization (si aplica)

```bash
curl -X POST http://localhost:4000/api/auth/select-organization \
  -H "Authorization: Bearer <tempToken>" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"org-id"}'
```

**Esperado:** `{ accessToken, refreshToken, user }`

### 4. Inbox List

```bash
curl http://localhost:4000/api/inbox/conversations \
  -H "Authorization: Bearer <accessToken>" \
  -H "X-Organization-Id: <orgId>"
```

**Esperado:** `{ data: [], meta: { total: 0, ... } }`

### 5. Open Conversation (si hay conversaciones)

```bash
curl http://localhost:4000/api/inbox/conversations/<conversationId> \
  -H "Authorization: Bearer <accessToken>" \
  -H "X-Organization-Id: <orgId>"
```

**Esperado:** `{ id, provider, status, ... }`

### 6. Send Message (WhatsApp/Instagram)

**WhatsApp:**
```bash
curl -X POST http://localhost:4000/api/inbox/conversations/<conversationId>/send-text \
  -H "Authorization: Bearer <accessToken>" \
  -H "X-Organization-Id: <orgId>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test message"}'
```

**Esperado:** `{ id, status: "QUEUED", ... }`

**Nota:** Requiere tokens válidos configurados. Si no hay tokens, el test fallará pero el endpoint debe responder (no crash).

## Rollback

### Manual

1. Detener aplicación actual
2. Revertir código a versión anterior
3. Rebuild y restart

### Docker

```bash
# Ver tags/imágenes disponibles
docker images

# Revertir a imagen anterior
docker-compose -f docker-compose.staging.yml down
docker-compose -f docker-compose.staging.yml up -d <previous-image>
```

**Nota:** Las migraciones de DB NO se revierten automáticamente. Si necesitas rollback de migraciones, hacerlo manualmente con `prisma migrate resolve`.

## Seguridad

### ⚠️ NUNCA:

- Commitear `.env` a git
- Exponer `JWT_SECRET` o `TOKEN_ENCRYPTION_KEY` en logs
- Usar tokens de producción en staging/dev
- Exponer `DATABASE_URL` públicamente

### ✅ SIEMPRE:

- Usar secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotar `JWT_SECRET` periódicamente
- Usar HTTPS en producción
- Configurar CORS correctamente (`CORS_ORIGINS`)
- Monitorear logs para errores de autenticación

## Troubleshooting

### Error: "Database connection failed"

- Verificar `DATABASE_URL`
- Verificar que PostgreSQL esté corriendo
- Verificar firewall/network

### Error: "JWT_SECRET is required"

- Verificar que `.env` esté cargado
- Verificar que `NODE_ENV=production` si aplica

### Error: "Migration failed"

- Verificar que DB esté accesible
- Verificar permisos de usuario de DB
- Revisar logs de migración

### Health check failing

- Verificar logs: `docker-compose logs api`
- Verificar que puerto 4000 esté expuesto
- Verificar que aplicación esté corriendo

## Monitoreo

### Health Endpoints

- `GET /api/health` - Health básico
- `GET /api/health/extended` - Health con DB, env, version

### Logs

- Logs estructurados (JSON) si `LOG_FORMAT=json`
- Niveles: `error`, `warn`, `info`, `debug`
- Configurar con `LOG_LEVEL`

### Métricas

- Endpoints protegidos con rate limiting
- Throttle: 100 requests/minuto por defecto
- Ajustable via código (no env var por ahora)

## Checklist Pre-Deploy

- [ ] `.env` configurado con todas las variables requeridas
- [ ] `JWT_SECRET` generado (32+ caracteres)
- [ ] `TOKEN_ENCRYPTION_KEY` generado (32 bytes base64)
- [ ] `DATABASE_URL` correcto y accesible
- [ ] Migraciones aplicadas (`pnpm migrate:deploy`)
- [ ] Build exitoso (`pnpm build`)
- [ ] Tests pasando (`pnpm test`)
- [ ] Health check responde OK
- [ ] CORS configurado correctamente
- [ ] Secrets NO expuestos en logs/código

## Checklist Post-Deploy

- [ ] Health check: `GET /api/health/extended` → OK
- [ ] Login funciona
- [ ] Select org funciona (si aplica)
- [ ] Inbox list funciona
- [ ] Send message funciona (si hay tokens)
- [ ] Logs sin errores críticos
- [ ] Rate limiting activo
- [ ] CORS funcionando (frontend puede llamar API)
