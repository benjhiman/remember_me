# How to Use Stock API

## 🚀 Quick Start

### Authentication
All endpoints require authentication:
```http
Authorization: Bearer <your-access-token>
```

Get your token from `/api/auth/login` or `/api/auth/select-organization`.

---

## 📦 Stock Items

### Creating Stock Items

#### Unit Item (with IMEI)
For individual items with unique IMEI:
```json
POST /api/stock
{
  "model": "iPhone 15 Pro 256GB",
  "storage": "256GB",
  "color": "Natural Titanium",
  "condition": "NEW",
  "imei": "123456789012345",
  "quantity": 1,  // Must be 1 for IMEI items
  "costPrice": 1000.00,
  "basePrice": 1200.00,
  "location": "Almacén Principal"
}
```

#### Batch Item (without IMEI)
For bulk items without individual tracking:
```json
POST /api/stock
{
  "model": "iPhone 15 Pro 256GB",
  "storage": "256GB",
  "color": "Natural Titanium",
  "condition": "NEW",
  "quantity": 10,  // Can be > 1
  "costPrice": 1000.00,
  "basePrice": 1200.00,
  "location": "Almacén Principal"
}
```

**Important:**
- Items with IMEI: `quantity` must be 1
- Items without IMEI: `quantity` can be any positive integer
- Creates initial `IN` movement automatically

---

### Adjusting Stock

To manually adjust stock quantity (increase or decrease):
```json
POST /api/stock/:id/adjust
{
  "quantityChange": 5,  // Positive = increase, Negative = decrease
  "reason": "Inventory count correction"
}
```

**Examples:**
- Increase: `"quantityChange": 5` → Adds 5 to current quantity
- Decrease: `"quantityChange": -3` → Subtracts 3 from current quantity
- **Cannot result in negative stock** → Throws error if would go below 0

---

## 🔒 Reservations

### Creating a Reservation

Reserve stock for a customer (does NOT decrease quantity yet):
```json
POST /api/stock/reservations
{
  "stockItemId": "item-123",
  "quantity": 3,
  "expiresAt": "2024-01-15T00:00:00.000Z",  // Optional
  "saleId": "sale-456",  // Optional, link to Sale
  "notes": "Reserved for customer John Doe"
}
```

**Important:**
- ✅ Creates reservation (status: ACTIVE)
- ✅ Stock quantity **does NOT change**
- ✅ Creates `RESERVE` movement for audit
- ✅ Uses transaction locking for concurrency safety

---

### Confirming a Reservation (Selling)

When customer pays, confirm the reservation:
```json
POST /api/stock/reservations/:id/confirm
```

**What happens:**
1. Reservation status → `CONFIRMED`
2. Stock quantity decreases by reservation quantity
3. If item has IMEI and quantity becomes 0 → status becomes `SOLD`
4. Creates `SOLD` movement

**Example:**
- Item has quantity: 10
- Reservation quantity: 3
- After confirm: quantity = 7
- If item has IMEI and quantity was 1 → quantity = 0, status = SOLD

---

### Releasing a Reservation (Canceling)

If customer cancels, release the reservation:
```json
POST /api/stock/reservations/:id/release
```

**What happens:**
1. Reservation status → `CANCELLED`
2. Stock quantity **does NOT change** (stays the same)
3. Creates `RELEASE` movement

---

## 🔍 Querying Stock

### List Stock Items
```
GET /api/stock?page=1&limit=20&status=AVAILABLE&model=iPhone&search=15
```

**Filters:**
- `status` - AVAILABLE, RESERVED, SOLD, DAMAGED, RETURNED, CANCELLED
- `condition` - NEW, USED, REFURBISHED
- `model` - Filter by model name
- `location` - Filter by location
- `search` - Search in model, sku, imei, serialNumber

### View Stock Movements (Audit Trail)
```
GET /api/stock/:id/movements?page=1&limit=50
```

Returns all movements (IN, OUT, RESERVE, RELEASE, ADJUST, SOLD) for an item.

---

## 💡 Common Patterns

### Pattern 1: Reserve → Confirm (Normal Sale)
```javascript
// 1. Reserve stock
const reservation = await fetch('/api/stock/reservations', {
  method: 'POST',
  body: JSON.stringify({
    stockItemId: 'item-123',
    quantity: 1,
    notes: 'Customer wants iPhone 15 Pro'
  })
});

// 2. Customer pays...
// 3. Confirm reservation (sells the stock)
await fetch(`/api/stock/reservations/${reservation.id}/confirm`, {
  method: 'POST'
});
```

### Pattern 2: Reserve → Release (Cancellation)
```javascript
// 1. Reserve stock
const reservation = await fetch('/api/stock/reservations', { ... });

// 2. Customer cancels...
// 3. Release reservation (stock becomes available again)
await fetch(`/api/stock/reservations/${reservation.id}/release`, {
  method: 'POST'
});
```

### Pattern 3: Manual Stock Adjustment
```javascript
// Found 5 more units during inventory count
await fetch('/api/stock/item-123/adjust', {
  method: 'POST',
  body: JSON.stringify({
    quantityChange: 5,
    reason: 'Inventory count - found 5 additional units'
  })
});

// Lost 2 units (damaged)
await fetch('/api/stock/item-123/adjust', {
  method: 'POST',
  body: JSON.stringify({
    quantityChange: -2,
    reason: 'Damaged during transport'
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
**Cause:** Insufficient permissions (e.g., SELLER trying to create stock item)
**Response:**
```json
{
  "statusCode": 403,
  "message": "Only admins and managers can create stock items"
}
```

#### 404 Not Found
**Cause:** Stock item or reservation not found (or belongs to another organization)
**Response:**
```json
{
  "statusCode": 404,
  "message": "Stock item not found"
}
```

#### 400 Bad Request

**Not enough stock available:**
```json
{
  "statusCode": 400,
  "message": "Not enough stock available. Available: 5, Requested: 10"
}
```

**Cannot adjust to negative stock:**
```json
{
  "statusCode": 400,
  "message": "Cannot adjust stock. Current quantity: 3, change: -5. Result would be negative."
}
```

**Item with IMEI must have quantity = 1:**
```json
{
  "statusCode": 400,
  "message": "Items with IMEI must have quantity = 1"
}
```

#### 409 Conflict

**IMEI already exists:**
```json
{
  "statusCode": 409,
  "message": "IMEI already exists"
}
```

---

## 📊 Stock States

### StockItem.status
- `AVAILABLE` - Available for reservation
- `RESERVED` - Reserved (legacy, not used with new reservation system)
- `SOLD` - Sold (quantity = 0 for IMEI items)
- `DAMAGED` - Damaged
- `RETURNED` - Returned
- `CANCELLED` - Cancelled

### ReservationStatus
- `ACTIVE` - Currently reserved
- `CONFIRMED` - Reservation confirmed (sold)
- `EXPIRED` - Reservation expired (future feature)
- `CANCELLED` - Reservation cancelled/released

---

## ✅ Best Practices

1. **Always check available quantity** before creating reservations
2. **Use reservations for temporary holds** (customer thinking, payment pending)
3. **Confirm reservations promptly** when payment is received
4. **Release reservations** if customer cancels
5. **Use adjustStock for manual corrections** (not for sales)
6. **Review movements regularly** for audit trail
7. **Multi-org isolation**: Each organization's stock is completely separate

---

## 🔗 Integration with Sales Module

When creating a Sale:
1. Create reservations for each stock item: `POST /api/stock/reservations`
2. Link reservations to sale using `saleId` field
3. When sale is paid: `POST /api/stock/reservations/:id/confirm`
4. If sale is cancelled: `POST /api/stock/reservations/:id/release`

Stock module handles all stock operations independently.

