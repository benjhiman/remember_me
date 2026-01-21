# Meta Ads - Step 5: List Adsets by Campaign

## Endpoint

```
GET /api/integrations/meta/adsets
```

## Authentication

Requires:
- `Authorization: Bearer <accessToken>`
- `X-Organization-Id: <organization-id>`

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `campaignId` | string | **Yes** | - | Campaign ID to list adsets for |
| `from` | ISO date string | No | 30 days ago | Start date for insights (YYYY-MM-DD) |
| `to` | ISO date string | No | Today | End date for insights (YYYY-MM-DD) |
| `limit` | number | No | 25 | Number of adsets per page (max: 100) |
| `after` | string | No | - | Pagination cursor from previous response |

## Description

Lists adsets for a specific Meta campaign. Each adset includes basic information (id, name, status, budgets, dates) and aggregated insights (spend, impressions, clicks, CTR, CPC) for the specified date range.

## Request Examples

### Basic Request

```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/adsets?campaignId=123456789' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

### With Date Range

```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/adsets?campaignId=123456789&from=2024-01-01&to=2024-01-31' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

### With Pagination

```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/adsets?campaignId=123456789&limit=50&after=eyJhZnRlciI6IjEyMzQ1Njc4OSJ9' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

## Response Example

### Success (200 OK)

```json
{
  "data": [
    {
      "id": "adset_123456789",
      "name": "Summer Sale - Age 25-34",
      "status": "ACTIVE",
      "dailyBudget": "100.00",
      "lifetimeBudget": null,
      "startTime": "2024-01-15T10:00:00+0000",
      "endTime": null,
      "campaignId": "123456789",
      "insights": {
        "spend": "250.50",
        "impressions": 10000,
        "clicks": 250,
        "ctr": "2.50",
        "cpc": "1.00"
      }
    },
    {
      "id": "adset_987654321",
      "name": "Summer Sale - Age 35-44",
      "status": "PAUSED",
      "dailyBudget": "150.00",
      "lifetimeBudget": null,
      "startTime": "2024-01-15T10:00:00+0000",
      "endTime": "2024-01-31T23:59:59+0000",
      "campaignId": "123456789",
      "insights": {
        "spend": "500.25",
        "impressions": 20000,
        "clicks": 500,
        "ctr": "2.50",
        "cpc": "1.00"
      }
    }
  ],
  "paging": {
    "after": "eyJhZnRlciI6Ijk4NzY1NDMyMSJ9"
  }
}
```

### Empty Result

```json
{
  "data": [],
  "paging": {
    "after": null
  }
}
```

## Error Responses

### 400 Bad Request - Missing campaignId

```json
{
  "statusCode": 400,
  "message": "campaignId is required",
  "error": "Bad Request"
}
```

### 400 Bad Request - Meta Not Connected

```json
{
  "statusCode": 400,
  "message": "Meta no conectado. Por favor, conecta tu cuenta de Meta a través de OAuth.",
  "error": "Bad Request"
}
```

### 400 Bad Request - Campaign Not Found

```json
{
  "statusCode": 400,
  "message": "Campaign no encontrada o no accesible. Verifica el campaignId.",
  "error": "Bad Request"
}
```

### 401 Unauthorized - Invalid Token

```json
{
  "statusCode": 401,
  "message": "Token de Meta inválido. Por favor, reconecta tu cuenta de Meta.",
  "error": "Unauthorized"
}
```

### 401 Unauthorized - Insufficient Permissions

```json
{
  "statusCode": 401,
  "message": "No tienes permisos para acceder a los adsets. Verifica los permisos de tu cuenta de Meta.",
  "error": "Unauthorized"
}
```

## Adset Status Values

Common status values from Meta API:
- `ACTIVE` - Adset is currently running
- `PAUSED` - Adset is paused
- `DELETED` - Adset is deleted
- `ARCHIVED` - Adset is archived
- `DISAPPROVED` - Adset was disapproved
- `PREAPPROVED` - Adset is pre-approved
- `PENDING_REVIEW` - Adset is pending review

## Budget Fields

- **dailyBudget**: Daily budget in cents (string format, e.g., "100000" = $1,000.00)
- **lifetimeBudget**: Lifetime budget in cents (string format, or null if not set)

## Insights Fields

- **spend**: Total amount spent in the currency of the ad account (string with 2 decimals)
- **impressions**: Total number of times ads were shown (integer)
- **clicks**: Total number of clicks (integer)
- **ctr**: Click-through rate as percentage (string with 2 decimals)
- **cpc**: Cost per click in currency (string with 2 decimals)

## Pagination

- Use `after` cursor from `paging.after` to fetch the next page
- If `paging.after` is `null`, there are no more pages
- Default page size is 25 adsets, maximum is 100 per request

## Implementation Details

1. **Campaign ID Validation**:
   - `campaignId` is required (returns 400 if missing)
   - Campaign must be accessible by the organization's Meta account

2. **Date Range**:
   - Default: Last 30 days if `from`/`to` not provided
   - Format: ISO date strings (YYYY-MM-DD)

3. **Insights Aggregation**:
   - Fetches insights for each adset separately
   - Aggregates insights if multiple date ranges are returned
   - If insights fetch fails for an adset, returns adset with zero insights

4. **Performance**:
   - Makes N+1 API calls (1 for adsets list + N for insights)
   - Can be optimized with batch requests in future iterations

## Related Endpoints

- `GET /api/integrations/meta/campaigns` - List campaigns (Step 3)
- `GET /api/integrations/meta/ad-accounts` - List accessible ad accounts (Step 1)
- `GET /api/integrations/meta/config` - Get configured ad account (Step 2)
