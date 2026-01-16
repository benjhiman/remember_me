# Job Runner Metrics API

## Overview

The Job Runner Metrics API provides observability into the background job processing system. It shows the health and status of integration jobs (WhatsApp, Instagram, Meta Spend, etc.).

## Endpoint

### Get Job Metrics

```
GET /api/integrations/jobs/metrics
```

**Description:** Returns metrics about the job runner for the current organization.

**Authentication:** Required (JWT)

**Permissions:** ADMIN, MANAGER, OWNER

**Multi-org:** Strict multi-organization isolation. Only returns metrics for the organization in the JWT token.

**Response:**
```json
{
  "pendingCount": 5,
  "processingCount": 2,
  "failedCount": 1,
  "oldestPendingAgeMs": 120000,
  "lastRunAt": "2026-01-15T10:30:00Z",
  "lastRunDurationMs": null
}
```

**Fields:**
- `pendingCount`: Number of jobs with status PENDING
- `processingCount`: Number of jobs with status PROCESSING
- `failedCount`: Number of jobs with status FAILED
- `oldestPendingAgeMs`: Age (in milliseconds) of the oldest pending job, or `null` if no pending jobs
- `lastRunAt`: Timestamp of the last processed job (DONE or FAILED), or `null` if no jobs have been processed
- `lastRunDurationMs`: Duration of the last job run (not tracked yet, always `null`)

**Health Status Indicators:**
- **OK**: `failedCount === 0` and `oldestPendingAgeMs < 600000` (10 minutes)
- **WARN**: `failedCount > 0` or `oldestPendingAgeMs >= 600000`
- **ERROR**: Multiple failures or very old pending jobs

**Example Usage:**

```bash
curl -X GET "https://api.example.com/api/integrations/jobs/metrics" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Organization-Id: org-123"
```

## Frontend Integration

The frontend displays these metrics in `/settings/integrations` with:
- Visual status indicator (OK/WARN/ERROR)
- Counts for pending, processing, and failed jobs
- Age of oldest pending job
- Last run timestamp

## Related Documentation

- [WhatsApp Automations](./WHATSAPP_AUTOMATIONS.md) - Automation jobs
- [Meta Spend](./META_SPEND.md) - Meta spend fetch jobs
- [Meta OAuth](./META_OAUTH.md) - Token refresh jobs
