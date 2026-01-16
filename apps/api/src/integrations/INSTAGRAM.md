# Instagram DM Integration (Graph API + Webhooks)

## Overview

This integration enables receiving and sending Instagram Direct Messages (DMs) through Meta's Graph API, fully integrated with the Unified Inbox system. Messages appear in `/api/inbox/conversations` with `provider=INSTAGRAM` alongside WhatsApp conversations.

## Requirements

### Meta Account Setup

1. **Instagram Business or Creator Account**
   - Must be connected to a Facebook Page
   - Account must be linked to a Meta App

2. **Meta App Configuration**
   - Create a Meta App at https://developers.facebook.com/apps
   - Add "Instagram" product to the app
   - Configure Instagram Basic Display or Instagram Graph API

3. **Required Permissions/Scopes**
   - `instagram_basic` - Basic Instagram account access
   - `instagram_manage_messages` - Send and receive messages
   - `pages_show_list` - List connected pages
   - `pages_messaging` - Messaging capabilities

4. **Webhook Setup**
   - Subscribe to `messages` webhook field
   - Configure webhook callback URL: `https://your-domain.com/api/webhooks/instagram`
   - Set verify token (must match `INSTAGRAM_VERIFY_TOKEN` env var)

## Environment Variables

```bash
# Webhook Verification
INSTAGRAM_VERIFY_TOKEN=your_verify_token_here

# Meta App Security
META_APP_SECRET=your_meta_app_secret

# OAuth Configuration (Required for production)
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_OAUTH_REDIRECT_URL=https://your-domain.com/api/integrations/meta/oauth/callback
TOKEN_ENCRYPTION_KEY=base64_encoded_32_byte_key
TOKEN_ENCRYPTION_KEY_ID=default

# Development Fallback (Dev Only - NODE_ENV=development)
META_PAGE_ACCESS_TOKEN=your_page_access_token  # Only used if no ConnectedAccount

# Instagram Account/Page ID (Optional - auto-detected from OAuth)
INSTAGRAM_PAGE_ID=your_instagram_page_id
# OR
INSTAGRAM_USER_ID=your_instagram_user_id
```

### Token Management

**Production (OAuth):**
- Tokens stored encrypted in `OAuthToken` table linked to `ConnectedAccount`
- Automatic token refresh/extend before expiration (60-day long-lived tokens)
- Support multiple Instagram accounts per organization
- Multi-org isolation via `ConnectedAccount.organizationId`
- See [Meta OAuth Documentation](./META_OAUTH.md) for setup

**Development Fallback:**
- Uses `META_PAGE_ACCESS_TOKEN` from environment variables if no `ConnectedAccount` found
- Only active when `NODE_ENV=development`
- Suitable for local development/testing

## Webhook Endpoints

### Verification (GET)

```
GET /api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

**Response:**
- Returns `hub.challenge` if verification succeeds
- Returns `403 Forbidden` if token doesn't match

**Meta calls this endpoint during webhook subscription setup.**

### Receive Events (POST)

```
POST /api/webhooks/instagram
```

**Headers:**
- `X-Hub-Signature-256`: SHA256 HMAC signature (required if `META_APP_SECRET` is set)

**Request Body:**
```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "page-id",
      "messaging": [
        {
          "sender": {
            "id": "instagram-user-id"
          },
          "recipient": {
            "id": "page-id"
          },
          "timestamp": 1234567890,
          "message": {
            "mid": "message-id",
            "text": "Hello!"
          }
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
- Signature verification using `META_APP_SECRET` (same as WhatsApp)
- Uses `X-Hub-Signature-256` header with SHA256 HMAC
- Raw body required for signature validation

## Message Processing

### Inbound Messages

When an Instagram DM is received:

1. **Webhook received** → `InstagramWebhookService.processWebhook()`
2. **MessageLog created** with:
   - `provider: INSTAGRAM`
   - `direction: INBOUND`
   - `from`: Instagram user ID or handle
   - `metaJson`: Contains `messageId`, `senderId`, `threadId`, etc.
3. **Conversation upserted** via `InboxService.syncConversationFromMessage()`:
   - `provider: INSTAGRAM`
   - `externalThreadId`: Thread/conversation ID from Instagram
   - `handle`: Instagram username (if available) or sender ID
   - `lastMessageAt`, `lastInboundAt` updated
   - `unreadCount` incremented
4. **Lead linking**: Attempts to link conversation to existing Lead by matching Instagram handle/ID

### Outbound Messages

**Endpoint:**
```
POST /api/integrations/instagram/send
```

**Request Body:**
```json
{
  "conversationId": "conv-1",
  "text": "Hello! How can I help you?"
}
```

**OR via Inbox Quick Action:**
```
POST /api/inbox/conversations/:id/send-text
```
(Works automatically if `conversation.provider === INSTAGRAM`)

**Process:**
1. Validates conversation exists and belongs to organization
2. Creates `IntegrationJob` with:
   - `provider: INSTAGRAM`
   - `jobType: SEND_MESSAGE`
   - `payloadJson`: `{ conversationId, text, recipientId, threadId }`
3. Job processor calls Instagram Graph API:
   ```
   POST https://graph.facebook.com/v18.0/{page-id}/messages
   ```
4. Creates `MessageLog` with `direction: OUTBOUND`
5. Updates `Conversation.lastOutboundAt`

## Graph API Endpoints Used

### Send Message
```
POST https://graph.facebook.com/v18.0/{page-id}/messages
```

**Headers:**
```
Authorization: Bearer {META_PAGE_ACCESS_TOKEN}
Content-Type: application/json
```

**Body:**
```json
{
  "recipient": {
    "id": "instagram-user-id"
  },
  "message": {
    "text": "Hello!"
  }
}
```

**Response:**
```json
{
  "recipient_id": "instagram-user-id",
  "message_id": "mid.xxx"
}
```

## Multi-Organization Support

### Account Mapping

**Production:**
- `ConnectedAccount` table maps `externalAccountId` (Instagram Page ID) → `organizationId`
- Webhook events include page ID → lookup `ConnectedAccount` → get `organizationId`
- Supports multiple Instagram accounts per organization
- Supports multiple organizations with different Instagram accounts
- OAuth flow automatically creates `ConnectedAccount` on successful authentication

**Development:**
- Uses `X-Organization-Id` header in webhook (dev mode only)
- Falls back to first organization if header missing (dev only)

### ConnectedAccount Model

```prisma
model ConnectedAccount {
  id                String
  organizationId    String
  provider          IntegrationProvider // INSTAGRAM
  externalAccountId String              // Instagram Page ID
  displayName       String?
  status            ConnectedAccountStatus
  // ...
}
```

## Integration with Unified Inbox

All Instagram conversations automatically appear in the Unified Inbox:

```
GET /api/inbox/conversations?provider=INSTAGRAM
```

**Response includes:**
- All standard conversation fields
- `provider: "INSTAGRAM"`
- `handle`: Instagram username
- `externalThreadId`: Instagram thread ID
- `previewText`, `lastMessageDirection`, etc. (UX fields)
- `canReply`, `requiresTemplate`, `slaStatus` (UX helpers)

**No frontend changes required** - Instagram conversations work with existing inbox endpoints.

## Job Processing

Instagram jobs are processed by extending the existing job processor:

- `PROCESS_WEBHOOK`: Process incoming webhook events
- `SEND_MESSAGE`: Send outbound messages via Graph API

Jobs use the same retry/backoff logic as WhatsApp jobs.

## Error Handling

### Rate Limits
- Instagram Graph API has rate limits (varies by endpoint)
- Job processor handles rate limit errors (429) with exponential backoff
- Failed jobs are retried automatically

### Message Sending Restrictions
- Some Instagram accounts may not support outbound messaging
- Error returned: `INSTAGRAM_MESSAGING_NOT_SUPPORTED`
- Check account type and permissions

### Webhook Failures
- Invalid signatures → 403 Forbidden
- Missing required fields → 400 Bad Request
- Duplicate messages → Skipped (idempotency check)

## Testing

### Webhook Verification Test
```bash
curl "http://localhost:3000/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=test_challenge"
```

### Sample Webhook Payload
See `hardening-api-test.http` for example webhook payloads.

## Limitations

1. **Account Types**
   - Only Business/Creator accounts connected to Facebook Pages can receive webhooks
   - Personal accounts are not supported

2. **Message Types**
   - MVP: Text messages only
   - Future: Images, videos, stories replies

3. **OAuth Flow**
   - ✅ Full OAuth flow implemented with token refresh
   - See [Meta OAuth Documentation](./META_OAUTH.md)

4. **Ads Integration**
   - Not implemented in MVP
   - Future: Instagram Ads comments/replies

5. **24-Hour Window**
   - Instagram has similar messaging window rules as WhatsApp
   - Outside window: May require different message types (not implemented in MVP)

## Security Considerations

1. **Signature Verification**
   - Always validate `X-Hub-Signature-256` in production
   - Use `META_APP_SECRET` for HMAC validation
   - Reject requests with invalid signatures

2. **Token Storage**
   - ✅ Encrypted storage in `OAuthToken` table (AES-256-GCM)
   - ✅ Automatic token refresh before expiration
   - Development: Falls back to env var if no ConnectedAccount

3. **Multi-Org Isolation**
   - Always validate `organizationId` from `ConnectedAccount`
   - Never allow cross-org data access

4. **Webhook Endpoint**
   - Should be HTTPS in production
   - Rate limiting recommended
   - IP whitelisting (Meta IPs) recommended for production

## References

- [Instagram Graph API Documentation](https://developers.facebook.com/docs/instagram-api)
- [Instagram Messaging API](https://developers.facebook.com/docs/instagram-api/guides/messaging)
- [Webhooks Setup](https://developers.facebook.com/docs/graph-api/webhooks)
- [Meta App Dashboard](https://developers.facebook.com/apps)
