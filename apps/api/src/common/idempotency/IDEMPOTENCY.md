# Idempotency

## Overview

The API supports idempotency for critical operations to prevent duplicate side-effects when requests are retried or sent multiple times. This is implemented using the `Idempotency-Key` header.

## How It Works

1. **Client sends request** with `Idempotency-Key` header (unique value per request)
2. **Server checks** if the key was used before with the same payload
3. **If cached**: Returns the exact same response (status code + body) from the first request
4. **If new**: Executes the operation, stores the response, and returns it
5. **If key reused with different payload**: Returns `409 Conflict` error

## Idempotent Endpoints

The following endpoints support idempotency:

- `POST /api/stock/reservations` - Create stock reservation
- `POST /api/sales` - Create sale
- `PATCH /api/sales/:id/pay` - Pay sale

## Usage

### Request Header

Include the `Idempotency-Key` header in your request:

```http
POST /api/sales
Authorization: Bearer <token>
Idempotency-Key: unique-key-12345
Content-Type: application/json

{
  "stockReservationIds": ["reservation-id-1", "reservation-id-2"],
  "customerName": "John Doe"
}
```

### Behavior

#### Same Key + Same Payload

If you send the exact same request (same key + same body) multiple times:

```bash
# First request
curl -X POST https://api.example.com/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: sale-2026-01-13-001" \
  -H "Content-Type: application/json" \
  -d '{"stockReservationIds": ["res-1"]}'

# Response: 201 Created
# {
#   "id": "sale-123",
#   "status": "RESERVED",
#   ...
# }

# Second request (same key + same body)
curl -X POST https://api.example.com/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: sale-2026-01-13-001" \
  -H "Content-Type: application/json" \
  -d '{"stockReservationIds": ["res-1"]}'

# Response: 201 Created (cached)
# {
#   "id": "sale-123",  # Same ID as first request
#   "status": "RESERVED",
#   ...
# }
```

**Important**: The second request does NOT create a new sale. It returns the exact same response from the first request.

#### Same Key + Different Payload

If you reuse the same key but change the request body:

```bash
# First request
curl -X POST https://api.example.com/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: sale-2026-01-13-001" \
  -H "Content-Type: application/json" \
  -d '{"stockReservationIds": ["res-1"]}'

# Second request (same key, different body)
curl -X POST https://api.example.com/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: sale-2026-01-13-001" \
  -H "Content-Type: application/json" \
  -d '{"stockReservationIds": ["res-2"]}'

# Response: 409 Conflict
# {
#   "statusCode": 409,
#   "message": "Idempotency key reused with different payload",
#   "errorCode": "IDEMPOTENCY_KEY_REUSE_DIFFERENT_PAYLOAD",
#   "error": "Conflict"
# }
```

#### Missing Header

If you forget the `Idempotency-Key` header on an idempotent endpoint:

```bash
curl -X POST https://api.example.com/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stockReservationIds": ["res-1"]}'

# Response: 400 Bad Request
# {
#   "statusCode": 400,
#   "message": "Idempotency-Key header is required",
#   "errorCode": "IDEMPOTENCY_KEY_REQUIRED",
#   "error": "Bad Request"
# }
```

## Key Guidelines

### Generate Unique Keys

Generate a unique key for each distinct operation. Good practices:

- **UUID**: `550e8400-e29b-41d4-a716-446655440000`
- **Timestamp-based**: `sale-2026-01-13-14-30-45-123`
- **Client request ID**: `client-request-abc123xyz`

### Key Scope

- Keys are scoped per organization and user
- Same key can be used by different organizations/users
- Keys are valid for **24 hours** from first use

### When to Use

Use idempotency keys for operations that:
- Have side-effects (create, update, payment)
- Might be retried due to network issues
- Should not be duplicated (creating a sale, paying an order)

## TTL (Time To Live)

- Keys are stored for **24 hours** from first use
- After 24 hours, the key expires and can be reused
- Expired keys are automatically cleaned up on server startup

## Error Responses

### Missing Header

```json
{
  "statusCode": 400,
  "message": "Idempotency-Key header is required",
  "errorCode": "IDEMPOTENCY_KEY_REQUIRED",
  "error": "Bad Request"
}
```

### Key Reused with Different Payload

```json
{
  "statusCode": 409,
  "message": "Idempotency key reused with different payload",
  "errorCode": "IDEMPOTENCY_KEY_REUSE_DIFFERENT_PAYLOAD",
  "error": "Conflict"
}
```

## Examples

### Create Stock Reservation

```bash
curl -X POST https://api.example.com/api/stock/reservations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: reservation-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{
    "stockItemId": "item-123",
    "quantity": 1,
    "notes": "Reserved for customer"
  }'
```

### Create Sale

```bash
curl -X POST https://api.example.com/api/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: sale-$(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "stockReservationIds": ["res-1", "res-2"],
    "customerName": "John Doe",
    "customerEmail": "john@example.com"
  }'
```

### Pay Sale

```bash
curl -X PATCH https://api.example.com/api/sales/sale-123/pay \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: pay-sale-123-$(date +%s)" \
  -H "Content-Type: application/json"
```

## Implementation Details

- Idempotency is implemented using database storage (PostgreSQL)
- Keys are stored with request hash (SHA256) to detect payload changes
- Responses are cached with status code and body
- Only successful responses (2xx, 3xx) are cached
- Errors are not cached to allow retries

## Limitations

- Keys are scoped per organization and user
- TTL is fixed at 24 hours (configurable in code)
- Cleanup runs on server startup (background cleanup is optional)
