# Sales Module - Complete Routes Map

## 📋 Endpoints Summary

**Total: 9 endpoints**

| # | Method | Route | Auth | Roles | Description |
|---|--------|-------|------|-------|-------------|
| 1 | GET | `/api/sales/health` | ✅ | All | Health check |
| 2 | GET | `/api/sales` | ✅ | All* | List sales |
| 3 | GET | `/api/sales/:id` | ✅ | All* | Get sale |
| 4 | POST | `/api/sales` | ✅ | All | Create sale from reservations |
| 5 | PATCH | `/api/sales/:id` | ✅ | All* | Update sale (customer fields) |
| 6 | PATCH | `/api/sales/:id/pay` | ✅ | All* | Pay sale (confirm reservations) |
| 7 | PATCH | `/api/sales/:id/cancel` | ✅ | All* | Cancel sale (release reservations) |
| 8 | PATCH | `/api/sales/:id/ship` | ✅ | All* | Ship sale |
| 9 | PATCH | `/api/sales/:id/deliver` | ✅ | All* | Deliver sale |
| 10 | DELETE | `/api/sales/:id` | ✅ | ADMIN, MANAGER, OWNER | Delete sale (only if DRAFT) |

*SELLER can only access sales they created or are assigned to.

---

## 🔒 Roles & Permissions

### ADMIN / MANAGER / OWNER
- ✅ **Full access** to all endpoints
- ✅ Can view all sales in organization
- ✅ Can create/update/pay/cancel/ship/deliver/delete sales
- ✅ Can update any sale

### SELLER
- ✅ Can create sales
- ✅ Can view/update/pay/cancel/ship/deliver sales they created or are assigned to
- ❌ **Cannot** view sales created/assigned to other users
- ❌ **Cannot** delete sales (only admins/managers)

---

## 📝 Detailed Routes

### 1. Health Check
```
GET /api/sales/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "sales"
}
```

---

### 2. List Sales
```
GET /api/sales?page=1&limit=10&status=RESERVED&q=John&createdFrom=2024-01-01&createdTo=2024-12-31&sort=createdAt&order=desc
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)
- `q` (optional) - Search in saleNumber, customerName, customerEmail, customerPhone
- `status` (optional) - DRAFT, RESERVED, PAID, SHIPPED, DELIVERED, CANCELLED
- `createdById` (optional) - Filter by creator
- `createdFrom` (optional) - ISO date string
- `createdTo` (optional) - ISO date string
- `sort` (optional) - createdAt, updatedAt (default: createdAt)
- `order` (optional) - asc, desc (default: desc)

**Response:**
```json
{
  "data": [
    {
      "id": "sale-123",
      "organizationId": "org-123",
      "createdById": "user-1",
      "assignedToId": "user-1",
      "saleNumber": "SALE-2024-001",
      "status": "RESERVED",
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "customerPhone": "+1234567890",
      "subtotal": "2600.00",
      "discount": "0.00",
      "total": "2600.00",
      "currency": "USD",
      "reservedAt": "2024-01-01T10:00:00.000Z",
      "paidAt": null,
      "shippedAt": null,
      "deliveredAt": null,
      "notes": "Demo sale",
      "metadata": {},
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z",
      "createdBy": {
        "id": "user-1",
        "name": "Sales Rep",
        "email": "sales@example.com"
      },
      "assignedTo": {
        "id": "user-1",
        "name": "Sales Rep",
        "email": "sales@example.com"
      },
      "items": [
        {
          "id": "item-1",
          "stockItemId": "stock-1",
          "model": "iPhone 15 Pro 256GB",
          "quantity": 1,
          "unitPrice": "1200.00",
          "totalPrice": "1200.00",
          "stockItem": {
            "id": "stock-1",
            "model": "iPhone 15 Pro 256GB",
            "sku": null,
            "imei": null
          }
        }
      ],
      "stockReservations": [
        {
          "id": "res-1",
          "stockItemId": "stock-1",
          "quantity": 1,
          "status": "ACTIVE",
          "stockItem": {
            "id": "stock-1",
            "model": "iPhone 15 Pro 256GB"
          }
        }
      ],
      "_count": {
        "items": 1,
        "stockReservations": 1
      }
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

### 3. Get Sale
```
GET /api/sales/:id
Authorization: Bearer <token>
```

**Response:** Same format as sale object in list response (full details)

---

### 4. Create Sale
```
POST /api/sales
Authorization: Bearer <token>
Content-Type: application/json

{
  "stockReservationIds": ["res-1", "res-2"],
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+1234567890",
  "discount": 100,
  "currency": "USD",
  "notes": "Customer requested fast shipping",
  "leadId": "lead-123",
  "metadata": {
    "source": "website"
  }
}
```

**Notes:**
- All reservations must exist, be ACTIVE, belong to organization, and not be linked to another sale
- Sale is created with status RESERVED
- Reservations are linked to the sale
- Totals are calculated from reservation stock items

**Response:** Created Sale with full details

---

### 5. Update Sale
```
PATCH /api/sales/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+0987654321",
  "discount": 150,
  "notes": "Updated customer info",
  "metadata": {
    "updatedReason": "Customer request"
  }
}
```

**Notes:**
- Cannot update if sale is SHIPPED or DELIVERED
- Discount changes automatically recalculate total
- Only customer fields and metadata can be updated (not status - use pay/cancel/ship/deliver endpoints)

**Response:** Updated Sale

---

### 6. Pay Sale
```
PATCH /api/sales/:id/pay
Authorization: Bearer <token>
```

**Notes:**
- Sale must be RESERVED
- All linked reservations are confirmed (stock quantity decreases)
- Sale status changes to PAID
- Creates StockMovements for each reservation confirmation
- Uses transaction with Serializable isolation level
- If any reservation confirmation fails, entire transaction rolls back

**Response:** Updated Sale (status: PAID, paidAt set)

---

### 7. Cancel Sale
```
PATCH /api/sales/:id/cancel
Authorization: Bearer <token>
```

**Notes:**
- Cannot cancel if sale is SHIPPED or DELIVERED
- All ACTIVE reservations are released (status → CANCELLED)
- Sale status changes to CANCELLED
- Creates StockMovements for each reservation release
- Stock quantity does NOT change (reservations are released, not confirmed)
- Uses transaction with Serializable isolation level

**Response:** Updated Sale (status: CANCELLED)

---

### 8. Ship Sale
```
PATCH /api/sales/:id/ship
Authorization: Bearer <token>
```

**Notes:**
- Sale must be PAID
- Sale status changes to SHIPPED
- shippedAt timestamp is set

**Response:** Updated Sale (status: SHIPPED, shippedAt set)

---

### 9. Deliver Sale
```
PATCH /api/sales/:id/deliver
Authorization: Bearer <token>
```

**Notes:**
- Sale must be SHIPPED
- Sale status changes to DELIVERED
- deliveredAt timestamp is set

**Response:** Updated Sale (status: DELIVERED, deliveredAt set)

---

### 10. Delete Sale
```
DELETE /api/sales/:id
Authorization: Bearer <token>
```

**Notes:**
- Only ADMIN/MANAGER/OWNER can delete
- Can only delete if status is DRAFT
- Cannot delete if sale has linked reservations
- Returns 204 No Content on success

---

## 🔄 Sale Status Flow

```
DRAFT → RESERVED → PAID → SHIPPED → DELIVERED
                  ↓
              CANCELLED (from RESERVED or PAID, not from SHIPPED/DELIVERED)
```

**State Transitions:**
- `createSale`: Creates sale with status RESERVED (from reservations)
- `paySale`: RESERVED → PAID (confirms reservations, decreases stock)
- `cancelSale`: RESERVED/PAID → CANCELLED (releases reservations, stock unchanged)
- `shipSale`: PAID → SHIPPED
- `deliverSale`: SHIPPED → DELIVERED
- `deleteSale`: Only if DRAFT (no reservations)

---

## ⚠️ Important Notes

1. **Sales are created from stock reservations** - Reservations must exist and be ACTIVE
2. **Pay confirms reservations** - Stock quantity decreases when sale is paid
3. **Cancel releases reservations** - Stock quantity does NOT change
4. **Multi-org strict** - All operations scoped to current organization
5. **SELLER access** - Can only access sales they created or are assigned to
6. **Transactions** - paySale and cancelSale use Serializable transactions for consistency
7. **Cannot update SHIPPED/DELIVERED** - Customer fields cannot be updated after shipping
8. **Cannot cancel SHIPPED/DELIVERED** - Sales cannot be cancelled after shipping

---

## 🔗 Integration with Stock Module

Sales module integrates with Stock module through reservations:

1. **Create reservations first:**
   ```
   POST /api/stock/reservations
   {
     "stockItemId": "item-1",
     "quantity": 1
   }
   ```

2. **Create sale from reservations:**
   ```
   POST /api/sales
   {
     "stockReservationIds": ["res-1", "res-2"],
     "customerName": "John Doe"
   }
   ```

3. **Pay sale (confirms reservations):**
   ```
   PATCH /api/sales/:id/pay
   ```

4. **Cancel sale (releases reservations):**
   ```
   PATCH /api/sales/:id/cancel
   ```

Stock module handles all stock operations independently.
