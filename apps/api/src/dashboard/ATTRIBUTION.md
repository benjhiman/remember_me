# Attribution & ROAS Dashboard

## Overview

This module provides end-to-end attribution tracking from Meta Lead Ads to paid Sales, enabling revenue attribution and ROAS (Return on Ad Spend) calculation.

## Attribution Flow

1. **Lead Creation** (Meta Lead Ads webhook)
   - Lead created with `META_ADS` tag
   - Attribution data stored in `customFields`:
     - `metaCampaignId`
     - `metaAdsetId`
     - `metaAdId`
     - `metaFormId`
     - `metaPageId`
     - `metaLeadgenId`

2. **Sale Payment** (`paySale()`)
   - When a Sale is marked as PAID, the system:
     - Resolves `leadId` from sale (or by customer phone/email)
     - Checks if lead has Meta Ads attribution data
     - Creates `MetaAttributionSnapshot` (idempotent, one per sale)

3. **Dashboard Metrics**
   - Aggregates attribution data by campaign/adset/ad
   - Calculates revenue, conversion rate, avg ticket
   - ROAS calculation (pending spend data)

## Data Model

### MetaAttributionSnapshot

```prisma
model MetaAttributionSnapshot {
  id             String            @id @default(cuid())
  organizationId String
  saleId         String            @unique
  leadId         String?
  source         AttributionSource @default(META_LEAD_ADS)
  campaignId     String?
  adsetId        String?
  adId           String?
  formId         String?
  pageId         String?
  leadgenId      String?
  createdAt      DateTime          @default(now())
}
```

**Key Features:**
- `saleId` is unique (idempotency-safe)
- Links to `Sale` and `Lead` (lead can be soft-deleted, snapshot remains)
- Indexed for fast queries by campaign/ad/organization

## API Endpoints

### Get Meta Attribution Metrics

```
GET /api/dashboard/attribution/meta
```

**Query Parameters:**
- `from` (optional): Start date (ISO 8601)
- `to` (optional): End date (ISO 8601)
- `groupBy` (required): `campaign` | `adset` | `ad` (default: `campaign`)
- `includeZeroRevenue` (optional): Include campaigns with no revenue (default: `false`)

**Response:**
```json
[
  {
    "campaignId": "campaign-123",
    "leadsCount": 50,
    "salesCount": 10,
    "revenue": 15000.00,
    "spend": 5000.00,
    "avgTicket": 1500.00,
    "conversionRate": 0.20,
    "roas": 3.0
  },
  {
    "adsetId": "adset-456",
    "leadsCount": 30,
    "salesCount": 8,
    "revenue": 12000.00,
    "spend": 4000.00,
    "avgTicket": 1500.00,
    "conversionRate": 0.27,
    "roas": 3.0
  }
]
```

**Metrics Explained:**
- `leadsCount`: Unique leads with attribution data
- `salesCount`: Number of PAID sales
- `revenue`: Sum of `sale.total` for PAID sales
- `spend`: Sum of `MetaSpendDaily.spend` for matching campaigns/adsets/ads
- `avgTicket`: Average revenue per sale (`revenue / salesCount`)
- `conversionRate`: `salesCount / leadsCount`
- `roas`: `revenue / spend` (null if spend = 0 or revenue = 0)

**Example Requests:**
```bash
# Group by campaign
curl -X GET "https://api.example.com/api/dashboard/attribution/meta?groupBy=campaign" \
  -H "Authorization: Bearer <token>" \
  -H "X-Organization-Id: org-123"

# Group by ad with date range
curl -X GET "https://api.example.com/api/dashboard/attribution/meta?groupBy=ad&from=2024-01-01&to=2024-01-31" \
  -H "Authorization: Bearer <token>" \
  -H "X-Organization-Id: org-123"

# Include zero revenue campaigns
curl -X GET "https://api.example.com/api/dashboard/attribution/meta?groupBy=campaign&includeZeroRevenue=true" \
  -H "Authorization: Bearer <token>" \
  -H "X-Organization-Id: org-123"
```

## Attribution Snapshot Creation

### When is a snapshot created?

A `MetaAttributionSnapshot` is created automatically when:
1. A Sale is marked as PAID (`paySale()`)
2. The Sale has a linked Lead (via `leadId` or resolved by phone/email)
3. The Lead has Meta Ads attribution data:
   - Has `META_ADS` tag, OR
   - Has `metaCampaignId` or `metaAdId` or `metaLeadgenId` in `customFields`

### Idempotency

- `saleId` is unique in `MetaAttributionSnapshot`
- If a snapshot already exists for a sale, it is not recreated
- Safe to call `paySale()` multiple times (e.g., retries)

### Lead Resolution

If `sale.leadId` is not set, the system attempts to resolve the lead by:
1. **Phone match**: Find most recent Lead with matching `customerPhone`
2. **Email match**: Find most recent Lead with matching `customerEmail`

If no lead is found, no snapshot is created.

### Soft Delete Handling

- If a Lead is soft-deleted (`deletedAt` is set), the snapshot remains
- `leadId` in snapshot is preserved (foreign key uses `onDelete: SetNull`)
- This ensures attribution data is not lost if a lead is deleted

## Multi-Organization Isolation

All queries are scoped by `organizationId`:
- Attribution snapshots are isolated per organization
- Dashboard metrics only show data for the requesting organization
- No cross-org data leakage

## ROAS Calculation

ROAS (Return on Ad Spend) = `Revenue / Spend`

**Current Status:**
- Revenue is tracked ✅
- Spend is tracked ✅ (via Meta Marketing API)
- ROAS is calculated in real-time ✅

**Implementation:**
- Daily spend is fetched from Meta Marketing API via `FETCH_META_SPEND` jobs
- Spend data is stored in `MetaSpendDaily` table
- ROAS is calculated as `revenue / spend` when both are > 0
- ROAS returns `null` if spend = 0 or revenue = 0

**See**: [Meta Spend Documentation](../integrations/META_SPEND.md) for setup and configuration.

## Example Use Cases

### 1. Campaign Performance Analysis
```bash
GET /api/dashboard/attribution/meta?groupBy=campaign&from=2024-01-01&to=2024-01-31
```

Returns revenue and conversion metrics per campaign, allowing you to:
- Identify top-performing campaigns
- Calculate ROI per campaign
- Optimize ad spend allocation

### 2. Ad-Level Optimization
```bash
GET /api/dashboard/attribution/meta?groupBy=ad&from=2024-01-01&to=2024-01-31
```

Returns metrics per ad, enabling:
- A/B testing analysis
- Creative performance comparison
- Ad-level budget optimization

### 3. Full Funnel Analysis
```bash
GET /api/dashboard/attribution/meta?groupBy=campaign&includeZeroRevenue=true
```

Includes campaigns with leads but no sales, showing:
- Full funnel conversion rates
- Campaigns that need optimization
- Lead quality by campaign

## Error Handling

### Attribution Snapshot Creation Failures
- If snapshot creation fails, `paySale()` continues
- Error is logged but does not block sale payment
- Ensures sale payment is not blocked by attribution issues

### Missing Attribution Data
- If a sale has no linked lead or lead has no Meta Ads data, no snapshot is created
- This is expected behavior (not all sales come from Meta Ads)

## Security

- All endpoints require authentication (`JwtAuthGuard`)
- Multi-org isolation enforced at database level
- Users can only access attribution data for their organization

## Related Documentation

- [Meta Lead Ads Integration](../integrations/META_LEAD_ADS.md)
- [Sales Module](../sales/SALES_ROUTES_MAP.md)
- [Dashboard Overview](./DASHBOARD_ROUTES_MAP.md)
