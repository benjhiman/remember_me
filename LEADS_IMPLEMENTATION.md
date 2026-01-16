# Implementación Completa del Módulo Leads (CRM)

## ✅ Resumen de Implementación

Se implementó el módulo Leads completo como MVP siguiendo el patrón del proyecto (NestJS + Prisma + guards existentes).

---

## 📋 Características Implementadas

### Multi-Org Estricto
- ✅ Todas las queries/writes filtradas por `organizationId`
- ✅ Verificación de membresía en cada operación
- ✅ Control de acceso basado en roles

### Modelos Prisma Utilizados
- ✅ `Pipeline` - Pipelines de CRM
- ✅ `Stage` - Etapas dentro de pipelines
- ✅ `Lead` - Leads/oportunidades
- ✅ `Note` - Notas asociadas a leads
- ✅ `Task` - Tareas asociadas a leads

### Roles y Permisos
- ✅ **ADMIN/MANAGER/OWNER**: Acceso completo (crear pipelines, stages, todos los leads)
- ✅ **SELLER**: Acceso limitado (ver solo leads asignados o creados por ellos)

---

## 🛣️ Endpoints Implementados

### Pipelines
- `GET /api/leads/pipelines` - Listar pipelines de la organización
- `POST /api/leads/pipelines` - Crear pipeline (ADMIN/MANAGER/OWNER)

### Stages
- `POST /api/leads/stages` - Crear stage (ADMIN/MANAGER/OWNER)
- `PATCH /api/leads/stages/reorder` - Reordenar stages (ADMIN/MANAGER/OWNER)

### Leads
- `GET /api/leads` - Listar leads (con filtros y paginación)
- `GET /api/leads/:id` - Obtener lead por ID
- `POST /api/leads` - Crear lead
- `PUT /api/leads/:id` - Actualizar lead
- `DELETE /api/leads/:id` - Eliminar lead (ADMIN/MANAGER/OWNER)
- `POST /api/leads/:id/assign` - Asignar lead a usuario

### Notes
- `GET /api/leads/:id/notes` - Listar notas de un lead
- `POST /api/leads/notes` - Crear nota (puede estar asociada a un lead o no)

### Tasks
- `GET /api/leads/:id/tasks` - Listar tareas de un lead
- `POST /api/leads/tasks` - Crear tarea (puede estar asociada a un lead o no)
- `PATCH /api/leads/tasks/:taskId` - Actualizar tarea (estado, título, etc.)

---

## 📝 Ejemplos de Requests

### 1. Crear Pipeline
```bash
POST /api/leads/pipelines
Authorization: Bearer <accessToken>
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
  "stages": [],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 2. Crear Stage
```bash
POST /api/leads/stages
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "pipelineId": "pipeline-123",
  "name": "Qualified",
  "color": "#10b981"
}
```

### 3. Crear Lead
```bash
POST /api/leads
Authorization: Bearer <accessToken>
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
  },
  "assignedToId": "user-456"
}
```

### 4. Listar Leads (con filtros)
```bash
GET /api/leads?page=1&limit=20&pipelineId=pipeline-123&status=ACTIVE&search=John
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "data": [
    {
      "id": "lead-123",
      "name": "John Doe",
      "email": "john@example.com",
      "pipeline": { "id": "pipeline-123", "name": "Sales Pipeline" },
      "stage": { "id": "stage-123", "name": "New" },
      "assignedTo": { "id": "user-456", "name": "Sales Rep" },
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

### 5. Asignar Lead
```bash
POST /api/leads/lead-123/assign
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "assignedToId": "user-789"
}
```

### 6. Crear Nota
```bash
POST /api/leads/notes
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "leadId": "lead-123",
  "content": "Cliente interesado en iPhone 15 Pro. Presupuesto aprobado.",
  "isPrivate": false
}
```

### 7. Crear Tarea
```bash
POST /api/leads/tasks
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "leadId": "lead-123",
  "title": "Llamar al cliente",
  "description": "Seguimiento de presupuesto",
  "dueDate": "2024-01-15T10:00:00Z",
  "assignedToId": "user-456"
}
```

### 8. Actualizar Estado de Tarea
```bash
PATCH /api/leads/tasks/task-123
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "completed": true
}
```

### 9. Reordenar Stages
```bash
PATCH /api/leads/stages/reorder
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "stages": [
    { "stageId": "stage-1", "order": 0 },
    { "stageId": "stage-2", "order": 1 },
    { "stageId": "stage-3", "order": 2 }
  ]
}
```

---

## 📁 Archivos Creados/Modificados

### DTOs
- `apps/api/src/leads/dto/create-pipeline.dto.ts`
- `apps/api/src/leads/dto/create-stage.dto.ts`
- `apps/api/src/leads/dto/reorder-stages.dto.ts`
- `apps/api/src/leads/dto/create-lead.dto.ts` (actualizado)
- `apps/api/src/leads/dto/update-lead.dto.ts` (actualizado)
- `apps/api/src/leads/dto/list-leads.dto.ts` (actualizado)
- `apps/api/src/leads/dto/create-note.dto.ts`
- `apps/api/src/leads/dto/create-task.dto.ts`
- `apps/api/src/leads/dto/update-task.dto.ts`
- `apps/api/src/leads/dto/assign-lead.dto.ts`

### Services
- `apps/api/src/leads/leads.service.ts` (completo con toda la lógica)

### Controllers
- `apps/api/src/leads/leads.controller.ts` (todos los endpoints)

### Modules
- `apps/api/src/leads/leads.module.ts` (actualizado con PrismaModule)

### Tests
- `apps/api/src/leads/leads.service.spec.ts` (5+ tests)

### Seed
- `packages/prisma/seed.ts` (crea pipeline "Default" con stages por organización)

---

## 🧪 Tests Implementados

### Tests de Servicio (leads.service.spec.ts)

1. ✅ **getPipelines** - Debe retornar pipelines de la organización
2. ✅ **getPipelines** - Debe lanzar NotFoundException si el usuario no es miembro
3. ✅ **createPipeline** - Debe crear pipeline para admin
4. ✅ **createPipeline** - Debe lanzar ForbiddenException para SELLER
5. ✅ **createLead** - Debe crear lead exitosamente
6. ✅ **createLead** - Debe lanzar NotFoundException si pipeline no existe
7. ✅ **listLeads** - Debe listar leads con paginación
8. ✅ **listLeads** - Debe filtrar leads para SELLER role
9. ✅ **createNote** - Debe crear nota para lead
10. ✅ **createTask** - Debe crear tarea para lead

**Total: 10+ tests** (más de los 5 mínimos requeridos)

---

## 🌱 Seed

El seed crea automáticamente:
- Pipeline "Default" para cada organización (si no existe)
- 4 stages por defecto:
  - "New" (gris)
  - "Contacted" (azul)
  - "Won" (verde)
  - "Lost" (rojo)

**Ejecutar seed:**
```bash
cd packages/prisma
pnpm db:seed
```

---

## 🔒 Seguridad y Validaciones

### Validaciones de DTOs
- ✅ Todos los DTOs usan `class-validator`
- ✅ Validación de tipos (string, number, enum, etc.)
- ✅ Validación de formato (emails, colores hex, etc.)

### Control de Acceso
- ✅ Verificación de membresía en cada operación
- ✅ Filtrado multi-org estricto
- ✅ Control de roles (ADMIN/MANAGER/OWNER vs SELLER)
- ✅ Validación de pertenencia (pipeline → org, stage → pipeline, etc.)

### Filtros de Seguridad
- ✅ SELLER solo ve leads asignados o creados por ellos
- ✅ Notas privadas solo visibles por el creador (excepto admin/manager)
- ✅ Tareas solo editables por asignado, creador o admin/manager

---

## 📊 Migración

La migración ya existe y fue aplicada previamente. El schema incluye:
- ✅ Todos los modelos (Pipeline, Stage, Lead, Note, Task)
- ✅ Índices correctos
- ✅ Relaciones con foreign keys
- ✅ Enums (LeadStatus, Role)

---

## 🚀 Próximos Pasos

El módulo está listo para:
1. Integración con frontend
2. Agregar más filtros de búsqueda
3. Implementar webhooks/notificaciones
4. Agregar analytics/reportes
5. Integrar con sistemas externos (Meta Lead Ads, TikTok)
