# Flujo de Autenticación Multi-Org

## Diagrama de Flujo

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ POST /auth/login
     │ { email, password }
     ▼
┌─────────────────────────────────┐
│  AuthService.login()            │
│  - Valida credenciales          │
│  - Busca memberships            │
└────┬────────────────────────────┘
     │
     ├─ Si memberships.length === 1
     │  └─► Retorna { accessToken, refreshToken, user }
     │
     └─ Si memberships.length > 1
        └─► Retorna { requiresOrgSelection: true, organizations, tempToken }
            │
            │ POST /auth/select-organization
            │ Authorization: Bearer tempToken
            │ Body: { organizationId }
            ▼
        ┌─────────────────────────────────┐
        │  AuthService.selectOrganization()│
        │  - Valida tempToken              │
        │  - Verifica membership           │
        │  - Genera tokens finales         │
        └────┬────────────────────────────┘
             │
             └─► Retorna { accessToken, refreshToken, user }
```

## Payloads y DTOs

### 1. POST /auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (1 organización):**
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
    "role": "OWNER"
  }
}
```

**Response (múltiples organizaciones):**
```json
{
  "requiresOrgSelection": true,
  "organizations": [
    {
      "id": "clxxx...",
      "name": "Empresa A",
      "slug": "empresa-a",
      "role": "OWNER"
    },
    {
      "id": "clyyy...",
      "name": "Empresa B",
      "slug": "empresa-b",
      "role": "ADMIN"
    }
  ],
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**tempToken payload (JWT):**
```json
{
  "sub": "clxxx...",  // userId
  "type": "org_selection",
  "iat": 1234567890,
  "exp": 1234568190  // 5-10 minutos
}
```

### 2. POST /auth/select-organization

**Request:**
```json
{
  "organizationId": "clxxx..."
}
```

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (tempToken)
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
    "role": "OWNER"
  }
}
```

**accessToken payload (JWT):**
```json
{
  "sub": "clxxx...",  // userId
  "email": "user@example.com",
  "organizationId": "clxxx...",
  "role": "OWNER",
  "iat": 1234567890,
  "exp": 1234571790  // 15 minutos
}
```

**refreshToken payload (JWT):**
```json
{
  "sub": "clxxx...",  // userId
  "email": "user@example.com",
  "organizationId": "clxxx...",
  "role": "OWNER",
  "iat": 1234567890,
  "exp": 1235172690  // 7 días
}
```

## DTOs

### LoginDto
```typescript
{
  email: string;
  password: string;
}
```

### LoginResponseDto (single org)
```typescript
{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    organizationId: string;
    organizationName: string;
    role: Role;
  };
}
```

### LoginResponseDto (multiple orgs)
```typescript
{
  requiresOrgSelection: true;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: Role;
  }>;
  tempToken: string;
}
```

### SelectOrganizationDto
```typescript
{
  organizationId: string;
}
```

### SelectOrganizationResponseDto
```typescript
{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    organizationId: string;
    organizationName: string;
    role: Role;
  };
}
```

## Token Types

1. **tempToken** (org selection):
   - Duración: 5-10 minutos
   - Payload: `{ sub: userId, type: "org_selection" }`
   - Secret: JWT_SECRET (mismo que access token)
   - Usado solo para: POST /auth/select-organization

2. **accessToken** (normal):
   - Duración: 15 minutos
   - Payload: `{ sub: userId, email, organizationId, role }`
   - Secret: JWT_SECRET
   - Usado para: Todos los endpoints protegidos

3. **refreshToken** (normal):
   - Duración: 7 días
   - Payload: `{ sub: userId, email, organizationId, role }`
   - Secret: JWT_REFRESH_SECRET
   - Almacenado en DB con organizationId
   - Usado para: POST /auth/refresh
