# How to Use Sales API

## 🚀 Quick Start

### Authentication
All endpoints require authentication:
```http
Authorization: Bearer <your-access-token>
```

Get your token from `/api/auth/login` or `/api/auth/select-organization`.

---

## 📦 Creating a Sale

### Step 1: Create Stock Reservations

First, you need to reserve stock items before creating a sale:

```http
POST /api/stock/reservations
Authorization: Bearer <token>
Content-Type: application/json

{
  "stockItemId": "item-123",
  "quantity": 1,
  "notes": "Reserved for sale"
}
```

Repeat for each item you want to include in the sale. Save the reservation IDs.

### Step 2: Create Sale from Reservations

Create the sale using the reservation IDs:

```http
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
  "notes": "Customer requested fast shipping"
}
```

**What happens:**
- Sale is created with status `RESERVED`
- Reservations are linked to the sale
- Totals are calculated from reservation stock items
- Sale number is auto-generated (e.g., "SALE-2024-001")

**Response:**
```json
{
  "id": "sale-123",
  "saleNumber": "SALE-2024-001",
  "status": "RESERVED",
  "customerName": "John Doe",
  "total": "2500.00",
  "items": [
    {
      "id": "item-1",
      "model": "iPhone 15 Pro 256GB",
      "quantity": 1,
      "unitPrice": "1200.00",
      "totalPrice": "1200.00"
    }
  ],
  "stockReservations": [
    {
      "id": "res-1",
      "status": "ACTIVE",
      "quantity": 1
    }
  ]
}
```

---

## 💰 Paying a Sale

When the customer pays, confirm the sale:

```http
PATCH /api/sales/:id/pay
Authorization: Bearer <token>
```

**What happens:**
1. All linked reservations are confirmed (status → `CONFIRMED`)
2. Stock quantity decreases for each reservation
3. Sale status changes to `PAID`
4. `paidAt` timestamp is set
5. StockMovements are created for audit trail

**Important:**
- Sale must be `RESERVED` to pay
- Uses transaction - if any reservation fails to confirm, entire operation rolls back
- Stock cannot go negative (validated in transaction)

---

## ❌ Canceling a Sale

If the customer cancels before paying:

```http
PATCH /api/sales/:id/cancel
Authorization: Bearer <token>
```

**What happens:**
1. All ACTIVE reservations are released (status → `CANCELLED`)
2. Sale status changes to `CANCELLED`
3. StockMovements are created
4. **Stock quantity does NOT change** (reservations are released, not confirmed)

**Important:**
- Cannot cancel if sale is `SHIPPED` or `DELIVERED`
- Only `RESERVED` or `PAID` sales can be cancelled

---

## 🚚 Shipping and Delivery

### Ship Sale
After payment, mark as shipped:

```http
PATCH /api/sales/:id/ship
Authorization: Bearer <token>
```

- Sale must be `PAID`
- Status changes to `SHIPPED`
- `shippedAt` timestamp is set

### Deliver Sale
When customer receives the item:

```http
PATCH /api/sales/:id/deliver
Authorization: Bearer <token>
```

- Sale must be `SHIPPED`
- Status changes to `DELIVERED`
- `deliveredAt` timestamp is set

---

## 📝 Updating Sale Information

Update customer information (only if not SHIPPED/DELIVERED):

```http
PATCH /api/sales/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "customerPhone": "+0987654321",
  "discount": 150,
  "notes": "Updated customer info"
}
```

**What can be updated:**
- Customer name, email, phone
- Discount (total is recalculated automatically)
- Notes
- Metadata

**What cannot be updated:**
- Sale status (use pay/cancel/ship/deliver endpoints)
- Items (sales are created from reservations)
- Cannot update if sale is `SHIPPED` or `DELIVERED`

---

## 🔍 Querying Sales

### List Sales with Filters

```http
GET /api/sales?page=1&limit=20&status=RESERVED&q=John&createdFrom=2024-01-01&createdTo=2024-12-31
Authorization: Bearer <token>
```

**Filters:**
- `status` - DRAFT, RESERVED, PAID, SHIPPED, DELIVERED, CANCELLED
- `q` - Search in saleNumber, customerName, customerEmail, customerPhone
- `createdById` - Filter by creator
- `createdFrom` / `createdTo` - Date range (ISO format)
- `sort` - createdAt, updatedAt (default: createdAt)
- `order` - asc, desc (default: desc)
- `page` / `limit` - Pagination

**Response:**
```json
{
  "data": [
    {
      "id": "sale-123",
      "saleNumber": "SALE-2024-001",
      "status": "RESERVED",
      "customerName": "John Doe",
      "total": "2500.00",
      "items": [...],
      "stockReservations": [...]
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### Get Single Sale

```http
GET /api/sales/:id
Authorization: Bearer <token>
```

Returns full sale details including items and reservations.

---

## 🗑️ Deleting a Sale

Only admins/managers can delete sales:

```http
DELETE /api/sales/:id
Authorization: Bearer <token>
```

**Rules:**
- Only `DRAFT` status sales can be deleted
- Cannot delete if sale has linked reservations
- Returns 204 No Content on success

---

## 💡 Common Patterns

### Pattern 1: Complete Sale Flow (Reserve → Create → Pay → Ship → Deliver)

```javascript
// 1. Reserve stock items
const reservation1 = await fetch('/api/stock/reservations', {
  method: 'POST',
  body: JSON.stringify({
    stockItemId: 'item-123',
    quantity: 1
  })
});
const res1 = await reservation1.json();

const reservation2 = await fetch('/api/stock/reservations', {
  method: 'POST',
  body: JSON.stringify({
    stockItemId: 'item-456',
    quantity: 2
  })
});
const res2 = await reservation2.json();

// 2. Create sale
const sale = await fetch('/api/sales', {
  method: 'POST',
  body: JSON.stringify({
    stockReservationIds: [res1.id, res2.id],
    customerName: 'John Doe',
    customerEmail: 'john@example.com'
  })
});
const saleData = await sale.json();

// 3. Customer pays
await fetch(`/api/sales/${saleData.id}/pay`, {
  method: 'PATCH'
});

// 4. Ship order
await fetch(`/api/sales/${saleData.id}/ship`, {
  method: 'PATCH'
});

// 5. Mark as delivered
await fetch(`/api/sales/${saleData.id}/deliver`, {
  method: 'PATCH'
});
```

### Pattern 2: Cancel Before Payment

```javascript
// 1. Create sale (same as Pattern 1)
const sale = await fetch('/api/sales', { ... });

// 2. Customer cancels before paying
await fetch(`/api/sales/${sale.id}/cancel`, {
  method: 'PATCH'
});

// Reservations are released, stock is unchanged
```

### Pattern 3: Update Customer Info

```javascript
// Update customer info while sale is RESERVED or PAID
await fetch(`/api/sales/${saleId}`, {
  method: 'PATCH',
  body: JSON.stringify({
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    discount: 150
  })
});
```

---

## 🚨 Error Handling

### Common Errors

#### 401 Unauthorized
**Cause:** Invalid or expired token
**Solution:** Re-authenticate

#### 403 Forbidden
**Cause:** Insufficient permissions (e.g., SELLER trying to access other user's sale)
**Response:**
```json
{
  "statusCode": 403,
  "message": "You do not have access to this sale"
}
```

#### 404 Not Found
**Cause:** Sale or reservation not found (or belongs to another organization)
**Response:**
```json
{
  "statusCode": 404,
  "message": "Sale not found"
}
```

#### 400 Bad Request

**Sale must be RESERVED to pay:**
```json
{
  "statusCode": 400,
  "message": "Sale must be RESERVED to pay. Current status: PAID"
}
```

**Cannot update SHIPPED/DELIVERED sale:**
```json
{
  "statusCode": 400,
  "message": "Cannot update sale that is SHIPPED or DELIVERED"
}
```

**Cannot cancel SHIPPED/DELIVERED sale:**
```json
{
  "statusCode": 400,
  "message": "Cannot cancel sale that is SHIPPED or DELIVERED"
}
```

**Reservations not ACTIVE:**
```json
{
  "statusCode": 400,
  "message": "Reservations res-1, res-2 are not ACTIVE"
}
```

**Reservation already linked to sale:**
```json
{
  "statusCode": 400,
  "message": "Reservations res-1 are already linked to a sale"
}
```

---

## 📊 Sale States

### SaleStatus Enum
- `DRAFT` - Draft sale (not used in current implementation, created as RESERVED)
- `RESERVED` - Sale created, reservations active, stock reserved
- `PAID` - Customer paid, reservations confirmed, stock decreased
- `SHIPPED` - Order shipped
- `DELIVERED` - Order delivered
- `CANCELLED` - Sale cancelled, reservations released

---

## ✅ Best Practices

1. **Always create reservations first** before creating a sale
2. **Pay sales promptly** after customer payment to update stock
3. **Cancel sales** if customer cancels before paying (releases stock)
4. **Update customer info** before shipping (cannot update after)
5. **Use filters** when listing sales for better performance
6. **Multi-org isolation**: Each organization's sales are completely separate

---

## 🔗 Integration with Stock Module

The Sales module depends on the Stock module for reservations:

1. **Create reservations** using Stock API: `POST /api/stock/reservations`
2. **Create sale** from reservations: `POST /api/sales` with `stockReservationIds`
3. **Pay sale** confirms reservations (stock decreases): `PATCH /api/sales/:id/pay`
4. **Cancel sale** releases reservations (stock unchanged): `PATCH /api/sales/:id/cancel`

Stock module handles all stock operations independently.
