# Pasos para Migración y Setup del Backend

## ✅ 1. Schema Confirmado

Los modelos de Auth están correctos:

- **User**: email único, sin organizationId directo
- **Organization**: slug único
- **Membership**: userId + organizationId + role (enum)
- **RefreshToken**: userId + organizationId
- **Role enum**: OWNER, ADMIN, MANAGER, SELLER

Constraints correctos:
- User.email @unique
- Organization.slug @unique
- Membership @@unique([userId, organizationId])
- RefreshToken.token @unique
- RefreshToken @@index([userId, organizationId])

## 📋 2. Pre-requisitos

1. PostgreSQL corriendo localmente
2. Crear base de datos: `createdb remember_me` (o desde psql)
3. Configurar `.env` con DATABASE_URL

## 🔧 3. Configuración .env

Crea/edita `.env` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/remember_me?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="your-refresh-secret-key-change-in-production"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=4000
NODE_ENV="development"
FRONTEND_URL="http://localhost:3000"
```

## 🚀 4. Comandos a Ejecutar

### Desde la raíz del proyecto:

```bash
# 1. Instalar dependencias (si no lo has hecho)
pnpm install

# 2. Generar migración y aplicarla
cd packages/prisma
pnpm db:migrate dev --name init_auth_multi_org

# 3. Generar Prisma Client
pnpm db:generate

# 4. Volver a la raíz y levantar backend
cd ../..
pnpm dev
```

## ✅ 5. Verificación de Endpoints

Una vez levantado el backend (debería estar en http://localhost:4000), prueba:

1. `POST /api/auth/register`
2. `POST /api/auth/login`
3. `POST /api/auth/select-organization`
4. `POST /api/auth/refresh`
5. `POST /api/auth/logout`

## 📝 6. Ejemplo de Flujo Completo

Ver archivo: `TEST_FLOW_EXAMPLE.md` (se creará después de levantar el backend)
