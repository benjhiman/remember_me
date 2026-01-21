# Integrations Settings (SaaS-ready)

Este documento describe el panel de **`/settings/integrations`** y los endpoints que usa para operación real.

## Panel: qué muestra

Cards:
- **Meta (OAuth + Ads)**
- **Instagram Inbox**
- **WhatsApp Inbox**

Cada card muestra:
- `connected`
- `lastSyncAt` (si existe; sino queda `-`)
- `lastChecked`
- `tokenStatus` + `tokenExpiresAt` (cuando aplica)
- últimos errores (hasta 5)
- `configSummary`
- `guardrails` (warnings/errores de configuración crítica)

Además: sección **Activity** (últimos 20 eventos).

## Guardrails importantes

- Meta conectado pero **sin `adAccountId`**:
  - Se muestra warning y CTA a `/ads` para seleccionarlo.
- WhatsApp / Instagram conectados pero falta config crítica (`phoneNumberId`, `wabaId`, `pageId`, `igBusinessId`):
  - Se muestra warning con los campos faltantes.

## Endpoints (API)

Todos requieren:
- `Authorization: Bearer <token>`
- `X-Organization-Id: <orgId>`

### Status

`GET /api/integrations/status`

Retorna:
- `lastChecked`
- `providers.meta|instagram|whatsapp` con los campos del panel

### Tests (requiere MANAGE_INTEGRATIONS por rol: ADMIN/MANAGER/OWNER)

`POST /api/integrations/meta/test`
- Verifica Meta Ads (intenta listar ad accounts).

`POST /api/integrations/instagram/test`
- Verifica token Graph con una llamada simple `/me?fields=id`.

`POST /api/integrations/whatsapp/test`
- Envía mensaje de test vía pipeline existente si está configurado:
  - `WHATSAPP_TEST_TO` (requerido)
  - `WHATSAPP_TEST_TEXT` (opcional)

### Audit

`GET /api/integrations/audit?limit=20`
- Devuelve los últimos eventos de activity.

## Audit log

Para evitar cambios de schema, se reutiliza `AuditLog` existente con:
- `entityType = Task`
- `entityId = integration:<provider>`
- `metadataJson = { provider, event, ok?, error?, payload? }`

Eventos típicos:
- `CONFIG_UPDATED` (ej: set de `adAccountId`)
- `TEST_RUN` (ok/fail)

