# Schema Prisma - Confirmación Final

## Modelos de Auth/Multi-Org

### User
```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String?
  avatar        String?
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  memberships      Membership[]
  refreshTokens    RefreshToken[]
  // ... otras relaciones

  @@index([email])
}
```

**Características:**
- ✅ Email único global (para login)
- ✅ Sin organizationId directo (User es global)
- ✅ Relación con organizaciones vía Membership

### Organization
```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  logo      String?
  settings  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members      Membership[]
  // ... otras relaciones

  @@index([slug])
}
```

**Características:**
- ✅ Slug único
- ✅ Multi-tenant: todas las queries filtran por organizationId

### Membership
```prisma
model Membership {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  role           Role     @default(SELLER)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user         User         @relation(...)
  organization Organization @relation(...)

  @@unique([userId, organizationId])
  @@index([organizationId, role])
  @@index([userId])
}
```

**Características:**
- ✅ Role en Membership (no en User)
- ✅ Un usuario puede tener múltiples memberships
- ✅ Unique constraint: un usuario solo puede ser miembro una vez por org
- ✅ Indexes para queries comunes

### RefreshToken
```prisma
model RefreshToken {
  id             String   @id @default(cuid())
  token          String   @unique
  userId         String
  organizationId String
  expiresAt      DateTime
  createdAt      DateTime @default(now())

  user         User         @relation(...)
  organization Organization @relation(...)

  @@index([token])
  @@index([userId])
  @@index([userId, organizationId])
}
```

**Características:**
- ✅ Token único
- ✅ organizationId incluido (multi-org support)
- ✅ Indexes para búsquedas eficientes

### Role Enum
```prisma
enum Role {
  OWNER
  ADMIN
  MANAGER
  SELLER
}
```

**Características:**
- ✅ Enum (no tabla)
- ✅ Roles: OWNER > ADMIN > MANAGER > SELLER
- ✅ Se aplica por Membership (no global)

## ✅ Validaciones

- ✅ Multi-tenant por organizationId
- ✅ Roles por Membership (no por User)
- ✅ Email único global (permite multi-org)
- ✅ Constraints e índices correctos
- ✅ Relaciones con cascadas apropiadas

## 📋 Listo para Migración

El schema está listo para:
```bash
pnpm db:migrate dev --name init_auth_multi_org
```
