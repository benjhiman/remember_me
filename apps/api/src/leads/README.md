# Módulo Leads (CRM) - Documentación Frontend

## 📋 Tabla de Endpoints

| Método | Ruta | Auth | Roles | Body | Response |
|--------|------|------|-------|------|----------|
| `GET` | `/api/leads/health` | ✅ | Todos | - | `{ ok: true, module: "leads" }` |
| `GET` | `/api/leads/pipelines` | ✅ | Todos | - | `Pipeline[]` |
| `POST` | `/api/leads/pipelines` | ✅ | ADMIN, MANAGER, OWNER | `CreatePipelineDto` | `Pipeline` |
| `POST` | `/api/leads/stages` | ✅ | ADMIN, MANAGER, OWNER | `CreateStageDto` | `Stage` |
| `PATCH` | `/api/leads/stages/reorder` | ✅ | ADMIN, MANAGER, OWNER | `ReorderStagesDto` | `Stage[]` |
| `GET` | `/api/leads` | ✅ | Todos* | Query params | `ListLeadsResponse` |
| `GET` | `/api/leads/:id` | ✅ | Todos* | - | `Lead` |
| `POST` | `/api/leads` | ✅ | Todos | `CreateLeadDto` | `Lead` |
| `PUT` | `/api/leads/:id` | ✅ | Todos* | `UpdateLeadDto` | `Lead` |
| `DELETE` | `/api/leads/:id` | ✅ | ADMIN, MANAGER, OWNER | - | `{ message: string }` |
| `POST` | `/api/leads/:id/assign` | ✅ | Todos* | `AssignLeadDto` | `Lead` |
| `GET` | `/api/leads/:id/notes` | ✅ | Todos* | - | `Note[]` |
| `POST` | `/api/leads/notes` | ✅ | Todos | `CreateNoteDto` | `Note` |
| `GET` | `/api/leads/:id/tasks` | ✅ | Todos* | - | `Task[]` |
| `POST` | `/api/leads/tasks` | ✅ | Todos | `CreateTaskDto` | `Task` |
| `PATCH` | `/api/leads/tasks/:taskId` | ✅ | Todos* | `UpdateTaskDto` | `Task` |

*SELLER solo puede acceder a leads asignados/creados por ellos.

---

## 🔐 Autenticación

Todos los endpoints requieren el header:
```
Authorization: Bearer <accessToken>
```

El `accessToken` se obtiene del flujo de autenticación (`/api/auth/login` o `/api/auth/select-organization`).

---

## 📝 Ejemplos de Requests/Responses

### 1. Health Check

**Request:**
```http
GET /api/leads/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "leads"
}
```

---

### 2. Listar Pipelines

**Request:**
```http
GET /api/leads/pipelines
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "pipeline-123",
    "organizationId": "org-123",
    "name": "Default",
    "color": "#6366f1",
    "order": 0,
    "isDefault": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "stages": [
      {
        "id": "stage-1",
        "pipelineId": "pipeline-123",
        "name": "New",
        "order": 0,
        "color": "#94a3b8",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "stage-2",
        "pipelineId": "pipeline-123",
        "name": "Contacted",
        "order": 1,
        "color": "#3b82f6",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "_count": {
      "leads": 5
    }
  }
]
```

---

### 3. Crear Pipeline

**Request:**
```http
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
  "id": "pipeline-456",
  "organizationId": "org-123",
  "name": "Sales Pipeline",
  "color": "#6366f1",
  "order": 1,
  "isDefault": false,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z",
  "stages": []
}
```

---

### 4. Crear Stage

**Request:**
```http
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
  "id": "stage-789",
  "pipelineId": "pipeline-123",
  "name": "Qualified",
  "order": 2,
  "color": "#10b981",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

---

### 5. Reordenar Stages

**Request:**
```http
PATCH /api/leads/stages/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "stages": [
    { "stageId": "stage-1", "order": 0 },
    { "stageId": "stage-2", "order": 1 },
    { "stageId": "stage-3", "order": 2 }
  ]
}
```

**Response:**
```json
[
  {
    "id": "stage-1",
    "order": 0,
    ...
  },
  {
    "id": "stage-2",
    "order": 1,
    ...
  },
  {
    "id": "stage-3",
    "order": 2,
    ...
  }
]
```

---

### 6. Listar Leads

**Request:**
```http
GET /api/leads?page=1&limit=20&pipelineId=pipeline-123&status=ACTIVE&search=John
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (opcional, default: 1) - Número de página
- `limit` (opcional, default: 10) - Elementos por página
- `search` (opcional) - Búsqueda en name, email, phone
- `pipelineId` (opcional) - Filtrar por pipeline
- `stageId` (opcional) - Filtrar por stage
- `assignedToId` (opcional) - Filtrar por usuario asignado
- `status` (opcional) - ACTIVE, CONVERTED, LOST, ARCHIVED

**Response:**
```json
{
  "data": [
    {
      "id": "lead-123",
      "organizationId": "org-123",
      "pipelineId": "pipeline-123",
      "stageId": "stage-1",
      "assignedToId": "user-456",
      "createdById": "user-789",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "source": "instagram",
      "city": "Buenos Aires",
      "budget": "1500.00",
      "model": "iPhone 15 Pro",
      "customFields": {
        "preferredColor": "blue",
        "tradeIn": true
      },
      "tags": ["vip", "urgent"],
      "status": "ACTIVE",
      "convertedAt": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "pipeline": {
        "id": "pipeline-123",
        "name": "Default",
        "color": "#6366f1"
      },
      "stage": {
        "id": "stage-1",
        "name": "New",
        "color": "#94a3b8"
      },
      "assignedTo": {
        "id": "user-456",
        "name": "Sales Rep",
        "email": "sales@example.com"
      },
      "creator": {
        "id": "user-789",
        "name": "Manager",
        "email": "manager@example.com"
      },
      "_count": {
        "notes": 3,
        "tasks": 2
      }
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

### 7. Obtener Lead

**Request:**
```http
GET /api/leads/lead-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "lead-123",
  "organizationId": "org-123",
  "pipelineId": "pipeline-123",
  "stageId": "stage-1",
  "assignedToId": "user-456",
  "createdById": "user-789",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "source": "instagram",
  "city": "Buenos Aires",
  "budget": "1500.00",
  "model": "iPhone 15 Pro",
  "customFields": {
    "preferredColor": "blue",
    "tradeIn": true
  },
  "tags": ["vip", "urgent"],
  "status": "ACTIVE",
  "convertedAt": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "pipeline": {
    "id": "pipeline-123",
    "name": "Default",
    "color": "#6366f1"
  },
  "stage": {
    "id": "stage-1",
    "name": "New",
    "color": "#94a3b8"
  },
  "assignedTo": {
    "id": "user-456",
    "name": "Sales Rep",
    "email": "sales@example.com"
  },
  "creator": {
    "id": "user-789",
    "name": "Manager",
    "email": "manager@example.com"
  }
}
```

---

### 8. Crear Lead

**Request:**
```http
POST /api/leads
Authorization: Bearer <token>
Content-Type: application/json

{
  "pipelineId": "pipeline-123",
  "stageId": "stage-1",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+9876543210",
  "source": "tiktok",
  "city": "Córdoba",
  "budget": 2000.00,
  "model": "iPhone 15 Pro Max",
  "tags": ["premium"],
  "customFields": {
    "preferredColor": "black",
    "tradeIn": false
  },
  "assignedToId": "user-456"
}
```

**Response:** (mismo formato que GET /api/leads/:id)

---

### 9. Actualizar Lead

**Request:**
```http
PUT /api/leads/lead-123
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Smith Updated",
  "email": "jane.updated@example.com",
  "stageId": "stage-2",
  "status": "ACTIVE",
  "budget": 2200.00,
  "tags": ["premium", "urgent"]
}
```

**Nota:** Todos los campos son opcionales. Solo incluye los campos que quieres actualizar.

**Response:** (mismo formato que GET /api/leads/:id)

---

### 10. Eliminar Lead

**Request:**
```http
DELETE /api/leads/lead-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Lead deleted successfully"
}
```

---

### 11. Asignar Lead

**Request:**
```http
POST /api/leads/lead-123/assign
Authorization: Bearer <token>
Content-Type: application/json

{
  "assignedToId": "user-789"
}
```

**Para desasignar:**
```json
{
  "assignedToId": null
}
```

**Response:** (mismo formato que GET /api/leads/:id)

---

### 12. Listar Notas de Lead

**Request:**
```http
GET /api/leads/lead-123/notes
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "note-123",
    "organizationId": "org-123",
    "leadId": "lead-123",
    "userId": "user-456",
    "content": "Cliente interesado en iPhone 15 Pro. Presupuesto aprobado.",
    "isPrivate": false,
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z",
    "user": {
      "id": "user-456",
      "name": "Sales Rep",
      "email": "sales@example.com"
    }
  },
  {
    "id": "note-124",
    "organizationId": "org-123",
    "leadId": "lead-123",
    "userId": "user-789",
    "content": "Nota privada sobre el cliente.",
    "isPrivate": true,
    "createdAt": "2024-01-01T11:00:00.000Z",
    "updatedAt": "2024-01-01T11:00:00.000Z",
    "user": {
      "id": "user-789",
      "name": "Manager",
      "email": "manager@example.com"
    }
  }
]
```

**Nota:** Las notas privadas solo son visibles para el creador y usuarios con rol ADMIN/MANAGER/OWNER.

---

### 13. Crear Nota

**Request:**
```http
POST /api/leads/notes
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadId": "lead-123",
  "content": "Nueva nota sobre el lead.",
  "isPrivate": false
}
```

**Response:**
```json
{
  "id": "note-125",
  "organizationId": "org-123",
  "leadId": "lead-123",
  "userId": "user-456",
  "content": "Nueva nota sobre el lead.",
  "isPrivate": false,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z",
  "user": {
    "id": "user-456",
    "name": "Sales Rep",
    "email": "sales@example.com"
  },
  "lead": {
    "id": "lead-123",
    "name": "John Doe"
  }
}
```

---

### 14. Listar Tareas de Lead

**Request:**
```http
GET /api/leads/lead-123/tasks
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "id": "task-123",
    "organizationId": "org-123",
    "leadId": "lead-123",
    "assignedToId": "user-456",
    "createdById": "user-789",
    "title": "Llamar al cliente",
    "description": "Seguimiento de presupuesto",
    "dueDate": "2024-01-15T10:00:00.000Z",
    "completed": false,
    "completedAt": null,
    "createdAt": "2024-01-01T10:00:00.000Z",
    "updatedAt": "2024-01-01T10:00:00.000Z",
    "assignedTo": {
      "id": "user-456",
      "name": "Sales Rep",
      "email": "sales@example.com"
    },
    "creator": {
      "id": "user-789",
      "name": "Manager",
      "email": "manager@example.com"
    }
  }
]
```

---

### 15. Crear Tarea

**Request:**
```http
POST /api/leads/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadId": "lead-123",
  "title": "Enviar cotización",
  "description": "Enviar cotización detallada del iPhone 15 Pro",
  "dueDate": "2024-01-20T14:00:00Z",
  "assignedToId": "user-456"
}
```

**Response:**
```json
{
  "id": "task-124",
  "organizationId": "org-123",
  "leadId": "lead-123",
  "assignedToId": "user-456",
  "createdById": "user-789",
  "title": "Enviar cotización",
  "description": "Enviar cotización detallada del iPhone 15 Pro",
  "dueDate": "2024-01-20T14:00:00.000Z",
  "completed": false,
  "completedAt": null,
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z",
  "assignedTo": {
    "id": "user-456",
    "name": "Sales Rep",
    "email": "sales@example.com"
  },
  "creator": {
    "id": "user-789",
    "name": "Manager",
    "email": "manager@example.com"
  },
  "lead": {
    "id": "lead-123",
    "name": "John Doe"
  }
}
```

---

### 16. Actualizar Tarea

**Request:**
```http
PATCH /api/leads/tasks/task-123
Authorization: Bearer <token>
Content-Type: application/json

{
  "completed": true
}
```

**Otros campos opcionales:**
```json
{
  "title": "Título actualizado",
  "description": "Descripción actualizada",
  "dueDate": "2024-01-25T10:00:00Z",
  "completed": true,
  "assignedToId": "user-789"
}
```

**Response:** (mismo formato que GET /api/leads/:id/tasks)

**Nota:** Cuando `completed` se establece en `true`, `completedAt` se establece automáticamente a la fecha/hora actual.

---

## 🔒 Reglas de Permisos

### Roles y Acceso

#### ADMIN / MANAGER / OWNER
- ✅ **Acceso completo** a todos los endpoints
- ✅ Puede crear pipelines y stages
- ✅ Puede ver **todos los leads** de la organización
- ✅ Puede actualizar/eliminar cualquier lead
- ✅ Puede asignar leads a cualquier usuario
- ✅ Puede ver todas las notas (incluyendo privadas)
- ✅ Puede actualizar/eliminar cualquier tarea

#### SELLER
- ✅ Puede crear leads
- ✅ Puede ver **solo leads asignados a ellos** o **creados por ellos**
- ✅ Puede actualizar leads asignados/creados por ellos
- ✅ Puede asignar/desasignar leads asignados/creados por ellos (a otros usuarios de la org)
- ❌ **No puede** crear pipelines/stages
- ❌ **No puede** eliminar leads
- ✅ Puede crear notas (públicas o privadas)
- ✅ Puede ver notas públicas y sus propias notas privadas
- ✅ Puede crear tareas
- ✅ Puede actualizar tareas asignadas/creadas por ellos

### Reglas Específicas

#### Leads
- **Crear:** Todos los roles pueden crear leads
- **Ver:** 
  - ADMIN/MANAGER/OWNER: todos los leads de la organización
  - SELLER: solo leads donde `assignedToId === userId` o `createdById === userId`
- **Actualizar:**
  - ADMIN/MANAGER/OWNER: cualquier lead
  - SELLER: solo leads asignados/creados por ellos
- **Eliminar:** Solo ADMIN/MANAGER/OWNER
- **Asignar:**
  - ADMIN/MANAGER/OWNER: cualquier lead a cualquier usuario de la org
  - SELLER: solo leads asignados/creados por ellos a otros usuarios de la org

#### Notes
- **Crear:** Todos los roles pueden crear notas
- **Ver:**
  - ADMIN/MANAGER/OWNER: todas las notas (públicas y privadas)
  - SELLER: notas públicas + sus propias notas privadas
- **Nota:** No hay endpoint para actualizar/eliminar notas (MVP)

#### Tasks
- **Crear:** Todos los roles pueden crear tareas
- **Ver:** Todos los roles pueden ver todas las tareas de un lead (si tienen acceso al lead)
- **Actualizar:**
  - ADMIN/MANAGER/OWNER: cualquier tarea
  - SELLER: solo tareas donde `assignedToId === userId` o `createdById === userId`

---

## ❌ Errores Comunes

### 401 Unauthorized
**Causa:** Token inválido, expirado o no proporcionado.

**Solución:**
- Verificar que el header `Authorization: Bearer <token>` esté presente
- Renovar el token si expiró (`/api/auth/refresh`)

**Response:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 403 Forbidden
**Causa:** Usuario no tiene permisos suficientes para la operación.

**Ejemplos:**
- SELLER intentando crear pipeline
- SELLER intentando acceder a lead no asignado/creado por ellos
- Usuario intentando actualizar tarea que no le pertenece

**Response:**
```json
{
  "statusCode": 403,
  "message": "Only admins and managers can create pipelines"
}
```

**Solución:**
- Verificar el rol del usuario
- Implementar UI condicional basada en roles
- Mostrar mensajes apropiados al usuario

---

### 404 Not Found
**Causa:** Recurso no encontrado o usuario no es miembro de la organización.

**Ejemplos:**
- Lead, pipeline, stage, task, note no existe
- Recurso existe pero pertenece a otra organización
- Usuario no es miembro de la organización

**Response:**
```json
{
  "statusCode": 404,
  "message": "Lead not found"
}
```

**Solución:**
- Verificar que el ID del recurso sea correcto
- Verificar que el usuario tenga acceso a la organización correcta

---

### 400 Bad Request
**Causa:** Datos inválidos en el body o query params.

**Ejemplos:**
- Campos requeridos faltantes
- Tipos de datos incorrectos
- Valores inválidos (ej: color hex inválido)
- Stage no pertenece al pipeline especificado
- Usuario asignado no es miembro de la organización

**Response:**
```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "pipelineId must be a string",
    "Color must be a valid hex color (e.g., #6366f1)"
  ]
}
```

**Solución:**
- Validar datos en frontend antes de enviar
- Mostrar mensajes de error específicos al usuario
- Verificar que los IDs referenciados existan y sean válidos

---

### 409 Conflict
**Causa:** Conflicto de datos (menos común en este módulo).

**Ejemplo:**
- Pipeline con nombre duplicado (si se implementa validación)

**Response:**
```json
{
  "statusCode": 409,
  "message": "Pipeline name already exists"
}
```

---

### Errores de Validación (400)
**Campos comunes que causan errores:**

1. **CreatePipelineDto:**
   - `name`: requerido, string
   - `color`: opcional, debe ser hex (#RRGGBB)

2. **CreateStageDto:**
   - `pipelineId`: requerido, string
   - `name`: requerido, string
   - `color`: opcional, debe ser hex (#RRGGBB)

3. **CreateLeadDto:**
   - `pipelineId`: requerido, string
   - `stageId`: requerido, string
   - `name`: requerido, string
   - `budget`: opcional, number (decimal)
   - `tags`: opcional, array de strings

4. **CreateTaskDto:**
   - `title`: requerido, string
   - `assignedToId`: requerido, string
   - `dueDate`: opcional, ISO 8601 string

---

## 💡 Tips para Frontend

### Manejo de Paginación
```typescript
interface ListLeadsResponse {
  data: Lead[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### Manejo de Filtros
Los filtros en `GET /api/leads` son acumulativos. Ejemplo:
- `?pipelineId=123&status=ACTIVE&search=John` → Leads del pipeline 123, activos, que contengan "John"

### Actualizaciones Parciales
`PUT /api/leads/:id` acepta campos opcionales. Solo envía los campos que quieres actualizar:
```json
{
  "stageId": "new-stage-id"
}
```

### Asignación/Deseasignación
Para desasignar un lead, envía `null`:
```json
{
  "assignedToId": null
}
```

### Estados de Lead (LeadStatus)
- `ACTIVE` - Lead activo (por defecto)
- `CONVERTED` - Lead convertido en venta
- `LOST` - Lead perdido
- `ARCHIVED` - Lead archivado

### Campos JSON (customFields)
`customFields` es un objeto JSON flexible. Ejemplo:
```json
{
  "customFields": {
    "preferredColor": "blue",
    "tradeIn": true,
    "notes": "Cliente prefiere color azul"
  }
}
```

### Fechas
- Todas las fechas son ISO 8601 strings
- `dueDate` en tasks es opcional
- `completedAt` se establece automáticamente cuando `completed: true`

---

## 🔄 Flujo Recomendado

1. **Obtener pipelines y stages:**
   ```
   GET /api/leads/pipelines
   ```

2. **Listar leads con filtros:**
   ```
   GET /api/leads?pipelineId=xxx&page=1&limit=20
   ```

3. **Obtener detalles de un lead:**
   ```
   GET /api/leads/:id
   ```

4. **Obtener notas y tareas:**
   ```
   GET /api/leads/:id/notes
   GET /api/leads/:id/tasks
   ```

5. **Crear/actualizar recursos según necesidad**

---

## 📞 Soporte

Para más información, consultar:
- `LEADS_IMPLEMENTATION.md` - Documentación técnica completa
- `LEADS_ROUTES_SUMMARY.md` - Resumen de rutas
