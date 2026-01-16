# Unified Inbox API

## Overview

The Unified Inbox provides a provider-agnostic interface for managing conversations across multiple communication channels (WhatsApp, Instagram, etc.). It offers features like conversation management, assignment, tags, status tracking, and metrics.

## Data Model

### Conversation

A persistent conversation record that tracks all messages and metadata for a communication thread.

- `id`: Unique identifier
- `organizationId`: Organization this conversation belongs to
- `provider`: Communication provider (WHATSAPP, INSTAGRAM)
- `phone`: Phone number (for WhatsApp)
- `handle`: Username/handle (for Instagram)
- `leadId`: Associated lead (if linked)
- `assignedToId`: Assigned user
- `status`: OPEN | PENDING | CLOSED
- `lastMessageAt`: Timestamp of last message
- `lastInboundAt`: Timestamp of last inbound message
- `lastOutboundAt`: Timestamp of last outbound message
- `lastReadAt`: Timestamp when conversation was last read
- `unreadCount`: Number of unread messages
- `createdAt`, `updatedAt`, `deletedAt`

### ConversationTag

Tags for organizing conversations.

- `id`: Unique identifier
- `organizationId`: Organization this tag belongs to
- `name`: Tag name (unique per organization)
- `color`: Hex color code (optional)
- `createdAt`, `updatedAt`, `deletedAt`

### ConversationTagLink

Many-to-many relationship between conversations and tags.

## Related Endpoints

### Users

**GET /api/users** - List users in current organization
- Auth: Required (all roles)
- Returns: Array of users with `id`, `email`, `name`, `avatar`, `role`, `isActive`, `createdAt`
- Used by: Assign dropdown in conversation detail
- Multi-org: Uses organization from JWT token

## Endpoints

### List Conversations

```
GET /api/inbox/conversations
```

**Query Parameters:**
- `provider` (optional): Filter by provider (WHATSAPP, INSTAGRAM)
- `status` (optional): Filter by status (OPEN, PENDING, CLOSED)
- `assignedToId` (optional): Filter by assigned user
- `tag` (optional): Filter by tag ID
- `q` (optional): Search query (searches phone, handle, lead name)
- `page` (default: 1): Page number
- `limit` (default: 20): Items per page

**Response:**
```json
{
  "data": [
    {
      "id": "conv-1",
      "organizationId": "org-1",
      "provider": "WHATSAPP",
      "phone": "+1234567890",
      "handle": null,
      "leadId": "lead-1",
      "assignedToId": "user-2",
      "status": "OPEN",
      "lastMessageAt": "2026-01-15T10:00:00Z",
      "lastInboundAt": "2026-01-15T10:00:00Z",
      "lastOutboundAt": "2026-01-15T09:30:00Z",
      "lastReadAt": null,
      "unreadCount": 2,
      "previewText": "Hello, I'm interested in...",
      "lastMessageDirection": "INBOUND",
      "lead": {
        "id": "lead-1",
        "name": "John Doe",
        "phone": "+1234567890",
        "stage": {
          "id": "stage-1",
          "name": "Qualified"
        }
      },
      "assignedTo": {
        "id": "user-2",
        "name": "Agent Smith",
        "email": "agent@example.com"
      },
      "assignedUser": {
        "id": "user-2",
        "name": "Agent Smith"
      },
      "tags": [
        {
          "id": "tag-1",
          "name": "VIP",
          "color": "#FF5733"
        }
      ],
      "canReply": true,
      "requiresTemplate": false,
      "slaStatus": "OK"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 20
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Get Conversation

```
GET /api/inbox/conversations/:id
```

**Response:**
```json
{
  "id": "conv-1",
  "organizationId": "org-1",
  "provider": "WHATSAPP",
  "phone": "+1234567890",
  "leadId": "lead-1",
  "assignedToId": "user-2",
  "status": "OPEN",
  "lastMessageAt": "2026-01-15T10:00:00Z",
  "unreadCount": 2,
  "previewText": "Hello, I'm interested in...",
  "lastMessageDirection": "INBOUND",
  "lead": {
    "id": "lead-1",
    "name": "John Doe",
    "phone": "+1234567890",
    "email": "john@example.com",
    "stage": {
      "id": "stage-1",
      "name": "Qualified"
    }
  },
  "assignedTo": {
    "id": "user-2",
    "name": "Agent Smith",
    "email": "agent@example.com"
  },
  "assignedUser": {
    "id": "user-2",
    "name": "Agent Smith"
  },
  "tags": [],
  "canReply": true,
  "requiresTemplate": false,
  "slaStatus": "OK"
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Get Conversation Messages

```
GET /api/inbox/conversations/:id/messages
```

**Query Parameters:**
- `page` (default: 1): Page number
- `limit` (default: 50): Items per page

**Response:**
```json
{
  "data": [
    {
      "id": "msg-1",
      "provider": "WHATSAPP",
      "direction": "INBOUND",
      "from": "+1234567890",
      "to": "phone-id",
      "text": "Hello",
      "status": "DELIVERED",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 50
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Assign Conversation

```
PATCH /api/inbox/conversations/:id/assign
```

**Request Body:**
```json
{
  "assignedToId": "user-2"
}
```

**Response:**
```json
{
  "id": "conv-1",
  "assignedToId": "user-2",
  "assignedTo": {
    "id": "user-2",
    "name": "Agent Smith",
    "email": "agent@example.com"
  }
}
```

**Permissions:** ADMIN, MANAGER, OWNER

### Mark Conversation as Read

```
PATCH /api/inbox/conversations/:id/mark-read
```

**Response:**
```json
{
  "id": "conv-1",
  "unreadCount": 0,
  "lastReadAt": "2026-01-15T10:30:00Z"
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Update Conversation Status

```
PATCH /api/inbox/conversations/:id/status
```

**Request Body:**
```json
{
  "status": "CLOSED"
}
```

**Response:**
```json
{
  "id": "conv-1",
  "status": "CLOSED"
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Send Text Message (Quick Action)

```
POST /api/inbox/conversations/:id/send-text
```

**Request Body:**
```json
{
  "text": "Hello, how can I help you?",
  "mediaUrl": "https://example.com/image.jpg",  // Optional
  "mediaType": "image",  // Optional: "image" | "document"
  "caption": "Check this out"  // Optional, only if mediaUrl is provided
}
```

**Validation:**
- Either `text` or `mediaUrl` must be provided
- If `mediaUrl` is provided, `mediaType` is required
- `caption` is optional when sending media
- Instagram does not support attachments yet (returns 400 if `mediaType` is provided)

**Response:**
```json
{
  "jobId": "job-abc",
  "status": "queued",
  "message": "Message queued for sending"
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

**Notes:**
- Media attachments are only supported for WhatsApp
- Media URL must be publicly accessible (WhatsApp Cloud API requires direct URL)
- Supported media types: `image`, `document`

### Send Template Message (Quick Action)

```
POST /api/inbox/conversations/:id/send-template
```

**Request Body:**
```json
{
  "templateId": "template-1",
  "variables": {
    "name": "John",
    "product": "Widget"
  }
}
```

**Response:**
```json
{
  "id": "msg-1",
  "conversationId": "conv-1",
  "organizationId": "org-1",
  "provider": "WHATSAPP",
  "phone": "+1234567890",
  "direction": "OUTBOUND",
  "text": null,
  "templateId": "template-1",
  "templateVariables": {
    "name": "John",
    "product": "Widget"
  },
  "status": "SENT",
  "createdAt": "2026-01-15T10:30:00Z"
}
```

**Note:** Template messages are required when sending to a conversation that hasn't received an outbound message in the last 24 hours (outside the WhatsApp messaging window).

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Add Tag to Conversation

```
POST /api/inbox/conversations/:id/tags/:tagId
```

**Response:**
```json
{
  "id": "link-1",
  "conversationId": "conv-1",
  "tagId": "tag-1",
  "tag": {
    "id": "tag-1",
    "name": "VIP",
    "color": "#FF5733"
  }
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Remove Tag from Conversation

```
DELETE /api/inbox/conversations/:id/tags/:tagId
```

**Response:** 204 No Content

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### List Tags

```
GET /api/inbox/tags
```

**Response:**
```json
{
  "data": [
    {
      "id": "tag-1",
      "organizationId": "org-1",
      "name": "VIP",
      "color": "#FF5733",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 5
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Get Tag

```
GET /api/inbox/tags/:id
```

**Response:**
```json
{
  "id": "tag-1",
  "organizationId": "org-1",
  "name": "VIP",
  "color": "#FF5733",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Create Tag

```
POST /api/inbox/tags
```

**Request Body:**
```json
{
  "name": "VIP",
  "color": "#FF5733"
}
```

**Response:**
```json
{
  "id": "tag-1",
  "organizationId": "org-1",
  "name": "VIP",
  "color": "#FF5733",
  "createdAt": "2026-01-15T10:00:00Z"
}
```

**Permissions:** ADMIN, MANAGER, OWNER

### Update Tag

```
PATCH /api/inbox/tags/:id
```

**Request Body:**
```json
{
  "name": "VIP Customer",
  "color": "#FF0000"
}
```

**Response:**
```json
{
  "id": "tag-1",
  "name": "VIP Customer",
  "color": "#FF0000"
}
```

**Permissions:** ADMIN, MANAGER, OWNER

### Delete Tag

```
DELETE /api/inbox/tags/:id
```

**Response:** 204 No Content

**Permissions:** ADMIN, MANAGER, OWNER

### Get Metrics

```
GET /api/inbox/metrics
```

**Query Parameters:**
- `provider` (optional): Filter by provider
- `from` (optional): Start date (ISO 8601)
- `to` (optional): End date (ISO 8601)

**Response:**
```json
{
  "openCount": 10,
  "pendingCount": 5,
  "closedCount": 3,
  "unreadTotal": 25,
  "avgFirstResponseMs": 300000,
  "responseSlaBreaches": 2
}
```

**Metrics:**
- `openCount`: Number of conversations with status OPEN
- `pendingCount`: Number of conversations with status PENDING
- `closedCount`: Number of conversations with status CLOSED
- `unreadTotal`: Sum of all unreadCount values
- `avgFirstResponseMs`: Average time (ms) between first inbound and first outbound message
- `responseSlaBreaches`: Number of conversations where response time exceeded SLA threshold

**SLA Configuration:**
- Environment variable: `INBOX_SLA_MINUTES` (default: 60)
- Defines the maximum acceptable response time in minutes

**Permissions:** ADMIN, MANAGER, OWNER, SELLER

### Retry Failed Message

```
POST /api/inbox/messages/:id/retry
```

**Description:** Re-queues a failed outbound message for sending. A new `MessageLog` entry will be created with a reference to the original failed message.

**Rules:**
- Only messages with `status == FAILED` can be retried
- Creates a new `IntegrationJob` (either `SEND_MESSAGE` or `SEND_MESSAGE_TEMPLATE` based on original message metadata)
- Creates a new `MessageLog` entry with `status == QUEUED` and `metaJson.retryOf` pointing to the original failed message ID
- Updates `conversation.lastMessageAt` and `conversation.lastOutboundAt`
- Idempotency: If a retry is already in progress (QUEUED or SENT status), returns 400 error

**Permissions:** ADMIN, MANAGER, OWNER

**Response:**
```json
{
  "messageLogId": "new-msg-log-id",
  "jobId": "new-job-id",
  "status": "queued",
  "message": "Message retry queued for sending"
}
```

**Error Responses:**
- `404`: Message not found or not in FAILED status
- `400`: Conversation is CLOSED or retry already in progress
- `403`: Message does not belong to your organization

## Automatic Conversation Sync

Conversations are automatically created/updated when messages are received or sent:

- **Inbound messages**: Creates conversation if it doesn't exist, increments `unreadCount`, updates `lastInboundAt`
- **Outbound messages**: Creates conversation if it doesn't exist, updates `lastOutboundAt`
- **Lead linking**: Automatically links conversation to lead if phone/handle matches

## Multi-Organization Isolation

All endpoints enforce strict multi-organization isolation. Users can only access conversations, tags, and metrics for their organization.

## Frontend Integration

The API is designed to be provider-agnostic, allowing the frontend to work with WhatsApp today and Instagram tomorrow without code changes. The `provider` field in conversations and filters allows switching between channels seamlessly.
