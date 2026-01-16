# Resumen de Rutas - Módulo Leads

## 📋 Lista Completa de Endpoints

### Base Path: `/api/leads`

Todos los endpoints requieren autenticación (`Authorization: Bearer <token>`)

---

## 1. Health Check
- **GET** `/api/leads/health`
- **Descripción**: Health check del módulo
- **Auth**: Requerida
- **Roles**: Todos
- **Response**: `{ ok: true, module: "leads" }`

---

## 2. Pipelines

### Listar Pipelines
- **GET** `/api/leads/pipelines`
- **Descripción**: Obtiene todos los pipelines de la organización
- **Auth**: Requerida
- **Roles**: Todos
- **Response**: Array de pipelines con stages incluidos

### Crear Pipeline
- **POST** `/api/leads/pipelines`
- **Descripción**: Crea un nuevo pipeline
- **Auth**: Requerida
- **Roles**: ADMIN, MANAGER, OWNER
- **Body**:
  ```json
  {
    "name": "Sales Pipeline",
    "color": "#6366f1" // opcional
  }
  ```

---

## 3. Stages

### Crear Stage
- **POST** `/api/leads/stages`
- **Descripción**: Crea un nuevo stage en un pipeline
- **Auth**: Requerida
- **Roles**: ADMIN, MANAGER, OWNER
- **Body**:
  ```json
  {
    "pipelineId": "pipeline-123",
    "name": "Qualified",
    "color": "#10b981" // opcional
  }
  ```

### Reordenar Stages
- **PATCH** `/api/leads/stages/reorder`
- **Descripción**: Reordena múltiples stages
- **Auth**: Requerida
- **Roles**: ADMIN, MANAGER, OWNER
- **Body**:
  ```json
  {
    "stages": [
      { "stageId": "stage-1", "order": 0 },
      { "stageId": "stage-2", "order": 1 }
    ]
  }
  ```

---

## 4. Leads

### Listar Leads
- **GET** `/api/leads`
- **Descripción**: Lista leads con paginación y filtros
- **Auth**: Requerida
- **Roles**: Todos (SELLER solo ve sus leads asignados/creados)
- **Query Params**:
  - `page` (opcional, default: 1)
  - `limit` (opcional, default: 10)
  - `search` (opcional) - Busca en name, email, phone
  - `pipelineId` (opcional)
  - `stageId` (opcional)
  - `assignedToId` (opcional)
  - `status` (opcional) - ACTIVE, CONVERTED, LOST, ARCHIVED
- **Response**: 
  ```json
  {
    "data": [...],
    "meta": {
      "total": 100,
      "page": 1,
      "limit": 10,
      "totalPages": 10
    }
  }
  ```

### Obtener Lead
- **GET** `/api/leads/:id`
- **Descripción**: Obtiene un lead por ID
- **Auth**: Requerida
- **Roles**: Todos (SELLER solo si asignado/creado por ellos)

### Crear Lead
- **POST** `/api/leads`
- **Descripción**: Crea un nuevo lead
- **Auth**: Requerida
- **Roles**: Todos
- **Body**:
  ```json
  {
    "pipelineId": "pipeline-123",
    "stageId": "stage-123",
    "name": "John Doe",
    "email": "john@example.com", // opcional
    "phone": "+1234567890", // opcional
    "source": "instagram", // opcional
    "city": "Buenos Aires", // opcional
    "budget": 1500.00, // opcional
    "model": "iPhone 15 Pro", // opcional
    "tags": ["vip", "urgent"], // opcional
    "customFields": {}, // opcional
    "assignedToId": "user-456" // opcional
  }
  ```

### Actualizar Lead
- **PUT** `/api/leads/:id`
- **Descripción**: Actualiza un lead
- **Auth**: Requerida
- **Roles**: Todos (SELLER solo si asignado/creado por ellos)
- **Body**: Todos los campos opcionales (mismo formato que create)

### Eliminar Lead
- **DELETE** `/api/leads/:id`
- **Descripción**: Elimina un lead
- **Auth**: Requerida
- **Roles**: ADMIN, MANAGER, OWNER

### Asignar Lead
- **POST** `/api/leads/:id/assign`
- **Descripción**: Asigna un lead a un usuario
- **Auth**: Requerida
- **Roles**: Todos (admin/manager o asignado/creador actual)
- **Body**:
  ```json
  {
    "assignedToId": "user-789" // opcional (null para desasignar)
  }
  ```

---

## 5. Notes

### Listar Notas de Lead
- **GET** `/api/leads/:id/notes`
- **Descripción**: Obtiene todas las notas de un lead
- **Auth**: Requerida
- **Roles**: Todos (notas privadas solo visibles por creador o admin/manager)

### Crear Nota
- **POST** `/api/leads/notes`
- **Descripción**: Crea una nota (puede estar asociada a un lead o no)
- **Auth**: Requerida
- **Roles**: Todos
- **Body**:
  ```json
  {
    "leadId": "lead-123", // opcional
    "content": "Nota sobre el lead...",
    "isPrivate": false // opcional, default: false
  }
  ```

---

## 6. Tasks

### Listar Tareas de Lead
- **GET** `/api/leads/:id/tasks`
- **Descripción**: Obtiene todas las tareas de un lead
- **Auth**: Requerida
- **Roles**: Todos

### Crear Tarea
- **POST** `/api/leads/tasks`
- **Descripción**: Crea una tarea (puede estar asociada a un lead o no)
- **Auth**: Requerida
- **Roles**: Todos
- **Body**:
  ```json
  {
    "leadId": "lead-123", // opcional
    "title": "Llamar al cliente",
    "description": "Seguimiento de presupuesto", // opcional
    "dueDate": "2024-01-15T10:00:00Z", // opcional
    "assignedToId": "user-456"
  }
  ```

### Actualizar Tarea
- **PATCH** `/api/leads/tasks/:taskId`
- **Descripción**: Actualiza una tarea (estado, título, etc.)
- **Auth**: Requerida
- **Roles**: Todos (solo asignado, creador o admin/manager)
- **Body**:
  ```json
  {
    "title": "Título actualizado", // opcional
    "description": "Descripción actualizada", // opcional
    "dueDate": "2024-01-20T10:00:00Z", // opcional
    "completed": true, // opcional
    "assignedToId": "user-789" // opcional
  }
  ```

---

## 📊 Resumen por Categoría

| Categoría | GET | POST | PUT | PATCH | DELETE | Total |
|-----------|-----|------|-----|-------|--------|-------|
| Pipelines | 1 | 1 | 0 | 0 | 0 | 2 |
| Stages | 0 | 1 | 0 | 1 | 0 | 2 |
| Leads | 2 | 1 | 1 | 0 | 1 | 5 |
| Notes | 1 | 1 | 0 | 0 | 0 | 2 |
| Tasks | 1 | 1 | 0 | 1 | 0 | 3 |
| **Health** | 1 | 0 | 0 | 0 | 0 | 1 |
| **TOTAL** | **6** | **5** | **1** | **2** | **1** | **15** |

---

## 🔒 Control de Acceso por Roles

### ADMIN / MANAGER / OWNER
- ✅ Acceso completo a todos los endpoints
- ✅ Puede crear pipelines y stages
- ✅ Puede ver todos los leads de la organización
- ✅ Puede eliminar leads
- ✅ Puede ver todas las notas (incluyendo privadas)

### SELLER
- ✅ Puede crear leads
- ✅ Puede ver solo leads asignados a ellos o creados por ellos
- ✅ Puede actualizar leads asignados/creados por ellos
- ✅ Puede asignar/desasignar leads asignados/creados por ellos
- ❌ No puede crear pipelines/stages
- ❌ No puede eliminar leads
- ✅ Puede crear notas y tareas
- ✅ Puede ver notas públicas y propias
- ✅ Puede actualizar tareas asignadas/creadas por ellos
