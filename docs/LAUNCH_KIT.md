# Enterprise Launch Kit — CRM Remember Me

## 📋 Qué es el producto

**Remember Me** es un CRM SaaS multi-tenant diseñado específicamente para revendedores de iPhone y operaciones de retail/wholesale. Combina gestión de leads, inventario, ventas, compras y un inbox unificado (WhatsApp + Instagram) en una sola plataforma con UX estilo Zoho y arquitectura enterprise-grade.

El sistema está construido con Next.js (frontend) y NestJS (backend), desplegado en Vercel y Railway, con PostgreSQL, Redis, y soporte completo para multi-organización, RBAC, y audit log.

---

## 🎯 Para quién es (ICP)

### Primary ICP
- **Revendedores de iPhone**: Operaciones que compran/venden iPhones en volumen
- **Wholesale/Retail**: Negocios que gestionan inventario, leads, y ventas simultáneamente
- **Agencias de ventas**: Equipos que necesitan gestión de leads, asignación, y seguimiento

### Secondary ICP
- **Operaciones multi-marca**: Negocios que manejan múltiples marcas/productos
- **Equipos de ventas distribuidos**: Organizaciones con múltiples ubicaciones/equipos

---

## 🚀 Diferenciadores

### 1. UX Enterprise (Zoho-style)
- Layout consistente con sidebar + topbar en todas las vistas
- Tablas densas con virtualización para grandes volúmenes
- Empty states profesionales con CTAs claros
- Skeleton loaders (no spinners)
- Micro-interacciones y transiciones suaves

### 2. Multi-Organización Nativo
- Usuarios pueden pertenecer a múltiples organizaciones
- Org Switcher en topbar (cambio sin logout)
- Aislamiento completo de datos por organización
- Contexto de organización visible en todas las páginas

### 3. RBAC Completo
- 5 roles: OWNER, ADMIN, MANAGER, SELLER, VIEWER
- 20+ permisos granulares por módulo
- UI gating automático (botones/acciones se ocultan según permisos)
- Backend siempre valida (403 si falta permiso)

### 4. Inbox Unificado
- WhatsApp (clon de WhatsApp Web)
- Instagram (clon de Instagram DM)
- Vista unificada con filtros por canal
- Estados: OPEN, PENDING, CLOSED
- Asignación de conversaciones a usuarios

### 5. Gestión de Stock Avanzada
- Items con IMEI, SKU, condición (NEW/USED/REFURBISHED)
- Estados: AVAILABLE, RESERVED, SOLD, DAMAGED, RETURNED, CANCELLED
- Reservas con fechas y usuarios
- Virtualización para listas grandes (> 50 items)

### 6. Módulo de Compras (Purchases)
- Órdenes de compra con líneas (items)
- Estados: DRAFT, APPROVED, RECEIVED, CANCELLED
- Transiciones de estado validadas
- Cálculo automático de totales
- Relación con Vendors (proveedores)

---

## ✅ Qué está listo hoy

### Módulos Core
- ✅ **Leads (CRM)**: Pipelines, stages, leads, notas, tareas, asignación
- ✅ **Stock**: Gestión de inventario, reservas, estados, condiciones
- ✅ **Sales**: Ventas, customers, vendors, purchases
- ✅ **Pricing**: Reglas de precios con markup
- ✅ **Dashboard**: KPIs y métricas agregadas
- ✅ **Settings**: Configuración de organización, audit log, integraciones

### Inbox
- ✅ **WhatsApp**: Lista de conversaciones, vista de chat, envío de mensajes
- ✅ **Instagram**: Mismo flujo con UI estilo Instagram
- ✅ **Unificado**: Vista combinada con filtros por canal

### Ads (Meta)
- ✅ Integración con Meta Graph API
- ✅ OAuth 2.0 para autenticación
- ✅ Sincronización de ads y leads
- ✅ Token encryption (AES-256-GCM)

### Infraestructura
- ✅ API desplegada en Railway (`api.iphonealcosto.com`)
- ✅ Web desplegada en Vercel (`app.iphonealcosto.com`)
- ✅ PostgreSQL en Railway
- ✅ Redis en Railway (BullMQ, rate limiting)
- ✅ Health checks (`/api/health`, `/api/health/extended`)
- ✅ Scripts de verificación automática (`./scripts/prod-check.sh`)

### Seguridad
- ✅ JWT con refresh tokens (access: 15min, refresh: 7 días)
- ✅ RBAC completo (5 roles, 20+ permisos)
- ✅ Multi-tenant con aislamiento por `organizationId`
- ✅ Audit log para eventos clave
- ✅ Rate limiting (Redis-based, fail-safe)
- ✅ Security headers (Helmet)
- ✅ Input validation (class-validator)
- ✅ CORS configurado para producción

### Performance
- ✅ Virtualización en listas grandes (Stock, Inbox, Leads)
- ✅ Infinite scroll / paginación
- ✅ Prefetch inteligente
- ✅ React Query optimizado (staleTime/gcTime)
- ✅ Medición de performance

---

## 🗺️ Qué viene próximo (Roadmap)

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

---

## 🔒 Seguridad y Compliance

### RBAC (Role-Based Access Control)
- **Roles**: OWNER, ADMIN, MANAGER, SELLER, VIEWER
- **Permisos granulares**: `leads.read`, `leads.write`, `stock.read`, `stock.write`, etc.
- **UI gating**: Botones/acciones se ocultan según permisos
- **Backend validation**: Siempre valida permisos (403 si falta)

### Audit Log
- Registro de eventos clave: Login, settings change, conversation assignment/status, Lead/Sale creation/edit, Customer/Vendor/Purchase CRUD
- Tabla `AuditLog` con: actorUserId, action, entityType, entityId, before/after, metadata
- UI visible en `/settings/audit` (tabla densa, read-only)

### Multi-Tenant
- Aislamiento completo por `organizationId`
- Validación de membership en cada request
- Header `X-Organization-Id` para scope de requests
- Usuarios no pueden acceder a datos de otras orgs

### Rate Limiting
- Redis-based (opcional, fail-safe)
- ThrottlerGuard de NestJS
- Configuración por endpoint
- Headers de rate limit en responses

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`

### Input Validation
- `class-validator` en todos los DTOs
- Whitelist: Solo propiedades definidas
- Forbid non-whitelisted: Extra properties rechazadas
- Transform: Conversión automática de tipos

---

## 🏗️ Infraestructura

### Deployment
- **API**: Railway (`api.iphonealcosto.com`)
- **Web**: Vercel (`app.iphonealcosto.com`)
- **Database**: PostgreSQL en Railway
- **Redis**: Railway Redis (BullMQ, rate limiting)

### Health Checks
- `GET /api/health` - Health básico (status, timestamp)
- `GET /api/health/extended` - Health extendido (db, redis, worker status, uptime, version)
- Script de verificación: `./scripts/prod-check.sh`

### Observabilidad
- **Métricas Prometheus**: `GET /api/metrics` (requiere `X-Metrics-Token`)
- **Request ID Tracking**: Header `X-Request-Id` en todas las requests
- **Logging**: Winston con niveles y formato estructurado

### Baseline
- **Tag**: `prod-baseline-v1`
- **Script de verificación**: `./scripts/prod-check.sh`
- **Checklist pre/post-merge**: Documentado en `docs/PRODUCTION_BASELINE.md`

---

## 📚 Documentación Técnica

- **RBAC**: `docs/RBAC.md`
- **Multi-Org UX**: `docs/MULTI_ORG_UX.md`
- **Sales Customers/Vendors**: `docs/SALES_CUSTOMERS_VENDORS.md`
- **Sales Purchases**: `docs/SALES_PURCHASES.md`
- **Production Baseline**: `docs/PRODUCTION_BASELINE.md`
- **Resumen Completo**: `docs/RESUMEN_COMPLETO_PROYECTO.md`

---

## 🎯 Success Criteria

### Para el Cliente
- Login funciona con credenciales válidas
- Puede crear/editar leads, stock, sales, purchases
- Inbox muestra conversaciones de WhatsApp/Instagram
- Org switcher funciona (si tiene múltiples orgs)
- Permisos se respetan (botones se ocultan según role)

### Para el Equipo
- Health checks pasan (200 OK)
- No hay errores 500 en logs
- Builds pasan (API y Web)
- Rate limiting funciona
- Audit log registra eventos clave

---

**Última actualización:** Enero 2025  
**Versión:** 1.0 (Production Baseline)
