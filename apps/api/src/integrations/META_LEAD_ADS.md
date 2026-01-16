# Meta Lead Ads Integration

## Overview

This integration automatically creates Leads from Meta (Facebook/Instagram) Lead Ads campaigns. When a user submits a lead form through a Meta Ads campaign, the webhook creates a Lead in the system with attribution data (campaign, ad, adset IDs) and automatically links it to existing WhatsApp/Instagram conversations if the phone number matches.

## Requirements

### Meta Ads Setup

1. **Meta Business Account**
   - Must have a Facebook Page or Instagram Business account
   - Account must be linked to a Meta App

2. **Lead Ads Campaign**
   - Create a Lead Ads campaign in Meta Ads Manager
   - Configure lead form with desired fields (name, email, phone, etc.)

3. **Webhook Configuration**
   - Subscribe to `leadgen` webhook field in Meta App Dashboard
   - Configure webhook callback URL: `https://your-domain.com/api/webhooks/meta-lead-ads`
   - Set verify token (must match `INSTAGRAM_VERIFY_TOKEN` env var - reuses Instagram webhook verification)

4. **Required Permissions**
   - `leads_retrieval` - Access to lead data
   - `pages_show_list` - List connected pages
   - `pages_read_engagement` - Read page engagement data

## Environment Variables

Uses the same environment variables as Instagram integration:

```bash
# Webhook Verification (reuses Instagram verify token)
INSTAGRAM_VERIFY_TOKEN=your_verify_token_here

# Meta App Security
META_APP_SECRET=your_meta_app_secret
```

## Webhook Endpoint

### Receive Lead Ads Events (POST)

```
POST /api/webhooks/meta-lead-ads
```

**Headers:**
- `X-Hub-Signature-256`: SHA256 HMAC signature (required if `META_APP_SECRET` is set)
- `X-Organization-Id`: Organization ID (dev mode only, optional)

**Request Body:**
```json
{
  "entry": [
    {
      "id": "page-id",
      "leadgen": [
        {
          "id": "leadgen-id",
          "ad_id": "ad-id",
          "adset_id": "adset-id",
          "campaign_id": "campaign-id",
          "form_id": "form-id",
          "created_time": "2024-01-15T10:00:00Z",
          "field_data": [
            {
              "name": "full_name",
              "values": ["John Doe"]
            },
            {
              "name": "email",
              "values": ["john@example.com"]
            },
            {
              "name": "phone_number",
              "values": ["+1234567890"]
            },
            {
              "name": "city",
              "values": ["New York"]
            }
          ]
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "status": "ok"
}
```

**Security:**
- Signature verification using `META_APP_SECRET` (same as Instagram)
- Uses `X-Hub-Signature-256` header with SHA256 HMAC
- Raw body required for signature validation

## Lead Creation Process

When a Meta Lead Ads webhook is received:

1. **Webhook received** → `MetaLeadAdsService.processWebhook()`
2. **Organization resolved** via:
   - `ConnectedAccount` lookup by page ID
   - `X-Organization-Id` header (dev mode)
   - First organization (dev mode fallback)
3. **Duplicate check** - Checks for existing Lead with same `metaLeadgenId` in `customFields`
4. **Lead created** with:
   - **Standard fields**: `name`, `email`, `phone`, `city` (extracted from `field_data`)
   - **Source**: `"meta_ads"`
   - **Tags**: `["META_ADS"]` (automatically added)
   - **Custom fields** (in `customFields` JSON):
     - `metaLeadgenId`: Leadgen ID from Meta
     - `metaAdId`: Ad ID
     - `metaAdsetId`: Adset ID
     - `metaCampaignId`: Campaign ID
     - `metaFormId`: Form ID
     - `metaPageId`: Page ID
     - `metaCreatedTime`: Creation timestamp
     - `meta_<field_name>`: Any additional fields from `field_data` that don't map to standard Lead fields
5. **Conversation linking**: Attempts to link Lead with existing WhatsApp/Instagram conversation if phone matches
6. **Note created**: Adds a note to the Lead with campaign and ad information
7. **Webhook event marked as processed**

## Field Mapping

The service maps Meta Lead Ads form fields to Lead model fields:

| Meta Field Name | Lead Field | Notes |
|----------------|-----------|-------|
| `full_name` | `name` | Full name |
| `first_name` + `last_name` | `name` | Combined if `full_name` not present |
| `email` | `email` | Email address |
| `phone_number` or `phone` | `phone` | Phone number |
| `city` | `city` | City name |
| Other fields | `customFields.meta_<field_name>` | Stored in customFields |

## Source Attribution

All Meta Ads attribution data is stored in the Lead's `customFields`:

```json
{
  "metaLeadgenId": "leadgen-123",
  "metaAdId": "ad-456",
  "metaAdsetId": "adset-789",
  "metaCampaignId": "campaign-101",
  "metaFormId": "form-202",
  "metaPageId": "page-303",
  "metaCreatedTime": "2024-01-15T10:00:00Z"
}
```

This allows for:
- **Revenue attribution**: Track which campaigns/ads generate revenue
- **ROI analysis**: Calculate return on ad spend (ROAS)
- **Campaign optimization**: Identify best-performing ads/campaigns

## Conversation Linking

The service automatically links Leads with existing conversations:

1. **Phone matching**: Normalizes phone numbers and searches for conversations
2. **Exact match**: First tries exact phone match
3. **Contains match**: Falls back to phone number containing the normalized number
4. **Link creation**: Updates conversation with `leadId` if conversation doesn't already have a lead

This enables:
- **Unified view**: See all interactions (ads + messages) in one place
- **Context**: Understand how leads found you (ads → conversation)
- **Attribution**: Track full customer journey

## Multi-Organization Support

### Account Mapping

**Production:**
- `ConnectedAccount` table maps `externalAccountId` (Meta Page ID) → `organizationId`
- Webhook events include page ID → lookup `ConnectedAccount` → get `organizationId`
- Supports multiple Meta accounts per organization
- Supports multiple organizations with different Meta accounts
- OAuth flow automatically creates `ConnectedAccount` on successful authentication

**Development:**
- Uses `X-Organization-Id` header in webhook (dev mode only)
- Falls back to first organization if header missing (dev only)

## Idempotency

The service prevents duplicate Leads by checking for existing Leads with the same `metaLeadgenId` in `customFields`. If a duplicate is found, the webhook is processed but no new Lead is created.

## Error Handling

### Missing Pipeline/Stage
- If no default pipeline is found, lead creation is skipped (logged as warning)
- If no stage is found, lead creation is skipped (logged as warning)

### Missing Admin User
- If no admin/manager/owner user is found, lead creation is skipped (logged as warning)

### Missing Organization
- If organization cannot be resolved, webhook is skipped (logged as warning)

## Testing

### Sample Webhook Payload
```json
{
  "entry": [
    {
      "id": "123456789",
      "leadgen": [
        {
          "id": "leadgen-123",
          "ad_id": "ad-456",
          "adset_id": "adset-789",
          "campaign_id": "campaign-101",
          "form_id": "form-202",
          "created_time": "2024-01-15T10:00:00Z",
          "field_data": [
            {
              "name": "full_name",
              "values": ["John Doe"]
            },
            {
              "name": "email",
              "values": ["john@example.com"]
            },
            {
              "name": "phone_number",
              "values": ["+1234567890"]
            },
            {
              "name": "city",
              "values": ["New York"]
            },
            {
              "name": "custom_question",
              "values": ["Custom answer"]
            }
          ]
        }
      ]
    }
  ]
}
```

See `hardening-api-test.http` for example webhook requests.

## Limitations

1. **Lead Form Fields**
   - MVP: Supports standard fields (name, email, phone, city)
   - Custom fields are stored in `customFields` but not automatically mapped to Lead fields
   - Future: Configurable field mapping

2. **Revenue Attribution**
   - MVP: Basic attribution data stored (campaign, ad IDs)
   - Future: Automatic revenue calculation and ROAS reporting

3. **OAuth Flow**
   - ✅ Full OAuth flow implemented with token refresh
   - Uses same OAuth system as Instagram and Marketing API
   - See [Meta OAuth Documentation](./META_OAUTH.md) for setup

4. **Click-to-WhatsApp**
   - MVP: Links existing conversations if phone matches
   - Future: Automatic WhatsApp message sending on lead creation

## Security Considerations

1. **Signature Verification**
   - Always validate `X-Hub-Signature-256` in production
   - Use `META_APP_SECRET` for HMAC validation
   - Reject requests with invalid signatures

2. **Multi-Org Isolation**
   - Always validate `organizationId` from `ConnectedAccount`
   - Never allow cross-org data access

3. **Webhook Endpoint**
   - Should be HTTPS in production
   - Rate limiting recommended
   - IP whitelisting (Meta IPs) recommended for production

## Conversion to Sale & Attribution

When a Lead with `META_ADS` tag is converted to a paid Sale, the system automatically creates an attribution snapshot:

1. **Sale Payment** (`PATCH /api/sales/:id/pay`)
   - System resolves `leadId` from sale (or by customer phone/email)
   - Checks if lead has Meta Ads attribution data
   - Creates `MetaAttributionSnapshot` with campaign/ad/adset IDs

2. **Attribution Snapshot**
   - Links sale to original Meta Ads campaign/ad
   - Enables revenue attribution and ROAS calculation
   - Idempotent (one snapshot per sale)

3. **Dashboard Metrics**
   - View revenue and conversion metrics by campaign/adset/ad
   - Calculate ROAS (when spend data is available)
   - See: [Attribution Dashboard Documentation](../dashboard/ATTRIBUTION.md)

**Example Flow:**
```
Meta Lead Ads Webhook
  → Lead created (tag: META_ADS, customFields: { metaCampaignId, metaAdId, ... })
  → Lead converted to Sale
  → Sale marked as PAID
  → Attribution snapshot created automatically
  → Dashboard shows revenue attributed to campaign/ad
```

## References

- [Meta Lead Ads API](https://developers.facebook.com/docs/marketing-api/guides/leadgen-retrieval)
- [Meta Webhooks](https://developers.facebook.com/docs/graph-api/webhooks)
- [Meta Ads Manager](https://business.facebook.com/adsmanager)
- [Attribution Dashboard](../dashboard/ATTRIBUTION.md)
