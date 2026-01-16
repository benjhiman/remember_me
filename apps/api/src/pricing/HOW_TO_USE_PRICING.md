# How to Use Pricing API

## 🚀 Quick Start

### Authentication
All endpoints require authentication:
```http
Authorization: Bearer <your-access-token>
```

Get your token from `/api/auth/login` or `/api/auth/select-organization`.

---

## 📋 Creating Pricing Rules

Only **ADMIN**, **MANAGER**, or **OWNER** can create, update, or delete pricing rules. **SELLER** can only view rules and compute prices.

### Rule Types

1. **MARKUP_PERCENT** - Apply a percentage markup
   - Example: value = 20 → 20% markup
   - Formula: `finalPrice = basePrice * (1 + value/100)`

2. **MARKUP_FIXED** - Add a fixed amount
   - Example: value = 100 → add $100
   - Formula: `finalPrice = basePrice + value`

3. **OVERRIDE_PRICE** - Set a fixed price (overrides base price)
   - Example: value = 1500 → price is always $1500
   - Formula: `finalPrice = value`

### Scope Types

1. **GLOBAL** - Applies to all items
   - Use when the rule should apply universally
   - Matchers are optional

2. **BY_PRODUCT** - Match by model/product
   - Use matchers.model to specify which product
   - Example: `{ "model": "iPhone 15 Pro 256GB" }`

3. **BY_CONDITION** - Match by condition (NEW, USED, REFURBISHED)
   - Use matchers.condition
   - Example: `{ "condition": "USED" }`

4. **BY_CATEGORY** - Match by category (not implemented in StockItem yet)

### Priority

- **Higher priority wins** when multiple rules match
- Priority is a number (higher = more priority)
- Example: Priority 50 beats Priority 10

---

## 💡 Examples

### Example 1: Global 20% Markup

```http
POST /api/pricing/rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Global 20% Markup",
  "priority": 10,
  "isActive": true,
  "ruleType": "MARKUP_PERCENT",
  "scopeType": "GLOBAL",
  "matchers": {},
  "value": 20,
  "currency": "USD"
}
```

**Effect:** All items get a 20% markup on their base price.

---

### Example 2: Override Price for Specific Product

```http
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

**Effect:** iPhone 15 Pro 256GB is always priced at $1500, regardless of base price.

---

### Example 3: Fixed Markup for Used Items

```http
POST /api/pricing/rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Used Items Fixed Markup",
  "priority": 30,
  "isActive": true,
  "ruleType": "MARKUP_FIXED",
  "scopeType": "BY_CONDITION",
  "matchers": {
    "condition": "USED"
  },
  "value": 50,
  "currency": "USD"
}
```

**Effect:** All USED items get an additional $50 on top of their base price.

---

## 🧮 Computing Prices

### Compute Price for One Item

```http
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
- `baseCost` is optional - if not provided, uses StockItem.basePrice
- `context` is optional - for future customer-specific pricing
- Returns which rule was applied (if any)

---

### Compute Prices for Multiple Items (Bulk)

```http
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

### Compute Prices for Sale (Preview)

Use this to see what prices would be if pricing rules were applied to a sale:

```http
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
- Shows current prices vs computed prices
- Does NOT persist prices (preview only)
- Useful for frontend to show "suggested price"

---

## 📊 Listing and Managing Rules

### List Rules

```http
GET /api/pricing/rules?page=1&limit=10&isActive=true&scopeType=GLOBAL&q=markup
Authorization: Bearer <token>
```

**Filters:**
- `isActive` - true/false
- `scopeType` - GLOBAL, BY_PRODUCT, BY_CONDITION, BY_CATEGORY
- `q` - Search by name
- `sort` - priority, createdAt (default: priority)
- `order` - asc, desc (default: desc)

---

### Get Rule

```http
GET /api/pricing/rules/:id
Authorization: Bearer <token>
```

---

### Update Rule

```http
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

---

### Delete Rule

```http
DELETE /api/pricing/rules/:id
Authorization: Bearer <token>
```

---

## ⚠️ Important Rules

1. **Priority Resolution** - Highest priority rule wins when multiple match
2. **Override Stops Processing** - OVERRIDE_PRICE rules stop further evaluation
3. **Stacking Disabled** - Only highest priority rule is applied (stacking may be added in future)
4. **Multi-org Strict** - All rules are scoped to current organization
5. **SELLER Permissions** - Can view rules and compute prices, but cannot create/update/delete

---

## 🔄 Rule Evaluation Flow

1. Get all active rules for organization (ordered by priority desc)
2. Filter rules that match the item (by scopeType and matchers)
3. Apply highest priority matching rule:
   - `OVERRIDE_PRICE`: Return value directly
   - `MARKUP_PERCENT`: basePrice * (1 + value/100)
   - `MARKUP_FIXED`: basePrice + value
4. If no rules match, return basePrice

---

## 💡 Common Patterns

### Pattern 1: Global Markup with Product Override

1. Create global markup (lower priority):
   ```json
   {
     "name": "Global 20% Markup",
     "priority": 10,
     "ruleType": "MARKUP_PERCENT",
     "scopeType": "GLOBAL",
     "value": 20
   }
   ```

2. Create product override (higher priority):
   ```json
   {
     "name": "iPhone 15 Pro Override",
     "priority": 50,
     "ruleType": "OVERRIDE_PRICE",
     "scopeType": "BY_PRODUCT",
     "matchers": { "model": "iPhone 15 Pro 256GB" },
     "value": 1500
   }
   ```

**Result:** Most items get 20% markup, but iPhone 15 Pro 256GB is always $1500.

---

### Pattern 2: Condition-Based Pricing

```json
{
  "name": "Used Items Discount",
  "priority": 30,
  "ruleType": "MARKUP_PERCENT",
  "scopeType": "BY_CONDITION",
  "matchers": { "condition": "USED" },
  "value": 10
}
```

**Result:** USED items get only 10% markup (instead of global 20%).

---

## 🚨 Error Handling

### Common Errors

#### 403 Forbidden
**Cause:** SELLER trying to create/update/delete rules
**Solution:** Only admins/managers can manage rules

#### 404 Not Found
**Cause:** Rule or stock item not found
**Response:**
```json
{
  "statusCode": 404,
  "message": "Pricing rule not found"
}
```

---

## ✅ Best Practices

1. **Use meaningful priorities** - Higher numbers for more important rules
2. **Start with GLOBAL rules** - Set base markup first
3. **Add specific overrides** - Use higher priority for specific products/conditions
4. **Test compute-sale** - Always preview prices before applying to sales
5. **Keep rules organized** - Use descriptive names
6. **Multi-org isolation** - Each organization's rules are completely separate
