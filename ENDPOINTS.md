# API Endpoints - MVP Fase 1

## Autenticación

### POST /api/auth/register
Registra un nuevo usuario y crea una organización.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "organizationName": "Mi Empresa",
  "organizationSlug": "mi-empresa" // opcional
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
Agrega un miembro a la organización. Requiere rol ADMIN o MANAGER.

**Body:**
```json
{
  "email": "newuser@example.com",
  "role": "VENDOR"
}
```

**Response:** Objeto OrganizationMember con user incluido.

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

- **ADMIN**: Control total (puede crear/eliminar miembros, cambiar roles, etc.)
- **MANAGER**: Puede agregar miembros y actualizar organización
- **VENDOR**: Acceso de solo lectura/escritura básica (para el MVP)
