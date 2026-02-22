# PROGRESO - MOVIMIENTOS / AUDIT LOG

## ✅ FASE 1 - COMPLETA

### Implementado:
- ✅ DTO con validaciones class-validator
- ✅ Hardening: pageSize max 100, fallback 90 días
- ✅ Redacción automática de datos sensibles
- ✅ Smoke test script
- ✅ Scoping obligatorio por organizationId
- ✅ UI verificada

### Commits:
- `80d331f` - fix(audit): hardening + validation + redaction + smoke test
- `6bc1002` - fix(audit): move smoke test to src/scripts
- `f2c2f26` - feat(audit): FASE 1 completa

---

## ⚠️ FASE 2 - PARCIAL (50%)

### Implementado:
- ✅ AuditDomainEventsService creado (event bus centralizado)
- ✅ Login success instrumentado
- ✅ Login failed instrumentado
- ✅ AuthModule importa AuditLogModule

### Pendiente:
- ⚠️ Migrar SalesService a AuditDomainEventsService
- ⚠️ Migrar CustomersService a AuditDomainEventsService
- ⚠️ Instrumentar StockService (create, update, adjust)
- ⚠️ Instrumentar ItemsService (create, update, delete)
- ⚠️ Instrumentar Folders si existe
- ⚠️ Instrumentar Payments si existe

### Commits:
- `adb3d07` - feat(audit): FASE 2 parcial - instrumentación login

---

## ❌ FASE 3 - PENDIENTE

### Pendiente:
- ❌ Endpoint GET /api/audit-logs/stats
- ❌ Endpoint GET /api/audit-logs/export?format=csv
- ❌ UI: Pestaña "Estadísticas"
- ❌ UI: Botón Exportar CSV

---

## ❌ FASE 4 - PENDIENTE

### Pendiente:
- ❌ Retención configurable (AUDIT_RETENTION_DAYS)
- ❌ Job programado para limpieza
- ❌ Índices adicionales
- ❌ Alertas críticas (LOGIN_FAILED > 50 en 10 min)
- ❌ Protección avanzada (inmutable)
- ❌ Documentación AUDIT_ARCHITECTURE.md

---

## PRÓXIMOS PASOS

1. Completar FASE 2: Migrar servicios restantes
2. Implementar FASE 3: Analytics + CSV export
3. Implementar FASE 4: Retención + alertas + infra

---

## ARCHIVOS CREADOS/MODIFICADOS

### Nuevos:
- `apps/api/src/common/audit/dto/list-audit-logs.dto.ts`
- `apps/api/src/common/audit/utils/redact-sensitive-data.ts`
- `apps/api/src/common/audit/audit-domain-events.service.ts`
- `apps/api/src/scripts/audit-log-smoke.ts`
- `AUDIT_LOG_SCAN_REPORT.md`
- `FASE1_COMPLETE.md`
- `AUDIT_LOG_PROGRESS.md`

### Modificados:
- `apps/api/src/common/audit/audit-log.controller.ts`
- `apps/api/src/common/audit/audit-log.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/package.json`
