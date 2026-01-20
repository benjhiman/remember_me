# Meta Ads - Step 1: List Ad Accounts

## Endpoint

```
GET /api/integrations/meta/ad-accounts
```

## Authentication

Requires:
- `Authorization: Bearer <accessToken>`
- `X-Organization-Id: <organization-id>`

## Description

Lists all ad accounts accessible by the organization's connected Meta account. This endpoint makes a real-time call to Meta Graph API to fetch the latest ad accounts.

## Request Example

```bash
curl -X GET \
  'http://localhost:4000/api/integrations/meta/ad-accounts' \
  -H 'Authorization: Bearer <your-access-token>' \
  -H 'X-Organization-Id: <your-org-id>'
```

## Response Example

### Success (200 OK)

```json
{
  "data": [
    {
      "id": "act_123456789",
      "name": "My Ad Account",
      "accountStatus": 1,
      "currency": "USD",
      "timezone": "America/New_York"
    },
    {
      "id": "act_987654321",
      "name": "Another Ad Account",
      "accountStatus": 1,
      "currency": "EUR",
      "timezone": "Europe/Madrid"
    }
  ]
}
```

### Error: Meta Not Connected (400 Bad Request)

```json
{
  "statusCode": 400,
  "message": "Meta no conectado. Por favor, conecta tu cuenta de Meta a través de OAuth.",
  "error": "Bad Request"
}
```

### Error: Invalid Token (401 Unauthorized)

```json
{
  "statusCode": 401,
  "message": "Token de Meta inválido. Por favor, reconecta tu cuenta de Meta.",
  "error": "Unauthorized"
}
```

### Error: Permission Denied (401 Unauthorized)

```json
{
  "statusCode": 401,
  "message": "No tienes permisos para acceder a las cuentas de anuncios. Verifica los permisos de tu cuenta de Meta.",
  "error": "Unauthorized"
}
```

## Account Status Codes

Meta returns `account_status` as a number. Common values:
- `1` = Active
- `2` = Disabled
- `3` = Unsettled
- `7` = Pending Risk Review
- `9` = In Grace Period
- `100` = Pending Closure
- `101` = Closed

See [Meta Ad Account Status documentation](https://developers.facebook.com/docs/marketing-api/reference/ad-account#fields) for full list.

## Implementation Details

- Uses `MetaTokenService.ensureValidToken()` to get a valid access token (refreshes if needed)
- Calls Meta Graph API: `GET /me/adaccounts?fields=id,name,account_status,currency,timezone_name`
- Handles token refresh automatically if token expires in < 7 days
- Falls back to env var `META_PAGE_ACCESS_TOKEN` in development mode if no ConnectedAccount exists

## Prerequisites

1. Organization must have a connected Meta account via OAuth
2. Connected account must have `ads_read` permission
3. Token must be valid (will be refreshed automatically if expiring soon)

## Related Endpoints

- `GET /api/integrations/meta/connected-accounts` - List connected Meta accounts
- `GET /api/integrations/meta/oauth/start` - Start OAuth flow to connect Meta account
