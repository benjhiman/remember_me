# Meta Spend Tracking & ROAS

## Overview

This module fetches daily spend data from Meta Marketing API and calculates ROAS (Return on Ad Spend) for attribution analysis.

## Features

- **Daily Spend Fetch**: Automatically fetches spend data from Meta Marketing API
- **Multi-Level Tracking**: Supports campaign, adset, and ad-level spend
- **ROAS Calculation**: Real-time ROAS = Revenue / Spend
- **Multi-Org Support**: Isolated spend tracking per organization
- **Token Management**: Uses ConnectedAccount + OAuthToken (with env fallback for dev)

## Data Model

### MetaSpendDaily

```prisma
model MetaSpendDaily {
  id             String            @id @default(cuid())
  organizationId String
  provider       IntegrationProvider @default(INSTAGRAM)
  date           DateTime          @db.Date
  level          MetaSpendLevel    // CAMPAIGN | ADSET | AD
  campaignId     String?
  adsetId        String?
  adId           String?
  currency       String            @default("USD")
  spend          Decimal           @db.Decimal(18, 2)
  impressions    Int?
  clicks         Int?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
}
```

**Unique Constraint**: `[organizationId, date, level, campaignId, adsetId, adId]`

## Environment Variables

### Required

- `META_PAGE_ACCESS_TOKEN` (fallback for dev): Meta Page Access Token
- `META_AD_ACCOUNT_ID` (fallback for dev): Meta Ad Account ID (format: `act_123456789`)

### Optional

- `META_SPEND_ENABLED`: Enable daily spend fetch scheduler (default: `false`)
- `META_SPEND_CRON`: Cron expression for scheduling (default: `"0 6 * * *"` - 6 AM daily)
- `META_APP_SECRET`: For webhook signature verification (shared with Instagram)

## Token Management

### Production (OAuth)

1. **Priority 1**: OAuthToken from ConnectedAccount
   - Checks for `ConnectedAccount` with provider `INSTAGRAM` or `FACEBOOK`
   - Uses most recent non-expired `OAuthToken`
   - Token is decrypted from `accessTokenEncrypted` using AES-256-GCM
   - Automatic token extension before expiration (60-day long-lived tokens)

2. **Token Refresh**
   - Daily scheduler extends tokens expiring in < 7 days
   - Configured via `META_TOKEN_REFRESH_ENABLED` and `META_TOKEN_REFRESH_CRON`
   - See [Meta OAuth Documentation](./META_OAUTH.md) for setup

### Development Fallback

- Falls back to `META_PAGE_ACCESS_TOKEN` env var if no ConnectedAccount found
- Only active when `NODE_ENV=development`
- Logs warning when using fallback

**For production**: Use OAuth flow to connect accounts. See [Meta OAuth Documentation](./META_OAUTH.md).

## Job Scheduler

### Automatic Daily Fetch

When `META_SPEND_ENABLED=true`, the system:

1. **Schedules jobs daily** at configured time (default: 6 AM)
2. **Fetches yesterday's spend** for all organizations with Meta accounts
3. **Processes jobs** via `JobRunnerService`
4. **Upserts spend data** into `MetaSpendDaily`

### Manual Trigger (Dev/Admin)

```
POST /api/integrations/meta/spend/fetch-now?date=2024-01-15&adAccountId=act_123456789
Authorization: Bearer <token>
X-Organization-Id: org-123
```

**Query Parameters:**
- `date` (optional): Date to fetch (YYYY-MM-DD). Defaults to yesterday.
- `adAccountId` (optional): Ad account ID. Defaults to first account from ConnectedAccount.

**Response:**
```json
{
  "message": "Meta spend fetch job enqueued and processed",
  "jobId": "job-123",
  "date": "2024-01-15"
}
```

**Roles**: ADMIN, OWNER only

## Meta Marketing API Integration

### Endpoint

```
GET https://graph.facebook.com/v21.0/act_{adAccountId}/insights
```

### Parameters

- `level`: `campaign` | `adset` | `ad`
- `fields`: `spend,impressions,clicks,campaign_id,adset_id,ad_id`
- `time_range`: `{'since':'YYYY-MM-DD','until':'YYYY-MM-DD'}` or `time_preset=yesterday`

### Rate Limiting

- **Handles 429 errors** with exponential backoff
- **Retries up to 3 times** with increasing delays
- **Respects `Retry-After` header** from Meta API

### Pagination

- Automatically handles pagination via `paging.next`
- Fetches all pages until complete

## Dashboard Integration

### Attribution Metrics with Spend

The attribution dashboard now includes spend and ROAS:

```
GET /api/dashboard/attribution/meta?groupBy=campaign&from=2024-01-01&to=2024-01-31
```

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
  }
]
```

**New Fields:**
- `spend`: Total spend for the group (sum of `MetaSpendDaily.spend`)
- `roas`: `revenue / spend` (null if spend = 0 or revenue = 0)

**ROAS Calculation:**
- `roas = revenue / spend` (only if both > 0)
- `roas = null` if spend = 0 or revenue = 0

## Setup Instructions

### 1. Connect Meta Account via OAuth (Recommended)

**Production Setup:**
1. Configure OAuth in Meta App Dashboard (see [Meta OAuth Documentation](./META_OAUTH.md))
2. Call `GET /api/integrations/meta/oauth/start` to initiate OAuth flow
3. Complete OAuth flow in browser
4. Token is automatically encrypted and stored in `OAuthToken` table
5. Token refresh is automatic (daily scheduler)

**Development Setup:**
- Option A: Use OAuth flow (same as production)
- Option B: Set `META_PAGE_ACCESS_TOKEN` env var (fallback only, dev mode)

### 2. Get Ad Account ID

**Production:**
- Ad accounts are automatically detected during OAuth flow
- Stored in `ConnectedAccount.metadataJson.adAccounts[]`
- List available accounts: `GET /api/integrations/meta/ad-accounts`
- Select account for spend fetch: `?adAccountId=act_123456789`

**Development:**
- Set `META_AD_ACCOUNT_ID` env var as fallback (dev mode only)

### 4. Enable Scheduler

Set environment variables:
```bash
META_SPEND_ENABLED=true
META_SPEND_CRON="0 6 * * *"  # 6 AM daily
```

### 5. Test Manual Fetch

```bash
curl -X POST "http://localhost:4000/api/integrations/meta/spend/fetch-now?date=2024-01-15" \
  -H "Authorization: Bearer <token>" \
  -H "X-Organization-Id: org-123"
```

## Known Limitations

### Current Limitations

1. **Currency**: Hardcoded to USD (should get from API)
2. **Historical Backfill**: No automatic backfill of historical data
3. **Spend Validation**: No comparison with Meta Ads Manager for accuracy

### Implemented Features

1. ✅ **OAuth Flow**: Full OAuth 2.0 flow for token management
2. ✅ **Token Encryption**: AES-256-GCM encryption for secure storage
3. ✅ **Token Refresh**: Automatic extension before expiration
4. ✅ **Multi-Account**: Support multiple ad accounts per organization
5. ✅ **Token Decryption**: Secure decryption from encrypted storage

### Future Improvements

1. **Currency Detection**: Get currency from API response
2. **Historical Backfill**: Job to backfill historical spend data
3. **Spend Validation**: Compare with Meta Ads Manager for accuracy

## Troubleshooting

### "No valid access token found"

**Solution:**
1. Connect account via OAuth: `GET /api/integrations/meta/oauth/start`
2. Check `ConnectedAccount` exists with `status=CONNECTED`
3. Check `OAuthToken` exists and is not expired
4. Verify token refresh scheduler is running (`META_TOKEN_REFRESH_ENABLED=true`)
5. Development: Set `META_PAGE_ACCESS_TOKEN` env var as fallback

### "No ad account ID found"

**Solution:**
1. Verify `ConnectedAccount.metadataJson.adAccounts[]` is populated (check after OAuth)
2. List ad accounts: `GET /api/integrations/meta/ad-accounts`
3. Specify `adAccountId` in spend fetch: `?adAccountId=act_123456789`
4. Development: Set `META_AD_ACCOUNT_ID` env var as fallback

### Rate Limiting Errors

**Solution:**
- System automatically retries with backoff
- If persistent, reduce fetch frequency or contact Meta support

### Spend Data Not Appearing

**Solution:**
1. Check job was created: `SELECT * FROM "IntegrationJob" WHERE "jobType" = 'FETCH_META_SPEND'`
2. Check job status: Should be `DONE` (not `FAILED`)
3. Verify date range: Spend is fetched for specific dates
4. Check `MetaSpendDaily` table for records

## Related Documentation

- [Attribution Dashboard](../dashboard/ATTRIBUTION.md)
- [Meta Lead Ads Integration](./META_LEAD_ADS.md)
- [Instagram Integration](./INSTAGRAM.md)
