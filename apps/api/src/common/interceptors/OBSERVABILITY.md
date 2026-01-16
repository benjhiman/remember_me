# Observability

## Overview

The API includes observability features for monitoring, debugging, and performance analysis: metrics interceptor, extended health checks, and structured error logging.

## Metrics Interceptor

The `MetricsInterceptor` automatically tracks request metrics for all HTTP requests.

### Features

- **Duration tracking**: Measures request processing time
- **X-Response-Time header**: Adds response time header to all responses
- **Slow request detection**: Logs warnings for requests exceeding threshold
- **Structured logging**: Logs metrics in JSON format with request context

### Configuration

Environment variables:

- `SLOW_REQUEST_MS`: Threshold in milliseconds for slow requests (default: `1500`)
- `LOG_LEVEL`: Logging level (default: `info`)
- `LOG_FORMAT`: Log format (`json` or `text`, default: `json`)

Example:
```bash
SLOW_REQUEST_MS=2000 LOG_LEVEL=info LOG_FORMAT=json
```

### Log Format

All metrics are logged in JSON format with the following fields:

```json
{
  "requestId": "req-123-abc",
  "method": "POST",
  "path": "/api/sales",
  "statusCode": 201,
  "durationMs": 245,
  "userId": "user-123",
  "orgId": "org-456"
}
```

### Slow Requests

When a request exceeds `SLOW_REQUEST_MS`, it is logged with `warn` level:

```json
{
  "level": "warn",
  "message": "Slow request: POST /api/sales 201 2450ms",
  "requestId": "req-123-abc",
  "method": "POST",
  "path": "/api/sales",
  "statusCode": 201,
  "durationMs": 2450,
  "userId": "user-123",
  "orgId": "org-456"
}
```

### Response Headers

All responses include the `X-Response-Time` header:

```http
HTTP/1.1 200 OK
X-Response-Time: 245ms
Content-Type: application/json

{"data": "..."}
```

## Extended Health Check

### Endpoint

```
GET /api/health/extended
```

### Response

```json
{
  "status": "ok",
  "db": "ok",
  "uptime": 3600,
  "version": "1.0.0",
  "env": "production"
}
```

**Fields:**
- `status`: Always `"ok"` if endpoint is reachable
- `db`: Database connection status (`"ok"` or `"error"`)
- `uptime`: Application uptime in seconds (since last restart)
- `version`: Application version from `package.json`
- `env`: `NODE_ENV` environment variable (safe, no secrets)

### Security

The health endpoint does NOT expose:
- Database connection strings
- API keys or secrets
- Internal configuration
- Sensitive environment variables

Only safe, non-sensitive information is returned.

### Usage

**Check application health:**
```bash
curl http://localhost:4000/api/health/extended
```

**Monitor database connectivity:**
```bash
curl http://localhost:4000/api/health/extended | jq .db
```

**Check version and environment:**
```bash
curl http://localhost:4000/api/health/extended | jq '{version, env}'
```

## Error Logging

All errors are logged with structured format including `requestId` for correlation.

### Development Mode

In development (`NODE_ENV !== 'production'`):
- Full stack traces are logged
- Detailed error information
- Helpful debugging context

Example log:
```json
{
  "level": "error",
  "message": "GET /api/leads/invalid-id 404 15ms",
  "stack": "Error: Lead not found\n    at LeadsService.getLead (...)\n    ...",
  "requestId": "req-123-abc",
  "method": "GET",
  "path": "/api/leads/invalid-id",
  "statusCode": 404,
  "durationMs": 15,
  "error": "Lead not found"
}
```

### Production Mode

In production (`NODE_ENV === 'production'`):
- Stack traces are NOT logged
- Secure error messages (no internal details)
- Minimal sensitive information

Example log:
```json
{
  "level": "error",
  "message": "GET /api/leads/invalid-id 404 15ms",
  "requestId": "req-123-abc",
  "method": "GET",
  "path": "/api/leads/invalid-id",
  "statusCode": 404,
  "durationMs": 15,
  "error": "Not Found"
}
```

### Request ID Correlation

All error logs include `requestId` from the `X-Request-Id` header (or generated):

```json
{
  "requestId": "req-123-abc",
  "error": "Validation failed",
  "path": "/api/sales",
  "method": "POST"
}
```

This allows correlating errors across logs and tracing request flows.

## Examples

### Normal Request Log

```json
{
  "level": "info",
  "message": "POST /api/sales 201 245ms",
  "context": "HTTP Metrics",
  "requestId": "req-abc-123",
  "method": "POST",
  "path": "/api/sales",
  "statusCode": 201,
  "durationMs": 245,
  "userId": "user-456",
  "orgId": "org-789"
}
```

### Slow Request Log

```json
{
  "level": "warn",
  "message": "Slow request: GET /api/dashboard/overview 200 2345ms",
  "requestId": "req-def-456",
  "method": "GET",
  "path": "/api/dashboard/overview",
  "statusCode": 200,
  "durationMs": 2345,
  "userId": "user-789",
  "orgId": "org-123"
}
```

### Error Request Log (Production)

```json
{
  "level": "error",
  "message": "POST /api/sales 500 123ms",
  "context": "HTTP Metrics Error",
  "requestId": "req-ghi-789",
  "method": "POST",
  "path": "/api/sales",
  "statusCode": 500,
  "durationMs": 123,
  "userId": "user-123",
  "orgId": "org-456"
}
```

## Monitoring Integration

### Log Aggregation

Logs are structured JSON, suitable for:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog
- CloudWatch Logs
- Splunk
- Grafana Loki

### Metrics Collection

The `X-Response-Time` header can be extracted by reverse proxies (nginx, Traefik) or API gateways for metrics collection.

### Alerting

Configure alerts based on:
- Slow requests (`durationMs > SLOW_REQUEST_MS`)
- Error rate (statusCode >= 400)
- Database connectivity (`db: "error"` in health check)

## Environment Variables Summary

| Variable | Default | Description |
|----------|---------|-------------|
| `SLOW_REQUEST_MS` | `1500` | Threshold for slow request warnings (ms) |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `LOG_FORMAT` | `json` | Log format (json or text) |
| `NODE_ENV` | `development` | Environment (affects error logging) |
