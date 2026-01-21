# Meta Ads - Step 2: Persist Ad Account Selection

## Overview

This step adds endpoints to save and retrieve the selected ad account ID for an organization. The configuration is stored in `Organization.settings.meta.adAccountId`.

## Endpoints

### GET /api/integrations/meta/config

Get the current Meta configuration for the organization.

**Authentication:**
- `Authorization: Bearer <accessToken>`
- `X-Organization-Id: <organization-id>`

**Response:**
```json
{
  "adAccountId": "act_123456789",
  "connected": true
}
```

**Example:**
```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/config' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

**Response when no ad account selected:**
```json
{
  "adAccountId": null,
  "connected": true
}
```

**Response when Meta not connected:**
```json
{
  "adAccountId": null,
  "connected": false
}
```

---

### PUT /api/integrations/meta/config

Update the selected ad account ID for the organization.

**Authentication:**
- `Authorization: Bearer <accessToken>`
- `X-Organization-Id: <organization-id>`

**Request Body:**
```json
{
  "adAccountId": "act_123456789"
}
```

**Or with numeric ID (will be normalized):**
```json
{
  "adAccountId": "123456789"
}
```

**Response:**
```json
{
  "adAccountId": "act_123456789"
}
```

**Example:**
```bash
curl -X PUT \
  'http://localhost:4000/api/integrations/meta/config' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>' \
  -H 'Content-Type: application/json' \
  -d '{
    "adAccountId": "act_123456789"
  }'
```

---

## Validations

1. **adAccountId required**: The `adAccountId` field is required in PUT requests.

2. **Format normalization**: 
   - If `adAccountId` starts with `act_`, it's used as-is
   - If `adAccountId` is numeric, it's normalized to `act_<id>`
   - Example: `"123456789"` → `"act_123456789"`

3. **Accessibility validation**: 
   - The system validates that the `adAccountId` exists in the list of accessible ad accounts
   - Uses `MetaAdsService.listAdAccounts()` to fetch the current list
   - If the ad account is not accessible → `400 Bad Request` with message: "Ad account no accesible por este token. Verifica que el ad account ID sea correcto y que tengas permisos para accederlo."

---

## Error Responses

### 400 Bad Request - Missing adAccountId

```json
{
  "statusCode": 400,
  "message": "adAccountId is required",
  "error": "Bad Request"
}
```

### 400 Bad Request - Ad Account Not Accessible

```json
{
  "statusCode": 400,
  "message": "Ad account no accesible por este token. Verifica que el ad account ID sea correcto y que tengas permisos para accederlo.",
  "error": "Bad Request"
}
```

### 400 Bad Request - Meta Not Connected

If Meta is not connected, the validation will fail when trying to list ad accounts:

```json
{
  "statusCode": 400,
  "message": "Meta no conectado. Por favor, conecta tu cuenta de Meta a través de OAuth.",
  "error": "Bad Request"
}
```

---

## Storage

The configuration is stored in `Organization.settings` as JSON:

```json
{
  "meta": {
    "adAccountId": "act_123456789"
  }
}
```

This allows for future expansion of Meta configuration without schema changes.

---

## Security

- Protected with `JwtAuthGuard` (authentication required)
- Organization isolation via `X-Organization-Id` header
- Ready for `MANAGE_INTEGRATIONS` permission guard (can be added later)

---

## Related Endpoints

- `GET /api/integrations/meta/ad-accounts` - List accessible ad accounts (Step 1)
- `GET /api/integrations/meta/connected-accounts` - List connected Meta accounts
- `GET /api/integrations/meta/oauth/start` - Start OAuth flow to connect Meta account

---

## Usage Flow

1. **Connect Meta Account**: Use OAuth flow to connect Meta account
2. **List Ad Accounts**: Call `GET /api/integrations/meta/ad-accounts` to see available accounts
3. **Select Ad Account**: Call `PUT /api/integrations/meta/config` with the desired `adAccountId`
4. **Retrieve Config**: Call `GET /api/integrations/meta/config` to get current selection

---

## Implementation Details

- Uses `Organization.settings` JSON field (no schema migration needed)
- Validates ad account accessibility in real-time
- Normalizes ad account ID format automatically
- Checks Meta connection status in GET response
