# Meta OAuth Integration (Instagram + Marketing API)

## Overview

This integration enables secure OAuth 2.0 authentication for Meta (Facebook/Instagram) accounts, supporting Instagram messaging, Marketing API (spend tracking), and Lead Ads. Tokens are encrypted and stored securely, with automatic refresh/extend before expiration.

## Prerequisites

### Meta Account Setup

1. **Meta Business Account**
   - Must have a Facebook Page
   - Instagram Business or Creator account connected to the Page
   - Access to Meta Ads Manager

2. **Meta App Creation**
   - Create app at https://developers.facebook.com/apps
   - Add products:
     - **Instagram** (for messaging)
     - **Marketing API** (for spend tracking)
     - **Lead Ads** (for lead generation)

3. **Required Roles**
   - Admin or Developer role on the Meta App
   - Admin access to the Facebook Page
   - Admin access to Ad Accounts (for spend tracking)

## Setup in Meta Developers Dashboard

### 1. Add Products

1. Go to your Meta App → **Add Products**
2. Add **Instagram** product
3. Add **Marketing API** product
4. Add **Lead Ads** product (if using Lead Ads)

### 2. Configure Permissions/Scopes

Go to **App Review** → **Permissions and Features**:

**Required Permissions:**
- `instagram_basic` - Basic Instagram account access
- `instagram_manage_messages` - Send/receive Instagram messages
- `pages_show_list` - List connected pages
- `pages_messaging` - Messaging capabilities
- `ads_read` - Read ad account data (for spend tracking)
- `leads_retrieval` - Access lead data (for Lead Ads)

**Note:** Some permissions require App Review for production use.

### 3. Configure OAuth Redirect URLs

Go to **Settings** → **Basic** → **Add Platform** → **Website**:

**Valid OAuth Redirect URIs:**
```
https://your-domain.com/api/integrations/meta/oauth/callback
http://localhost:4000/api/integrations/meta/oauth/callback  (dev only)
```

### 4. Configure Webhooks

**Instagram Messaging:**
- Go to **Instagram** → **Webhooks**
- Subscribe to `messages` field
- Callback URL: `https://your-domain.com/api/webhooks/instagram`
- Verify Token: Must match `INSTAGRAM_VERIFY_TOKEN` env var

**Lead Ads:**
- Go to **Lead Ads** → **Webhooks**
- Subscribe to `leadgen` field
- Callback URL: `https://your-domain.com/api/webhooks/meta-lead-ads`
- Verify Token: Must match `INSTAGRAM_VERIFY_TOKEN` env var

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte key for AES-256-GCM | `dGVzdC1rZXktMzItYnl0ZXMtbG9uZy1lbm91Z2g=` |
| `TOKEN_ENCRYPTION_KEY_ID` | Identifier for key rotation | `default` |
| `META_APP_ID` | Meta App ID | `1234567890123456` |
| `META_APP_SECRET` | Meta App Secret | `abc123def456...` |
| `META_OAUTH_REDIRECT_URL` | OAuth callback URL | `https://your-domain.com/api/integrations/meta/oauth/callback` |

### Optional (Scheduler)

| Variable | Description | Default |
|----------|-------------|---------|
| `META_SPEND_ENABLED` | Enable daily spend fetch | `false` |
| `META_SPEND_CRON` | Cron expression for spend fetch | `"0 6 * * *"` (6 AM daily) |
| `META_TOKEN_REFRESH_ENABLED` | Enable token refresh scheduler | `false` |
| `META_TOKEN_REFRESH_CRON` | Cron expression for token refresh | `"0 4 * * *"` (4 AM daily) |

### Development Fallback (Dev Only)

| Variable | Description | Notes |
|----------|-------------|-------|
| `META_PAGE_ACCESS_TOKEN` | Fixed token (dev only) | Only used if `NODE_ENV=development` and no ConnectedAccount |
| `META_AD_ACCOUNT_ID` | Fixed ad account ID (dev only) | Only used if `NODE_ENV=development` and no ConnectedAccount |

### Generating TOKEN_ENCRYPTION_KEY

```bash
# Generate 32 random bytes and encode to base64
openssl rand -base64 32
```

**Example output:**
```
dGVzdC1rZXktMzItYnl0ZXMtbG9uZy1lbm91Z2g=
```

Store this securely (e.g., in a secrets manager). **Never commit to version control.**

## OAuth Flow

### Step 1: Start OAuth Flow

**Endpoint:**
```
GET /api/integrations/meta/oauth/start
```

**Headers:**
```
Authorization: Bearer <user-token>
X-Organization-Id: <org-id>
```

**Response:**
```json
{
  "url": "https://www.facebook.com/v21.0/dialog/oauth?client_id=...&redirect_uri=...&state=...&scope=...",
  "state": "signed-state-string"
}
```

**What happens:**
- Generates signed state (CSRF protection) with `organizationId`, `userId`, and `nonce`
- Returns Meta OAuth authorization URL
- User must open URL in browser

### Step 2: User Login/Consent

1. User opens the URL from Step 1 in browser
2. User logs into Meta/Facebook
3. User grants permissions (Instagram, Pages, Ads)
4. Meta redirects to callback URL with `code` and `state`

### Step 3: OAuth Callback

**Endpoint:**
```
GET /api/integrations/meta/oauth/callback?code=<auth-code>&state=<signed-state>
```

**What happens:**
1. Verifies signed state (CSRF check)
2. Exchanges `code` for short-lived token
3. Exchanges short-lived token for long-lived token (60 days)
4. Fetches user info, pages, and ad accounts
5. Creates/updates `ConnectedAccount`:
   - `provider: INSTAGRAM`
   - `status: CONNECTED`
   - `metadataJson`: Contains `metaUserId`, `pageId`, `igUserId`, `adAccounts[]`
6. Encrypts and stores token in `OAuthToken`:
   - `accessTokenEncrypted`: Encrypted long-lived token
   - `expiresAt`: 60 days from now
   - `scopes`: Granted permissions

**Response:**
```json
{
  "connectedAccountId": "account-123",
  "accessToken": "plain-token-for-immediate-use",
  "expiresIn": 5184000
}
```

## What Gets Stored

### ConnectedAccount

```json
{
  "id": "account-123",
  "organizationId": "org-456",
  "provider": "INSTAGRAM",
  "externalAccountId": "page-id-789",
  "displayName": "My Instagram Page",
  "status": "CONNECTED",
  "metadataJson": {
    "metaUserId": "user-123",
    "pageId": "page-456",
    "igUserId": "ig-789",
    "adAccounts": [
      {
        "id": "act_123456789",
        "name": "My Ad Account"
      }
    ]
  }
}
```

### OAuthToken

```json
{
  "id": "token-123",
  "connectedAccountId": "account-123",
  "accessTokenEncrypted": "encrypted-ciphertext-with-iv-tag-keyid",
  "expiresAt": "2024-03-15T00:00:00Z",
  "scopes": ["instagram_basic", "instagram_manage_messages", "ads_read"]
}
```

**Token Format:**
```
<iv-hex>:<encrypted-hex>:<auth-tag-hex>:<key-id>
```

## Token Refresh/Extension

### Automatic Refresh

**When it runs:**
- Daily at configured time (default: 4 AM) via `META_TOKEN_REFRESH_CRON`
- Only if `META_TOKEN_REFRESH_ENABLED=true`

**What it does:**
1. Finds all `ConnectedAccount` with `status=CONNECTED` and `provider=INSTAGRAM`
2. Checks token expiration
3. If expires in < 7 days:
   - Decrypts current token
   - Calls Meta API to extend token (long-lived tokens can be extended)
   - Encrypts new token
   - Updates `OAuthToken` with new token and expiration

**Extension API:**
```
GET https://graph.facebook.com/v21.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id={app-id}&
  client_secret={app-secret}&
  fb_exchange_token={current-token}
```

**Response:**
```json
{
  "access_token": "new-long-lived-token",
  "expires_in": 5184000
}
```

### What Happens if Refresh Fails

- Error is logged
- Current token is still used (may work until expiration)
- Next refresh attempt will try again
- Manual re-authentication may be required if token expires

### Manual Refresh

If automatic refresh fails, user must re-authenticate:
1. Call `GET /api/integrations/meta/oauth/start`
2. Complete OAuth flow again
3. New token replaces old token

## Multi Ad Accounts

### Listing Ad Accounts

**Endpoint:**
```
GET /api/integrations/meta/ad-accounts?connectedAccountId=<account-id>
```

**Headers:**
```
Authorization: Bearer <user-token>
X-Organization-Id: <org-id>
```

**Response:**
```json
[
  {
    "id": "act_123456789",
    "name": "My Ad Account 1"
  },
  {
    "id": "act_987654321",
    "name": "My Ad Account 2"
  }
]
```

### Selecting Ad Account for Spend Fetch

**Option 1: Query Parameter**
```
POST /api/integrations/meta/spend/fetch-now?adAccountId=act_123456789&date=2024-01-15
```

**Option 2: Default**
- If no `adAccountId` provided, uses first ad account from `ConnectedAccount.metadataJson.adAccounts[]`

**Option 3: Environment Variable (Dev Only)**
- Falls back to `META_AD_ACCOUNT_ID` if no ConnectedAccount

## Security

### State/CSRF Protection

- OAuth state includes:
  - `organizationId`: Prevents cross-org attacks
  - `userId`: Links to user who initiated flow
  - `nonce`: Random value for uniqueness
  - `timestamp`: Expiration check (5 minutes)
- State is signed with `META_APP_SECRET` using HMAC-SHA256
- Callback verifies signature and expiration before processing

### Token Encryption

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV**: 16 random bytes per encryption
- **Auth Tag**: 16 bytes (prevents tampering)
- **Key ID**: Stored in ciphertext for future key rotation

**Encryption Process:**
1. Generate random IV
2. Encrypt plaintext with AES-256-GCM
3. Extract authentication tag
4. Format: `<iv>:<ciphertext>:<tag>:<key-id>`

**Decryption Process:**
1. Parse ciphertext format
2. Verify key ID matches current key
3. Decrypt with IV and tag
4. Verify authentication tag

### Key Rotation

**Current Implementation:**
- Single key with `TOKEN_ENCRYPTION_KEY_ID`
- Key rotation not yet implemented

**Future:**
- Support multiple keys via `TOKEN_ENCRYPTION_KEY_ID`
- Decrypt with old key, re-encrypt with new key
- Migrate tokens gradually

**Recommendation:**
- Rotate keys annually or after security incident
- Store old keys temporarily for migration
- Use key management service (AWS KMS, HashiCorp Vault) in production

## Troubleshooting

### Redirect URI Mismatch

**Error:** `redirect_uri_mismatch`

**Solution:**
1. Check `META_OAUTH_REDIRECT_URL` matches exactly (including protocol, domain, path)
2. Verify redirect URI is added in Meta App Dashboard → Settings → Basic → Valid OAuth Redirect URIs
3. No trailing slashes or query parameters

### Missing Permissions

**Error:** `insufficient_permissions` or missing data

**Solution:**
1. Check required scopes are requested in OAuth URL
2. Verify permissions are approved in App Review (for production)
3. Re-authenticate with correct scopes

### Token Expired

**Error:** `Invalid OAuth access token`

**Solution:**
1. Check token expiration: `SELECT expiresAt FROM "OAuthToken" WHERE "connectedAccountId" = '...'`
2. Verify `META_TOKEN_REFRESH_ENABLED=true` and scheduler is running
3. Manually trigger refresh or re-authenticate

### Missing Ad Account

**Error:** `No ad account ID found`

**Solution:**
1. Verify `ConnectedAccount.metadataJson.adAccounts[]` is populated
2. Check user has access to ad accounts in Meta Business Manager
3. Re-authenticate to refresh ad account list
4. Set `META_AD_ACCOUNT_ID` env var as fallback (dev only)

### Rate Limits

**Error:** `429 Too Many Requests`

**Solution:**
- System automatically retries with exponential backoff
- Reduce request frequency if persistent
- Check Meta API rate limits: https://developers.facebook.com/docs/graph-api/overview/rate-limiting

### Token Decryption Failed

**Error:** `Failed to decrypt token`

**Solution:**
1. Verify `TOKEN_ENCRYPTION_KEY` is correct (32 bytes base64)
2. Check `TOKEN_ENCRYPTION_KEY_ID` matches key used for encryption
3. If key was rotated, tokens need re-encryption
4. Re-authenticate to get new encrypted token

## Related Documentation

- [Instagram Integration](./INSTAGRAM.md) - Instagram messaging setup
- [Meta Spend Tracking](./META_SPEND.md) - Spend tracking and ROAS
- [Meta Lead Ads](./META_LEAD_ADS.md) - Lead Ads integration
- [Attribution Dashboard](../dashboard/ATTRIBUTION.md) - Revenue attribution

## References

- [Meta OAuth 2.0](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)
- [Long-Lived Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived-tokens)
- [Meta App Dashboard](https://developers.facebook.com/apps)
- [Meta Business Manager](https://business.facebook.com)
