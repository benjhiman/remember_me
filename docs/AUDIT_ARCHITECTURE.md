# Arquitectura del Sistema de Auditoría (Audit Log)

## 📋 Índice

1. [Visión General](#visión-general)
2. [Flujo Completo](#flujo-completo)
3. [Eventos Instrumentados](#eventos-instrumentados)
4. [Seguridad](#seguridad)
5. [Performance](#performance)
6. [Retención](#retención)
7. [Alertas](#alertas)
8. [Escalabilidad Futura](#escalabilidad-futura)

---

## 🎯 Visión General

El sistema de auditoría (MOVIMIENTOS) es un módulo centralizado que registra **todos los movimientos relevantes** del sistema, proporcionando trazabilidad completa y capacidad de análisis para el rol OWNER.

### Características Principales

- ✅ **Multi-tenant seguro**: Todos los logs están scoped por `organizationId`
- ✅ **Fire-and-forget**: No bloquea requests principales
- ✅ **Redacción automática**: Datos sensibles (passwords, tokens) se redactan)
- ✅ **Modo asíncrono opcional**: Soporte para queue-based logging (BullMQ)
- ✅ **Retención configurable**: Limpieza automática de logs antiguos
- ✅ **Alertas**: Detección de patrones sospechosos
- ✅ **Exportación**: CSV streaming para análisis externo
- ✅ **Analítica**: Estadísticas agregadas por rol, acción, entidad

---

## 🔄 Flujo Completo

### 1. Captura de Eventos

```
┌─────────────────┐
│  Service Layer  │
│ (SalesService,  │
│ CustomersService│
│  StockService)  │
└────────┬────────┘
         │
         │ emit(event)
         ▼
┌─────────────────────────┐
│ AuditDomainEventsService│
│   (Event Bus Central)   │
└────────┬────────────────┘
         │
         ├─── Si queue disponible ───► Queue (BullMQ) ───► Worker ───► DB
         │
         └─── Si no queue ───► AuditLogService.log() ───► DB (directo)
```

### 2. Contexto Automático

El `AuditLogInterceptor` captura automáticamente:
- `requestId` (generado si no existe)
- `ip` (del request)
- `userAgent` (del request)
- `actorRole` (del JWT)
- `actorEmail` (del JWT)

### 3. Persistencia

```typescript
AuditLog {
  id: cuid()
  organizationId: string  // CRITICAL: Multi-tenant isolation
  actorUserId: string?
  actorRole: string?
  actorEmail: string?
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  beforeJson: Json?       // Estado anterior (snapshot)
  afterJson: Json?        // Estado posterior (snapshot)
  metadataJson: Json?     // Contexto adicional
  requestId: string?
  severity: 'info' | 'warn' | 'error'
  source: 'web' | 'api' | 'worker' | 'system'
  ip: string?
  userAgent: string?
  createdAt: DateTime
}
```

### 4. Consulta y Visualización

```
GET /api/audit-logs?page=1&pageSize=50&dateFrom=...&dateTo=...
  └──► AuditLogController.listAuditLogs()
      └──► Prisma.findMany() con filtros
      └──► Redacción de datos sensibles
      └──► Response paginado
```

---

## 📊 Eventos Instrumentados

### Autenticación
- ✅ `LOGIN_SUCCESS` - Login exitoso
- ✅ `LOGIN_FAILED` - Intento de login fallido

### Clientes
- ✅ `CUSTOMER_CREATED` - Cliente creado
- ✅ `CUSTOMER_UPDATED` - Cliente actualizado

### Ventas
- ✅ `SALE_CREATED` - Venta creada
- ✅ `SALE_UPDATED` - Venta actualizada
- ✅ `SALE_STATUS_CHANGED` - Estado de venta cambiado
- ✅ `PAY` - Pago recibido
- ✅ `CANCEL` - Venta cancelada
- ✅ `SHIP` - Venta enviada
- ✅ `DELIVER` - Venta entregada
- ✅ `DELETE` - Venta eliminada
- ✅ `RESTORE` - Venta restaurada

### Stock
- ✅ `CREATE` (StockItem) - Item de stock creado
- ✅ `UPDATE` (StockItem) - Item de stock actualizado
- ✅ `DELETE` (StockItem) - Item de stock eliminado
- ✅ `ADJUST` (StockItem) - Stock ajustado
- ✅ `RESTORE` (StockItem) - Item restaurado

### Items (Catálogo)
- ✅ `CREATE` (Item) - Item creado
- ✅ `UPDATE` (Item) - Item actualizado
- ✅ `DELETE` (Item) - Item eliminado

### Folders
- ✅ `CREATE` (Folder) - Carpeta creada
- ✅ `DELETE` (Folder) - Carpeta eliminada

---

## 🔒 Seguridad

### 1. Multi-tenant Isolation

**CRÍTICO**: Todos los queries incluyen `organizationId`:

```typescript
const where: Prisma.AuditLogWhereInput = {
  organizationId, // SIEMPRE presente
  // ... otros filtros
};
```

### 2. Acceso Restringido

- **Backend**: `@OwnerOnly()` guard en todos los endpoints
- **Frontend**: `RoleGuard` con `allowedRoles={[Role.OWNER]}`

### 3. Redacción de Datos Sensibles

Función `redactSensitiveData()` redacta automáticamente:
- `password`, `passwordHash`
- `token`, `accessToken`, `refreshToken`
- `authorization`, `authorizationHeader`
- `apiKey`, `secret`, `secretKey`
- `creditCard`, `cardNumber`, `cvv`
- `ssn`, `socialSecurityNumber`

### 4. Inmutabilidad

- ❌ **NO hay endpoints** para `UPDATE` o `DELETE` de audit logs
- ✅ Solo `CREATE` (automático) y `READ` (OWNER)

---

## ⚡ Performance

### 1. Índices Optimizados

```prisma
@@index([organizationId, createdAt])              // Query principal
@@index([organizationId, actorUserId, createdAt])  // Filtro por usuario
@@index([organizationId, actorRole, createdAt])    // Filtro por rol
@@index([organizationId, action, createdAt])      // Filtro por acción
@@index([organizationId, entityType, entityId])    // Búsqueda por entidad
@@index([requestId])                               // Búsqueda por request
@@index([actorEmail])                              // Búsqueda por email
@@index([ip])                                      // Búsqueda por IP
```

### 2. Fire-and-Forget

```typescript
async emit(event: AuditLogData): Promise<void> {
  try {
    // ... logging logic
  } catch (error) {
    // Nunca rompe el request principal
    this.logger.error(...);
  }
}
```

### 3. Modo Asíncrono (Opcional)

Si `WORKER_MODE=1` o `QUEUE_ENABLED=true`:
- Los eventos se envían a una queue (BullMQ)
- Un worker procesa los logs en background
- No bloquea el request principal

Si no hay queue disponible:
- Fallback a escritura directa (sincrónica pero fire-and-forget)

### 4. Paginación Eficiente

- `pageSize` máximo: **100** (hardened)
- Queries con `skip` y `take` optimizados
- `orderBy createdAt desc` para resultados recientes primero

---

## 🗑️ Retención

### Configuración

```bash
AUDIT_RETENTION_DAYS=365              # Días de retención (default: 365)
AUDIT_RETENTION_AUTO_CLEANUP=true    # Auto-cleanup habilitado
```

### Limpieza Automática

- **Frecuencia**: Diaria a las 2 AM
- **Acción**: Elimina logs más antiguos que `AUDIT_RETENTION_DAYS`
- **Logging**: Registra cantidad de logs eliminados

### Limpieza Manual

```typescript
const retentionService = ...;
const result = await retentionService.cleanup();
// { deleted: 1234, cutoffDate: Date }
```

---

## 🚨 Alertas

### Alertas Implementadas

1. **Excesivos Intentos de Login Fallidos**
   - Condición: >50 `LOGIN_FAILED` en 10 minutos (mismo usuario)
   - Severidad: `warn`
   - Acción: Registra evento de alerta en audit log

2. **Actividad Excesiva**
   - Condición: >100 eventos en 1 minuto (mismo actor)
   - Severidad: `warn`
   - Acción: Registra evento de alerta en audit log

### Configuración

```bash
AUDIT_ALERTS_ENABLED=true    # Habilitar monitoreo de alertas
```

### Monitoreo

- **Frecuencia**: Cada 5 minutos
- **Logging**: Alertas se registran como eventos de audit log
- **Futuro**: Integración con Slack/Webhook

---

## 📈 Escalabilidad Futura

### 1. Particionamiento (Sharding)

Para organizaciones grandes:
- Particionar `AuditLog` por `organizationId` o rango de fechas
- Usar tablas separadas por período (mensual/anual)

### 2. Archivo en Frío

- Mover logs antiguos a S3/Storage
- Mantener solo últimos N días en DB activa
- Endpoint para restaurar desde archivo

### 3. Streaming Real-time

- WebSockets para actualizaciones en tiempo real
- Server-Sent Events (SSE) para dashboard live

### 4. Análisis Avanzado

- Integración con herramientas de BI (Metabase, Looker)
- Exportación a data warehouse
- Machine learning para detección de anomalías

### 5. Integraciones

- **Slack**: Notificaciones de alertas críticas
- **Webhook**: Callbacks para eventos importantes
- **Email**: Reportes diarios/semanales

---

## 🔧 Variables de Entorno

```bash
# Retención
AUDIT_RETENTION_DAYS=365
AUDIT_RETENTION_AUTO_CLEANUP=true

# Alertas
AUDIT_ALERTS_ENABLED=true

# Modo de fallo
AUDIT_FAIL_MODE=OPEN  # OPEN: log error y continúa | CLOSED: throw error

# Modo asíncrono
WORKER_MODE=1
QUEUE_ENABLED=true
```

---

## 📝 Ejemplos de Uso

### Emitir Evento Manualmente

```typescript
await this.auditDomainEvents.emit({
  organizationId,
  actorUserId: userId,
  actorRole: role,
  actorEmail: user.email,
  requestId,
  action: AuditAction.CUSTOMER_CREATED,
  entityType: AuditEntityType.Customer,
  entityId: customer.id,
  before: null,
  after: { id: customer.id, name: customer.name },
  metadata: { method: 'POST', path: '/api/customers' },
  ip,
  userAgent,
  source: 'api',
  severity: 'info',
});
```

### Consultar Logs

```typescript
GET /api/audit-logs?page=1&pageSize=50&dateFrom=2024-01-01&actorRole=OWNER
```

### Exportar CSV

```typescript
GET /api/audit-logs/export?format=csv&dateFrom=2024-01-01&dateTo=2024-12-31
```

### Estadísticas

```typescript
GET /api/audit-logs/stats
```

---

## ✅ Checklist de Validación

- [x] Scoping obligatorio por `organizationId`
- [x] Redacción de datos sensibles
- [x] Validaciones (pageSize max 100, search min 3 chars)
- [x] Fallback a 90 días si no hay fechas
- [x] Protección OWNER en todos los endpoints
- [x] Instrumentación completa de eventos
- [x] Modo asíncrono opcional
- [x] Retención configurable
- [x] Alertas críticas
- [x] Exportación CSV
- [x] Estadísticas agregadas
- [x] UI completa con tabs y filtros

---

**Última actualización**: 2025-02-21
**Versión**: 1.0.0
