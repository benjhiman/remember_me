# Observabilidad Avanzada

## Overview

Sistema de métricas Prometheus-ready con tracing básico por `requestId` para monitoreo y debugging en producción.

## Endpoint de Métricas

### GET /api/metrics

Endpoint que expone métricas en formato Prometheus.

**Autenticación:**
- Si `METRICS_TOKEN` está configurado: requiere header `X-Metrics-Token` con el valor exacto
  ```bash
  curl -H "X-Metrics-Token: $METRICS_TOKEN" http://localhost:4000/api/metrics
  ```
- Si `METRICS_TOKEN` NO está configurado: requiere JWT con rol ADMIN/OWNER
  ```bash
  curl -H "Authorization: Bearer $JWT_TOKEN" http://localhost:4000/api/metrics/authenticated
  ```

**Nota:** En producción, siempre usar `METRICS_TOKEN` para mayor seguridad.

**Respuesta:**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/inbox/conversations/:id",status="200",env="production",version="1.0.0"} 1234

# HELP http_request_duration_ms HTTP request duration in milliseconds
# TYPE http_request_duration_ms histogram
http_request_duration_ms_bucket{method="GET",route="/api/inbox/conversations/:id",status="200",le="100"} 1000
...
```

## Métricas Disponibles

### HTTP Metrics

- `http_requests_total` - Total de requests HTTP (labels: `method`, `route`, `status`)
- `http_request_duration_ms` - Duración de requests (histogram)
- `slow_requests_total` - Requests que exceden `SLOW_REQUEST_MS` threshold

**Ejemplo de query:**
```promql
# Requests por segundo
rate(http_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))

# Slow requests
rate(slow_requests_total[5m])
```

### Job Metrics

- `integration_jobs_pending_count` - Jobs pendientes (gauge, labels: `provider`, `jobType`)
- `integration_jobs_processing_count` - Jobs en procesamiento (gauge)
- `integration_jobs_failed_count` - Jobs fallidos (gauge)
- `integration_job_latency_ms` - Latencia desde `runAt` hasta inicio (histogram)
- `integration_job_duration_ms` - Duración de ejecución (histogram, labels: `provider`, `jobType`, `status`)

**Ejemplo de query:**
```promql
# Jobs pendientes por tipo
integration_jobs_pending_count

# Tasa de fallos
rate(integration_jobs_failed_count[5m])

# P95 job duration
histogram_quantile(0.95, rate(integration_job_duration_ms_bucket[5m]))
```

### Webhook Metrics

- `webhook_events_total` - Total de eventos webhook (counter, labels: `provider`, `status`)
- `webhook_processing_duration_ms` - Duración de procesamiento (histogram)

**Ejemplo de query:**
```promql
# Webhooks por segundo
rate(webhook_events_total[5m])

# Tasa de errores
rate(webhook_events_total{status="error"}[5m])
```

### Messaging Metrics

- `messages_outbound_total` - Mensajes outbound (counter, labels: `provider`, `status`)
- `message_status_transitions_total` - Transiciones de estado (counter, labels: `provider`, `from`, `to`)

**Ejemplo de query:**
```promql
# Mensajes enviados por segundo
rate(messages_outbound_total{status="sent"}[5m])

# Tasa de fallos
rate(messages_outbound_total{status="failed"}[5m])
```

### Rate Limit Metrics

- `rate_limit_hits_total` - Total de checks de rate limit (counter, labels: `action`)
- `rate_limit_rejected_total` - Total de rechazos (counter, labels: `action`)

**Ejemplo de query:**
```promql
# Tasa de rechazos
rate(rate_limit_rejected_total[5m])

# Ratio de rechazo
rate(rate_limit_rejected_total[5m]) / rate(rate_limit_hits_total[5m])
```

## Configuración de Prometheus

### prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'remember-me-api'
    scrape_interval: 10s
    metrics_path: '/api/metrics'
    bearer_token: '${METRICS_TOKEN}'
    static_configs:
      - targets: ['api:4000']
        labels:
          env: 'production'
          service: 'api'
```

### Docker Compose (Opcional)

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
```

## Tracing por RequestId

Todos los logs y métricas incluyen `requestId` para correlación:

**Logs:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "GET /api/inbox/conversations 200 150ms",
  "requestId": "req-123-abc",
  "method": "GET",
  "path": "/api/inbox/conversations",
  "statusCode": 200,
  "durationMs": 150
}
```

**Jobs:**
- `correlationId` en job payload incluye `jobId` + `requestId` (si existe)
- Útil para rastrear jobs creados por requests específicos

## Queries Útiles

### P95 Latency por Endpoint

```promql
histogram_quantile(0.95, 
  sum(rate(http_request_duration_ms_bucket[5m])) by (le, route)
)
```

### Job Failures por Tipo

```promql
sum(rate(integration_jobs_failed_count[5m])) by (jobType)
```

### Rate Limit Rejections

```promql
sum(rate(rate_limit_rejected_total[5m])) by (action)
```

### Webhook Processing Time

```promql
histogram_quantile(0.95, 
  sum(rate(webhook_processing_duration_ms_bucket[5m])) by (le, provider)
)
```

## Runbook Básico

### Jobs se Acumulan

**Síntoma:** `integration_jobs_pending_count` crece constantemente

**Diagnóstico:**
1. Verificar `integration_jobs_processing_count` - si es 0, el worker no está corriendo
2. Verificar `integration_jobs_failed_count` - si crece, hay errores sistemáticos
3. Revisar logs con `requestId` del job que falla

**Acción:**
- Verificar worker: `docker logs remember_me_worker`
- Verificar DB: `SELECT COUNT(*) FROM "IntegrationJob" WHERE status = 'PENDING'`
- Verificar rate limits: `rate_limit_rejected_total`

### Webhooks Fallan

**Síntoma:** `webhook_events_total{status="error"}` aumenta

**Diagnóstico:**
1. Verificar `webhook_processing_duration_ms` - si es alto, hay bottleneck
2. Revisar logs con `requestId` del webhook
3. Verificar rate limits en webhook endpoints

**Acción:**
- Verificar signature validation
- Verificar DB connectivity
- Verificar rate limits: `rate_limit_rejected_total{action="webhook.whatsapp"}`

### Rate Limits Rechazan Requests

**Síntoma:** `rate_limit_rejected_total` aumenta

**Diagnóstico:**
1. Verificar `rate_limit_hits_total` vs `rate_limit_rejected_total`
2. Identificar acción más afectada: `sum(rate_limit_rejected_total[5m]) by (action)`

**Acción:**
- Ajustar límites por organización si es necesario
- Verificar si hay abuso o carga legítima alta
- Considerar aumentar límites en `RATE_LIMITS.md`

### Slow Requests

**Síntoma:** `slow_requests_total` aumenta

**Diagnóstico:**
1. Verificar `http_request_duration_ms` P95/P99
2. Identificar rutas más lentas: `sum(rate(slow_requests_total[5m])) by (route)`

**Acción:**
- Optimizar queries de DB
- Agregar índices si es necesario
- Revisar N+1 queries

## Variables de Entorno

```bash
# Métricas
METRICS_TOKEN=your-secure-token-here  # Token para /api/metrics

# Thresholds
SLOW_REQUEST_MS=1500  # Threshold para slow requests

# App Info
APP_VERSION=1.0.0  # Versión para labels de métricas
NODE_ENV=production  # Env para labels de métricas
```

## Integración con Grafana (Opcional)

### Dashboard Básico

1. **HTTP Requests:**
   - Panel: Requests/sec (rate)
   - Panel: P95/P99 latency
   - Panel: Error rate (4xx + 5xx)

2. **Jobs:**
   - Panel: Pending/Processing/Failed counts
   - Panel: Job duration P95
   - Panel: Job failure rate

3. **Webhooks:**
   - Panel: Webhook events/sec
   - Panel: Error rate
   - Panel: Processing duration

4. **Rate Limits:**
   - Panel: Rejection rate
   - Panel: Hits vs Rejections

### Ejemplo de Dashboard JSON

Ver `docs/grafana-dashboard.json` (si existe) o crear manualmente usando las queries de arriba.

## Troubleshooting

### Métricas no aparecen

1. Verificar `METRICS_TOKEN` está configurado
2. Verificar endpoint: `curl http://localhost:4000/api/metrics`
3. Verificar logs: buscar "MetricsService initialized"

### Cardinalidad alta

- Las rutas se normalizan automáticamente (IDs reemplazados por `:id`)
- Si aún hay cardinalidad alta, revisar labels en métricas personalizadas

### Performance

- Prometheus scraping cada 10-15s es suficiente
- Métricas se almacenan en memoria (no afecta DB)
- Usar `prometheus` client library (ya incluido)

## Próximos Pasos

- [ ] Alertas en Prometheus (Alertmanager)
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Métricas de negocio (conversiones, revenue)
- [ ] Dashboard pre-configurado en Grafana
