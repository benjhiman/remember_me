# How to Use Leads API

## 🔐 Authentication

All endpoints require authentication. Get your token first:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

If you have multiple organizations, you'll need to select one:

```http
POST /api/auth/select-organization
Authorization: Bearer <tempToken>
Content-Type: application/json

{
  "organizationId": "org-id"
}
```

Then use the `accessToken` in all requests:

```
Authorization: Bearer <accessToken>
```

---

## 📋 Complete Routes Map

### Pipelines

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads/pipelines` | ✅ | All | List all pipelines |
| `POST` | `/api/leads/pipelines` | ✅ | ADMIN, MANAGER, OWNER | Create pipeline |

### Stages

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `POST` | `/api/leads/stages` | ✅ | ADMIN, MANAGER, OWNER | Create stage |
| `PATCH` | `/api/leads/stages/reorder` | ✅ | ADMIN, MANAGER, OWNER | Reorder stages |

### Leads

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads` | ✅ | All* | List leads (with filters) |
| `GET` | `/api/leads/:id` | ✅ | All* | Get lead by ID |
| `POST` | `/api/leads` | ✅ | All | Create lead |
| `PUT` | `/api/leads/:id` | ✅ | All* | Update lead |
| `DELETE` | `/api/leads/:id` | ✅ | ADMIN, MANAGER, OWNER | Delete lead |
| `POST` | `/api/leads/:id/assign` | ✅ | All* | Assign lead |

*SELLER can only access leads assigned to them or created by them

### Notes

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads/:id/notes` | ✅ | All* | Get lead notes |
| `POST` | `/api/leads/notes` | ✅ | All | Create note |

### Tasks

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads/:id/tasks` | ✅ | All* | Get lead tasks |
| `POST` | `/api/leads/tasks` | ✅ | All | Create task |
| `PATCH` | `/api/leads/tasks/:taskId` | ✅ | All* | Update task |

---

## 🚀 Quick Start Examples

### 1. Create Pipeline

```json
POST /api/leads/pipelines
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Sales Pipeline",
  "color": "#6366f1"
}
```

**Response:**
```json
{
  "id": "pipeline-123",
  "organizationId": "org-123",
  "name": "Sales Pipeline",
  "color": "#6366f1",
  "order": 0,
  "isDefault": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. Create Stage

```json
POST /api/leads/stages
Authorization: Bearer <token>
Content-Type: application/json

{
  "pipelineId": "pipeline-123",
  "name": "Qualified",
  "color": "#10b981"
}
```

**Response:**
```json
{
  "id": "stage-123",
  "pipelineId": "pipeline-123",
  "name": "Qualified",
  "order": 0,
  "color": "#10b981",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 3. Create Lead

```json
POST /api/leads
Authorization: Bearer <token>
Content-Type: application/json

{
  "pipelineId": "pipeline-123",
  "stageId": "stage-123",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "source": "instagram",
  "city": "Buenos Aires",
  "budget": 1500.00,
  "model": "iPhone 15 Pro",
  "tags": ["vip", "urgent"],
  "customFields": {
    "preferredColor": "blue",
    "tradeIn": true
  }
}
```

**Response:**
```json
{
  "id": "lead-123",
  "organizationId": "org-123",
  "pipelineId": "pipeline-123",
  "stageId": "stage-123",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "source": "instagram",
  "city": "Buenos Aires",
  "budget": "1500.00",
  "model": "iPhone 15 Pro",
  "tags": ["vip", "urgent"],
  "status": "ACTIVE",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "pipeline": {
    "id": "pipeline-123",
    "name": "Sales Pipeline"
  },
  "stage": {
    "id": "stage-123",
    "name": "Qualified"
  }
}
```

---

### 4. List Leads (with filters)

```json
GET /api/leads?q=John&stageId=stage-123&status=ACTIVE&createdFrom=2024-01-01&createdTo=2024-12-31&page=1&limit=20&sort=createdAtDesc
Authorization: Bearer <token>
```

**Query Parameters:**
- `q` or `search` - Search in name, email, phone
- `pipelineId` - Filter by pipeline
- `stageId` - Filter by stage
- `assignedToId` - Filter by assigned user
- `status` - ACTIVE, CONVERTED, LOST, ARCHIVED
- `createdFrom` - ISO date string (e.g., "2024-01-01")
- `createdTo` - ISO date string (e.g., "2024-12-31")
- `sort` - "createdAt", "createdAtDesc", "createdAtAsc", "updatedAt", "updatedAtDesc", "updatedAtAsc"
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Response:**
```json
{
  "data": [
    {
      "id": "lead-123",
      "name": "John Doe",
      "email": "john@example.com",
      "pipeline": { "id": "pipeline-123", "name": "Sales Pipeline" },
      "stage": { "id": "stage-123", "name": "Qualified" },
      "_count": { "notes": 2, "tasks": 1 }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 5. Assign Lead

```json
POST /api/leads/lead-123/assign
Authorization: Bearer <token>
Content-Type: application/json

{
  "assignedToId": "user-456"
}
```

---

### 6. Create Note

```json
POST /api/leads/notes
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadId": "lead-123",
  "content": "Cliente interesado en iPhone 15 Pro. Presupuesto aprobado.",
  "isPrivate": false
}
```

---

### 7. Create Task

```json
POST /api/leads/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadId": "lead-123",
  "title": "Llamar al cliente",
  "description": "Seguimiento de presupuesto",
  "dueDate": "2024-01-15T10:00:00Z",
  "assignedToId": "user-456"
}
```

---

### 8. Update Task Status

```json
PATCH /api/leads/tasks/task-123
Authorization: Bearer <token>
Content-Type: application/json

{
  "completed": true
}
```

---

## 🔒 Permissions Summary

### ADMIN / MANAGER / OWNER
- ✅ Full access to all endpoints
- ✅ Can create pipelines and stages
- ✅ Can see all leads in organization
- ✅ Can delete leads
- ✅ Can reorder stages

### SELLER
- ✅ Can create leads
- ✅ Can see only leads assigned to them or created by them
- ✅ Can update leads assigned/created by them
- ✅ Can assign leads (assigned/created by them)
- ✅ Can create notes and tasks
- ❌ Cannot create pipelines/stages
- ❌ Cannot delete leads
- ❌ Cannot reorder stages

---

## ✅ Validations

### Email
- Must be a valid email format
- Example: `user@example.com`

### Phone
- Can contain digits, spaces, +, -, (, )
- Example: `+1 (234) 567-8900`

### Stage Names
- Cannot be duplicated within the same pipeline
- Error: `Stage with name "X" already exists in this pipeline`

### Stage Reorder
- Orders must be unique within the same pipeline
- Error: `Duplicate order X in pipeline Y`

---

## ❌ Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message here",
  "error": "Bad Request"
}
```

Common errors:
- `401 Unauthorized` - Invalid or expired token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `400 Bad Request` - Validation error or invalid operation

---

## 📝 Notes

- All dates are ISO 8601 strings
- Decimal fields (budget, prices) are returned as strings
- Multi-org isolation is enforced automatically
- SELLER role has restricted access (see permissions above)
