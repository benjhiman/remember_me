# Resumen Completo del Proyecto — CRM Remember Me

**Fecha:** Enero 2025  
**Versión:** v1.0 (Production Baseline)  
**Estado:** Producción en `app.iphonealcosto.com` y `api.iphonealcosto.com`

---

## 📋 ÍNDICE

1. [Visión General](#visión-general)
2. [Infraestructura](#infraestructura)
3. [Autenticación, Roles y Configuración](#autenticación-roles-y-configuración)
4. [White-Label y Configuración](#white-label-y-configuración)
5. [Módulos Implementados](#módulos-implementados)
6. [Inbox (WhatsApp / Instagram / Unificado)](#inbox-whatsapp--instagram--unificado)
7. [Ads (Meta)](#ads-meta)
8. [Performance y Escalabilidad](#performance-y-escalabilidad)
9. [QA, Seguridad y Base SaaS](#qa-seguridad-y-base-saas)
10. [Qué Está Listo para Producción](#qué-está-listo-para-producción)
11. [Próximos Pasos](#próximos-pasos)

---

## 1. VISIÓN GENERAL

**Remember Me** es un CRM tipo Monday + Stock/Precios + Gestión de Leads + Ventas diseñado específicamente para revendedores de iPhone. El sistema está construido como una plataforma SaaS multi-tenant con arquitectura enterprise-grade.

### Stack Tecnológico

- **Backend**: NestJS (Node.js + TypeScript) + Prisma ORM
- **Base de Datos**: PostgreSQL (Railway)
- **Frontend**: Next.js 14 (App Router) + React + Tailwind CSS + shadcn/ui
- **Autenticación**: JWT (access + refresh tokens) + RBAC
- **Jobs/Queues**: Redis + BullMQ
- **Deployment**: 
  - API: Railway (`api.iphonealcosto.com`)
  - Web: Vercel (`app.iphonealcosto.com`)
- **Monorepo**: pnpm workspaces

### Arquitectura

```
remember-me/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   ├── prisma/       # Prisma schema + client
│   └── shared/       # Types/interfaces compartidos
```

---

## 2. INFRAESTRUCTURA

### Servicios en Producción

1. **API (Backend)**
   - URL: `https://api.iphonealcosto.com`
   - Stack: NestJS + Prisma + PostgreSQL
   - Health: `GET /api/health` y `GET /api/health/extended`
   - Rate Limiting: Redis-based (opcional, fail-safe)

2. **Web (Frontend)**
   - URL: `https://app.iphonealcosto.com`
   - Stack: Next.js 14 (App Router) + React
   - Health: HTTP 200 en `/` o `/login`

3. **Worker (Background Jobs)**
   - Stack: NestJS Worker + BullMQ + Redis
   - Health: Validado mediante métricas/jobs

4. **Database**
   - PostgreSQL en Railway
   - Validado en `/api/health/extended` (campo `db`)

5. **Redis**
   - Railway Redis
   - Usado para: BullMQ, rate limiting (opcional)

### Health Checks

- **`GET /api/health`**: Health básico (status, timestamp)
- **`GET /api/health/extended`**: Health extendido (db, redis, worker status, uptime, version)
- **Script de verificación**: `./scripts/prod-check.sh` (bash, validación automática)

### Observabilidad

- **Métricas Prometheus**: `GET /api/metrics` (requiere `X-Metrics-Token`)
- **Request ID Tracking**: Header `X-Request-Id` en todas las requests
- **Logging**: Winston con niveles y formato estructurado
- **Audit Log**: Sistema de auditoría para eventos clave (CREATE, UPDATE, DELETE)

---

## 3. AUTENTICACIÓN, ROLES Y CONFIGURACIÓN

### Sistema de Autenticación

**JWT Tokens:**
- **Access Token**: 15 minutos (almacenado en memoria del frontend)
- **Refresh Token**: 7 días (almacenado en httpOnly cookie)
- **Temporary Token**: Usado para selección de organización

**Endpoints:**
- `POST /api/auth/register` - Registro de usuario + creación de organización
- `POST /api/auth/login` - Login con email/password
- `POST /api/auth/refresh` - Renovar access token
- `POST /api/auth/logout` - Invalidar refresh token
- `GET /api/users/me` - Perfil del usuario actual (incluye role + permissions)

**Seguridad:**
- Hash de contraseñas con bcrypt (salt rounds)
- Rate limiting en login (5 req/min por IP)
- Validación de DTOs con `class-validator`
- Security headers (Helmet): X-Content-Type-Options, X-Frame-Options, HSTS, CSP

### Sistema RBAC (Role-Based Access Control)

**Roles Disponibles:**
- **OWNER**: Acceso total (incluye `org.manage`)
- **ADMIN**: Casi todo (excepto `org.manage`)
- **MANAGER**: Read/write en módulos, puede `members.manage`, no `settings.write` ni `integrations.manage`
- **SELLER**: Read/write en leads/sales/inbox, read-only en stock/settings, no members/integrations
- **VIEWER**: Solo lectura en todos los módulos

**Permisos (Formato: `<module>.<action>`):**
- `dashboard.read`
- `leads.read` / `leads.write`
- `sales.read` / `sales.write`
- `stock.read` / `stock.write`
- `inbox.read` / `inbox.write`
- `settings.read` / `settings.write`
- `customers.read` / `customers.write`
- `vendors.read` / `vendors.write`
- `purchases.read` / `purchases.write`
- `org.manage` (solo OWNER)
- `members.manage`
- `integrations.read` / `integrations.manage`

**Implementación:**
- **Backend**: `@RequirePermissions()` decorator + `PermissionsGuard`
- **Frontend**: `usePermissions()` hook con `can(permission)` helper
- **UI Gating**: Botones/acciones se ocultan si falta permiso
- **Backend siempre valida**: Aunque la UI oculte acciones, el backend rechaza con `403 Forbidden`

### Multi-Organización (Multi-Tenant)

**Arquitectura:**
- Todas las tablas relevantes tienen `organizationId`
- Usuarios pueden pertenecer a múltiples organizaciones (tabla `Membership`)
- Contexto de organización se propaga vía header `X-Organization-Id`

**Org Switcher:**
- Dropdown en TopbarZoho
- Cambio sin logout
- Persistencia en `localStorage` (`rm.currentOrgId`)
- Invalidación automática de queries al cambiar org

**Validación Backend:**
- `OrganizationInterceptor` valida membership antes de procesar requests
- Si header `X-Organization-Id` presente: valida membership → 403 si no es miembro
- Si header ausente: usa JWT `organizationId` (backward compat)

---

## 4. WHITE-LABEL Y CONFIGURACIÓN

### Sistema de Configuración

**Fuente de Verdad:** `Organization.settings` (JSONB field)

**Estructura Mínima:**
```json
{
  "crm": {
    "permissions": { ... },
    "inbox": {
      "sellerSeesOnlyAssigned": true
    },
    "ui": { ... }
  }
}
```

**Endpoints:**
- `GET /api/settings` - Obtener configuración actual
- `PUT /api/settings` - Actualizar configuración (requiere `settings.write`)

**Características:**
- Defaults explícitos al crear organización
- Validación con Zod o class-validator
- Sistema nunca se rompe si falta una key (fallback a defaults)
- Toda la lógica de permisos consulta `settings`, NO hardcodea reglas

---

## 5. MÓDULOS IMPLEMENTADOS

### 5.1. Leads (CRM)

**Rutas Web:**
- `/leads` - Listado de leads (tabla o kanban)
- `/leads/[id]` - Detalle de lead
- `/leads/[id]/edit` - Editar lead
- `/leads/new` - Crear nuevo lead
- `/leads/board` - Vista kanban

**Funcionalidades:**
- Pipelines y Stages personalizables
- Leads con campos: name, email, phone, status, stage, assignedUser
- Notas y Tareas asociadas a leads
- Filtros: status, stage, assignedTo, search
- Paginación y búsqueda

**Endpoints API:**
- `GET /api/leads` - Listar leads (con filtros y paginación)
- `GET /api/leads/:id` - Obtener lead por ID
- `POST /api/leads` - Crear lead
- `PUT /api/leads/:id` - Actualizar lead
- `DELETE /api/leads/:id` - Eliminar lead (ADMIN/MANAGER/OWNER)
- `POST /api/leads/:id/assign` - Asignar lead a usuario
- `GET /api/leads/pipelines` - Listar pipelines
- `POST /api/leads/pipelines` - Crear pipeline
- `GET /api/leads/:id/notes` - Listar notas
- `POST /api/leads/notes` - Crear nota
- `GET /api/leads/:id/tasks` - Listar tareas
- `POST /api/leads/tasks` - Crear tarea

**Permisos:** `leads.read` / `leads.write`

### 5.2. Stock

**Rutas Web:**
- `/stock` - Listado de items en stock (virtualizado si > 50 items)
- `/stock/[id]` - Detalle de item
- `/stock/reservations` - Gestión de reservas

**Funcionalidades:**
- Items con: model, SKU, IMEI, condition (NEW/USED/REFURBISHED), quantity, status
- Estados: AVAILABLE, RESERVED, SOLD, DAMAGED, RETURNED, CANCELLED
- Reservas con fechas y usuarios
- Filtros: status, condition, search
- Virtualización para listas grandes (> 50 items)

**Endpoints API:**
- `GET /api/stock` - Listar items (con filtros y paginación)
- `GET /api/stock/:id` - Obtener item por ID
- `POST /api/stock` - Crear item
- `PATCH /api/stock/:id` - Actualizar item
- `GET /api/stock/reservations` - Listar reservas

**Permisos:** `stock.read` / `stock.write`

### 5.3. Sales (Ventas)

**Rutas Web:**
- `/sales` - Listado de ventas
- `/sales/[id]` - Detalle de venta
- `/sales/[id]/edit` - Editar venta
- `/sales/new` - Crear nueva venta
- `/sales/customers` - Gestión de clientes
- `/sales/vendors` - Gestión de proveedores
- `/sales/purchases` - Gestión de compras

**Funcionalidades:**

**Ventas:**
- Ventas con items, totales, estado, cliente
- Estados: DRAFT, PENDING, COMPLETED, CANCELLED

**Customers (Clientes):**
- CRUD completo de clientes
- Campos: name, email, phone, notes, status (ACTIVE/INACTIVE)
- Búsqueda y filtros

**Vendors (Proveedores):**
- CRUD completo de proveedores
- Campos: name, email, phone, notes, status (ACTIVE/INACTIVE)
- Búsqueda y filtros

**Purchases (Compras):**
- Órdenes de compra con líneas (items)
- Estados: DRAFT, APPROVED, RECEIVED, CANCELLED
- Transiciones de estado validadas
- Cálculo automático de totales (subtotal, tax placeholder, total)
- Relación con Vendors
- **Nota**: No impacta stock real aún (v0)

**Endpoints API:**
- `GET /api/sales` - Listar ventas
- `POST /api/sales` - Crear venta
- `GET /api/customers` - Listar clientes
- `POST /api/customers` - Crear cliente
- `PATCH /api/customers/:id` - Actualizar cliente
- `GET /api/vendors` - Listar proveedores
- `POST /api/vendors` - Crear proveedor
- `PATCH /api/vendors/:id` - Actualizar proveedor
- `GET /api/purchases` - Listar compras
- `POST /api/purchases` - Crear compra
- `PATCH /api/purchases/:id` - Actualizar compra (solo DRAFT)
- `POST /api/purchases/:id/transition` - Cambiar estado de compra

**Permisos:** `sales.read` / `sales.write`, `customers.read` / `customers.write`, `vendors.read` / `vendors.write`, `purchases.read` / `purchases.write`

### 5.4. Pricing (Precios)

**Rutas Web:**
- `/pricing` - Gestión de reglas de precios

**Funcionalidades:**
- Reglas de precios con markup y condiciones
- Tipos de markup: PERCENTAGE, FIXED

**Endpoints API:**
- `GET /api/pricing` - Listar reglas
- `POST /api/pricing` - Crear regla
- `PATCH /api/pricing/:id` - Actualizar regla

**Permisos:** `pricing.read` / `pricing.write`

### 5.5. Dashboard

**Rutas Web:**
- `/dashboard` - Dashboard principal
- `/dashboard/roas` - ROI/ROAS de ads

**Funcionalidades:**
- KPIs y métricas agregadas
- Gráficos y visualizaciones (recharts)

**Endpoints API:**
- `GET /api/dashboard` - Obtener métricas

**Permisos:** `dashboard.read`

### 5.6. Settings

**Rutas Web:**
- `/settings` - Configuración general
- `/settings/audit` - Log de auditoría (tabla densa, read-only)
- `/settings/integrations` - Integraciones (Meta, WhatsApp, Instagram)

**Funcionalidades:**
- Configuración de organización
- Branding (logo, colores)
- Audit log visible en UI
- Gestión de integraciones

**Endpoints API:**
- `GET /api/settings` - Obtener configuración
- `PUT /api/settings` - Actualizar configuración
- `GET /api/settings/audit` - Obtener audit log

**Permisos:** `settings.read` / `settings.write`

---

## 6. INBOX (WHATSAPP / INSTAGRAM / UNIFICADO)

### 6.1. Inbox WhatsApp

**Ruta:** `/inbox/whatsapp`

**Layout:**
- 3-columnas: Lista de chats (izquierda), Conversación (centro), Detalles opcionales (derecha)
- Footer fijo con input de mensaje
- Estilo: Clon de WhatsApp Web (bordes suaves, tipografía legible, alta densidad)

**Funcionalidades:**
- Lista de conversaciones con preview, unread count, timestamp
- Vista de conversación con mensajes
- Input de mensaje siempre visible
- Estados: OPEN, PENDING, CLOSED
- Asignación de conversaciones a usuarios
- Búsqueda y filtros

**Endpoints API:**
- `GET /api/inbox/conversations?provider=WHATSAPP` - Listar conversaciones
- `GET /api/inbox/conversations/:id` - Obtener conversación
- `GET /api/inbox/conversations/:id/messages` - Listar mensajes
- `POST /api/inbox/conversations/:id/messages` - Enviar mensaje
- `PATCH /api/inbox/conversations/:id/status` - Cambiar estado

**Permisos:** `inbox.read` / `inbox.write`

### 6.2. Inbox Instagram

**Ruta:** `/inbox/instagram`

**Layout:**
- Misma lógica que WhatsApp pero estilo Instagram DM
- Avatares circulares, fondo blanco, bubbles estilo Instagram
- Diferencias visuales claras vs WhatsApp

**Funcionalidades:**
- Mismas funcionalidades que WhatsApp
- Misma API, diferente layout

**Endpoints API:**
- Mismos que WhatsApp pero con `provider=INSTAGRAM`

### 6.3. Inbox Unificado

**Ruta:** `/inbox/unified`

**Layout:**
- Vista "Inbox CRM" con lista única
- Badge de canal (WhatsApp/Instagram) en cada conversación
- Filtros por canal y estado

**Funcionalidades:**
- Lista combinada de conversaciones de ambos canales
- Filtros: provider, status, search
- Virtualización para listas grandes

---

## 7. ADS (META)

**Ruta:** `/ads`

**Layout:**
- Sidebar izquierdo: Selector de Ad Account, Date Range, Refresh
- Header: Breadcrumb
- Tabla densa: Name, Status, Spend, Impressions, Clicks, CTR, CPC
- Drill-down: Click en ad → detalle

**Estilo:**
- Exactamente como Meta Ads Manager
- No elementos "custom inventados"

**Funcionalidades:**
- Sincronización con Meta Graph API
- OAuth 2.0 para autenticación
- Token encryption (AES-256-GCM)
- CSRF protection (signed state)
- Webhooks para Lead Ads

**Endpoints API:**
- `GET /api/integrations/meta/accounts` - Listar ad accounts
- `GET /api/integrations/meta/ads` - Listar ads
- `POST /api/integrations/meta/sync` - Sincronizar datos
- `GET /api/integrations/meta/leads` - Listar leads de ads

**Permisos:** `integrations.read` / `integrations.manage`

---

## 8. PERFORMANCE Y ESCALABILIDAD

### Virtualización

**Implementado:**
- Stock list: Virtualizado si > 50 items (`@tanstack/react-virtual`)
- Inbox list: Virtualizado si > 50 items
- Leads list: Virtualizado si > 50 items (si tabla)

**Librería:** `@tanstack/react-virtual`

**Beneficios:**
- Renderiza solo items visibles
- Scroll fluido con miles de items
- Mantiene accesibilidad básica

### Paginación / Infinite Scroll

**Patrón Unificado:**
- API: Soporte para `page`/`limit` o cursor
- Frontend: `useInfiniteQuery` para infinite scroll
- "Load more" button en lugar de paginación tradicional

**Páginas con Infinite Scroll:**
- Stock list
- Inbox conversations
- Leads list (si aplica)

### Prefetch Inteligente

**Implementado:**
- Prefetch on hover para `/leads/[id]`, `/inbox/[conversationId]`
- Deshabilitado en conexiones lentas (detectado automáticamente)

### React Query Optimizado

**Configuración:**
- `staleTime`: 1-5 minutos según módulo
- `gcTime`: 5-10 minutos
- Invalidación solo de queries necesarias
- Auto-invalidación al cambiar org

### Medición de Performance

**Herramientas:**
- `perfMark()` y `perfMeasureToNow()` helpers
- Logging solo en dev o con `NEXT_PUBLIC_PERF_LOG=1`
- Medición: mount → data loaded

---

## 9. QA, SEGURIDAD Y BASE SAAS

### Audit Log

**Backend:**
- Registro de eventos clave: Login, settings change, conversation assignment/status, Lead/Sale creation/edit, Customer/Vendor/Purchase CRUD
- Tabla `AuditLog` con: actorUserId, action, entityType, entityId, before/after, metadata

**Frontend:**
- Ruta `/settings/audit`
- Tabla densa, read-only
- Filtros: fecha, usuario, acción, entidad

### Rate Limiting

**Implementado:**
- Redis-based (opcional, fail-safe)
- ThrottlerGuard de NestJS
- Configuración por endpoint
- Headers de rate limit en responses

### Security Headers

**Helmet Middleware:**
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`

### Input Validation

**Backend:**
- `class-validator` en todos los DTOs
- Whitelist: Solo propiedades definidas
- Forbid non-whitelisted: Extra properties rechazadas
- Transform: Conversión automática de tipos

### CORS

**Configuración:**
- `CORS_ORIGINS` env var (lista separada por comas)
- Incluye `https://app.iphonealcosto.com` en producción
- Credentials: `include` en todas las requests

### Error Handling

**Frontend:**
- `ErrorBoundary` global
- `ApiErrorBanner` para errores de API
- Toasts consistentes: Success / Error / Info
- Mensajes específicos: CORS, 404, 500, Timeout

**Backend:**
- Respuestas estructuradas: `{ code, message, ... }`
- 403 Forbidden con detalles de permisos
- 400 Bad Request con validaciones
- 404 Not Found para recursos no encontrados

### Testing

**E2E (Playwright):**
- Tests mínimos: Login, org switcher, cambio de org, invalid org IDs
- Archivo: `apps/web/__tests__/e2e/org-switcher.spec.ts`

**Unit/Integration (Jest):**
- Tests de servicios críticos (Purchases, Customers, Vendors)
- Validación de permisos, multi-tenant, transiciones

**Smoke Tests:**
- Script: `./scripts/prod-check.sh`
- Validación automática de health endpoints

---

## 10. QUÉ ESTÁ LISTO PARA PRODUCCIÓN

### ✅ Funcionalidades Completas

1. **Autenticación y Autorización**
   - Login/Logout/Register
   - JWT con refresh tokens
   - RBAC completo (5 roles, 20+ permisos)
   - Multi-org con switcher

2. **Módulos Core**
   - Leads (CRM completo con pipelines, stages, notas, tareas)
   - Stock (gestión de inventario con reservas)
   - Sales (ventas, customers, vendors, purchases)
   - Pricing (reglas de precios)
   - Dashboard (KPIs y métricas)

3. **Inbox**
   - WhatsApp (clon de WhatsApp Web)
   - Instagram (clon de Instagram DM)
   - Unificado (vista combinada)

4. **Ads**
   - Integración con Meta Graph API
   - OAuth 2.0
   - Sincronización de ads y leads

5. **Settings**
   - Configuración de organización
   - Audit log visible
   - Integraciones

### ✅ Infraestructura

- API desplegada en Railway
- Web desplegada en Vercel
- PostgreSQL en Railway
- Redis en Railway (BullMQ, rate limiting)
- Health checks funcionando
- Scripts de verificación automática

### ✅ Seguridad

- Security headers (Helmet)
- Input validation (class-validator)
- CORS configurado
- Rate limiting (opcional, fail-safe)
- Audit log
- RBAC completo

### ✅ Performance

- Virtualización en listas grandes
- Infinite scroll / paginación
- Prefetch inteligente
- React Query optimizado
- Medición de performance

### ✅ UX/UI

- Layout Zoho (sidebar + topbar)
- Empty states profesionales
- Loading skeletons (no spinners)
- Toasts consistentes
- Error handling claro
- Responsive design

---

## 11. PRÓXIMOS PASOS

### P0 (Crítico - Próximas 2 semanas)

1. **Purchases v1.1**
   - Impacto real en stock al recibir compra
   - SKU mapping (PurchaseLine → StockItem)
   - Taxes reales (no placeholder)

2. **Inbox Mejoras**
   - Envío de mensajes real (integración con APIs de WhatsApp/Instagram)
   - Webhooks funcionando
   - Notificaciones en tiempo real

3. **Leads Mejoras**
   - Automatizaciones básicas (ej: auto-asignar por reglas)
   - Email templates
   - Exportar leads (CSV)

### P1 (Alto - Próximo mes)

1. **Dashboard Avanzado**
   - Gráficos interactivos
   - Filtros de fecha personalizables
   - Exportar reportes (PDF)

2. **Stock Avanzado**
   - Movimientos de stock automáticos
   - Alertas de stock bajo
   - Historial completo de movimientos

3. **Sales Avanzado**
   - Facturación básica
   - Integración con compras → stock
   - Reportes de ventas

4. **Performance P2**
   - Command Palette (⌘K)
   - Keyboard shortcuts completos
   - Micro-interacciones

### P2 (Medio - Próximos 2-3 meses)

1. **Integraciones**
   - TikTok Ads
   - Email marketing (Mailchimp/SendGrid)
   - SMS (Twilio)

2. **Automatizaciones**
   - Workflows visuales
   - Triggers y acciones
   - Notificaciones personalizables

3. **Mobile App**
   - React Native app
   - Notificaciones push
   - Acceso offline básico

4. **Analytics Avanzado**
   - Funnel analysis
   - Cohort analysis
   - Predictive analytics

### P3 (Bajo - Backlog)

1. **White-Label Completo**
   - Custom domains
   - Branding completo (colores, logos, favicon)
   - Email templates personalizables

2. **Multi-Idioma**
   - i18n (español, inglés)
   - Detección automática de idioma

3. **API Pública**
   - API keys para integraciones
   - Webhooks para eventos
   - Documentación Swagger/OpenAPI

---

## 📚 REFERENCIAS Y DOCUMENTACIÓN

### Documentación Técnica

- **RBAC**: `docs/RBAC.md`
- **Multi-Org UX**: `docs/MULTI_ORG_UX.md`
- **Sales Customers/Vendors**: `docs/SALES_CUSTOMERS_VENDORS.md`
- **Sales Purchases**: `docs/SALES_PURCHASES.md`
- **Production Baseline**: `docs/PRODUCTION_BASELINE.md`
- **Security**: `SECURITY.md`

### Scripts Útiles

- **Prod Check**: `./scripts/prod-check.sh`
- **Smoke Tests**: `./scripts/prod-smoke.ts`
- **Seed Owner**: `pnpm --filter @remember-me/api seed:owner`

### Endpoints Clave

- **Health**: `GET /api/health`, `GET /api/health/extended`
- **Auth**: `POST /api/auth/login`, `POST /api/auth/refresh`
- **Me**: `GET /api/users/me` (incluye permissions)
- **Settings**: `GET /api/settings`, `PUT /api/settings`
- **Audit**: `GET /api/settings/audit`

---

## 🎯 MÉTRICAS DE ÉXITO

### Producción Actual

- ✅ Builds pasando: API y Web
- ✅ Health checks: 200 OK
- ✅ Login funcionando
- ✅ Multi-org funcionando
- ✅ RBAC funcionando
- ✅ Virtualización funcionando
- ✅ Audit log funcionando

### Próximas Métricas

- Tiempo de carga inicial < 2s
- Tiempo de respuesta API < 200ms (p95)
- Uptime > 99.9%
- Zero security incidents
- User satisfaction > 4.5/5

---

**Última actualización:** Enero 2025  
**Mantenido por:** Tech Lead  
**Versión del documento:** 1.0
