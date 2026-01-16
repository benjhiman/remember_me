# Audit Log Documentation

## Overview

The Audit Log system provides comprehensive tracking of all critical mutations (create, update, delete, restore) across the application. Every change to core entities is logged with before/after state, metadata, and request context.

---

## What Gets Audited

### Audited Entities

The following entities have audit logging enabled:

- **Lead** - All CRUD operations, assignments, notes, tasks
- **StockItem** - Creation, updates, deletions, stock adjustments, reservations
- **Sale** - Creation, payment, cancellation, shipping, delivery
- **PricingRule** - Creation, updates, deletions
- **Pipeline** - Creation, updates, deletions
- **Stage** - Creation, reordering, deletions
- **StockReservation** - Confirmation, release operations

### Audited Actions

| Action | Description | Entities |
|--------|-------------|----------|
| `CREATE` | Entity created | Lead, StockItem, Sale, PricingRule, Pipeline, Stage |
| `UPDATE` | Entity updated | Lead, StockItem, Sale, PricingRule, Pipeline, Stage |
| `DELETE` | Entity soft-deleted | Lead, StockItem, Sale, PricingRule, Pipeline, Stage |
| `RESTORE` | Entity restored from soft delete | Lead, StockItem, Sale, PricingRule, Pipeline, Stage |
| `ASSIGN` | Lead assigned to user | Lead |
| `RESERVE` | Stock reserved | StockReservation |
| `CONFIRM` | Reservation confirmed (sale completed) | StockReservation |
| `RELEASE` | Reservation released/cancelled | StockReservation |
| `ADJUST` | Stock quantity adjusted | StockItem |
| `PAY` | Sale marked as paid | Sale |
| `CANCEL` | Sale cancelled | Sale |
| `SHIP` | Sale shipped | Sale |
| `DELIVER` | Sale delivered | Sale |

---

## Audit Log Schema

The `AuditLog` model contains the following fields:

```prisma
model AuditLog {
  id            String   @id @default(cuid())
  organizationId String
  actorUserId   String?  // Nullable for public actions (rare)
  action        AuditAction
  entityType    AuditEntityType
  entityId      String
  beforeJson    Json?    // State before the change
  afterJson     Json?    // State after the change
  metadataJson  Json?    // Additional context (IP, userAgent, method, path, etc.)
  requestId     String?  // Request correlation ID
  createdAt     DateTime @default(now())

  @@index([organizationId, createdAt])
  @@index([entityType, entityId])
  @@index([actorUserId, createdAt])
}
```

### Field Descriptions

- **id**: Unique identifier for the audit log entry
- **organizationId**: Organization context (multi-tenant isolation)
- **actorUserId**: User who performed the action (nullable for public actions)
- **action**: Type of action performed (enum)
- **entityType**: Type of entity being modified (enum)
- **entityId**: ID of the entity being modified
- **beforeJson**: JSON snapshot of entity state before the change (null for CREATE)
- **afterJson**: JSON snapshot of entity state after the change (null for DELETE)
- **metadataJson**: Additional context:
  - `requestId`: Request correlation ID
  - `method`: HTTP method (GET, POST, PATCH, etc.)
  - `path`: API path
  - `ip`: Client IP address
  - `userAgent`: User agent string
  - Business-specific fields (e.g., `quantity`, `reservationIds`, `saleId`)
- **requestId**: Request correlation ID (also in metadata for easy querying)
- **createdAt**: Timestamp of the audit log entry

---

## Audit Fail Mode

The system supports two failure modes controlled by the `AUDIT_FAIL_MODE` environment variable:

### OPEN Mode (Development/Testing)

**Behavior**: If audit log write fails, the operation continues and an error is logged.

**Use Case**: Development and testing environments where audit logging is helpful but not critical.

**Configuration**: `AUDIT_FAIL_MODE=OPEN`

**Example**:
```typescript
// If audit log fails in OPEN mode:
// - Error logged to console/logger
// - Operation continues successfully
// - User receives normal response
```

### CLOSED Mode (Production/Compliance)

**Behavior**: If audit log write fails, the operation is aborted with a 500 error.

**Use Case**: Production environments with compliance requirements where audit logs are mandatory.

**Configuration**: `AUDIT_FAIL_MODE=CLOSED`

**Error Response**:
```json
{
  "statusCode": 500,
  "message": "Audit log operation failed",
  "errorCode": "AUDIT_LOG_FAILED",
  "requestId": "req-123",
  "timestamp": "2026-01-13T10:00:00Z"
}
```

---

## Example Audit Log Entries

### CREATE Action

```json
{
  "id": "audit-123",
  "organizationId": "org-1",
  "actorUserId": "user-1",
  "action": "CREATE",
  "entityType": "Lead",
  "entityId": "lead-456",
  "beforeJson": null,
  "afterJson": {
    "id": "lead-456",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "NEW",
    "pipelineId": "pipeline-1",
    "stageId": "stage-1"
  },
  "metadataJson": {
    "requestId": "req-789",
    "method": "POST",
    "path": "/api/leads",
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  },
  "requestId": "req-789",
  "createdAt": "2026-01-13T10:00:00Z"
}
```

### UPDATE Action

```json
{
  "id": "audit-124",
  "organizationId": "org-1",
  "actorUserId": "user-1",
  "action": "UPDATE",
  "entityType": "StockItem",
  "entityId": "item-789",
  "beforeJson": {
    "id": "item-789",
    "quantity": 10,
    "status": "AVAILABLE"
  },
  "afterJson": {
    "id": "item-789",
    "quantity": 15,
    "status": "AVAILABLE"
  },
  "metadataJson": {
    "requestId": "req-790",
    "method": "PUT",
    "path": "/api/stock/items/item-789",
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "updatedFields": ["quantity"]
  },
  "requestId": "req-790",
  "createdAt": "2026-01-13T10:05:00Z"
}
```

### PAY Action (Sale)

```json
{
  "id": "audit-125",
  "organizationId": "org-1",
  "actorUserId": "user-2",
  "action": "PAY",
  "entityType": "Sale",
  "entityId": "sale-123",
  "beforeJson": {
    "id": "sale-123",
    "status": "RESERVED",
    "paidAt": null
  },
  "afterJson": {
    "id": "sale-123",
    "status": "PAID",
    "paidAt": "2026-01-13T10:10:00Z"
  },
  "metadataJson": {
    "requestId": "req-791",
    "method": "PATCH",
    "path": "/api/sales/sale-123/pay",
    "ip": "192.168.1.2",
    "userAgent": "Mozilla/5.0...",
    "reservationIds": ["res-1", "res-2"]
  },
  "requestId": "req-791",
  "createdAt": "2026-01-13T10:10:00Z"
}
```

---

## Querying Audit Logs

### By Organization and Date Range

```typescript
const logs = await prisma.auditLog.findMany({
  where: {
    organizationId: 'org-1',
    createdAt: {
      gte: new Date('2026-01-01'),
      lte: new Date('2026-01-31'),
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

### By Entity

```typescript
const logs = await prisma.auditLog.findMany({
  where: {
    entityType: 'Lead',
    entityId: 'lead-456',
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

### By User

```typescript
const logs = await prisma.auditLog.findMany({
  where: {
    actorUserId: 'user-1',
    createdAt: {
      gte: new Date('2026-01-01'),
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

### By Request ID (Tracing)

```typescript
const logs = await prisma.auditLog.findMany({
  where: {
    requestId: 'req-789',
  },
  orderBy: {
    createdAt: 'asc',
  },
});
```

---

## Best Practices

1. **Always include requestId**: For request correlation and tracing
2. **Keep before/after minimal**: Only include relevant fields, not full entity snapshots
3. **No sensitive data**: Never log passwords, tokens, or PII unless required by compliance
4. **Metadata for context**: Include business-relevant fields (quantities, IDs, etc.)
5. **Use appropriate fail mode**: OPEN for dev/test, CLOSED for production

---

## Performance Considerations

- Audit logs are written asynchronously when possible
- Indexes are optimized for common query patterns (org+date, entity, user+date)
- Large metadata JSON fields may impact query performance
- Consider archiving old audit logs for compliance retention

---

## Security & Compliance

- Audit logs are immutable (no update/delete operations)
- All audit logs are scoped to organizations (multi-tenant isolation)
- Request IDs enable full request tracing for security investigations
- CLOSED mode ensures compliance with audit requirements

---

## Implementation Notes

- Audit logging is implemented at the service layer (not via interceptors) to capture accurate before/after states
- Each service method handles its own audit logging with appropriate error handling based on `AUDIT_FAIL_MODE`
- The `AuditLogService` provides a centralized logging interface used across all services
