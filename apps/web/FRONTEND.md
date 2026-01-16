# Frontend v1 - Inbox + Attribution/ROAS

## Overview

Frontend completo para Remember Me con Inbox unificado (WhatsApp + Instagram) y Dashboard ROAS, construido con Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, TanStack Query y Zustand.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand (auth) + TanStack Query (server state)
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React

## Setup Local

### Prerrequisitos

- Node.js >= 18
- pnpm >= 8
- Backend API corriendo en `http://localhost:4000` (o configurar `NEXT_PUBLIC_API_BASE_URL`)

### Instalación

```bash
cd apps/web
pnpm install
```

### Variables de Entorno

Crear archivo `.env.local` con las siguientes variables:

```bash
# Requerido
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api

# Opcional (defaults)
NEXT_PUBLIC_APP_ENV=dev  # dev | staging | prod
NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS=10000  # ms (default: 10000)
NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN=2000  # ms (default: 2000)
NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED=8000  # ms (default: 8000)
```

**Nota:** Las variables de entorno se validan al iniciar la aplicación. Si falta `NEXT_PUBLIC_API_BASE_URL`, la app fallará con un error claro.

### Variables de Entorno

Crear `.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

### Desarrollo

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000)

### Build

```bash
pnpm build
pnpm start
```

### Tests

```bash
pnpm test
```

## Estructura del Proyecto

```
apps/web/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Grupo de rutas de auth
│   │   ├── login/
│   │   └── select-org/
│   ├── inbox/               # Inbox unificado
│   │   ├── page.tsx
│   │   └── [conversationId]/
│   ├── dashboard/
│   │   └── roas/            # Dashboard ROAS
│   └── settings/
│       └── integrations/    # Configuración de integraciones
├── components/
│   ├── ui/                  # Componentes base (shadcn/ui)
│   ├── inbox/               # Componentes específicos de inbox
│   └── dashboard/           # Componentes de dashboard
├── lib/
│   ├── api/                 # API client y hooks
│   ├── store/               # Zustand stores
│   └── utils/               # Utilidades
└── types/                   # TypeScript types
```

## Rutas

### Públicas

- `/login` - Login con email/password
- `/select-org` - Selección de organización (si user tiene múltiples orgs)

### Protegidas (requieren auth)

- `/inbox` - Lista de conversaciones
- `/inbox/[conversationId]` - Vista de conversación individual
- `/dashboard/roas` - Dashboard de ROAS (campaign/adset/ad)
- `/settings/integrations` - Configuración de integraciones Meta

## API Client

El API client centralizado (`lib/api/client.ts`) maneja:

- Inyección automática de `Authorization: Bearer <token>`
- Inyección de `X-Organization-Id` header
- Refresh automático de token en 401
- Redirección a `/login` si refresh falla
- Manejo centralizado de errores

### Uso

```typescript
import { api } from '@/lib/api/client';

// GET
const conversations = await api.get<ConversationListResponse>('/inbox/conversations?status=OPEN');

// POST
const response = await api.post('/inbox/conversations/123/send-text', { text: 'Hello' });
```

## Autenticación

El sistema de auth usa Zustand con persistencia en localStorage:

- `accessToken` - JWT token de acceso
- `refreshToken` - Token para refresh
- `user` - Información del usuario (incluye organizationId)
- `tempToken` - Token temporal para selección de org

### Flujo

1. User hace login → `POST /api/auth/login`
2. Si tiene 1 org → recibe `accessToken`, `refreshToken`, `user`
3. Si tiene múltiples orgs → recibe `tempToken` + lista de `organizations`
4. Selección de org → `POST /api/auth/select-organization` con `tempToken`
5. Refresh automático → Si token expira, se refresha automáticamente

## Inbox

### Listado de Conversaciones

- **Filtros**: provider, status, assignedToId, tag, q (búsqueda)
- **Paginación**: page, limit
- **Polling**: Cada 5 segundos (configurable)
- **Badges**: SLA status, unread count
- **Preview**: Último mensaje + dirección

### Vista de Conversación

- Lista de mensajes (paginada)
- Envío de mensajes (text/template)
- Status de mensajes outbound (QUEUED/SENT/DELIVERED/READ/FAILED)
- Quick actions: assign, mark-read, change status, add/remove tags
- Link a lead si existe

### Componentes Clave

- `ConversationListItem` - Item en lista
- `MessageBubble` - Mensaje individual
- `FiltersBar` - Barra de filtros
- `TagsPicker` - Selector de tags
- `TemplatePicker` - Selector de templates

## Dashboard ROAS

### Filtros

- `from` / `to` - Rango de fechas
- `groupBy` - campaign | adset | ad
- `includeZeroRevenue` - Incluir filas sin revenue

### Tabla

Muestra métricas por grupo:
- ID (campaignId/adsetId/adId)
- Leads Count
- Sales Count
- Revenue
- Spend
- ROAS (Revenue / Spend)
- Conversion Rate
- Avg Ticket

### Export

Exporta tabla a CSV (client-side) usando datos del endpoint.

## Settings / Integrations

### Vista Principal

Muestra todas las cuentas Meta conectadas para la organización:
- **Estado**: CONNECTED, DISCONNECTED, ERROR
- **Detalles**: Provider, Page ID, Instagram User ID, Ad Accounts
- **Token**: Fecha de expiración
- **Acciones**: Botón "Desconectar" con confirmación

### Flujo OAuth End-to-End

1. **Usuario hace click en "Conectar cuenta Meta"**
   - Frontend llama `GET /api/integrations/meta/oauth/start`
   - Backend devuelve `{ authorizationUrl: "https://www.facebook.com/..." }`
   - Frontend redirige a `authorizationUrl`

2. **Usuario autoriza en Meta**
   - Meta redirige a backend: `GET /api/integrations/meta/oauth/callback?code=...&state=...`
   - Backend intercambia code por token, crea/actualiza `ConnectedAccount`
   - Backend redirige a frontend: `/settings/integrations?connected=true&accountId=...`

3. **Frontend recibe callback**
   - Detecta `connected=true` en query params
   - Refresca lista de cuentas conectadas
   - Limpia URL (remueve query params)
   - Muestra cuenta recién conectada

4. **Manejo de errores**
   - Si Meta devuelve error: `/settings/integrations?error=...&reason=...`
   - Frontend muestra mensaje de error
   - Limpia URL después de 5 segundos

### Desconectar Cuenta

- Click en "Desconectar" → Confirmación → `POST /api/integrations/meta/oauth/disconnect/:accountId`
- Refresca lista automáticamente

### Endpoints Backend

- `GET /api/integrations/meta/oauth/start` - Inicia OAuth (devuelve URL)
- `GET /api/integrations/meta/oauth/callback` - Callback de Meta (redirect a frontend)
- `POST /api/integrations/meta/oauth/disconnect/:accountId` - Desconecta cuenta
- `GET /api/integrations/meta/connected-accounts` - Lista cuentas conectadas
- `GET /api/integrations/meta/ad-accounts` - Lista ad accounts disponibles

## Componentes UI (shadcn/ui)

Componentes base disponibles:
- `Button` - Botones con variantes
- `Input` - Inputs de formulario
- `Card` - Tarjetas contenedoras
- Más componentes según necesidad

## Estado de Mensajes

Los mensajes outbound muestran su status:
- `QUEUED` - En cola
- `SENT` - Enviado
- `DELIVERED` - Entregado
- `READ` - Leído
- `FAILED` - Fallido

## Helpers UX

Cada conversación incluye:
- `canReply` - false si está CLOSED
- `requiresTemplate` - true si fuera de ventana 24h
- `slaStatus` - OK | WARNING | BREACH

## Tests

Tests mínimos (8-12) cubren:
- Smoke tests de páginas principales
- API client mocks
- Componentes críticos

## Deploy a Producción

### Build

```bash
pnpm build
```

**Importante:** El build requiere `NEXT_PUBLIC_API_BASE_URL` para validación. Si no está presente, se usan valores por defecto durante el build, pero la app fallará en runtime si falta.

### Variables de Entorno Requeridas

- `NEXT_PUBLIC_API_BASE_URL`: URL completa del backend API (requerido en runtime)
- `NEXT_PUBLIC_APP_ENV`: Ambiente (`dev`, `staging`, `prod`) - default: `dev`

### Variables Opcionales (Feature Flags)

- `NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS`: Intervalo de polling para lista de conversaciones (ms) - default: `10000`
- `NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN`: Intervalo cuando conversación está abierta (ms) - default: `2000`
- `NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED`: Intervalo cuando conversación está cerrada (ms) - default: `8000`

### Validación de Env Vars

Las variables de entorno se validan usando **Zod** en `lib/config/env.ts`:
- **Build time**: Si falta `NEXT_PUBLIC_API_BASE_URL`, se usan valores por defecto (no falla el build)
- **Runtime (cliente)**: Si falta o tiene formato incorrecto, la app falla con mensaje claro
- **Tests**: Se usan valores por defecto automáticamente

### Manejo Global de Errores

El API client (`lib/api/client.ts`) maneja errores globalmente:

- **401 Unauthorized**: 
  - Intenta refresh token automáticamente
  - Si refresh falla: logout + redirect a `/login`
- **403 Forbidden**: 
  - Muestra alert "No tienes permisos para realizar esta acción"
  - No redirige (permite al usuario seguir navegando)
- **Otros errores**: Se propagan normalmente para manejo específico

### Health Check

El frontend incluye un **Health Indicator** en `/settings/integrations`:

- Llama a `GET /api/health/extended` cada 30 segundos
- Muestra:
  - Estado general (ok/error)
  - Estado de base de datos (connected/disconnected + latency)
  - Ambiente (dev/staging/prod)
  - Versión del sistema
  - Timestamp de última verificación
- Útil para monitoreo en producción y debugging

### Deploy Options

#### Vercel (Recomendado)

1. Conectar repositorio a Vercel
2. Configurar variables de entorno:
   - `NEXT_PUBLIC_API_BASE_URL` (requerido)
   - `NEXT_PUBLIC_APP_ENV` (opcional, default: `dev`)
   - Polling intervals (opcional)
3. Deploy automático en push a `main`

#### Netlify

1. Conectar repositorio
2. Build command: `cd apps/web && pnpm install && pnpm build`
3. Publish directory: `apps/web/.next`
4. Configurar env vars en dashboard

#### Docker (Opcional)

Ver `apps/web/Dockerfile` (si existe) o usar build estándar de Next.js.

### Checklist de Deploy

- [ ] `NEXT_PUBLIC_API_BASE_URL` configurado correctamente
- [ ] `NEXT_PUBLIC_APP_ENV` configurado (`prod` para producción)
- [ ] Polling intervals ajustados según necesidades (opcional)
- [ ] Build exitoso: `pnpm build`
- [ ] Tests pasando: `pnpm test`
- [ ] Health check accesible en `/settings/integrations`
- [ ] CORS configurado en backend para permitir frontend URL

## API Gaps

Ninguno identificado. Todos los endpoints necesarios están disponibles en el backend.

## Estado Actual

✅ **Completado:**
- Setup completo (Next.js, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zod)
- API client centralizado con auth y refresh automático
- Páginas: login, select-org, inbox, inbox/[conversationId], dashboard/roas, settings/integrations
- Componentes: ConversationListItem, UI base (Button, Input, Card)
- Hooks: useConversations, useMessages, useAttribution
- Tests: 4 tests pasando (login, api client, useConversations)
- Documentación completa

⚠️ **Pendiente (opcional para MVP):**
- Componentes avanzados: TagsPicker, TemplatePicker (pueden agregarse después)
- FiltersBar como componente separado (actualmente inline en inbox page)
- MessageBubble como componente separado (actualmente inline en conversation page)
- Métricas avanzadas en dashboard

**Nota:** El frontend es funcional y usable. Los componentes faltantes son mejoras de UX que pueden agregarse iterativamente.

## Notas

- Polling de inbox es cada 5s (configurable)
- No hay websockets (se puede agregar después)
- OAuth flow requiere interacción manual del usuario
- Todos los endpoints requieren autenticación excepto `/login` y `/select-org`
