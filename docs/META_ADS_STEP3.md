# Meta Ads - Step 3: List Campaigns

## Endpoint

```
GET /api/integrations/meta/campaigns
```

## Authentication

Requires:
- `Authorization: Bearer <accessToken>`
- `X-Organization-Id: <organization-id>`

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `adAccountId` | string | No | From config | Override the configured ad account |
| `from` | ISO date string | No | 30 days ago | Start date for insights (YYYY-MM-DD) |
| `to` | ISO date string | No | Today | End date for insights (YYYY-MM-DD) |
| `limit` | number | No | 25 | Number of campaigns per page (max: 100) |
| `after` | string | No | - | Pagination cursor from previous response |

## Description

Lists campaigns for the organization's configured Meta ad account. Each campaign includes basic information (id, name, status, objective) and aggregated insights (spend, impressions, clicks, CTR, CPC) for the specified date range.

## Request Examples

### Basic Request

```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/campaigns' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

### With Date Range

```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/campaigns?from=2024-01-01&to=2024-01-31' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

### With Pagination

```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/campaigns?limit=50&after=eyJhZnRlciI6IjEyMzQ1Njc4OSJ9' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

### Override Ad Account

```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/campaigns?adAccountId=act_987654321' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

## Response Example

### Success (200 OK)

```json
{
  "data": [
    {
      "id": "123456789",
      "name": "Summer Sale Campaign",
      "status": "ACTIVE",
      "objective": "OUTCOME_SALES",
      "createdTime": "2024-01-15T10:00:00+0000",
      "updatedTime": "2024-01-20T14:30:00+0000",
      "insights": {
        "spend": "1250.50",
        "impressions": 50000,
        "clicks": 1250,
        "ctr": "2.50",
        "cpc": "1.00"
      }
    },
    {
      "id": "987654321",
      "name": "Brand Awareness Campaign",
      "status": "PAUSED",
      "objective": "BRAND_AWARENESS",
      "createdTime": "2024-01-10T08:00:00+0000",
      "updatedTime": "2024-01-18T12:00:00+0000",
      "insights": {
        "spend": "500.25",
        "impressions": 75000,
        "clicks": 500,
        "ctr": "0.67",
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

### 400 Bad Request - No Ad Account Configured

```json
{
  "statusCode": 400,
  "message": "No hay Ad Account configurada. Setear en /api/integrations/meta/config",
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
  "message": "No tienes permisos para acceder a las campañas. Verifica los permisos de tu cuenta de Meta.",
  "error": "Unauthorized"
}
```

### 400 Bad Request - Ad Account Not Found

```json
{
  "statusCode": 400,
  "message": "Ad Account no encontrada o no accesible. Verifica la configuración.",
  "error": "Bad Request"
}
```

## Campaign Status Values

Common status values from Meta API:
- `ACTIVE` - Campaign is currently running
- `PAUSED` - Campaign is paused
- `DELETED` - Campaign is deleted
- `ARCHIVED` - Campaign is archived

## Campaign Objective Values

Common objective values:
- `OUTCOME_SALES` - Sales/conversions
- `OUTCOME_LEADS` - Lead generation
- `OUTCOME_ENGAGEMENT` - Engagement
- `BRAND_AWARENESS` - Brand awareness
- `REACH` - Reach
- `TRAFFIC` - Website traffic
- `APP_INSTALLS` - App installs
- `VIDEO_VIEWS` - Video views

See [Meta Campaign Objectives](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group#fields) for full list.

## Insights Fields

- **spend**: Total amount spent in the currency of the ad account (string with 2 decimals)
- **impressions**: Total number of times ads were shown (integer)
- **clicks**: Total number of clicks (integer)
- **ctr**: Click-through rate as percentage (string with 2 decimals)
- **cpc**: Cost per click in currency (string with 2 decimals)

## Pagination

- Use `after` cursor from `paging.after` to fetch the next page
- If `paging.after` is `null`, there are no more pages
- Default page size is 25 campaigns, maximum is 100 per request

## Implementation Details

1. **Ad Account Resolution**:
   - If `adAccountId` query param is provided, use it
   - Otherwise, use `Organization.settings.meta.adAccountId` from config
   - If no ad account found, return 400 error

2. **Date Range**:
   - Default: Last 30 days if `from`/`to` not provided
   - Format: ISO date strings (YYYY-MM-DD)

3. **Insights Aggregation**:
   - Fetches insights for each campaign separately
   - Aggregates insights if multiple date ranges are returned
   - If insights fetch fails for a campaign, returns campaign with zero insights

4. **Performance**:
   - Makes N+1 API calls (1 for campaigns list + N for insights)
   - Can be optimized with batch requests in future iterations

## Related Endpoints

- `GET /api/integrations/meta/ad-accounts` - List accessible ad accounts (Step 1)
- `GET /api/integrations/meta/config` - Get configured ad account (Step 2)
- `PUT /api/integrations/meta/config` - Set ad account configuration (Step 2)
