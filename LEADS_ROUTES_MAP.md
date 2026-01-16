# Leads Module - Complete Routes Map

## Base Path: `/api/leads`

All endpoints require authentication: `Authorization: Bearer <token>`

---

## Pipelines

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads/pipelines` | ✅ | All | List all pipelines with stages |
| `POST` | `/api/leads/pipelines` | ✅ | ADMIN, MANAGER, OWNER | Create new pipeline |

---

## Stages

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `POST` | `/api/leads/stages` | ✅ | ADMIN, MANAGER, OWNER | Create new stage in pipeline |
| `PATCH` | `/api/leads/stages/reorder` | ✅ | ADMIN, MANAGER, OWNER | Reorder stages (bulk update) |

---

## Leads

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads` | ✅ | All* | List leads with filters & pagination |
| `GET` | `/api/leads/:id` | ✅ | All* | Get lead by ID |
| `POST` | `/api/leads` | ✅ | All | Create new lead |
| `PUT` | `/api/leads/:id` | ✅ | All* | Update lead |
| `DELETE` | `/api/leads/:id` | ✅ | ADMIN, MANAGER, OWNER | Delete lead |
| `POST` | `/api/leads/:id/assign` | ✅ | All* | Assign/unassign lead to user |

*SELLER can only access leads assigned to them or created by them

**Query Parameters for GET /api/leads:**
- `q` / `search` - Search in name, email, phone
- `pipelineId` - Filter by pipeline
- `stageId` - Filter by stage
- `assignedToId` - Filter by assigned user
- `status` - ACTIVE, CONVERTED, LOST, ARCHIVED
- `createdFrom` - ISO date (e.g., "2024-01-01")
- `createdTo` - ISO date (e.g., "2024-12-31")
- `sort` - createdAt, createdAtDesc, createdAtAsc, updatedAt, updatedAtDesc, updatedAtAsc
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

---

## Notes

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads/:id/notes` | ✅ | All* | Get all notes for a lead |
| `POST` | `/api/leads/notes` | ✅ | All | Create note (can be linked to lead) |

*Private notes only visible to creator and ADMIN/MANAGER/OWNER

---

## Tasks

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads/:id/tasks` | ✅ | All* | Get all tasks for a lead |
| `POST` | `/api/leads/tasks` | ✅ | All | Create task (can be linked to lead) |
| `PATCH` | `/api/leads/tasks/:taskId` | ✅ | All* | Update task (status, title, etc.) |

*SELLER can only update tasks assigned to them or created by them

---

## Health Check

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| `GET` | `/api/leads/health` | ✅ | All | Health check endpoint |

---

## Summary

**Total Endpoints: 15**

- Pipelines: 2
- Stages: 2
- Leads: 6
- Notes: 2
- Tasks: 3
