# Dashboard Module - Complete Routes Map

## 📋 Endpoints Summary

**Total: 5 endpoints**

| # | Method | Route | Auth | Roles | Description |
|---|--------|-------|------|-------|-------------|
| 1 | GET | `/api/dashboard/health` | ✅ | All | Health check |
| 2 | GET | `/api/dashboard/overview` | ✅ | All | Overview KPIs (all modules) |
| 3 | GET | `/api/dashboard/leads` | ✅ | All | Leads dashboard data |
| 4 | GET | `/api/dashboard/sales` | ✅ | All | Sales dashboard data |
| 5 | GET | `/api/dashboard/stock` | ✅ | All | Stock dashboard data |

---

## 🔒 Roles & Permissions

### ADMIN / MANAGER / OWNER
- ✅ **Full access** to all dashboard endpoints
- ✅ Can view all metrics and data

### SELLER
- ✅ Can view dashboard data
- ✅ All metrics are scoped to their organization
- ✅ No sensitive data exposure (metrics are aggregated)

**Note:** All endpoints respect multi-organization filtering automatically.

---

## 📝 Common Query Parameters

All dashboard endpoints support these query parameters:

- `from` (optional) - ISO date string - Start date for filtering
- `to` (optional) - ISO date string - End date for filtering
- `tz` (optional) - Timezone string - Timezone for date calculations
- `groupBy` (optional) - `day`, `week`, `month` - Period grouping for series (default: `day`)
- `compare` (optional) - `true`, `false` - Compare with previous period (not implemented in MVP)
- `threshold` (optional, stock only) - Number - Threshold for low stock alerts (default: 5)

---

## 📝 Detailed Routes

### 1. Health Check
```
GET /api/dashboard/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "dashboard"
}
```

---

### 2. Overview
```
GET /api/dashboard/overview?from=2024-01-01&to=2024-12-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "totalLeads": 150,
  "leadsByStage": [
    {
      "stageId": "stage-123",
      "stageName": "New",
      "stageColor": "#94a3b8",
      "count": 50
    },
    {
      "stageId": "stage-456",
      "stageName": "Contacted",
      "stageColor": "#3b82f6",
      "count": 30
    }
  ],
  "totalSales": 75,
  "salesByStatus": [
    {
      "status": "PAID",
      "count": 40
    },
    {
      "status": "RESERVED",
      "count": 20
    },
    {
      "status": "SHIPPED",
      "count": 10
    },
    {
      "status": "DELIVERED",
      "count": 5
    }
  ],
  "revenue": "50000.00",
  "stockAvailableCount": 100,
  "stockReservedCount": 10,
  "stockSoldCount": 20,
  "topProductsByVolume": [
    {
      "model": "iPhone 15 Pro 256GB",
      "quantitySold": 25,
      "salesCount": 20
    },
    {
      "model": "iPhone 14 128GB",
      "quantitySold": 15,
      "salesCount": 12
    }
  ]
}
```

**KPIs:**
- `totalLeads` - Total number of leads (filtered by date if provided)
- `leadsByStage` - Top 10 stages by lead count
- `totalSales` - Total number of sales (filtered by date if provided)
- `salesByStatus` - Sales count grouped by status
- `revenue` - Sum of SaleItem.totalPrice (filtered by date if provided)
- `stockAvailableCount` - Count of stock items with AVAILABLE status
- `stockReservedCount` - Count of stock items with RESERVED status
- `stockSoldCount` - Count of stock items with SOLD status
- `topProductsByVolume` - Top 10 products by quantity sold

---

### 3. Leads Dashboard
```
GET /api/dashboard/leads?from=2024-01-01&to=2024-12-31&groupBy=week
Authorization: Bearer <token>
```

**Response:**
```json
{
  "series": [
    {
      "period": "2024-01-01T00:00:00.000Z",
      "count": 10
    },
    {
      "period": "2024-01-08T00:00:00.000Z",
      "count": 15
    },
    {
      "period": "2024-01-15T00:00:00.000Z",
      "count": 20
    }
  ],
  "breakdown": [
    {
      "stageId": "stage-123",
      "stageName": "New",
      "stageColor": "#94a3b8",
      "count": 50
    },
    {
      "stageId": "stage-456",
      "stageName": "Contacted",
      "stageColor": "#3b82f6",
      "count": 30
    }
  ],
  "assignedLeadsCount": [
    {
      "userId": "user-123",
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "count": 25
    },
    {
      "userId": "user-456",
      "userName": "Jane Smith",
      "userEmail": "jane@example.com",
      "count": 15
    }
  ]
}
```

**Data:**
- `series` - Leads created over time (grouped by day/week/month)
- `breakdown` - Leads count by stage
- `assignedLeadsCount` - Top 10 users by assigned leads count

---

### 4. Sales Dashboard
```
GET /api/dashboard/sales?from=2024-01-01&to=2024-12-31&groupBy=month
Authorization: Bearer <token>
```

**Response:**
```json
{
  "salesCreated": [
    {
      "period": "2024-01-01T00:00:00.000Z",
      "count": 10
    },
    {
      "period": "2024-02-01T00:00:00.000Z",
      "count": 15
    }
  ],
  "revenue": [
    {
      "period": "2024-01-01T00:00:00.000Z",
      "revenue": "12000.00"
    },
    {
      "period": "2024-02-01T00:00:00.000Z",
      "revenue": "18000.00"
    }
  ],
  "breakdown": [
    {
      "status": "PAID",
      "count": 40
    },
    {
      "status": "RESERVED",
      "count": 20
    }
  ],
  "topCustomers": [
    {
      "customerName": "John Doe",
      "salesCount": 5,
      "totalSpent": "15000.00"
    },
    {
      "customerName": "Jane Smith",
      "salesCount": 3,
      "totalSpent": "9000.00"
    }
  ]
}
```

**Data:**
- `salesCreated` - Sales count over time (grouped by day/week/month)
- `revenue` - Revenue over time (sum of SaleItem.totalPrice, grouped by day/week/month)
- `breakdown` - Sales count by status
- `topCustomers` - Top 10 customers by total spent

**Note:** Revenue is calculated from SaleItem.totalPrice. If pricing rules are applied but not persisted, revenue reflects the prices stored in SaleItem.

---

### 5. Stock Dashboard
```
GET /api/dashboard/stock?from=2024-01-01&to=2024-12-31&groupBy=day&threshold=5
Authorization: Bearer <token>
```

**Response:**
```json
{
  "breakdown": [
    {
      "status": "AVAILABLE",
      "count": 100,
      "totalQuantity": 500
    },
    {
      "status": "RESERVED",
      "count": 10,
      "totalQuantity": 10
    },
    {
      "status": "SOLD",
      "count": 20,
      "totalQuantity": 20
    }
  ],
  "movements": [
    {
      "period": "2024-01-01T00:00:00.000Z",
      "IN": 10,
      "OUT": 5,
      "RESERVE": 3,
      "RELEASE": 1,
      "SOLD": 2,
      "ADJUST": 1
    },
    {
      "period": "2024-01-02T00:00:00.000Z",
      "IN": 15,
      "OUT": 8,
      "SOLD": 5
    }
  ],
  "lowStock": [
    {
      "id": "item-123",
      "model": "iPhone 15 Pro 256GB",
      "quantity": 2,
      "status": "AVAILABLE",
      "location": "Warehouse A"
    },
    {
      "id": "item-456",
      "model": "iPhone 14 128GB",
      "quantity": 3,
      "status": "AVAILABLE",
      "location": "Warehouse B"
    }
  ]
}
```

**Data:**
- `breakdown` - Stock count and total quantity by status
- `movements` - Stock movements over time (grouped by type: IN, OUT, RESERVE, RELEASE, SOLD, ADJUST)
- `lowStock` - Items with quantity <= threshold (default: 5), excluding SOLD items (max 50 items)

---

## ⚠️ Important Notes

1. **Multi-org strict** - All queries are filtered by current organization
2. **Date filtering** - All endpoints support `from` and `to` parameters (ISO date strings)
3. **Grouping** - Series data can be grouped by `day`, `week`, or `month`
4. **Revenue calculation** - Revenue is calculated from SaleItem.totalPrice (persisted prices)
5. **Performance** - Uses Prisma aggregate/groupBy and raw SQL queries for date truncation
6. **Pagination** - Top lists are limited (10-50 items) for performance
7. **SELLER access** - Sellers can view all dashboard metrics (aggregated data only)

---

## 📊 Date Filtering Examples

### Last 30 days
```
GET /api/dashboard/overview?from=2024-01-01&to=2024-01-31
```

### Current month (weekly grouping)
```
GET /api/dashboard/sales?from=2024-01-01&to=2024-01-31&groupBy=week
```

### Year to date (monthly grouping)
```
GET /api/dashboard/overview?from=2024-01-01&to=2024-12-31&groupBy=month
```

---

## 🔄 Data Aggregation

**Series Data:**
- Uses PostgreSQL `DATE_TRUNC` for grouping
- Returns period and count/revenue for each period
- Ordered chronologically (ASC)

**Breakdown Data:**
- Uses Prisma `groupBy` for aggregation
- Returns counts grouped by dimension (stage, status, etc.)

**Top Lists:**
- Limited to top N items (10-50)
- Ordered by relevant metric (count, revenue, quantity)
