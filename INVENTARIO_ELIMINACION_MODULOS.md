# INVENTARIO COMPLETO - Eliminación de Módulos

## 📋 RESUMEN EJECUTIVO

Módulos a eliminar:
1. **Kanban** (Leads board / pipeline)
2. **Inbox** (unified inbox: WhatsApp/Instagram)
3. **Meta Ads** (cualquier módulo/página/integración de Ads)

---

## 1️⃣ KANBAN (LEADS BOARD / PIPELINE)

### 1.1 Frontend - Rutas Next.js
- ✅ `/apps/web/app/(dashboard)/board/` (directorio completo)
  - `board/page.tsx`
  - `board/leads/page.tsx`
  - `board/leads/new/page.tsx`
  - `board/leads/[id]/page.tsx`
  - `board/leads/[id]/edit/page.tsx`
  - `board/pipelines/page.tsx`
  - `board/pipelines/new/page.tsx`
- ✅ `/apps/web/app/(dashboard)/leads/` (directorio completo)
  - `leads/page.tsx`
  - `leads/board/page.tsx`
  - `leads/new/page.tsx`
  - `leads/[id]/page.tsx`
  - `leads/[id]/edit/page.tsx`

### 1.2 Frontend - Componentes
- ✅ `apps/web/components/leads/lead-form.tsx` (usa pipelines)

### 1.3 Frontend - Hooks React Query
- ✅ `apps/web/lib/api/hooks/use-pipelines.ts`
- ✅ `apps/web/lib/api/hooks/use-leads.ts` (usa pipelineId)
- ✅ `apps/web/lib/api/hooks/use-lead-mutations.ts` (usa pipelineId)
- ✅ `apps/web/lib/api/hooks/use-update-lead-stage.ts` (usa pipelineId)

### 1.4 Frontend - Sidebar/Navigation
- ✅ `apps/web/components/layout/sidebar-zoho.tsx`
  - Línea 17: `KanbanSquare` import
  - Líneas 58-66: Item "Kanban" con children (Leads, Pipelines)
  - Línea 387: `if (pathname.startsWith('/board')) return 'kanban';`
  - Línea 400: `if (label === 'kanban') return 'kanban';`

### 1.5 Frontend - Permisos
- ✅ `apps/web/lib/auth/permissions.ts`
  - `Permission.VIEW_LEADS` (usado en sidebar)
- ✅ `apps/web/lib/auth/permission-matrix.ts`
  - `canMoveKanban()` función (línea 80)

### 1.6 Frontend - Settings
- ✅ `apps/web/app/(dashboard)/settings/page.tsx`
  - Líneas 209-211: `sellerCanMoveKanban` setting
- ✅ `apps/web/lib/api/hooks/use-org-settings.ts`
  - `sellerCanMoveKanban: boolean` (línea 23)

### 1.7 Backend - Módulos NestJS
- ✅ `apps/api/src/leads/` (directorio completo)
  - `leads.controller.ts`
  - `leads.service.ts`
  - `leads.module.ts`
  - `leads.controller.spec.ts`
  - `leads.service.spec.ts`
  - DTOs:
    - `dto/create-lead.dto.ts`
    - `dto/update-lead.dto.ts`
    - `dto/list-leads.dto.ts`
    - `dto/assign-lead.dto.ts`
    - `dto/create-pipeline.dto.ts`
    - `dto/create-stage.dto.ts`
    - `dto/reorder-stages.dto.ts`
    - `dto/create-note.dto.ts`
    - `dto/create-task.dto.ts`
    - `dto/update-task.dto.ts`

### 1.8 Backend - Permisos
- ✅ `apps/api/src/common/guards/permissions.guard.ts` (si usa `VIEW_LEADS`)
- ✅ `apps/api/src/common/interceptors/audit-log.interceptor.ts`
  - Línea 177: `if (pathLower.includes('/pipelines')) return AuditEntityType.Pipeline;`
  - Línea 178: `if (pathLower.includes('/stages')) return AuditEntityType.Stage;`
  - Línea 192: `['leads', 'sales', 'stock', 'pricing', 'pipelines', 'stages']`

### 1.9 Backend - Settings
- ✅ `apps/api/src/settings/settings.controller.ts`
  - Línea 44: `sellerCanMoveKanban?: boolean;`
- ✅ `apps/api/src/settings/org-settings.defaults.ts`
  - Línea 20: `sellerCanMoveKanban: boolean;`
  - Línea 52: `sellerCanMoveKanban: true,`

### 1.10 Database - Prisma Schema
- ✅ `packages/prisma/schema.prisma`
  - Modelo `Pipeline` (líneas 173-189)
  - Modelo `Stage` (líneas 191-205)
  - Modelo `Lead` (líneas 207-250) - **⚠️ COMPARTIDO**: Tiene relación con `Sale` y `Conversation`
  - Modelo `Note` (líneas 259-275) - **⚠️ COMPARTIDO**: Puede no estar asociado a lead (`leadId` nullable)
  - Modelo `Task` (líneas 277-298) - **⚠️ COMPARTIDO**: Puede no estar asociado a lead (`leadId` nullable)
  - Enum `LeadStatus` (líneas 252-257)
  - Enum `AuditEntityType` (líneas 957-974)
    - `Pipeline` (línea 962)
    - `Stage` (línea 963)
    - `Lead` (línea 958)
    - `Note` (línea 966)
    - `Task` (línea 967)

### 1.11 Database - Migraciones
- ✅ `packages/prisma/migrations/20260112015337_init/migration.sql`
  - Tabla `Pipeline` (línea 212)
  - Tabla `Stage` (línea 228)
  - Tabla `Lead` (línea 242)
  - Índices y constraints relacionados

### 1.12 Documentación
- ✅ `LEADS_ROUTES_SUMMARY.md`
- ✅ `LEADS_ROUTES_MAP.md`
- ✅ `LEADS_IMPLEMENTATION.md`
- ✅ `LEADS_PRODUCTION_READY.md`
- ✅ `apps/api/src/leads/README.md`
- ✅ `apps/api/src/leads/HOW_TO_USE.md`
- ✅ `RESUMEN_PROYECTO_COMPLETO.md` (referencias a Kanban)
- ✅ `RESUMEN_COMPLETO_PROYECTO.md` (referencias a Kanban)
- ✅ `PROJECT_STATUS_COMPLETE.md` (referencias a pipelines)

---

## 2️⃣ INBOX (WHATSAPP/INSTAGRAM/UNIFIED)

### 2.1 Frontend - Rutas Next.js
- ✅ `/apps/web/app/(dashboard)/inbox/` (directorio completo)
  - `inbox/page.tsx`
  - `inbox/layout.tsx`
  - `inbox/whatsapp/page.tsx`
  - `inbox/instagram/page.tsx`
  - `inbox/unified/page.tsx`
  - `inbox/unified/unified-inner.tsx`
  - `inbox/unificado/page.tsx`
  - `inbox/[channel]/` (si existe)

### 2.2 Frontend - Componentes
- ✅ `apps/web/components/inbox/` (directorio completo)
  - `inbox-thread-list.tsx`
  - `inbox-conversation.tsx`
  - `inbox-topbar.tsx`
  - `inbox-header.tsx`
  - `inbox-channel-tabs.tsx`
  - `inbox-empty-state.tsx`
  - `conversation-list-item.tsx`
  - `virtualized-conversation-list.tsx`
  - `enterprise-chat-list-item.tsx`
  - `tags-picker.tsx`
  - `template-picker.tsx`

### 2.3 Frontend - Hooks/Lib
- ✅ `apps/web/lib/inbox/mock.ts` (si existe)

### 2.4 Frontend - Sidebar/Navigation
- ✅ `apps/web/components/layout/sidebar-zoho.tsx`
  - Línea 15: `Inbox` import
  - Líneas 19-22: `MessageSquare`, `Instagram`, `MessageCircle`, `Phone` imports
  - Líneas 68-78: Item "Inbox" con children (General, WhatsApp, Instagram, Unificado)
  - Línea 388: `if (pathname.startsWith('/inbox')) return 'inbox';`
  - Línea 401: `if (label === 'inbox') return 'inbox';`

### 2.5 Frontend - Permisos
- ✅ `apps/web/lib/auth/permissions.ts`
  - `Permission.VIEW_INBOX` (líneas 42-43, 65, 80, 95, 97, 110)

### 2.6 Frontend - Settings
- ✅ `apps/web/app/(dashboard)/settings/page.tsx`
  - Línea 97: `<TabsTrigger value="inbox">Inbox</TabsTrigger>`
  - Líneas 240-293: Tab "inbox" con settings:
    - `autoAssignOnReply`
    - `sellerSeesOnlyAssigned`
    - `defaultConversationStatus`

### 2.7 Backend - Módulos NestJS
- ✅ `apps/api/src/integrations/inbox/` (directorio completo)
  - `inbox.controller.ts`
  - `inbox.service.ts`
  - `inbox.controller.spec.ts`
  - `inbox.service.spec.ts`
  - DTOs:
    - `dto/send-text.dto.ts`
    - `dto/create-tag.dto.ts`
    - `dto/update-tag.dto.ts`

### 2.8 Backend - Webhooks
- ✅ `apps/api/src/integrations/webhooks/` (directorio completo)
  - `whatsapp-webhook.controller.ts`
  - `whatsapp-webhook.service.ts`
  - `instagram-webhook.controller.ts`
  - `instagram-webhook.service.ts`
  - `whatsapp-signature.guard.ts`
  - `instagram-signature.guard.ts`
  - `meta-lead-ads.controller.ts` (si es solo para Lead Ads, puede compartirse con Meta Ads)
  - `meta-lead-ads.service.ts`
  - `meta-lead-ads-raw-body.middleware.ts`

### 2.9 Backend - Workers/Jobs
- ✅ `apps/api/src/integrations/jobs/` (directorio completo)
  - `whatsapp-job-processor.service.ts`
  - `instagram-job-processor.service.ts`
  - `job-runner.service.ts` (tiene lógica de Meta Spend y Token Refresh - **⚠️ COMPARTIDO**)

### 2.10 Backend - Providers
- ✅ `apps/api/src/integrations/providers/meta/`
  - `whatsapp.provider.ts`
  - `instagram.provider.ts`

### 2.11 Backend - Integrations Module
- ✅ `apps/api/src/integrations/integrations.module.ts`
  - Imports de inbox, webhooks, jobs, providers

### 2.12 Backend - Settings
- ✅ `apps/api/src/settings/org-settings.defaults.ts`
  - Settings de inbox (si existen)

### 2.13 Database - Prisma Schema
- ✅ `packages/prisma/schema.prisma`
  - Modelo `Conversation` (líneas 1179-1209)
  - Modelo `ConversationTag` (líneas 1211-1225)
  - Modelo `ConversationTagLink` (líneas 1227-1239)
  - Modelo `MessageLog` (líneas 1148-1171)
  - Modelo `WhatsAppTemplate` (líneas 1241-1258)
  - Modelo `WhatsAppAutomationRule` (líneas 1260-1277)
  - Enum `IntegrationProvider` (líneas 1025-1029)
    - `WHATSAPP` (línea 1026)
    - `INSTAGRAM` (línea 1027)
    - `FACEBOOK` (línea 1028) - **⚠️ COMPARTIDO**: Puede usarse para Meta Ads
  - Enum `MessageDirection` (líneas 1043-1046)
  - Enum `MessageStatus` (líneas 1048-1054)
  - Enum `ConversationStatus` (líneas 1173-1177)
  - Enum `WhatsAppTemplateCategory` (líneas 1056-1060)
  - Enum `WhatsAppTemplateStatus` (líneas 1062-1067)
  - Enum `WhatsAppAutomationTrigger` (líneas 1080-1085)
  - Enum `WhatsAppAutomationAction` (líneas 1087-1090)
  - Relación `Lead.Conversation` (línea 243) - **⚠️ COMPARTIDO**: Lead tiene relación con Conversation

### 2.14 Database - Migraciones
- ✅ Migraciones que crean tablas de inbox/conversations

### 2.15 Environment Variables
- ✅ `WHATSAPP_ACCESS_TOKEN`
- ✅ `WHATSAPP_PHONE_NUMBER_ID`
- ✅ `WHATSAPP_APP_ID`
- ✅ `WHATSAPP_APP_SECRET`
- ✅ `WHATSAPP_VERIFY_TOKEN`
- ✅ `WHATSAPP_WEBHOOK_URL`
- ✅ `WHATSAPP_TEST_TO`
- ✅ `WHATSAPP_TEST_TEXT`
- ✅ `INSTAGRAM_VERIFY_TOKEN`
- ✅ `INSTAGRAM_PAGE_ID`
- ✅ `INSTAGRAM_USER_ID`
- ✅ `META_PAGE_ACCESS_TOKEN` (puede compartirse con Meta Ads)

### 2.16 Documentación
- ✅ `apps/api/src/integrations/INBOX.md`
- ✅ `apps/api/src/integrations/INSTAGRAM.md`
- ✅ `apps/api/src/integrations/WHATSAPP.md`
- ✅ `apps/api/src/integrations/WHATSAPP_AUTOMATIONS.md`
- ✅ `docs/INTEGRATIONS_SETTINGS.md` (referencias a WhatsApp/Instagram)
- ✅ `docs/RBAC.md` (referencias a inbox)

---

## 3️⃣ META ADS

### 3.1 Frontend - Rutas Next.js
- ✅ `/apps/web/app/(dashboard)/ads/`
  - `ads/page.tsx`

### 3.2 Frontend - Hooks React Query
- ✅ `apps/web/lib/api/hooks/use-meta-ads.ts` (directorio completo)

### 3.3 Frontend - Sidebar/Navigation
- ✅ `apps/web/components/layout/sidebar-zoho.tsx`
  - Línea 26: `Megaphone` import
  - Línea 119: `{ href: '/ads', label: 'Meta Ads', icon: Megaphone, permission: Permission.VIEW_INTEGRATIONS }`
- ✅ `apps/web/components/layout/app-layout.tsx`
  - Línea 44: `if (s === 'ads') return 'Meta Ads';`

### 3.4 Frontend - Settings
- ✅ `apps/web/app/(dashboard)/settings/integrations/page.tsx`
  - Referencias a Meta Ads (si existen)

### 3.5 Backend - Módulos NestJS
- ✅ `apps/api/src/integrations/meta/` (directorio completo)
  - `meta-ads.controller.ts`
  - `meta-ads.service.ts`
  - `meta-ads-cache.service.ts`
  - `meta-ads-items.service.ts`
  - `meta-adsets.service.ts`
  - `meta-bulk-insights.service.ts`
  - `meta-campaigns.service.ts`
  - `meta-config.controller.ts`
  - `meta-config.service.ts`
  - `meta-integrations.controller.ts`
  - `meta-marketing.service.ts`
  - `meta-marketing.service.spec.ts`
  - `meta-oauth.controller.ts`
  - `meta-oauth.service.ts`
  - `meta-oauth.service.spec.ts`
  - `meta-token.service.ts`
  - `meta-token.service.spec.ts`

### 3.6 Backend - Webhooks
- ✅ `apps/api/src/integrations/webhooks/meta-lead-ads.controller.ts` (si es solo para Lead Ads)
- ✅ `apps/api/src/integrations/webhooks/meta-lead-ads.service.ts`
- ✅ `apps/api/src/integrations/webhooks/meta-lead-ads-raw-body.middleware.ts`

### 3.7 Backend - Workers/Jobs
- ✅ `apps/api/src/integrations/jobs/job-runner.service.ts`
  - Líneas 35-37: `META_SPEND_ENABLED`, `META_TOKEN_REFRESH_ENABLED`
  - Líneas 96-109: Cron jobs para Meta Spend y Token Refresh
  - Líneas 323-326: Procesamiento de `FETCH_META_SPEND` y `REFRESH_META_TOKEN`
  - Líneas 514-525: Scheduling de `FETCH_META_SPEND`
  - Líneas 606-617: Scheduling de `REFRESH_META_TOKEN`

### 3.8 Backend - Integrations Module
- ✅ `apps/api/src/integrations/integrations.module.ts`
  - Imports de meta-ads, meta-oauth, meta-token, etc.
- ✅ `apps/api/src/integrations/integrations-settings.controller.ts`
  - Línea 18: `MetaAdsService` import
  - Líneas 41, 120, 238: Uso de `MetaAdsService`

### 3.9 Backend - Metrics
- ✅ `apps/api/src/common/metrics/metrics.service.ts`
  - Líneas 170-177: Métricas `meta_requests_total` y `meta_latency_ms`

### 3.10 Database - Prisma Schema
- ✅ `packages/prisma/schema.prisma`
  - Modelo `MetaAttributionSnapshot` (líneas 1332-1354)
  - Modelo `MetaSpendDaily` (líneas 1364-1387)
  - Enum `AttributionSource` (líneas 1328-1330)
    - `META_LEAD_ADS` (línea 1329)
  - Enum `MetaSpendLevel` (líneas 1358-1362)
  - Enum `IntegrationJobType` (líneas 1069-1078)
    - `FETCH_META_SPEND` (línea 1076)
    - `REFRESH_META_TOKEN` (línea 1077)
  - Relación `Sale.metaAttributionSnapshot` (línea 584) - **⚠️ COMPARTIDO**: Sale tiene relación con MetaAttributionSnapshot
  - Relación `Lead.metaAttributionSnapshots` (línea 244) - **⚠️ COMPARTIDO**: Lead tiene relación con MetaAttributionSnapshot

### 3.11 Database - Migraciones
- ✅ `packages/prisma/migrations/20260115000004_add_meta_attribution_snapshot/migration.sql`
- ✅ `packages/prisma/migrations/20260115000005_add_meta_spend_daily/migration.sql`
- ✅ `packages/prisma/migrations/20260115000006_add_meta_oauth_metadata/migration.sql`

### 3.12 Environment Variables
- ✅ `META_APP_ID`
- ✅ `META_APP_SECRET`
- ✅ `META_OAUTH_REDIRECT_URI`
- ✅ `META_AD_ACCOUNT_ID`
- ✅ `META_PAGE_ACCESS_TOKEN` (puede compartirse con Inbox)
- ✅ `META_CACHE_TTL_SEC`
- ✅ `META_SPEND_ENABLED`
- ✅ `META_SPEND_CRON`
- ✅ `META_TOKEN_REFRESH_ENABLED`
- ✅ `META_TOKEN_REFRESH_CRON`

### 3.13 Documentación
- ✅ `apps/api/src/integrations/META_LEAD_ADS.md`
- ✅ `apps/api/src/integrations/META_OAUTH.md`
- ✅ `apps/api/src/integrations/META_SPEND.md`
- ✅ `docs/META_ADS_HARDENING.md`
- ✅ `docs/META_ADS_STEP1.md`
- ✅ `RESUMEN_PROYECTO_COMPLETO.md` (referencias a Meta Ads)
- ✅ `RESUMEN_COMPLETO_PROYECTO.md` (referencias a Meta Ads)

---

## ⚠️ MODELOS COMPARTIDOS (NO ELIMINAR)

### Lead
- **Usado por**: Kanban (principal), Inbox (Conversation.leadId), Meta Ads (MetaAttributionSnapshot.leadId), Sales (Sale.leadId)
- **Acción**: Eliminar solo referencias a Kanban, mantener relaciones con Sales/Inbox/Meta Ads si se usan

### Note
- **Usado por**: Kanban (principal), pero `leadId` es nullable
- **Acción**: Verificar si se usa en otros módulos antes de eliminar

### Task
- **Usado por**: Kanban (principal), pero `leadId` es nullable
- **Acción**: Verificar si se usa en otros módulos antes de eliminar

### Conversation
- **Usado por**: Inbox (principal), Lead (Lead.Conversation[])
- **Acción**: Eliminar completamente si solo se usa en Inbox

### MetaAttributionSnapshot
- **Usado por**: Meta Ads (principal), Sale (Sale.metaAttributionSnapshot), Lead (Lead.metaAttributionSnapshots[])
- **Acción**: Eliminar completamente si solo se usa en Meta Ads

### MetaSpendDaily
- **Usado por**: Meta Ads (exclusivo)
- **Acción**: Eliminar completamente

### IntegrationProvider
- **Usado por**: Inbox (WHATSAPP, INSTAGRAM), Meta Ads (FACEBOOK)
- **Acción**: Eliminar solo WHATSAPP e INSTAGRAM, mantener FACEBOOK si se usa en otros lugares

---

## 📝 NOTAS IMPORTANTES

1. **Lead**: Tiene relación con `Sale`, `Conversation`, y `MetaAttributionSnapshot`. Si eliminamos Kanban, debemos verificar si Lead se usa en otros módulos. Si no, podemos eliminarlo también.

2. **Note y Task**: Tienen `leadId` nullable, por lo que pueden existir sin Lead. Verificar si se usan en otros módulos.

3. **Conversation**: Solo se usa en Inbox. Eliminar completamente.

4. **MetaAttributionSnapshot y MetaSpendDaily**: Solo se usan en Meta Ads. Eliminar completamente.

5. **IntegrationProvider**: Eliminar solo WHATSAPP e INSTAGRAM del enum, mantener FACEBOOK si se usa en otros lugares.

6. **Workers/Jobs**: `job-runner.service.ts` tiene lógica de Meta Spend y Token Refresh. Eliminar solo esas partes, mantener el resto del job runner.

7. **Environment Variables**: Eliminar todas las variables relacionadas con WhatsApp, Instagram y Meta Ads.

8. **Settings**: Eliminar settings de inbox y kanban de `org-settings.defaults.ts` y `settings.controller.ts`.

---

## ✅ PRÓXIMOS PASOS

1. ✅ Inventario completo (ESTE DOCUMENTO)
2. ⏳ Eliminar Kanban (PASO 2)
3. ⏳ Eliminar Inbox (PASO 3)
4. ⏳ Eliminar Meta Ads (PASO 4)
5. ⏳ Limpieza transversal (PASO 5)
6. ⏳ Build y tests (PASO 6)
7. ⏳ Commit y push (PASO 7)
