# API Endpoints - Auth + Organizaciones + Roles

## Autenticación

### POST /api/auth/register
Registra un nuevo usuario. Puede crear una organización nueva o aceptar una invitación.

**Body (Crear organización nueva):**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "organizationName": "Mi Empresa",
  "organizationSlug": "mi-empresa" // opcional
}
```

**Body (Aceptar invitación):**
```json
{
  "email": "invited@example.com",
  "password": "SecurePass123",
  "name": "Jane Doe",
  "invitationToken": "abc123..." // token de invitación
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxx...",
    "email": "user@example.com",
    "name": "John Doe",
    "organizationId": "clxxx...",
    "organizationName": "Mi Empresa",
    "role": "ADMIN"
  }
}
```

### POST /api/auth/login
Inicia sesión con email y contraseña.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response:** Mismo formato que register.

### POST /api/auth/refresh
Renueva el access token usando un refresh token.

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST /api/auth/logout
Invalida un refresh token.

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

## Organizaciones

Todos los endpoints requieren autenticación (Bearer token).

### POST /api/organizations
Crea una nueva organización.

**Body:**
```json
{
  "name": "Nueva Empresa",
  "slug": "nueva-empresa" // opcional
}
```

**Response:**
```json
{
  "id": "clxxx...",
  "name": "Nueva Empresa",
  "slug": "nueva-empresa",
  "logo": null,
  "settings": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/organizations
Obtiene todas las organizaciones del usuario actual.

**Response:**
```json
[
  {
    "id": "clxxx...",
    "name": "Mi Empresa",
    "slug": "mi-empresa",
    "logo": null,
    "role": "ADMIN",
    ...
  }
]
```

### GET /api/organizations/:id
Obtiene una organización específica (si el usuario es miembro).

**Response:** Objeto Organization.

### PUT /api/organizations/:id
Actualiza una organización. Requiere rol ADMIN o MANAGER.

**Body:**
```json
{
  "name": "Nombre Actualizado",
  "logo": "https://..." // opcional
}
```

**Response:** Objeto Organization actualizado.

### GET /api/organizations/:id/members
Obtiene todos los miembros de una organización.

**Response:**
```json
[
  {
    "id": "clxxx...",
    "role": "ADMIN",
    "joinedAt": "2024-01-01T00:00:00.000Z",
    "user": {
      "id": "clxxx...",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar": null
    }
  }
]
```

### POST /api/organizations/:id/members
Agrega un miembro a la organización (el usuario debe existir). Requiere rol ADMIN o MANAGER.

**Body:**
```json
{
  "email": "existinguser@example.com",
  "role": "VENDOR"
}
```

**Response:** Objeto OrganizationMember con user incluido.

### POST /api/organizations/:id/invite
Invita a un usuario (puede no existir aún). Requiere rol ADMIN o MANAGER.

**Body:**
```json
{
  "email": "newuser@example.com",
  "role": "VENDOR",
  "expiresInDays": 7 // opcional, default 7
}
```

**Response:**
```json
{
  "id": "clxxx...",
  "email": "newuser@example.com",
  "role": "VENDOR",
  "token": "abc123...", // ⚠️ En producción, solo enviar por email
  "expiresAt": "2024-01-08T00:00:00.000Z",
  "organization": {
    "id": "clxxx...",
    "name": "Mi Empresa",
    "slug": "mi-empresa"
  },
  "inviteLink": "http://localhost:3000/accept-invitation?token=abc123..."
}
```

### GET /api/organizations/:id/invitations
Obtiene todas las invitaciones de una organización. Requiere rol ADMIN o MANAGER.

**Response:**
```json
[
  {
    "id": "clxxx...",
    "email": "invited@example.com",
    "role": "VENDOR",
    "status": "PENDING",
    "expiresAt": "2024-01-08T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "invitedBy": {
      "id": "clxxx...",
      "email": "admin@example.com",
      "name": "Admin User"
    }
  }
]
```

### DELETE /api/organizations/:id/invitations/:invitationId
Cancela una invitación pendiente. Requiere rol ADMIN o MANAGER.

**Response:**
```json
{
  "message": "Invitation cancelled successfully"
}
```

### PUT /api/organizations/:id/members/:memberId/role
Actualiza el rol de un miembro. Requiere rol ADMIN.

**Body:**
```json
{
  "role": "MANAGER"
}
```

**Response:** Objeto OrganizationMember actualizado.

### DELETE /api/organizations/:id/members/:memberId
Elimina un miembro de la organización. Requiere rol ADMIN.

**Response:**
```json
{
  "message": "Member removed successfully"
}
```

---

## Usuarios

Todos los endpoints requieren autenticación (Bearer token).

### GET /api/users/me
Obtiene el perfil del usuario actual.

**Response:**
```json
{
  "id": "clxxx...",
  "email": "user@example.com",
  "name": "John Doe",
  "avatar": null,
  "emailVerified": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### PUT /api/users/me
Actualiza el perfil del usuario actual.

**Body:**
```json
{
  "name": "John Updated",
  "avatar": "https://..." // opcional
}
```

**Response:** Objeto User actualizado.

### GET /api/users/organization/:organizationId
Obtiene todos los usuarios de una organización (si el usuario es miembro).

**Response:**
```json
[
  {
    "id": "clxxx...",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": null,
    "role": "ADMIN",
    "joinedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

## Autenticación

Todos los endpoints (excepto `/api/auth/*`) requieren el header:
```
Authorization: Bearer <accessToken>
```

El access token expira en 15 minutos (configurable).
El refresh token expira en 7 días (configurable).

## Roles

- **ADMIN**: Control total
  - Puede crear/eliminar miembros
  - Puede cambiar roles
  - Puede actualizar organización
  - Puede invitar usuarios
  - Puede cancelar invitaciones
  - No puede cambiar su propio rol
  - No puede eliminarse a sí mismo

- **MANAGER**: Gestión básica
  - Puede agregar miembros existentes
  - Puede invitar usuarios
  - Puede ver/cancelar invitaciones
  - Puede actualizar organización
  - No puede cambiar roles
  - No puede eliminar miembros

- **VENDOR**: Acceso básico
  - Acceso de lectura/escritura básica
  - Sin permisos administrativos

## Flujo de Invitaciones

1. **Admin/Manager invita usuario**: `POST /api/organizations/:id/invite`
2. **Usuario recibe email** (en producción) con link: `/accept-invitation?token=xxx`
3. **Usuario se registra** usando el token: `POST /api/auth/register` con `invitationToken`
4. **Usuario automáticamente se une** a la organización con el rol especificado
