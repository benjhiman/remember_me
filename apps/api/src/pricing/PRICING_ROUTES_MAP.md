# Pricing Module - Complete Routes Map

## 📋 Endpoints Summary

**Total: 8 endpoints**

| # | Method | Route | Auth | Roles | Description |
|---|--------|-------|------|-------|-------------|
| 1 | GET | `/api/pricing/health` | ✅ | All | Health check |
| 2 | GET | `/api/pricing/rules` | ✅ | All | List pricing rules |
| 3 | GET | `/api/pricing/rules/:id` | ✅ | All | Get pricing rule |
| 4 | POST | `/api/pricing/rules` | ✅ | ADMIN, MANAGER, OWNER | Create pricing rule |
| 5 | PATCH | `/api/pricing/rules/:id` | ✅ | ADMIN, MANAGER, OWNER | Update pricing rule |
| 6 | DELETE | `/api/pricing/rules/:id` | ✅ | ADMIN, MANAGER, OWNER | Delete pricing rule |
| 7 | POST | `/api/pricing/compute` | ✅ | All | Compute price for one item |
| 8 | POST | `/api/pricing/compute-bulk` | ✅ | All | Compute prices for multiple items |
| 9 | POST | `/api/pricing/compute-sale` | ✅ | All | Compute prices for sale items |

---

## 🔒 Roles & Permissions

### ADMIN / MANAGER / OWNER
- ✅ **Full access** to all endpoints
- ✅ Can create/update/delete pricing rules
- ✅ Can compute prices

### SELLER
- ✅ Can view pricing rules (list, get)
- ✅ Can compute prices
- ❌ **Cannot** create/update/delete pricing rules

---

## 📝 Detailed Routes

### 1. Health Check
```
GET /api/pricing/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "pricing"
}
```

---

### 2. List Pricing Rules
```
GET /api/pricing/rules?page=1&limit=10&isActive=true&scopeType=GLOBAL&q=markup&sort=priority&order=desc
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)
- `q` (optional) - Search by name
- `isActive` (optional) - Filter by active status
- `scopeType` (optional) - GLOBAL, BY_PRODUCT, BY_CONDITION, BY_CATEGORY
- `sort` (optional) - priority, createdAt (default: priority)
- `order` (optional) - asc, desc (default: desc)

**Response:**
```json
{
  "data": [
    {
      "id": "rule-123",
      "organizationId": "org-123",
      "name": "Global 20% Markup",
      "priority": 10,
      "isActive": true,
      "ruleType": "MARKUP_PERCENT",
      "scopeType": "GLOBAL",
      "matchers": {},
      "value": "20.00",
      "currency": "USD",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 3. Get Pricing Rule
```
GET /api/pricing/rules/:id
Authorization: Bearer <token>
```

**Response:** Pricing rule object (same format as in list)

---

### 4. Create Pricing Rule
```
POST /api/pricing/rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "iPhone 15 Pro Override",
  "priority": 50,
  "isActive": true,
  "ruleType": "OVERRIDE_PRICE",
  "scopeType": "BY_PRODUCT",
  "matchers": {
    "model": "iPhone 15 Pro 256GB"
  },
  "value": 1500,
  "currency": "USD"
}
```

**Rule Types:**
- `MARKUP_PERCENT` - Percentage markup (value: 20 = 20%)
- `MARKUP_FIXED` - Fixed amount markup (value: 100 = +$100)
- `OVERRIDE_PRICE` - Override to specific price (value: 1500 = $1500)

**Scope Types:**
- `GLOBAL` - Applies to all items (matchers optional)
- `BY_PRODUCT` - Match by model (matchers.model required)
- `BY_CONDITION` - Match by condition (matchers.condition required)
- `BY_CATEGORY` - Match by category (not implemented in StockItem yet)

**Matchers:**
- `model` - Product model name
- `condition` - NEW, USED, REFURBISHED
- `storage` - Storage capacity
- `color` - Color variant

**Response:** Created pricing rule

---

### 5. Update Pricing Rule
```
PATCH /api/pricing/rules/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Rule Name",
  "priority": 25,
  "isActive": false,
  "value": 25
}
```

**Response:** Updated pricing rule

---

### 6. Delete Pricing Rule
```
DELETE /api/pricing/rules/:id
Authorization: Bearer <token>
```

**Response:** 204 No Content

---

### 7. Compute Price
```
POST /api/pricing/compute
Authorization: Bearer <token>
Content-Type: application/json

{
  "stockItemId": "item-123",
  "baseCost": 1000,
  "context": {
    "customerType": "vip"
  }
}
```

**Body Parameters:**
- `stockItemId` (required) - Stock item ID
- `baseCost` (optional) - Override basePrice from StockItem
- `context` (optional) - Customer context (for future use)

**Response:**
```json
{
  "stockItemId": "item-123",
  "basePrice": "1000.00",
  "finalPrice": "1200.00",
  "appliedRule": {
    "id": "rule-123",
    "name": "Global 20% Markup"
  }
}
```

**Notes:**
- Returns basePrice and finalPrice
- Shows which rule was applied (if any)
- Uses highest priority matching rule
- If no rules match, returns basePrice as finalPrice

---

### 8. Compute Bulk
```
POST /api/pricing/compute-bulk
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "stockItemId": "item-1",
      "baseCost": 1000
    },
    {
      "stockItemId": "item-2",
      "baseCost": 800
    }
  ],
  "context": {
    "customerType": "vip"
  }
}
```

**Response:**
```json
{
  "results": [
    {
      "stockItemId": "item-1",
      "basePrice": "1000.00",
      "finalPrice": "1200.00",
      "appliedRule": {
        "id": "rule-123",
        "name": "Global 20% Markup"
      }
    },
    {
      "stockItemId": "item-2",
      "basePrice": "800.00",
      "finalPrice": "960.00",
      "appliedRule": {
        "id": "rule-123",
        "name": "Global 20% Markup"
      }
    }
  ]
}
```

---

### 9. Compute Sale
```
POST /api/pricing/compute-sale
Authorization: Bearer <token>
Content-Type: application/json

{
  "saleId": "sale-123"
}
```

**Response:**
```json
{
  "saleId": "sale-123",
  "saleNumber": "SALE-2024-001",
  "items": [
    {
      "saleItemId": "item-1",
      "stockItemId": "stock-1",
      "model": "iPhone 15 Pro 256GB",
      "quantity": 1,
      "unitPrice": "1000.00",
      "totalPrice": "1000.00",
      "computedPrice": "1200.00",
      "computedTotal": "1200.00",
      "appliedRule": {
        "id": "rule-123",
        "name": "Global 20% Markup"
      }
    }
  ],
  "currentSubtotal": "2000.00",
  "computedSubtotal": 2400,
  "discount": "0.00",
  "currentTotal": "2000.00",
  "computedTotal": 2400
}
```

**Notes:**
- Computes prices for all items in the sale
- Shows current vs computed prices
- Does NOT persist prices (preview only)
- Useful for frontend to show "suggested price"

---

## ⚠️ Important Notes

1. **Priority resolution** - Highest priority rule wins (if multiple match)
2. **Override stops processing** - OVERRIDE_PRICE rules stop further rule evaluation
3. **Stacking disabled by default** - Only highest priority rule is applied
4. **Multi-org strict** - All operations scoped to current organization
5. **SELLER can compute but not edit** - Sellers can view rules and compute prices, but cannot create/update/delete
6. **Base price source** - Uses StockItem.basePrice by default, can be overridden with baseCost parameter

---

## 🔄 Rule Evaluation Logic

1. Get all active rules for organization (ordered by priority desc)
2. Filter rules that match the item (by scopeType and matchers)
3. Apply highest priority matching rule:
   - `OVERRIDE_PRICE`: Return value directly
   - `MARKUP_PERCENT`: basePrice * (1 + value/100)
   - `MARKUP_FIXED`: basePrice + value
4. If no rules match, return basePrice

**Example:**
- Base price: $1000
- Rule 1 (priority 10): MARKUP_PERCENT 20% → $1200
- Rule 2 (priority 5): MARKUP_PERCENT 10% → $1100
- **Result: $1200** (Rule 1 wins due to higher priority)
