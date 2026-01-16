# Soft Delete Documentation

## Overview

Soft delete is implemented across core entities to allow "deletion" without permanent data loss. Instead of removing records from the database, entities are marked with a `deletedAt` timestamp. This enables data recovery, audit trail preservation, and referential integrity.

---

## Entities with Soft Delete

The following entities support soft delete:

- **Lead** - CRM leads
- **StockItem** - Inventory items
- **Sale** - Sales transactions
- **PricingRule** - Pricing rules
- **Pipeline** - Sales pipelines
- **Stage** - Pipeline stages

---

## How Soft Delete Works

### Database Schema

All soft-deletable entities include a `deletedAt` field:

```prisma
model Lead {
  id            String    @id @default(cuid())
  // ... other fields
  deletedAt     DateTime? // Null = not deleted, Date = deleted
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Behavior

1. **DELETE operations** set `deletedAt` to the current timestamp (soft delete)
2. **List/GET operations** exclude records where `deletedAt IS NOT NULL` by default
3. **Restore operations** set `deletedAt` back to `null`
4. **Update operations** are blocked on soft-deleted entities
5. **Business operations** (assign, reserve, pay, etc.) are blocked on soft-deleted entities

---

## API Behavior

### List Endpoints

**Default Behavior**: Excludes soft-deleted records

```http
GET /api/leads
Authorization: Bearer <token>
```

**Response**: Only returns leads where `deletedAt IS NULL`

**Include Deleted (Admin/Manager/Owner only)**:

```http
GET /api/leads?includeDeleted=true
Authorization: Bearer <token>
```

**Response**: Returns all leads, including soft-deleted ones

**Permission Check**: 
- `includeDeleted=true` is ignored for non-admin roles (SELLER)
- Only ADMIN, MANAGER, OWNER can view deleted records

### GET Endpoints

**Default Behavior**: Returns 404 if entity is soft-deleted

```http
GET /api/leads/:id
Authorization: Bearer <token>
```

**Response 404**: If lead exists but `deletedAt IS NOT NULL`

### DELETE Endpoints

**Behavior**: Performs soft delete (sets `deletedAt`)

```http
DELETE /api/leads/:id
Authorization: Bearer <token>
```

**Response**: Returns the deleted entity with `deletedAt` set to current timestamp

**Permissions**: ADMIN, MANAGER, OWNER only

### Restore Endpoints

**Behavior**: Restores soft-deleted entity (sets `deletedAt = null`)

```http
PATCH /api/leads/:id/restore
Authorization: Bearer <token>
```

**Response**: Returns the restored entity with `deletedAt = null`

**Permissions**: ADMIN, MANAGER, OWNER only

**Status Codes**:
- `200 OK` - Entity restored successfully
- `404 Not Found` - Entity not found or not deleted
- `403 Forbidden` - User lacks permission

---

## Blocked Operations on Soft-Deleted Entities

The following operations are blocked on soft-deleted entities and return `400 Bad Request`:

### Leads
- ❌ `PATCH /api/leads/:id` - Update lead
- ❌ `POST /api/leads/:id/assign` - Assign lead
- ❌ `POST /api/leads/:id/notes` - Add note
- ❌ `POST /api/leads/:id/tasks` - Create task

### Stock Items
- ❌ `PUT /api/stock/items/:id` - Update stock item
- ❌ `POST /api/stock/items/:id/adjust` - Adjust stock
- ❌ `POST /api/stock/reservations` - Reserve stock (if item is deleted)

### Sales
- ❌ `PATCH /api/sales/:id` - Update sale
- ❌ `PATCH /api/sales/:id/pay` - Pay sale
- ❌ `PATCH /api/sales/:id/cancel` - Cancel sale
- ❌ `PATCH /api/sales/:id/ship` - Ship sale
- ❌ `PATCH /api/sales/:id/deliver` - Deliver sale

### Pricing Rules
- ❌ `PATCH /api/pricing/rules/:id` - Update rule
- ❌ Pricing computation automatically excludes deleted rules (no error, just ignored)

---

## Example Flows

### Delete and Restore Lead

```http
# 1. Delete lead (soft delete)
DELETE /api/leads/lead-123
Authorization: Bearer <token>

# Response 200
{
  "id": "lead-123",
  "name": "John Doe",
  "deletedAt": "2026-01-13T10:00:00Z",
  // ... other fields
}

# 2. Try to update (blocked)
PATCH /api/leads/lead-123
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}

# Response 400
{
  "statusCode": 400,
  "message": "Cannot update a deleted lead",
  "errorCode": "ENTITY_DELETED"
}

# 3. List leads (excluded by default)
GET /api/leads
Authorization: Bearer <token>

# Response: lead-123 is not in the list

# 4. List with includeDeleted (admin only)
GET /api/leads?includeDeleted=true
Authorization: Bearer <token>

# Response: lead-123 is included with deletedAt set

# 5. Restore lead
PATCH /api/leads/lead-123/restore
Authorization: Bearer <token>

# Response 200
{
  "id": "lead-123",
  "name": "John Doe",
  "deletedAt": null,
  // ... other fields
}

# 6. Update now works
PATCH /api/leads/lead-123
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}

# Response 200: Success
```

### Pricing Rules Exclusion

```http
# 1. Delete pricing rule
DELETE /api/pricing/rules/rule-123
Authorization: Bearer <token>

# 2. Compute price (deleted rule is ignored)
POST /api/pricing/compute
Authorization: Bearer <token>
Content-Type: application/json

{
  "stockItemId": "item-456"
}

# Response: Price computed without deleted rule-123
# No error, rule is simply excluded from computation
```

---

## Multi-Organization Isolation

Soft delete respects organization boundaries:

- Entities can only be soft-deleted within their organization
- `includeDeleted` only shows deleted entities from the current organization
- Restore operations verify organization membership

---

## Audit Log Integration

All soft delete and restore operations generate audit log entries:

- **DELETE action**: Logs entity state before deletion
- **RESTORE action**: Logs entity state after restoration

---

## Permissions Summary

| Operation | ADMIN | MANAGER | OWNER | SELLER |
|-----------|-------|---------|-------|--------|
| Soft delete | ✅ | ✅ | ✅ | ❌ |
| Restore | ✅ | ✅ | ✅ | ❌ |
| View deleted (`includeDeleted=true`) | ✅ | ✅ | ✅ | ❌ (ignored) |
| Perform operations on deleted | ❌ | ❌ | ❌ | ❌ |

---

## Implementation Details

### Service Layer

Services automatically:
1. Exclude `deletedAt IS NOT NULL` in list/get queries (unless `includeDeleted=true` and user is admin)
2. Check `deletedAt IS NULL` before allowing updates/business operations
3. Set `deletedAt = now()` on DELETE operations
4. Set `deletedAt = null` on RESTORE operations

### Database Queries

**List with soft delete exclusion (default)**:
```typescript
where: {
  organizationId: 'org-1',
  deletedAt: null, // Excludes soft-deleted
}
```

**List with soft delete inclusion (admin only)**:
```typescript
where: {
  organizationId: 'org-1',
  // deletedAt filter omitted to include all
}
```

**Check if entity is deleted**:
```typescript
const entity = await prisma.lead.findFirst({
  where: {
    id: 'lead-123',
    organizationId: 'org-1',
    deletedAt: null, // Only find if not deleted
  },
});
```

---

## Best Practices

1. **Always check `deletedAt`** before performing business operations
2. **Use `includeDeleted` sparingly** - only for admin operations
3. **Restore instead of recreating** - preserves relationships and audit trail
4. **Document restore workflows** - know when and why to restore
5. **Consider data retention policies** - eventually archive or permanently delete old soft-deleted records

---

## Error Messages

| Error | Status Code | Description |
|-------|-------------|-------------|
| `Cannot update a deleted {entity}` | 400 | Attempted to update soft-deleted entity |
| `Cannot {operation} a deleted {entity}` | 400 | Attempted business operation on soft-deleted entity |
| `Entity not found` | 404 | Entity doesn't exist or is soft-deleted (for GET) |
| `Cannot restore: entity is not deleted` | 400 | Attempted to restore non-deleted entity |

---

## Future Considerations

- **Permanent deletion**: Consider adding a permanent delete endpoint for compliance (GDPR right to be forgotten)
- **Auto-cleanup**: Consider automated cleanup of soft-deleted records older than X days
- **Cascade soft delete**: Consider soft-deleting related entities (e.g., soft-delete lead notes when lead is deleted)
- **Bulk restore**: Consider adding bulk restore endpoints for admin operations
