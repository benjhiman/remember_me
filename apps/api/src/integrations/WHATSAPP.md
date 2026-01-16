# WhatsApp Cloud API Integration

## Overview

This module implements WhatsApp Cloud API integration for receiving inbound messages via webhooks and sending outbound messages. It uses the existing webhook → event → job architecture.

## Environment Variables

Add these to your `.env` file:

```bash
# WhatsApp Cloud API Configuration
WHATSAPP_VERIFY_TOKEN=your_verify_token_here  # Token for webhook verification (GET challenge)
WHATSAPP_APP_SECRET=your_app_secret_here     # App secret for signature validation (REQUIRED for production)
WHATSAPP_ACCESS_TOKEN=your_access_token      # Permanent access token (temporary, will be replaced by OAuth)
WHATSAPP_PHONE_NUMBER_ID=your_phone_id      # WhatsApp Business Phone Number ID
WHATSAPP_WABA_ID=your_waba_id                # WhatsApp Business Account ID (optional)

# Job Runner Configuration
JOB_RUNNER_ENABLED=true                      # Enable automatic job processing (default: false)
JOB_RUNNER_INTERVAL_MS=5000                  # Interval between job processing cycles in milliseconds (default: 5000)
```

### Setup Instructions

1. **Create WhatsApp Business Account**:
   - Go to [Meta for Developers](https://developers.facebook.com/)
   - Create a WhatsApp Business Account
   - Get your Phone Number ID and WABA ID

2. **Get Access Token**:
   - For MVP: Use a permanent access token from Meta App Dashboard
   - For production: Implement OAuth flow (future)

3. **Configure Webhook**:
   - Webhook URL: `https://your-domain.com/api/webhooks/whatsapp`
   - Verify Token: Set `WHATSAPP_VERIFY_TOKEN` in your `.env`
   - Subscribe to `messages` events

4. **Security**:
   - `WHATSAPP_VERIFY_TOKEN`: Random string (e.g., UUID) for webhook verification
   - `WHATSAPP_APP_SECRET`: Used for signature validation (recommended for production)
   - Store tokens securely (use secrets manager in production)

## Architecture

### Webhook Flow

1. **GET `/api/webhooks/whatsapp`**: Meta verifies webhook (challenge)
2. **POST `/api/webhooks/whatsapp`**: Receives message events
3. **Event Storage**: Saves `WebhookEvent` with status `PENDING`
4. **Job Creation**: Creates `IntegrationJob` of type `PROCESS_WEBHOOK`
5. **Async Processing**: Job runner processes webhook and creates/updates Lead

### Send Message Flow

1. **POST `/api/integrations/whatsapp/send`**: Frontend sends message request
2. **Job Enqueue**: Creates `IntegrationJob` of type `SEND_MESSAGE`
3. **Job Processing**: Job runner calls WhatsApp Cloud API
4. **Message Log**: Saves `MessageLog` with direction `OUTBOUND`

## Endpoints

### Webhook Verification (GET)

```
GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

**Response**: Returns `hub.challenge` if `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`

### Receive Webhook (POST)

```
POST /api/webhooks/whatsapp
Content-Type: application/json
X-Hub-Signature-256: sha256=<hmac_sha256_signature>
```

**Signature Verification**: If `WHATSAPP_APP_SECRET` is set, the webhook will validate the `X-Hub-Signature-256` header using HMAC SHA256. If validation fails, returns `401/403` with `errorCode: WHATSAPP_SIGNATURE_INVALID`.

**Payload** (WhatsApp Cloud API format):
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WABA_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "1234567890",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "messages": [
              {
                "from": "1234567890",
                "id": "wamid.xxx",
                "timestamp": "1234567890",
                "text": {
                  "body": "Hello, I want to buy an iPhone"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Response**: `200 OK` (acknowledgment)

### Send Message

```
POST /api/integrations/whatsapp/send
Authorization: Bearer <token>
X-Organization-Id: <org-id>
Content-Type: application/json

{
  "toPhone": "+1234567890",
  "text": "Hello! How can I help you?",
  "leadId": "lead-123" // optional
}
```

**Response**:
```json
{
  "jobId": "job-123",
  "status": "PENDING",
  "message": "Message queued for sending"
}
```

### List Messages

```
GET /api/integrations/messages?leadId=lead-123&page=1&limit=20
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

**Response**:
```json
{
  "data": [
    {
      "id": "msg-123",
      "provider": "WHATSAPP",
      "direction": "INBOUND",
      "to": "+1234567890",
      "from": "+0987654321",
      "text": "Hello",
      "createdAt": "2026-01-14T10:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

## Lead Auto-Link

When an inbound message is received:

1. **Search Lead**: Look for existing Lead by `organizationId` + `phone`
2. **Create if Missing**: If no Lead found, create new Lead:
   - `name`: "WhatsApp <phone>"
   - `phone`: Phone number from message
   - `status`: `ACTIVE`
   - `source`: `"whatsapp"`
   - `stageId`: First stage of default pipeline
3. **Append Note**: Add Note to Lead with message content:
   - `content`: Message text
   - `isPrivate`: `false`

## Job Processing

The job runner (`processPendingJobs`) processes jobs:

### PROCESS_WEBHOOK

1. Parse WhatsApp webhook payload
2. Extract message data (from, text, messageId)
3. Find or create Lead by phone
4. Create Note with message content
5. Save MessageLog (INBOUND)
6. Mark job as DONE

### SEND_MESSAGE

1. Extract payload (toPhone, text, leadId)
2. Call WhatsApp Cloud API:
   ```
   POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
   Authorization: Bearer {ACCESS_TOKEN}
   Content-Type: application/json
   
   {
     "messaging_product": "whatsapp",
     "to": "1234567890",
     "type": "text",
     "text": { "body": "Hello" }
   }
   ```
3. Save MessageLog (OUTBOUND) with:
   - `externalMessageId`: WhatsApp message ID from response
   - `status`: `SENT` (initial status)
   - `statusUpdatedAt`: Current timestamp
4. If `leadId` provided, create Note on Lead
5. Mark job as DONE

**Response from WhatsApp API**:
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{"input": "1234567890", "wa_id": "1234567890"}],
  "messages": [{"id": "wamid.HBgNMTIzNDU2Nzg5MAUBARgS"}]
}
```

The `messages[0].id` is stored as `externalMessageId` for status tracking.

## Message Status Tracking

WhatsApp sends status events via webhooks to track message delivery:

### Status Lifecycle

```
QUEUED → SENT → DELIVERED → READ
                ↓
              FAILED (can happen at any stage)
```

- **QUEUED**: Initial status when message is created (default)
- **SENT**: Message sent to WhatsApp (set when API responds successfully)
- **DELIVERED**: Message delivered to recipient's device
- **READ**: Message read by recipient
- **FAILED**: Message failed to send/deliver (includes errorCode and errorMessage)

### Status Webhook Payload

WhatsApp sends status events in the webhook payload:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "field": "statuses",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "statuses": [
              {
                "id": "wamid.HBgNMTIzNDU2Nzg5MAUBARgS",
                "status": "sent",
                "timestamp": "1234567890",
                "recipient_id": "1234567890"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Status Types**:
- `sent`: Message sent successfully
- `delivered`: Message delivered to device
- `read`: Message read by recipient
- `failed`: Message failed (includes `errors` array)

**Failed Status Example**:
```json
{
  "id": "wamid.xxx",
  "status": "failed",
  "timestamp": "1234567890",
  "recipient_id": "1234567890",
  "errors": [
    {
      "code": 131047,
      "title": "Message failed to send",
      "message": "Invalid phone number format"
    }
  ]
}
```

### Status Update Logic

- Status updates are **idempotent**: same status event won't downgrade existing status
- Status progression is **one-way**: QUEUED → SENT → DELIVERED → READ
- **FAILED** can occur at any stage and always updates (overwrites current status)
- Status updates are linked to `MessageLog` via `externalMessageId`

## Error Handling

- **Webhook Verification Failure**: Returns `403 Forbidden`
- **Invalid Payload**: Returns `400 Bad Request`
- **API Errors**: Job marked as `FAILED`, retries with exponential backoff
- **Duplicate Messages**: Idempotency check using `messageId` (unique constraint)
- **Status Updates**: Unknown `externalMessageId` is silently ignored (message not found)

## Testing

See test files:
- `webhooks/whatsapp-webhook.controller.spec.ts`
- `webhooks/whatsapp-webhook.service.spec.ts`
- `jobs/whatsapp-job-processor.spec.ts`

Run tests:
```bash
cd apps/api && pnpm test whatsapp
```

## Templates (HSM - Highly Structured Messages)

WhatsApp Templates allow you to send pre-approved messages for marketing, utility, and authentication purposes. Templates must be approved by Meta before they can be used.

### Template Model

Templates are stored per organization with the following structure:

- **name**: Template identifier (e.g., "welcome", "order_confirmation")
- **language**: Language code (e.g., "es_AR", "en_US")
- **category**: MARKETING, UTILITY, or AUTHENTICATION
- **status**: APPROVED, PENDING, REJECTED, or DISABLED
- **componentsJson**: Template structure with body/header/buttons and placeholders

### Template Components Structure

```json
{
  "body": [
    {
      "type": "text",
      "text": "Hello {{1}}, your order {{2}} is ready!"
    }
  ],
  "header": [
    {
      "type": "text",
      "text": "Order Update"
    }
  ],
  "buttons": [
    {
      "type": "quick_reply",
      "text": "View Order"
    }
  ]
}
```

Placeholders use `{{1}}`, `{{2}}`, etc. and are replaced with actual values when sending.

### Template Endpoints

#### List Templates

```
GET /api/integrations/whatsapp/templates?status=APPROVED&category=MARKETING&page=1&limit=20
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

**Response**:
```json
{
  "data": [
    {
      "id": "template-123",
      "name": "welcome",
      "language": "es_AR",
      "category": "MARKETING",
      "status": "APPROVED",
      "componentsJson": { ... },
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

#### Get Template

```
GET /api/integrations/whatsapp/templates/:id
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

#### Create Template (ADMIN/MANAGER/OWNER only)

```
POST /api/integrations/whatsapp/templates
Authorization: Bearer <token>
X-Organization-Id: <org-id>

{
  "name": "welcome",
  "language": "es_AR",
  "category": "MARKETING",
  "componentsJson": {
    "body": [
      {
        "type": "text",
        "text": "Hello {{1}}, welcome to our store!"
      }
    ]
  }
}
```

**Note**: New templates start with status `PENDING` and must be approved by Meta before use.

#### Update Template (ADMIN/MANAGER/OWNER only)

```
PATCH /api/integrations/whatsapp/templates/:id
Authorization: Bearer <token>
X-Organization-Id: <org-id>

{
  "status": "APPROVED",
  "componentsJson": { ... }
}
```

#### Delete Template (ADMIN/MANAGER/OWNER only)

```
DELETE /api/integrations/whatsapp/templates/:id
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

Soft deletes the template and sets status to `DISABLED`.

### Send Template Message

```
POST /api/integrations/whatsapp/templates/send
Authorization: Bearer <token>
X-Organization-Id: <org-id>

{
  "toPhone": "+1234567890",
  "templateId": "template-123",
  "variables": {
    "1": "John",
    "2": "#12345"
  },
  "leadId": "lead-456" // Optional
}
```

**Response**:
```json
{
  "jobId": "job-789",
  "messageLogId": "msg-log-101",
  "status": "QUEUED",
  "message": "Template message queued for sending"
}
```

**Behavior**:
1. Validates template is `APPROVED`
2. Creates `MessageLog` (OUTBOUND) with status `QUEUED` and metadata
3. Enqueues `SEND_MESSAGE_TEMPLATE` job
4. Job processor calls WhatsApp Cloud API with template format
5. Updates `MessageLog` with `externalMessageId` and status `SENT`
6. If `leadId` provided, creates Note on Lead

**Template API Payload** (sent to WhatsApp):
```json
{
  "messaging_product": "whatsapp",
  "to": "1234567890",
  "type": "template",
  "template": {
    "name": "welcome",
    "language": {
      "code": "es_AR"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "John"
          },
          {
            "type": "text",
            "text": "#12345"
          }
        ]
      }
    ]
  }
}
```

**WhatsApp Response**:
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{"input": "1234567890", "wa_id": "1234567890"}],
  "messages": [{"id": "wamid.HBgNMTIzNDU2Nzg5MAUBARgS"}]
}
```

The `messages[0].id` is stored as `externalMessageId` for status tracking.

### Template Status Lifecycle

1. **PENDING**: Template created, awaiting Meta approval
2. **APPROVED**: Template approved, can be used for sending
3. **REJECTED**: Template rejected by Meta (needs revision)
4. **DISABLED**: Template soft-deleted or manually disabled

Only `APPROVED` templates can be sent.

### Permissions

- **ADMIN/MANAGER/OWNER**: Full CRUD access to templates
- **SELLER**: Can list and send templates, cannot create/edit/delete

## Inbox API

The Inbox API provides endpoints for managing conversations and messages:

### List Conversations

```
GET /api/integrations/conversations?provider=WHATSAPP&page=1&limit=20
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

**Response**:
```json
{
  "data": [
    {
      "id": "+1234567890",
      "phone": "+1234567890",
      "leadId": "lead-123",
      "leadName": "John Doe",
      "unreadCount": 2,
      "lastMessageAt": "2026-01-15T10:00:00Z",
      "lastMessageText": "Hello",
      "lastMessageDirection": "INBOUND",
      "assignedToId": "user-1",
      "assignedToName": "Agent 1"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

### Get Conversation Messages

```
GET /api/integrations/conversations/:id/messages?page=1&limit=50
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

### Assign Conversation

```
PATCH /api/integrations/conversations/:id/assign
Authorization: Bearer <token>
X-Organization-Id: <org-id>
Content-Type: application/json

{
  "assignedToId": "user-2"
}
```

**Roles**: ADMIN, MANAGER, OWNER only

### Mark Conversation Read

```
PATCH /api/integrations/conversations/:id/mark-read
Authorization: Bearer <token>
X-Organization-Id: <org-id>
```

## Job Runner

The job runner automatically processes pending integration jobs:

- **Enabled**: Set `JOB_RUNNER_ENABLED=true` to enable automatic processing
- **Interval**: Configure `JOB_RUNNER_INTERVAL_MS` (default: 5000ms)
- **Mutex**: Prevents concurrent execution (only one job batch at a time)
- **Error Handling**: Errors in job processing don't stop the scheduler

## Security Notes

- **Webhook Verification**: Always verify `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`
- **Signature Validation**: **REQUIRED in production** - validate `X-Hub-Signature-256` header using `WHATSAPP_APP_SECRET` (HMAC SHA256)
- **Token Storage**: Access tokens should be encrypted (placeholder for now, use KMS in production)
- **Rate Limiting**: WhatsApp has rate limits (1000 messages/day for free tier)
- **Raw Body**: Signature verification requires access to raw request body (handled by `WhatsAppRawBodyMiddleware`)

## Future Improvements

- [ ] OAuth flow for token refresh
- [ ] Signature validation for webhooks
- [ ] Support for media messages (images, documents)
- [ ] Template messages
- [ ] Read receipts and delivery status
- [ ] Multi-agent routing (assign Lead to available agent)
