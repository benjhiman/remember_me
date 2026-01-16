# Rate Limiting por Organización

## Overview

Sistema de rate limiting distribuido por organización usando Redis, que funciona en múltiples instancias y protege endpoints críticos.

## Algoritmo

**Sliding Window Log**: Usa ventanas de tiempo fijas (ej: 60 segundos) y cuenta requests por ventana.

- Key: `rate_limit:{orgId}:{action}:{windowStart}`
- TTL: window size + 1 segundo (buffer)
- Atomic: Usa Redis pipeline para operaciones atómicas

## Endpoints Protegidos

### Auth
- `POST /api/auth/login` - 10 requests/min por org
- `POST /api/auth/register` - 3 requests/min por org

### Webhooks
- `POST /api/webhooks/whatsapp` - 100 requests/min por org
- `POST /api/webhooks/instagram` - 100 requests/min por org
- `POST /api/webhooks/meta-lead-ads` - 50 requests/min por org

### Inbox
- `POST /api/inbox/conversations/:id/send-text` - 60 requests/min por org
- `POST /api/inbox/conversations/:id/send-template` - 20 requests/min por org
- `POST /api/inbox/messages/:id/retry` - 10 requests/min por org

### Integrations
- `POST /api/integrations/meta/spend/fetch-now` - 5 requests/min por org (admin only)

## Configuración

### Variables de Entorno

```bash
# Habilitar rate limiting
RATE_LIMIT_ENABLED=true

# URL de Redis
RATE_LIMIT_REDIS_URL=redis://localhost:6379
# o para Docker
RATE_LIMIT_REDIS_URL=redis://redis:6379
```

### Defaults por Acción

| Acción | Límite | Ventana | Descripción |
|--------|--------|---------|-------------|
| `auth.login` | 10 | 60s | Login attempts |
| `auth.register` | 3 | 60s | Registration attempts |
| `webhook.whatsapp` | 100 | 60s | WhatsApp webhooks |
| `webhook.instagram` | 100 | 60s | Instagram webhooks |
| `webhook.meta_lead_ads` | 50 | 60s | Meta Lead Ads webhooks |
| `inbox.send_text` | 60 | 60s | Send text messages |
| `inbox.send_template` | 20 | 60s | Send template messages |
| `inbox.retry` | 10 | 60s | Retry failed messages |
| `integrations.meta_spend_fetch` | 5 | 60s | Force fetch Meta spend |

## Uso en Código

### Aplicar Rate Limiting a un Endpoint

```typescript
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';

@Controller('my-endpoint')
@UseGuards(RateLimitGuard)
@RateLimit({ action: 'my.action', limit: 10, windowSec: 60, skipIfDisabled: true })
@Post()
async myEndpoint(@CurrentOrganization() organizationId: string) {
  // ...
}
```

### Parámetros del Decorator

- `action`: Identificador único de la acción (ej: `inbox.send_text`)
- `limit`: Número máximo de requests permitidas
- `windowSec`: Tamaño de la ventana en segundos
- `skipIfDisabled`: Si `true`, permite requests si rate limiting está deshabilitado

## Respuestas HTTP

### Rate Limit Excedido (429)

```json
{
  "errorCode": "RATE_LIMITED",
  "message": "Rate limit exceeded for action: inbox.send_text",
  "retryAfterSec": 45
}
```

### Headers

- `X-RateLimit-Limit`: Límite máximo
- `X-RateLimit-Remaining`: Requests restantes en la ventana actual
- `X-RateLimit-Reset`: Timestamp Unix cuando se resetea la ventana
- `Retry-After`: Segundos hasta que se puede intentar de nuevo (solo si excedido)

### Ejemplo de Respuesta

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705276800
Retry-After: 45

{
  "errorCode": "RATE_LIMITED",
  "message": "Rate limit exceeded for action: inbox.send_text",
  "retryAfterSec": 45
}
```

## Comportamiento

### Multi-Instancia

El rate limiting funciona correctamente con múltiples instancias de la API porque:
- Redis es compartido entre todas las instancias
- Las operaciones son atómicas (pipeline)
- Cada instancia consulta el mismo contador

### Fallback

Si Redis no está disponible o rate limiting está deshabilitado:
- **Fail Open**: Todas las requests son permitidas
- Se loguea un warning pero no se bloquea el tráfico
- Útil para desarrollo local sin Redis

### Organización

- Rate limits son **por organización** (no globales)
- Si una org excede su límite, otras orgs no se ven afectadas
- Para endpoints sin organización (ej: webhooks), se usa `'global'` como orgId

## Overrides por Organización (Futuro)

Para permitir límites personalizados por organización, se puede:

1. **Opción A**: Tabla `RateLimitOverride` en DB
2. **Opción B**: Campo `rateLimitConfig` en `Organization.settingsJson`

Ejemplo de override:
```json
{
  "rateLimits": {
    "inbox.send_text": { "limit": 120, "windowSec": 60 }
  }
}
```

## Testing

### Deshabilitar en Tests

```typescript
// En test setup
process.env.RATE_LIMIT_ENABLED = 'false';
```

### Mock Redis

```typescript
const mockRedis = {
  pipeline: jest.fn().mockReturnValue({
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      [null, 1],
      [null, 1],
      [null, '5'],
    ]),
  }),
};
```

## Troubleshooting

### Rate Limit no funciona

1. Verificar `RATE_LIMIT_ENABLED=true`
2. Verificar conexión a Redis: `redis-cli ping`
3. Verificar logs: buscar "Redis connected for rate limiting"
4. Verificar que el decorator `@RateLimit` está aplicado

### Redis no disponible

- Rate limiting se deshabilita automáticamente
- Todas las requests son permitidas (fail open)
- Se loguea un error pero no se bloquea el tráfico

### Reset Manual (Admin)

```typescript
// Desde código (admin function)
await rateLimitService.resetLimit(organizationId, 'inbox.send_text');
```

O desde Redis CLI:
```bash
redis-cli KEYS "rate_limit:org-123:inbox.send_text:*" | xargs redis-cli DEL
```

## Próximos Pasos

- [ ] Overrides por organización (DB o config)
- [ ] Métricas de rate limit hits
- [ ] Alertas cuando org excede límites frecuentemente
- [ ] Rate limiting por usuario (además de por org)
