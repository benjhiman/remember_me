# Ejemplo de Flujo Completo - Auth Multi-Org

## Setup

Base URL: `http://localhost:4000/api`

## Flujo Completo: Register → Login → Select Org → Access Token

### 1. Register (crea usuario + organización)

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123",
    "name": "John Doe",
    "organizationName": "Mi Empresa",
    "organizationSlug": "mi-empresa"
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxx123...",
    "email": "john@example.com",
    "name": "John Doe",
    "organizationId": "clxxx456...",
    "organizationName": "Mi Empresa",
    "role": "OWNER"
  }
}
```

**Nota:** El usuario se crea como OWNER de la organización.

---

### 2. Login (usuario con 1 organización)

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxx123...",
    "email": "john@example.com",
    "name": "John Doe",
    "organizationId": "clxxx456...",
    "organizationName": "Mi Empresa",
    "role": "OWNER"
  }
}
```

---

### 3. Login (usuario con múltiples organizaciones)

Primero, agregamos el usuario a otra organización (desde otro usuario admin o manualmente en DB).

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123"
  }'
```

**Response (200 OK):**
```json
{
  "requiresOrgSelection": true,
  "organizations": [
    {
      "id": "clxxx456...",
      "name": "Mi Empresa",
      "slug": "mi-empresa",
      "role": "OWNER"
    },
    {
      "id": "clyyy789...",
      "name": "Otra Empresa",
      "slug": "otra-empresa",
      "role": "ADMIN"
    }
  ],
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 4. Select Organization

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/select-organization \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "organizationId": "clyyy789..."
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxx123...",
    "email": "john@example.com",
    "name": "John Doe",
    "organizationId": "clyyy789...",
    "organizationName": "Otra Empresa",
    "role": "ADMIN"
  }
}
```

---

### 5. Refresh Token

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 6. Logout

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

### 7. Usar Access Token (ejemplo: obtener organizaciones)

**Request:**
```bash
curl -X GET http://localhost:4000/api/organizations \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
[
  {
    "id": "clxxx456...",
    "name": "Mi Empresa",
    "slug": "mi-empresa",
    "logo": null,
    "settings": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "role": "OWNER"
  },
  {
    "id": "clyyy789...",
    "name": "Otra Empresa",
    "slug": "otra-empresa",
    "logo": null,
    "settings": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "role": "ADMIN"
  }
]
```

---

## Flujo Completo en Secuencia

```
1. POST /auth/register
   → Crea usuario + organización
   → Retorna: accessToken, refreshToken, user (role: OWNER)

2. POST /auth/login (si tiene 1 org)
   → Retorna: accessToken, refreshToken, user

2b. POST /auth/login (si tiene >1 org)
   → Retorna: requiresOrgSelection: true, organizations[], tempToken

3. POST /auth/select-organization (con tempToken)
   → Retorna: accessToken, refreshToken, user (con org seleccionada)

4. GET /organizations (con accessToken)
   → Retorna: lista de organizaciones del usuario

5. POST /auth/refresh (con refreshToken)
   → Retorna: nuevo accessToken

6. POST /auth/logout (con refreshToken)
   → Invalida refreshToken
```
