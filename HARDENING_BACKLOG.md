# Hardening Sprint - Backlog Priorizado

## 📋 Resumen Ejecutivo

Este documento lista las tareas de hardening necesarias para llevar el backend a nivel SaaS-grade, priorizadas por impacto, esfuerzo y riesgo.

**Última actualización:** 2026-01-13  
**Estado:** En ejecución (Fase 0 → Fase 1)

---

## 🎯 Priorización

- **P0 (Crítico)**: Seguridad básica, estabilidad, cumplimiento mínimo SaaS
- **P1 (Alto)**: Mejoras de calidad, idempotencia, observabilidad
- **P2 (Medio)**: Nice-to-have, optimizaciones, features avanzadas

---

## 📊 Fase 0: Auditoría + Backlog ✅

**Estado:** COMPLETADO  
**Esfuerzo:** S (Small)  
**Riesgo:** N/A

**Entregable:**
- ✅ Este documento (HARDENING_BACKLOG.md)

---

## 🔧 Decisiones de Diseño Aplicadas

### Decisión A: Login Lockout

**Decisión:** NO implementar lockout in-memory en Fase 1.

**Racional:**
- Rate limiting por IP es suficiente para protección básica contra brute force
- Lockout in-memory no es escalable (no funciona con múltiples instancias)
- Lockout real requiere persistencia (Redis o tabla DB)

**Implementación Fase 1:**
- Solo rate limiting: `/api/auth/login` → 5 req/min por IP
- No lockout temporal por usuario/email

**Futuro (Fase 3 - P1):**
- Implementar lockout persistente con Redis o tabla `LoginAttempt`
- Lockout después de N intentos fallidos (ej: 5 intentos = 15 min lockout)
- Reset lockout después de login exitoso

---

### Decisión B: Audit Log Failure Mode

**Decisión:** Definir `AUDIT_FAIL_MODE` ahora (aunque audit se implemente en Fase 2).

**Variable de Entorno:**
```env
AUDIT_FAIL_MODE=OPEN  # o CLOSED
```

**Comportamiento:**

- **OPEN (dev/test):**
  - Si audit log falla: loggear error y continuar operación
  - Útil para desarrollo y testing donde audit no es crítico
  - No bloquea operaciones si audit service está caído

- **CLOSED (prod/compliance):**
  - Si audit log falla: abortar operación (throw error)
  - Garantiza que todas las mutaciones están auditadas
  - Requerido para compliance/regulaciones

**Implementación:**
- Middleware/interceptor de audit log verifica `AUDIT_FAIL_MODE`
- Si `CLOSED` y audit falla → `throw new Error('Audit log failed')`
- Si `OPEN` y audit falla → `logger.error()` y continuar

**Nota:** Esta decisión queda documentada aquí. La implementación real del audit log será en Fase 2.

---

## 🚨 FASE 1: Seguridad y Estabilidad (P0)

### 1.1 Rate Limiting Global + Por Ruta

**Prioridad:** P0 - Crítico  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** Ataques DDoS, brute force, abuso de API  
**Archivos Afectados:**
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/package.json` (agregar `@nestjs/throttler`)
- Nuevo: `apps/api/src/common/guards/throttler.guard.ts` (si necesita custom)

**Descripción:**
- Instalar y configurar `@nestjs/throttler`
- Rate limiting global (ej: 100 req/min por IP)
- Límites específicos para rutas sensibles:
  - `/api/auth/login`: 5 req/min por IP
  - `/api/auth/register`: 3 req/min por IP
  - `/api/pricing/compute`: 50 req/min por usuario autenticado
  - `/api/sales/*/pay`: 10 req/min por usuario
  - `/api/stock/reservations`: 20 req/min por usuario

**Orden Recomendado:** 1 (primera tarea de Fase 1)

---

### 1.2 RequestId + Logging Estructurado (JSON)

**Prioridad:** P0 - Crítico  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** Imposibilidad de rastrear requests en producción, debugging difícil  
**Archivos Afectados:**
- `apps/api/src/main.ts`
- `apps/api/src/common/interceptors/logging.interceptor.ts` (refactor completo)
- `apps/api/src/common/interceptors/request-id.interceptor.ts` (nuevo)
- `apps/api/src/common/middleware/request-id.middleware.ts` (nuevo)
- `apps/api/src/app.module.ts`
- `apps/api/package.json` (agregar `winston` o `pino`)

**Descripción:**
- Middleware que genera `X-Request-Id` (UUID v4) si no viene en header
- Interceptor que loguea requests/responses en formato JSON estructurado
- Logger estructurado (Winston o Pino) con niveles, timestamps, requestId
- Logs deben incluir: method, path, statusCode, duration, userId, orgId, ip
- Configuración por ambiente (dev: console, prod: JSON)

**Orden Recomendado:** 2 (después de rate limiting)

---

### 1.3 Error Handling Unificado

**Prioridad:** P0 - Crítico  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** Errores inconsistentes, información sensible expuesta, debugging difícil  
**Archivos Afectados:**
- `apps/api/src/common/filters/http-exception.filter.ts` (refactor completo)
- `apps/api/src/common/filters/all-exceptions.filter.ts` (nuevo, opcional)
- `apps/api/src/common/exceptions/*.ts` (nuevo: custom exceptions)
- `apps/api/src/main.ts`

**Descripción:**
- Filtro global de excepciones que normaliza todas las respuestas de error
- Formato consistente: `{ statusCode, message, error, requestId, timestamp }`
- En producción, ocultar stack traces y detalles técnicos
- Mapeo de excepciones Prisma a HTTP codes apropiados
- Códigos de error consistentes (400, 401, 403, 404, 409, 422, 500)

**Orden Recomendado:** 3

---

### 1.4 Security Hardening

**Prioridad:** P0 - Crítico  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** Vulnerabilidades comunes (XSS, CSRF, clickjacking, MIME sniffing)  
**Archivos Afectados:**
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/package.json` (agregar `helmet`, `@nestjs/config` si no existe)
- `.env.example` (nuevo)

**Descripción:**
- Instalar y configurar `helmet` para security headers
- CORS estricto y configurable por ambiente:
  - Dev: `http://localhost:3000, http://localhost:3001`
  - Prod: variable de entorno `CORS_ORIGINS`
- Validación estricta de payloads (ya existe `ValidationPipe` global, verificar configuración)
- Brute force protection en login (complemento de rate limiting):
  - Lockout temporal después de N intentos fallidos (ej: 5 intentos = 15 min lockout)
  - Implementar con Redis o in-memory store

**Orden Recomendado:** 4

---

### 1.5 Tests para Fase 1

**Prioridad:** P0 - Crítico  
**Esfuerzo:** L (Large)  
**Riesgo Mitigado:** Regresiones en seguridad y estabilidad  
**Archivos Afectados:**
- Nuevos archivos de test para rate limiting
- Nuevos archivos de test para logging interceptor
- Nuevos archivos de test para error filter
- Actualización de tests existentes si cambian respuestas

**Descripción:**
- Tests unitarios para rate limiting (mock throttler)
- Tests de integración para rate limiting (multiple requests)
- Tests para requestId middleware/interceptor
- Tests para error handling (diferentes tipos de excepciones)
- Tests para security headers (helmet, CORS)

**Orden Recomendado:** 5 (al final de Fase 1)

---

## 📝 FASE 2: Audit Log + Soft Delete (P0)

### 2.1 AuditLog Modelo Prisma

**Prioridad:** P0 - Crítico (compliance, trazabilidad)  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** Imposibilidad de auditar cambios, problemas de compliance  
**Archivos Afectados:**
- `packages/prisma/schema.prisma`
- `packages/prisma/migrations/*` (nueva migración)
- `packages/prisma/index.ts` (export AuditLog)

**Descripción:**
- Modelo `AuditLog`:
  - `id`, `organizationId`, `actorUserId`
  - `action` (CREATE, UPDATE, DELETE, etc.)
  - `entityType` (Lead, StockItem, Sale, PricingRule, etc.)
  - `entityId`, `beforeJson`, `afterJson`, `metadataJson`
  - `createdAt`
- Índices: `[organizationId, createdAt]`, `[entityType, entityId]`

**Orden Recomendado:** 1 (primera tarea de Fase 2)

---

### 2.2 Middleware/Interceptor de Audit Log

**Prioridad:** P0 - Crítico  
**Esfuerzo:** L (Large)  
**Riesgo Mitigado:** Pérdida de trazabilidad de cambios  
**Archivos Afectados:**
- `apps/api/src/common/interceptors/audit-log.interceptor.ts` (nuevo)
- `apps/api/src/app.module.ts`
- Servicios afectados: `LeadsService`, `StockService`, `SalesService`, `PricingService`

**Descripción:**
- Interceptor que captura mutaciones (POST/PATCH/PUT/DELETE)
- Registra en `AuditLog` antes y después del cambio
- Usar transacciones para garantizar atomicidad
- No bloquear operaciones si audit log falla (log error y continuar)

**Orden Recomendado:** 2

---

### 2.3 Soft Delete Estándar

**Prioridad:** P0 - Crítico (datos críticos no deben perderse)  
**Esfuerzo:** L (Large)  
**Riesgo Mitigado:** Pérdida de datos por eliminaciones accidentales  
**Archivos Afectados:**
- `packages/prisma/schema.prisma` (agregar `deletedAt DateTime?` a modelos)
- `packages/prisma/migrations/*` (nueva migración)
- Todos los servicios: modificar queries para excluir `deletedAt IS NOT NULL`
- Nuevos endpoints o flags: `includeDeleted`, `restore`

**Modelos Afectados:**
- `Lead`
- `StockItem`
- `Sale`
- `PricingRule`
- `Pipeline` (opcional)
- `Stage` (opcional)

**Descripción:**
- Agregar campo `deletedAt DateTime?` a entidades core
- Middleware Prisma o queries modificadas para excluir soft-deleted por defecto
- Endpoints DELETE cambian a soft delete (actualizar `deletedAt`)
- Endpoint `PATCH /:entity/:id/restore` para admins
- Query param `?includeDeleted=true` para admins

**Orden Recomendado:** 3

---

### 2.4 Migraciones + Seed Adjust

**Prioridad:** P0 - Crítico  
**Esfuerzo:** S (Small)  
**Riesgo Mitigado:** Base de datos inconsistente  
**Archivos Afectados:**
- `packages/prisma/migrations/*`
- `packages/prisma/seed.ts`

**Descripción:**
- Generar y aplicar migración para `AuditLog`
- Generar y aplicar migración para `deletedAt` en modelos
- Ajustar seed si es necesario (no debería afectar)

**Orden Recomendado:** 4

---

### 2.5 Tests Fase 2 (mínimo 30 nuevos tests)

**Prioridad:** P0 - Crítico  
**Esfuerzo:** L (Large)  
**Riesgo Mitigado:** Regresiones en audit log y soft delete  
**Archivos Afectados:**
- `apps/api/src/common/interceptors/audit-log.interceptor.spec.ts` (nuevo)
- Tests de servicios actualizados para soft delete
- Tests de permisos (admins pueden restaurar, otros no)

**Descripción:**
- Tests unitarios para audit log interceptor
- Tests de integración para audit log (verificar que se persiste)
- Tests para soft delete (verificar exclusión en queries)
- Tests para restore endpoint
- Tests para permisos (includeDeleted solo admins)

**Orden Recomendado:** 5 (al final de Fase 2)

---

## 🔄 FASE 3: Idempotencia + Consistencia Transaccional (P1)

### 3.1 Idempotency-Key en Endpoints Críticos

**Prioridad:** P1 - Alto (prevención de duplicados)  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** Duplicación de ventas, pagos, reservas por reintentos  
**Archivos Afectados:**
- `apps/api/src/common/interceptors/idempotency.interceptor.ts` (nuevo)
- `apps/api/src/common/decorators/idempotency-key.decorator.ts` (nuevo)
- `apps/api/src/app.module.ts`
- Controllers: `SalesController`, `StockController`

**Endpoints Afectados:**
- `POST /api/sales`
- `PATCH /api/sales/:id/pay`
- `POST /api/stock/reservations`

**Descripción:**
- Decorator `@IdempotencyKey()` para marcar endpoints
- Header `Idempotency-Key: <uuid>` requerido
- Guardar key + respuesta en cache/store (Redis o in-memory) con TTL (ej: 24h)
- Si key existe, devolver respuesta cached (mismo statusCode + body)
- Validar que mismo usuario + org no pueda usar misma key en diferentes endpoints

**Orden Recomendado:** 1 (primera tarea de Fase 3)

---

### 3.2 Persistencia de Idempotency Keys

**Prioridad:** P1 - Alto  
**Esfuerzo:** S (Small)  
**Riesgo Mitigado:** Pérdida de keys en restart, inconsistencia  
**Archivos Afectados:**
- Opción 1: Redis (requiere Redis)
- Opción 2: Tabla Prisma `IdempotencyKey` (persistente)
- `apps/api/src/common/services/idempotency.service.ts` (nuevo)

**Descripción:**
- Store para keys: `organizationId + userId + key + route` → `response + timestamp`
- TTL: 24 horas
- Cleanup job opcional para limpiar keys expiradas

**Orden Recomendado:** 2

---

### 3.3 Tests de Idempotencia (mínimo 10)

**Prioridad:** P1 - Alto  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** Idempotencia no funciona correctamente  
**Archivos Afectados:**
- `apps/api/src/common/interceptors/idempotency.interceptor.spec.ts` (nuevo)
- Tests e2e para endpoints con idempotency

**Descripción:**
- Tests unitarios para idempotency interceptor
- Tests e2e: mismo key = misma respuesta
- Tests e2e: diferentes keys = diferentes requests procesados
- Tests: key expirada = nuevo request procesado

**Orden Recomendado:** 3 (al final de Fase 3)

---

## 📊 FASE 4: Export + Observabilidad (P1)

### 4.1 Export CSV (leads, sales, stock)

**Prioridad:** P1 - Alto (feature solicitada por usuarios)  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** N/A (feature, no riesgo)  
**Archivos Afectados:**
- `apps/api/src/common/services/export.service.ts` (nuevo)
- `apps/api/src/leads/leads.controller.ts`
- `apps/api/src/sales/sales.controller.ts`
- `apps/api/src/stock/stock.controller.ts`
- `apps/api/package.json` (agregar `csv-writer` o similar)

**Descripción:**
- Endpoints `GET /api/leads/export?format=csv&...filters`
- Endpoints `GET /api/sales/export?format=csv&...filters`
- Endpoints `GET /api/stock/export?format=csv&...filters`
- Respuesta: `Content-Type: text/csv`, `Content-Disposition: attachment`
- Aplicar mismos filtros que list endpoints
- Límite de registros (ej: 10,000) para evitar timeouts

**Orden Recomendado:** 1 (si se implementa Fase 4)

---

### 4.2 Métricas/Observabilidad

**Prioridad:** P1 - Alto (monitoreo en producción)  
**Esfuerzo:** M (Medium)  
**Riesgo Mitigado:** Imposibilidad de monitorear performance en producción  
**Archivos Afectados:**
- `apps/api/src/common/interceptors/metrics.interceptor.ts` (nuevo)
- `apps/api/src/app.module.ts`

**Descripción:**
- Interceptor que mide tiempo de ejecución por endpoint
- Logs estructurados con timing (ya debería estar en logging interceptor)
- Opcional: endpoint `/metrics` en formato Prometheus
- Opcional: health check extendido con dependencias (DB, Redis si aplica)

**Orden Recomendado:** 2 (si se implementa Fase 4)

---

## 📋 Resumen por Fase

| Fase | Prioridad | Esfuerzo Total | Riesgo Mitigado |
|------|-----------|----------------|-----------------|
| Fase 0 | P0 | S | N/A (auditoría) |
| Fase 1 | P0 | M-L | Seguridad, estabilidad, debugging |
| Fase 2 | P0 | L | Compliance, trazabilidad, pérdida de datos |
| Fase 3 | P1 | M | Duplicación de operaciones críticas |
| Fase 4 | P1 | M | Feature gap, observabilidad |

---

## 🎯 Orden Recomendado de Ejecución

1. ✅ **Fase 0** (COMPLETADO)
2. 🚧 **Fase 1.1** - Rate Limiting
3. 🚧 **Fase 1.2** - RequestId + Logging
4. 🚧 **Fase 1.3** - Error Handling
5. 🚧 **Fase 1.4** - Security Hardening
6. 🚧 **Fase 1.5** - Tests Fase 1
7. ⏳ **Fase 2.1-2.5** - Audit Log + Soft Delete
8. ⏳ **Fase 3.1-3.3** - Idempotencia
9. ⏳ **Fase 4.1-4.2** - Export + Observabilidad (opcional)

---

## 📝 Notas de Implementación

### Dependencias Nuevas Requeridas

```json
{
  "@nestjs/throttler": "^5.0.0",
  "winston": "^3.11.0",
  "winston-daily-rotate-file": "^4.7.1",
  "helmet": "^7.1.0",
  "uuid": "^9.0.0",
  "csv-writer": "^1.6.0"
}
```

### Variables de Entorno Nuevas

```env
# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
NODE_ENV=production
```

---

## ✅ Checklist de Entregables

### Documentación Obligatoria
- [x] HARDENING_BACKLOG.md (este archivo)
- [ ] SECURITY.md (env vars + CORS + rate limit)
- [ ] AUDIT_LOG.md (qué se registra)
- [ ] SOFT_DELETE.md (cómo funciona)
- [ ] IDEMPOTENCY.md (cómo usar)

### Archivos de Testing
- [ ] hardening-api-test.http (rate limit + idempotency)

### Código
- [ ] Build SUCCESS
- [ ] TypeScript sin errores
- [ ] Tests PASSING

---

**Próximos Pasos:** Ejecutar Fase 1 completa (tareas 1.1 a 1.5)
