# Remember Me

CRM tipo Monday + Stock/Precios + Gestión de Leads + Ventas para revendedores de iPhone.

## Stack

- **Backend**: NestJS (Node.js + TypeScript)
- **Database**: PostgreSQL + Prisma
- **Jobs/Queues**: Redis + BullMQ
- **Frontend**: Next.js 14 (App Router) + React + Tailwind CSS
- **Auth**: JWT (access + refresh tokens) + roles

## Estructura del Monorepo

```
remember-me/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   ├── prisma/       # Prisma schema + client
│   └── shared/       # Types/interfaces compartidos
```

## Setup

### Prerrequisitos

- Node.js >= 18
- pnpm >= 8
- PostgreSQL
- Redis (para BullMQ)
- Docker & Docker Compose (para staging)

### Instalación Local

1. Instalar dependencias:
```bash
pnpm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

3. Configurar base de datos:
```bash
cd packages/prisma
pnpm db:push  # o pnpm db:migrate
```

4. Generar Prisma client:
```bash
cd packages/prisma
pnpm db:generate
```

### Desarrollo

```bash
# Ejecutar todos los servicios en desarrollo
pnpm dev

# O ejecutar individualmente:
cd apps/api && pnpm dev    # Backend en http://localhost:4000
cd apps/web && pnpm dev    # Frontend en http://localhost:3000
```

### Staging con Docker Compose

Para levantar el entorno completo (API + Worker + Redis + Postgres):

1. Configurar variables de entorno:
```bash
cp .env.docker.example .env.docker
# Editar .env.docker con tus configuraciones
# Importante: JWT_SECRET, TOKEN_ENCRYPTION_KEY, METRICS_TOKEN
```

2. Levantar servicios:
```bash
pnpm docker:up
```

3. Ver logs:
```bash
pnpm docker:logs
# o logs de un servicio específico:
docker-compose -f docker-compose.staging.yml --env-file .env.docker logs -f api
docker-compose -f docker-compose.staging.yml --env-file .env.docker logs -f worker
```

4. Ejecutar smoke e2e tests:
```bash
# Asegúrate de que los servicios estén levantados
pnpm smoke:e2e
```

5. Detener servicios:
```bash
pnpm docker:down
```

**Endpoints de Health:**
- `GET /api/health` - Health básico
- `GET /api/health/extended` - Health extendido (DB, uptime, version)
- `GET /api/integrations/jobs/metrics` - Métricas de jobs (requiere auth)
- `GET /api/metrics` - Métricas Prometheus (requiere `X-Metrics-Token` header)

**Configuración Staging:**
- `QUEUE_MODE=bullmq` - Usa BullMQ (Redis) para cola de jobs
- `RATE_LIMIT_ENABLED=true` - Rate limiting activado
- `WORKER_MODE=0` en API, `WORKER_MODE=1` en Worker
- `JOB_RUNNER_ENABLED=false` en API, `true` en Worker

### Smoke E2E Tests

Los smoke e2e tests validan el funcionamiento end-to-end del sistema:

```bash
cd apps/api
pnpm smoke:e2e
```

**Tests incluidos:**
1. Health extended ok
2. Metrics endpoint auth by token
3. Rate limit: 429 + headers
4. WhatsApp webhook: enqueue job
5. Inbox send-text: enqueue job
6. Worker processing: jobs marcados DONE
7. BullMQ mode: jobs en Redis
8. Meta spend fetch-now: enqueue job

**Variables de entorno para smoke tests:**
```bash
API_BASE_URL=http://localhost:4000
METRICS_TOKEN=staging-metrics-token-change-me
TEST_ORG_ID=test-org-id  # Opcional
TEST_USER_EMAIL=test@example.com  # Opcional
TEST_USER_PASSWORD=TestPassword123!  # Opcional
```

## Módulos (API)

- `auth/` - Autenticación y autorización
- `organizations/` - Gestión de organizaciones
- `users/` - Gestión de usuarios
- `leads/` - CRM de leads (pipelines, stages, leads)
- `stock/` - Gestión de stock
- `pricing/` - Reglas de precios
- `sales/` - Ventas y reservas
- `dashboard/` - KPIs y métricas
- `common/` - Guards, decorators, interceptors, DTOs compartidos

## Roadmap

- **Fase 1 (MVP)**: Auth, CRM Leads, Stock/Pricing, Ventas, Dashboard básico
- **Fase 2**: Integraciones (Meta Lead Ads, TikTok)
- **Fase 3**: Inbox unificado, Automatizaciones
