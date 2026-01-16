# Integrations Module Overview

## Architecture

The Integrations module provides a foundation for connecting external messaging platforms (WhatsApp, Instagram, Facebook) with the CRM system. It uses a **webhook → event → job** architecture for asynchronous processing.

### Flow

1. **Webhook Reception**: External provider sends webhook to `POST /api/webhooks/:provider`
2. **Event Storage**: Webhook is saved as `WebhookEvent` with status `PENDING`
3. **Job Creation**: An `IntegrationJob` of type `PROCESS_WEBHOOK` is created and enqueued
4. **Async Processing**: Worker processes jobs from the queue (DB-backed)
5. **Status Updates**: Job status transitions: `PENDING` → `PROCESSING` → `DONE` / `FAILED`

## Models

### ConnectedAccount

Represents a connected external account (WhatsApp Business, Instagram Business, etc.).

```typescript
{
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  externalAccountId: string;
  displayName?: string;
  status: ConnectedAccountStatus; // CONNECTED, DISCONNECTED, ERROR
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

**Indices:**
- `[organizationId, provider]` - Fast lookup by org and provider
- `[organizationId, status]` - Filter by status

### OAuthToken

Stores encrypted OAuth tokens for authenticated accounts.

```typescript
{
  id: string;
  connectedAccountId: string;
  accessTokenEncrypted: string; // Base64 encoded encrypted token
  refreshTokenEncrypted?: string;
  expiresAt?: DateTime;
  scopes: string[];
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

**Note**: Encryption is placeholder. Real implementation should use KMS or secure key management.

### WebhookEvent

Stores incoming webhook events from external providers.

```typescript
{
  id: string;
  provider: IntegrationProvider;
  eventType: string;
  payloadJson: Json;
  receivedAt: DateTime;
  processedAt?: DateTime;
  status: WebhookEventStatus; // PENDING, PROCESSED, FAILED
  retries: number;
}
```

**Indices:**
- `[provider, status]` - Filter by provider and status
- `[status, receivedAt]` - Process oldest pending events first

### MessageLog

Logs all inbound and outbound messages (for audit and debugging).

```typescript
{
  id: string;
  provider: IntegrationProvider;
  direction: MessageDirection; // INBOUND, OUTBOUND
  to: string;
  from: string;
  text: string;
  metaJson?: Json;
  createdAt: DateTime;
}
```

**Indices:**
- `[provider, createdAt]` - Query by provider and time
- `[to]`, `[from]` - Lookup by contact

### IntegrationJob

DB-backed job queue for async processing.

```typescript
{
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  jobType: IntegrationJobType; // SEND_MESSAGE, PROCESS_WEBHOOK, SYNC_ACCOUNT, RETRY
  payloadJson: Json;
  status: IntegrationJobStatus; // PENDING, PROCESSING, DONE, FAILED
  attempts: number;
  lastError?: string;
  runAt: DateTime;
  connectedAccountId?: string;
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

**Indices:**
- `[status, runAt]` - Fetch next jobs: `PENDING` + `runAt <= now`, ordered by `runAt ASC`
- `[organizationId, status]` - Filter by org
- `[provider, status]` - Filter by provider

## Enums

### IntegrationProvider
- `WHATSAPP`
- `INSTAGRAM`
- `FACEBOOK`

### ConnectedAccountStatus
- `CONNECTED` - Account is active and ready
- `DISCONNECTED` - Account was disconnected
- `ERROR` - Account has errors (token expired, API errors, etc.)

### WebhookEventStatus
- `PENDING` - Event received, not yet processed
- `PROCESSED` - Event successfully processed
- `FAILED` - Event processing failed

### IntegrationJobStatus
- `PENDING` - Job waiting to be processed
- `PROCESSING` - Job currently being processed
- `DONE` - Job completed successfully
- `FAILED` - Job failed after max attempts

### IntegrationJobType
- `SEND_MESSAGE` - Send a message via provider API
- `PROCESS_WEBHOOK` - Process an incoming webhook event
- `SYNC_ACCOUNT` - Sync account data from provider
- `RETRY` - Retry a failed operation

### MessageDirection
- `INBOUND` - Message received from external provider
- `OUTBOUND` - Message sent to external provider

## API Contracts

### Frontend Endpoints

#### `GET /api/integrations`

List all connected accounts for the current organization.

**Auth**: Required (JWT + Organization context)

**Response:**
```json
[
  {
    "id": "acc-123",
    "organizationId": "org-1",
    "provider": "WHATSAPP",
    "externalAccountId": "whatsapp-business-123",
    "displayName": "WhatsApp Business Account",
    "status": "CONNECTED",
    "createdAt": "2026-01-14T10:00:00Z",
    "updatedAt": "2026-01-14T10:00:00Z",
    "oauthTokens": []
  }
]
```

#### `POST /api/integrations/:provider/connect`

Connect a new account (STUB - no real OAuth flow yet).

**Auth**: Required (JWT + Organization context, ADMIN/MANAGER/OWNER only)

**Path Params:**
- `provider`: `WHATSAPP` | `INSTAGRAM` | `FACEBOOK`

**Body:**
```json
{
  "externalAccountId": "dummy-account-123",
  "displayName": "My WhatsApp Account" // optional
}
```

**Response:**
```json
{
  "id": "acc-123",
  "organizationId": "org-1",
  "provider": "WHATSAPP",
  "externalAccountId": "dummy-account-123",
  "displayName": "My WhatsApp Account",
  "status": "CONNECTED",
  "createdAt": "2026-01-14T10:00:00Z",
  "updatedAt": "2026-01-14T10:00:00Z",
  "oauthTokens": []
}
```

**Note**: This is a STUB. Real implementation will:
1. Generate OAuth authorization URL
2. Redirect user to provider OAuth page
3. Handle callback and exchange code for tokens
4. Store encrypted tokens in `OAuthToken`

#### `DELETE /api/integrations/:accountId/disconnect`

Disconnect an account (sets status to `DISCONNECTED`).

**Auth**: Required (JWT + Organization context, ADMIN/MANAGER/OWNER only)

**Response:**
```json
{
  "id": "acc-123",
  "status": "DISCONNECTED",
  "updatedAt": "2026-01-14T10:30:00Z"
}
```

### Webhook Endpoints

#### `POST /api/webhooks/:provider`

Receive webhook from external provider.

**Auth**: None (public endpoint, but should validate webhook signature in production)

**Path Params:**
- `provider`: `WHATSAPP` | `INSTAGRAM` | `FACEBOOK`

**Body:** (Provider-specific payload)

Example WhatsApp:
```json
{
  "eventType": "message",
  "data": {
    "from": "+1234567890",
    "to": "+0987654321",
    "text": "Hello",
    "messageId": "msg-123"
  }
}
```

**Response:**
```json
{
  "status": "received"
}
```

**Status Code**: `200` (always, to acknowledge receipt)

**Flow:**
1. Validates provider
2. Creates `WebhookEvent` with status `PENDING`
3. Creates `IntegrationJob` of type `PROCESS_WEBHOOK`
4. Returns `200` immediately (async processing)

## Job Queue (DB-backed)

### IntegrationJobsService

#### `enqueue(jobType, provider, payload, runAt?, organizationId?, connectedAccountId?)`

Adds a job to the queue.

**Parameters:**
- `jobType`: `IntegrationJobType`
- `provider`: `IntegrationProvider`
- `payload`: `any` (JSON-serializable)
- `runAt`: `Date?` (default: now)
- `organizationId`: `string?` (required for multi-org)
- `connectedAccountId`: `string?` (optional, links to account)

**Returns:** Created `IntegrationJob`

#### `fetchNext(limit = 10)`

Fetches next jobs ready to process.

**Query:**
- `status = PENDING`
- `runAt <= now`
- Ordered by `runAt ASC`
- Limit: `limit`

**Returns:** Array of `IntegrationJob`

#### `markProcessing(jobId)`

Marks job as `PROCESSING` (prevents duplicate processing).

#### `markDone(jobId)`

Marks job as `DONE` (success).

#### `markFailed(jobId, error)`

Handles job failure with exponential backoff retry.

**Retry Logic:**
- If `attempts < 5`:
  - Calculate backoff: `min(2^attempts, 60)` minutes
  - Set `status = PENDING`
  - Set `runAt = now + backoff`
  - Increment `attempts`
- If `attempts >= 5`:
  - Set `status = FAILED`
  - Store `lastError`

**Backoff Examples:**
- Attempt 1 → 2 minutes
- Attempt 2 → 4 minutes
- Attempt 3 → 8 minutes
- Attempt 4 → 16 minutes
- Attempt 5+ → 60 minutes (cap)

## Multi-Organization

All operations are **strictly multi-org**:

- `ConnectedAccount` is scoped by `organizationId`
- `IntegrationJob` requires `organizationId`
- Frontend endpoints use `@CurrentOrganization()` decorator
- Webhooks can optionally include `organizationId` in payload/header (future: signature validation)

## What's Stub vs Real

### ✅ Implemented (Real)
- Prisma models and migrations
- DB-backed job queue (`IntegrationJobsService`)
- Webhook reception and event storage
- Frontend API contracts (`GET /api/integrations`, `POST /api/integrations/:provider/connect`)
- Multi-org isolation
- Job retry with exponential backoff

### 🚧 Stub (Placeholder)
- **OAuth Flow**: `POST /api/integrations/:provider/connect` creates dummy account without real OAuth
- **Provider Implementations**: `WhatsAppProvider`, `InstagramProvider` are stubs (throw errors)
- **Token Encryption**: `OAuthToken.accessTokenEncrypted` is placeholder (should use KMS)
- **Webhook Signature Validation**: Not implemented (should validate provider signatures)
- **Message Sending**: No real API calls to providers yet
- **Webhook Processing**: Job is created but worker logic is not implemented

### 📋 TODO (Future Implementation)
1. Implement OAuth flows for each provider
2. Integrate real provider APIs (WhatsApp Business API, Instagram Graph API, Facebook Graph API)
3. Implement webhook signature validation
4. Add KMS/encryption for OAuth tokens
5. Implement worker to process `PROCESS_WEBHOOK` jobs
6. Implement `SEND_MESSAGE` job processing
7. Add rate limiting per provider
8. Add webhook retry mechanism for failed events

## Examples

### Connect Account (Stub)

```bash
curl -X POST http://localhost:3000/api/integrations/WHATSAPP/connect \
  -H "Authorization: Bearer <token>" \
  -H "X-Organization-Id: org-123" \
  -H "Content-Type: application/json" \
  -d '{
    "externalAccountId": "whatsapp-business-123",
    "displayName": "My WhatsApp Business"
  }'
```

### Receive Webhook

```bash
curl -X POST http://localhost:3000/api/webhooks/WHATSAPP \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "message",
    "data": {
      "from": "+1234567890",
      "text": "Hello, I want to buy an iPhone"
    }
  }'
```

### List Connected Accounts

```bash
curl -X GET http://localhost:3000/api/integrations \
  -H "Authorization: Bearer <token>" \
  -H "X-Organization-Id: org-123"
```

## Testing

All endpoints have comprehensive tests:

- **IntegrationJobsService**: 10+ tests (enqueue, fetchNext, markProcessing, markDone, markFailed, backoff, cap)
- **WebhooksService**: 6+ tests (save event, create job, validate provider, multi-org)
- **WebhooksController**: 6+ tests (200 response, eventType extraction, multi-provider)
- **IntegrationsController**: 6+ tests (list by org, connect stub, disconnect, multi-org isolation)

Run tests:
```bash
cd apps/api && pnpm test integrations
```
