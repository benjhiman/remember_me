# Stock Module - Complete Routes Map

## 📋 Endpoints Summary

**Total: 12 endpoints**

| # | Method | Route | Auth | Roles | Description |
|---|--------|-------|------|-------|-------------|
| 1 | GET | `/api/stock/health` | ✅ | All | Health check |
| 2 | GET | `/api/stock` | ✅ | All | List stock items |
| 3 | GET | `/api/stock/:id` | ✅ | All | Get stock item |
| 4 | POST | `/api/stock` | ✅ | ADMIN, MANAGER, OWNER | Create stock item |
| 5 | PUT | `/api/stock/:id` | ✅ | ADMIN, MANAGER, OWNER | Update stock item |
| 6 | DELETE | `/api/stock/:id` | ✅ | ADMIN, MANAGER, OWNER | Delete stock item |
| 7 | POST | `/api/stock/:id/adjust` | ✅ | ADMIN, MANAGER, OWNER | Adjust stock quantity |
| 8 | GET | `/api/stock/:id/movements` | ✅ | All | List stock movements |
| 9 | POST | `/api/stock/reservations` | ✅ | All | Create reservation |
| 10 | GET | `/api/stock/reservations` | ✅ | All | List reservations |
| 11 | GET | `/api/stock/reservations/:id` | ✅ | All | Get reservation |
| 12 | POST | `/api/stock/reservations/:id/release` | ✅ | All | Release reservation |
| 13 | POST | `/api/stock/reservations/:id/confirm` | ✅ | All | Confirm reservation (sell) |

---

## 🔒 Roles & Permissions

### ADMIN / MANAGER / OWNER
- ✅ **Full access** to all endpoints
- ✅ Can create/update/delete stock items
- ✅ Can adjust stock quantities
- ✅ Can create/reserve/confirm/release reservations

### SELLER
- ✅ Can view stock items
- ✅ Can create reservations
- ✅ Can release reservations
- ✅ Can confirm reservations (sell)
- ❌ **Cannot** create/update/delete stock items
- ❌ **Cannot** adjust stock quantities

---

## 📝 Detailed Routes

### 1. Health Check
```
GET /api/stock/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "stock"
}
```

---

### 2. List Stock Items
```
GET /api/stock?page=1&limit=10&status=AVAILABLE&model=iPhone&search=15
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)
- `search` (optional) - Search in model, sku, imei, serialNumber
- `status` (optional) - AVAILABLE, RESERVED, SOLD, DAMAGED, RETURNED, CANCELLED
- `condition` (optional) - NEW, USED, REFURBISHED
- `model` (optional) - Filter by model
- `location` (optional) - Filter by location

**Response:**
```json
{
  "data": [
    {
      "id": "item-123",
      "organizationId": "org-123",
      "sku": "IPHONE15PRO-256-NT",
      "model": "iPhone 15 Pro 256GB",
      "storage": "256GB",
      "color": "Natural Titanium",
      "condition": "NEW",
      "imei": "123456789012345",
      "serialNumber": "SN123456789",
      "quantity": 1,
      "costPrice": "1000.00",
      "basePrice": "1200.00",
      "status": "AVAILABLE",
      "location": "Almacén A",
      "notes": "Nuevo en caja",
      "metadata": {},
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### 3. Get Stock Item
```
GET /api/stock/:id
Authorization: Bearer <token>
```

**Response:** Same format as item in list response

---

### 4. Create Stock Item
```
POST /api/stock
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "iPhone 15 Pro 256GB",
  "storage": "256GB",
  "color": "Natural Titanium",
  "condition": "NEW",
  "imei": "123456789012345",  // Optional, if provided quantity must be 1
  "serialNumber": "SN123456789",
  "quantity": 1,  // Required, default 1. If IMEI provided, must be 1
  "costPrice": 1000.00,
  "basePrice": 1200.00,
  "status": "AVAILABLE",
  "location": "Almacén A",
  "notes": "Nuevo en caja",
  "metadata": {
    "supplier": "Apple"
  }
}
```

**Notes:**
- If `imei` is provided, `quantity` must be 1 (unit item)
- If `imei` is not provided, `quantity` can be > 1 (batch item)
- Creates initial `IN` movement automatically

**Response:** Created StockItem

---

### 5. Update Stock Item
```
PUT /api/stock/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "iPhone 15 Pro 256GB Updated",
  "location": "Almacén B",
  "notes": "Updated notes"
}
```

**Notes:**
- Cannot update `quantity` directly (use `/adjust` endpoint)
- Cannot set status to AVAILABLE if item is SOLD

**Response:** Updated StockItem

---

### 6. Delete Stock Item
```
DELETE /api/stock/:id
Authorization: Bearer <token>
```

**Notes:**
- Cannot delete if item has active reservations
- Returns 204 No Content on success

---

### 7. Adjust Stock
```
POST /api/stock/:id/adjust
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantityChange": 5,  // Can be positive or negative
  "reason": "Inventory adjustment - manual count",
  "metadata": {
    "adjustedBy": "admin-123"
  }
}
```

**Notes:**
- `quantityChange` can be positive (increase) or negative (decrease)
- **Never allows negative stock** - throws BadRequestException
- Creates `ADJUST` movement automatically

**Response:** Updated StockItem

---

### 8. List Stock Movements
```
GET /api/stock/:id/movements?page=1&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "mov-123",
      "organizationId": "org-123",
      "stockItemId": "item-123",
      "type": "IN",
      "quantity": 10,
      "quantityBefore": 0,
      "quantityAfter": 10,
      "reason": "Initial stock entry",
      "reservationId": null,
      "saleId": null,
      "createdById": "user-123",
      "metadata": {},
      "createdAt": "2024-01-01T00:00:00.000Z",
      "createdBy": {
        "id": "user-123",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**Movement Types:**
- `IN` - Initial entry
- `OUT` - Manual exit (future)
- `RESERVE` - Reservation created (quantity doesn't change)
- `RELEASE` - Reservation released (quantity doesn't change)
- `ADJUST` - Manual adjustment
- `SOLD` - Reservation confirmed/sold (quantity decreases)

---

### 9. Create Reservation
```
POST /api/stock/reservations
Authorization: Bearer <token>
Content-Type: application/json

{
  "stockItemId": "item-123",
  "quantity": 3,
  "expiresAt": "2024-01-15T00:00:00.000Z",  // Optional ISO date
  "saleId": "sale-456",  // Optional, link to Sale
  "notes": "Reserved for customer John Doe"
}
```

**Notes:**
- **Reserves stock but does NOT decrease quantity**
- Creates `RESERVE` movement (quantityBefore = quantityAfter)
- Checks available quantity (total quantity - active reservations)
- Uses transaction with locking for concurrency control
- Throws BadRequestException if not enough stock available

**Response:**
```json
{
  "id": "res-123",
  "organizationId": "org-123",
  "stockItemId": "item-123",
  "quantity": 3,
  "status": "ACTIVE",
  "expiresAt": "2024-01-15T00:00:00.000Z",
  "saleId": "sale-456",
  "createdById": "user-123",
  "notes": "Reserved for customer John Doe",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 10. List Reservations
```
GET /api/stock/reservations?itemId=item-123&status=ACTIVE&page=1&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `itemId` (optional) - Filter by stock item
- `status` (optional) - ACTIVE, CONFIRMED, EXPIRED, CANCELLED
- `page` (optional, default: 1)
- `limit` (optional, default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "res-123",
      "organizationId": "org-123",
      "stockItemId": "item-123",
      "quantity": 3,
      "status": "ACTIVE",
      "expiresAt": "2024-01-15T00:00:00.000Z",
      "saleId": null,
      "createdById": "user-123",
      "notes": "Reserved for customer",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "stockItem": {
        "id": "item-123",
        "model": "iPhone 15 Pro 256GB",
        "sku": "IPHONE15PRO-256-NT"
      },
      "createdBy": {
        "id": "user-123",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

---

### 11. Get Reservation
```
GET /api/stock/reservations/:id
Authorization: Bearer <token>
```

**Response:** Reservation object with full details (same format as in list)

---

### 12. Release Reservation
```
POST /api/stock/reservations/:id/release
Authorization: Bearer <token>
```

**Notes:**
- Changes reservation status to `CANCELLED`
- **Does NOT change stock quantity**
- Creates `RELEASE` movement
- Throws BadRequestException if reservation is not ACTIVE

**Response:** Updated reservation (status: CANCELLED)

---

### 13. Confirm Reservation (Sell)
```
POST /api/stock/reservations/:id/confirm
Authorization: Bearer <token>
```

**Notes:**
- Changes reservation status to `CONFIRMED`
- **Decrements stock quantity** by reservation quantity
- If item has IMEI and quantity becomes 0, sets status to `SOLD`
- Creates `SOLD` movement
- Throws BadRequestException if reservation is not ACTIVE
- Throws BadRequestException if confirmation would result in negative stock

**Response:** Updated reservation (status: CONFIRMED)

---

## 🔄 Stock Status Flow

```
AVAILABLE → [Reserve] → (Reservation ACTIVE, quantity unchanged)
                          ↓
                    [Confirm] → SOLD (quantity decreases)
                    [Release] → AVAILABLE (quantity unchanged)
```

---

## ⚠️ Important Notes

1. **Reservations do NOT decrease quantity** until confirmed
2. **Only confirmed reservations decrease quantity**
3. **Stock can never be negative** - validated in adjustStock and confirmReservation
4. **All operations create StockMovement** for audit trail
5. **Concurrency**: Reservations use transactions with locking to prevent race conditions
6. **Multi-org**: All operations are scoped to current organization

---

## 🔄 Integration with Sales Module

The Sales module should:
1. Call `POST /api/stock/reservations` to reserve stock
2. Call `POST /api/stock/reservations/:id/confirm` to confirm sale
3. Call `POST /api/stock/reservations/:id/release` to cancel sale

Stock module handles all stock operations independently.
