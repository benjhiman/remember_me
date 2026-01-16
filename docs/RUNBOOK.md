# Runbook Operativo

Guía de troubleshooting y operación para Remember Me en producción/staging.

## Jobs Acumulados

### Síntomas

- Jobs en estado `PENDING` que no se procesan
- `pendingCount` creciendo en `/api/integrations/jobs/metrics`
- Latencia alta en procesamiento de mensajes

### Diagnóstico

1. **Verificar métricas de jobs:**
   ```bash
   curl -H "Authorization: Bearer <JWT>" \
     http://localhost:4000/api/integrations/jobs/metrics
   ```

   Buscar:
   - `pendingCount` alto (> 10)
   - `oldestPendingAgeMs` alto (> 60000 = 1 min)
   - `lastRunAt` muy antiguo

2. **Verificar métricas Prometheus:**
   ```bash
   curl -H "X-Metrics-Token: <TOKEN>" \
     http://localhost:4000/api/metrics | grep integration_jobs
   ```

   Buscar:
   - `integration_jobs_pending_count` alto
   - `integration_job_latency_ms` alto (p95, p99)

3. **Verificar logs del worker:**
   ```bash
   docker-compose logs worker | tail -50
   ```

   Buscar:
   - Errores repetidos
   - "Lock not acquired" (múltiples workers compitiendo)
   - "Redis connection failed"

### Acciones

1. **Si worker está caído:**
   ```bash
   docker-compose restart worker
   ```

2. **Si Redis está caído:**
   ```bash
   docker-compose restart redis
   # Esperar 10s y verificar conexión
   ```

3. **Si hay jobs bloqueados (PROCESSING > 5 min):**
   ```bash
   # Marcar manualmente como PENDING para retry
   # (requiere acceso a DB)
   psql -U postgres -d remember_me -c "
     UPDATE \"IntegrationJob\" 
     SET status = 'PENDING' 
     WHERE status = 'PROCESSING' 
     AND \"updatedAt\" < NOW() - INTERVAL '5 minutes';
   "
   ```

4. **Si concurrency es bajo:**
   ```bash
   # Aumentar INTEGRATION_WORKER_CONCURRENCY en .env.docker
   INTEGRATION_WORKER_CONCURRENCY=10
   docker-compose restart worker
   ```

## Webhooks Fallan

### Síntomas

- Webhooks de WhatsApp/Instagram no crean `MessageLog`
- `WebhookEvent` con `status=ERROR`
- `webhook_events_total{status="error"}` incrementando

### Diagnóstico

1. **Verificar logs de webhooks:**
   ```bash
   docker-compose logs api | grep -i webhook
   ```

   Buscar:
   - "Invalid signature"
   - "Webhook verification failed"
   - "Missing raw body"

2. **Verificar métricas:**
   ```bash
   curl -H "X-Metrics-Token: <TOKEN>" \
     http://localhost:4000/api/metrics | grep webhook
   ```

   Buscar:
   - `webhook_events_total{status="error"}`
   - `webhook_processing_duration_ms` alto

3. **Verificar configuración:**
   - `WHATSAPP_APP_SECRET` correcto
   - `META_APP_SECRET` correcto
   - `WHATSAPP_VERIFY_TOKEN` correcto
   - Raw body middleware habilitado

### Acciones

1. **Firma inválida:**
   - Verificar `WHATSAPP_APP_SECRET` / `META_APP_SECRET` en Meta dashboard
   - Verificar raw body middleware está activo
   - Verificar headers `X-Hub-Signature-256` están presentes

2. **Verificación falla:**
   - Verificar `WHATSAPP_VERIFY_TOKEN` coincide con Meta config
   - Verificar query params `hub.mode=subscribe&hub.verify_token=...`

3. **Raw body faltante:**
   - Verificar middleware `RawBodyMiddleware` está registrado antes de webhook routes
   - Verificar nginx/proxy no está consumiendo body

4. **RequestId faltante:**
   - Verificar `RequestIdMiddleware` está registrado
   - Buscar en logs: `requestId: undefined`

## Rate Limit Pegando

### Síntomas

- Requests devuelven `429 Too Many Requests`
- Headers `X-RateLimit-Remaining: 0`
- `rate_limit_rejected_total` incrementando

### Diagnóstico

1. **Verificar headers de respuesta:**
   ```bash
   curl -v http://localhost:4000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"wrong"}'
   ```

   Buscar:
   - `HTTP/1.1 429 Too Many Requests`
   - `Retry-After: <seconds>`
   - `X-RateLimit-Limit: <limit>`
   - `X-RateLimit-Remaining: 0`
   - `X-RateLimit-Reset: <timestamp>`

2. **Verificar métricas:**
   ```bash
   curl -H "X-Metrics-Token: <TOKEN>" \
     http://localhost:4000/api/metrics | grep rate_limit
   ```

   Buscar:
   - `rate_limit_rejected_total{action="auth.login"}`
   - `rate_limit_hits_total{action="auth.login"}`

3. **Verificar Redis rate limit:**
   ```bash
   docker-compose exec redis redis-cli
   > KEYS rate_limit:*
   > GET rate_limit:auth.login:org-123
   ```

### Acciones

1. **Aumentar límite temporalmente:**
   - Modificar `RateLimitDecorator` en endpoint específico
   - O cambiar defaults en `RateLimitService`

2. **Verificar organización específica:**
   - Rate limits son por `organizationId`
   - Verificar si una org específica está generando spam

3. **Deshabilitar rate limit (emergencia):**
   ```bash
   # En .env.docker
   RATE_LIMIT_ENABLED=false
   docker-compose restart api worker
   ```

4. **Ajustar límites por acción:**
   - Ver `@RateLimit()` decorators en controllers
   - Ajustar `limit` y `windowSec` según necesidad

## Mensajes FAILED

### Síntomas

- `MessageLog` con `status=FAILED`
- Jobs marcados como `FAILED` en `IntegrationJob`
- `message_status_transitions_total{to_status="failed"}` incrementando

### Diagnóstico

1. **Verificar mensajes failed:**
   ```bash
   # Vía API (requiere auth)
   curl -H "Authorization: Bearer <JWT>" \
     "http://localhost:4000/api/integrations/messages?status=FAILED"
   ```

2. **Verificar métricas:**
   ```bash
   curl -H "X-Metrics-Token: <TOKEN>" \
     http://localhost:4000/api/metrics | grep message_status_transitions
   ```

3. **Verificar logs de worker:**
   ```bash
   docker-compose logs worker | grep -i "failed\|error"
   ```

   Buscar:
   - "WhatsApp API error"
   - "Instagram API error"
   - `lastError` en `IntegrationJob`

### Acciones

1. **Retry desde Inbox (recomendado):**
   ```bash
   # POST /api/inbox/messages/:id/retry
   curl -X POST \
     -H "Authorization: Bearer <JWT>" \
     -H "Content-Type: application/json" \
     http://localhost:4000/api/inbox/messages/<messageLogId>/retry
   ```

   Esto:
   - Crea nuevo `MessageLog` OUTBOUND
   - Encuela nuevo job
   - Worker procesará automáticamente

2. **Verificar causa del fallo:**
   - Ver `lastError` en `IntegrationJob`
   - Ver `metaJson.error` en `MessageLog`
   - Verificar tokens de WhatsApp/Instagram válidos

3. **Retry manual de job:**
   ```bash
   # Marcar job como PENDING para retry
   psql -U postgres -d remember_me -c "
     UPDATE \"IntegrationJob\" 
     SET status = 'PENDING', attempts = 0 
     WHERE id = '<job-id>';
   "
   ```

4. **Bulk retry failed messages:**
   ```bash
   # Script de ejemplo (requiere acceso a DB)
   psql -U postgres -d remember_me -c "
     UPDATE \"MessageLog\" 
     SET status = 'QUEUED' 
     WHERE status = 'FAILED' 
     AND direction = 'OUTBOUND'
     AND \"createdAt\" > NOW() - INTERVAL '24 hours';
   "
   ```

## Monitoring & Alerting

### Métricas Clave

1. **Jobs:**
   - `integration_jobs_pending_count` > 50 → Alert
   - `integration_jobs_failed_count` > 10 → Alert
   - `integration_job_latency_ms` p95 > 30s → Alert

2. **Webhooks:**
   - `webhook_events_total{status="error"}` rate > 1/min → Alert

3. **Messages:**
   - `message_status_transitions_total{to_status="failed"}` rate > 5/min → Alert

4. **HTTP:**
   - `http_request_duration_ms` p95 > 2s → Alert
   - `slow_requests_total` rate > 10/min → Alert

5. **Rate Limit:**
   - `rate_limit_rejected_total` rate > 100/min → Alert

### Dashboards Recomendados

- **Jobs Dashboard:**
  - Pending/Processing/Failed counts
  - Job latency (p50, p95, p99)
  - Job duration by type

- **Webhooks Dashboard:**
  - Success/error rates
  - Processing duration
  - Events by provider

- **Messages Dashboard:**
  - Outbound message rates
  - Status transitions
  - Failed message count

- **System Dashboard:**
  - HTTP request rates
  - Error rates (4xx, 5xx)
  - Slow requests

### Alertas Recomendadas

```yaml
# Ejemplo (Prometheus AlertManager)
groups:
  - name: remember_me
    rules:
      - alert: HighPendingJobs
        expr: integration_jobs_pending_count > 50
        for: 5m
        annotations:
          summary: "High pending jobs count"

      - alert: WebhookErrorsHigh
        expr: rate(webhook_events_total{status="error"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "High webhook error rate"

      - alert: MessagesFailing
        expr: rate(message_status_transitions_total{to_status="failed"}[5m]) > 0.1
        for: 5m
        annotations:
          summary: "Messages failing frequently"
```
