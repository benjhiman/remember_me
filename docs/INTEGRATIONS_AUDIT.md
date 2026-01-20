# Auditoría de Integraciones - Instagram, WhatsApp, Meta Ads

## A) Instagram Inbox

### ✅ Webhooks
- **Archivo**: `apps/api/src/integrations/webhooks/instagram-webhook.controller.ts`
- **Endpoint**: `GET/POST /api/webhooks/instagram`
- **Verificación**: ✅ Implementado con `InstagramSignatureGuard`
- **Estado**: ✅ Funcional

### ✅ Persistencia de Mensajes
- **Modelos**: `Conversation` y `MessageLog` en `packages/prisma/schema.prisma`
- **Tablas**: `Conversation` (línea 750), `MessageLog` (línea 719)
- **Estado**: ✅ Mensajes se guardan correctamente

### ✅ Endpoints para Listar Conversaciones
- **Endpoint**: `GET /api/inbox/conversations?provider=INSTAGRAM`
- **Archivo**: `apps/api/src/integrations/inbox/inbox.controller.ts` (línea 34)
- **Estado**: ✅ Funcional

### ✅ Endpoints para Listar Mensajes
- **Endpoint**: `GET /api/inbox/conversations/:id/messages`
- **Archivo**: `apps/api/src/integrations/inbox/inbox.controller.ts` (línea 66)
- **Estado**: ✅ Funcional

### ✅ Endpoint para Enviar Mensaje
- **Endpoint**: `POST /api/inbox/conversations/:id/send-text`
- **Archivo**: `apps/api/src/integrations/inbox/inbox.controller.ts` (línea 218)
- **Estado**: ✅ Funcional (solo texto, sin attachments para Instagram)

### ❌ UI en Frontend
- **Archivo actual**: `apps/web/app/inbox/page.tsx`
- **Estado**: ❌ Existe UI unificada pero **NO tiene tabs separados** por provider
- **Falta**: Crear `/inbox/instagram` y `/inbox/whatsapp` con tabs

---

## B) WhatsApp Inbox

### ✅ Webhooks
- **Archivo**: `apps/api/src/integrations/webhooks/whatsapp-webhook.controller.ts`
- **Endpoint**: `GET/POST /api/webhooks/whatsapp`
- **Verificación**: ✅ Implementado con `WhatsAppSignatureGuard`
- **Estado**: ✅ Funcional

### ✅ Persistencia de Mensajes
- **Modelos**: `Conversation` y `MessageLog` en `packages/prisma/schema.prisma`
- **Tablas**: `Conversation` (línea 750), `MessageLog` (línea 719)
- **Estado**: ✅ Mensajes se guardan correctamente

### ✅ Endpoints para Listar Conversaciones
- **Endpoint**: `GET /api/inbox/conversations?provider=WHATSAPP`
- **Archivo**: `apps/api/src/integrations/inbox/inbox.controller.ts` (línea 34)
- **Estado**: ✅ Funcional

### ✅ Endpoints para Listar Mensajes
- **Endpoint**: `GET /api/inbox/conversations/:id/messages`
- **Archivo**: `apps/api/src/integrations/inbox/inbox.controller.ts` (línea 66)
- **Estado**: ✅ Funcional

### ✅ Endpoint para Enviar Mensaje
- **Endpoint**: `POST /api/inbox/conversations/:id/send-text`
- **Archivo**: `apps/api/src/integrations/inbox/inbox.controller.ts` (línea 218)
- **Estado**: ✅ Funcional (texto + attachments)

### ❌ UI en Frontend
- **Archivo actual**: `apps/web/app/inbox/page.tsx`
- **Estado**: ❌ Existe UI unificada pero **NO tiene tabs separados** por provider
- **Falta**: Crear `/inbox/instagram` y `/inbox/whatsapp` con tabs

---

## C) Meta Ads (Marketing)

### ✅ OAuth Meta Conectado
- **Archivo**: `apps/api/src/integrations/meta/meta-oauth.service.ts`
- **Endpoint**: `GET /api/integrations/meta/oauth/start`
- **Documentación**: `apps/api/src/integrations/META_OAUTH.md`
- **Estado**: ✅ Funcional

### ✅ Refresh Tokens
- **Archivo**: `apps/api/src/integrations/meta/meta-token.service.ts`
- **Scheduler**: Automático (configurable via `META_TOKEN_REFRESH_ENABLED`)
- **Documentación**: `apps/api/src/integrations/META_OAUTH.md` (línea 225)
- **Estado**: ✅ Funcional

### ❌ Endpoints para Listar Campañas/Adsets/Ads
- **Estado**: ❌ **NO EXISTEN** endpoints específicos
- **Lo que existe**: 
  - `POST /api/integrations/meta/spend/fetch-now` - Solo para fetch de spend diario
  - `GET /api/dashboard/roas` - Solo métricas agregadas de ROAS
- **Falta**: Endpoints para listar campañas, adsets, ads con métricas

### ❌ UI para Ads
- **Estado**: ❌ **NO EXISTE** página `/ads`
- **Falta**: Crear `/ads` con lista de campañas/adsets/ads o placeholder

---

## D) Asignación de Conversaciones

### ✅ Endpoint Backend
- **Endpoint**: `PATCH /api/inbox/conversations/:id/assign`
- **Archivo**: `apps/api/src/integrations/inbox/inbox.controller.ts` (línea 82)
- **Roles**: ADMIN, MANAGER, OWNER
- **Estado**: ✅ Funcional

### ⚠️ UI Frontend
- **Archivo**: `apps/web/app/inbox/[conversationId]/page.tsx` (línea 239)
- **Estado**: ⚠️ Existe dropdown pero **NO tiene guard de permisos** visible
- **Falta**: Ocultar dropdown para SELLER, mostrar badge con vendedor asignado

---

## Resumen

| Componente | Estado | Notas |
|------------|--------|-------|
| Instagram Webhooks | ✅ | Funcional |
| Instagram Persistencia | ✅ | Funcional |
| Instagram Endpoints | ✅ | Funcional |
| Instagram UI | ❌ | Falta tabs separados |
| WhatsApp Webhooks | ✅ | Funcional |
| WhatsApp Persistencia | ✅ | Funcional |
| WhatsApp Endpoints | ✅ | Funcional |
| WhatsApp UI | ❌ | Falta tabs separados |
| Meta OAuth | ✅ | Funcional |
| Meta Refresh Tokens | ✅ | Funcional |
| Meta Ads Endpoints | ❌ | No existen |
| Meta Ads UI | ❌ | No existe |
| Asignación Endpoint | ✅ | Funcional |
| Asignación UI | ⚠️ | Existe pero falta guard de permisos |

---

## Endpoints Faltantes (Backend)

### Meta Ads
- `GET /api/integrations/meta/campaigns` - Listar campañas
- `GET /api/integrations/meta/campaigns/:id` - Detalle de campaña
- `GET /api/integrations/meta/adsets` - Listar adsets
- `GET /api/integrations/meta/adsets/:id` - Detalle de adset
- `GET /api/integrations/meta/ads` - Listar ads
- `GET /api/integrations/meta/ads/:id` - Detalle de ad

**Nota**: Estos endpoints deberían usar Meta Marketing API (`/act_{ad_account_id}/campaigns`, etc.) con el token de OAuth.
