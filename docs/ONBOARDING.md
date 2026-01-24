# Onboarding — CRM Remember Me

## 📋 Proceso de Onboarding (Día 0 a Día 7)

### Día 0: Setup Inicial
**Objetivo:** Cliente tiene acceso y puede hacer login.

**Tareas:**
1. Crear organización en el sistema
2. Crear usuario OWNER (email + password)
3. Enviar credenciales de acceso
4. Confirmar que puede hacer login en `https://app.iphonealcosto.com/login`

**Entregables:**
- Email con credenciales
- Link de acceso
- Instrucciones básicas de login

---

### Día 1: Configuración Básica
**Objetivo:** Cliente tiene su organización configurada con branding y usuarios iniciales.

**Checklist:**
- [ ] **Login exitoso**
- [ ] **Configurar branding**:
  - Nombre de organización
  - Logo (opcional)
  - Colores (opcional, si white-label)
- [ ] **Crear usuarios iniciales**:
  - Roles: OWNER, ADMIN, MANAGER, SELLER según necesidad
  - Invitar por email (si hay flujo de invitación) o crear directamente
- [ ] **Verificar permisos**: Confirmar que cada usuario ve/oculta acciones según su role

**Success Criteria:**
- Cliente puede hacer login
- Branding visible en la app
- Al menos 2 usuarios creados (OWNER + otro role)
- Permisos funcionan correctamente

---

### Día 2-3: Configuración de Módulos Core
**Objetivo:** Cliente tiene Leads, Stock, y Sales configurados y funcionando.

**Checklist:**

#### Leads (CRM)
- [ ] **Crear Pipeline inicial**:
  - Nombre: "Sales Pipeline" o similar
  - Stages: "Nuevo", "Contactado", "Cotización", "Cerrado", "Perdido"
- [ ] **Crear primeros leads** (mínimo 3):
  - Verificar que se pueden crear, editar, asignar
  - Verificar que se pueden mover entre stages
- [ ] **Configurar permisos** (si aplica):
  - SELLER solo ve leads asignados
  - MANAGER ve todos los leads

#### Stock
- [ ] **Importar items iniciales** (si hay datos):
  - CSV import (si existe) o creación manual
  - Mínimo 5 items con: model, SKU, IMEI (si aplica), condition, quantity
- [ ] **Verificar estados**: AVAILABLE, RESERVED, SOLD funcionan
- [ ] **Crear reserva de prueba**: Verificar que stock se actualiza

#### Sales
- [ ] **Crear customers** (mínimo 3):
  - Nombre, email, phone, status
- [ ] **Crear vendors** (mínimo 2):
  - Nombre, email, phone, status
- [ ] **Crear purchase de prueba**:
  - Vendor seleccionado
  - Líneas con items
  - Transición: DRAFT → APPROVED → RECEIVED

**Success Criteria:**
- Pipeline creado con stages
- Al menos 5 leads creados
- Al menos 5 items en stock
- Al menos 3 customers y 2 vendors
- 1 purchase creada y transicionada

---

### Día 4-5: Configuración de Inbox
**Objetivo:** Cliente tiene Inbox configurado y puede recibir/responder mensajes.

**Checklist:**
- [ ] **Configurar WhatsApp** (si aplica):
  - Conectar cuenta de WhatsApp Business API
  - Verificar webhook funcionando
  - Enviar mensaje de prueba
- [ ] **Configurar Instagram** (si aplica):
  - Conectar cuenta de Instagram Business
  - Verificar webhook funcionando
  - Enviar mensaje de prueba
- [ ] **Verificar inbox unificado**:
  - Conversaciones aparecen en `/inbox/unified`
  - Filtros por canal funcionan
  - Estados (OPEN, PENDING, CLOSED) funcionan
- [ ] **Asignación de conversaciones**:
  - Verificar que se pueden asignar a usuarios
  - Verificar que SELLER solo ve asignadas (si aplica)

**Success Criteria:**
- Al menos 1 conversación de WhatsApp visible
- Al menos 1 conversación de Instagram visible (si aplica)
- Puede responder mensajes desde la app
- Asignación funciona correctamente

---

### Día 6: Configuración de Integraciones (Opcional)
**Objetivo:** Cliente tiene integraciones configuradas si las necesita.

**Checklist:**
- [ ] **Meta Ads** (si aplica):
  - OAuth 2.0 completado
  - Ad accounts conectados
  - Sincronización de ads funcionando
  - Leads de ads apareciendo en CRM
- [ ] **Otras integraciones** (si aplica):
  - Email marketing
  - SMS
  - TikTok Ads

**Success Criteria:**
- Integraciones conectadas
- Datos sincronizando correctamente

---

### Día 7: Training y Go-Live
**Objetivo:** Cliente está listo para usar el sistema en producción.

**Checklist:**
- [ ] **Sesión de training** (1-2h):
  - Recorrido por módulos principales
  - Flujos comunes (crear lead, vender, recibir compra)
  - Org switcher (si tiene múltiples orgs)
  - Permisos y roles
- [ ] **Q&A**: Responder preguntas específicas
- [ ] **Documentación**: Enviar links a docs relevantes
- [ ] **Success criteria final**: Verificar que todo funciona

**Success Criteria:**
- Cliente puede usar todos los módulos principales sin ayuda
- No hay errores críticos
- Datos de prueba migrados o creados
- Usuarios finales tienen acceso

---

## ✅ Checklist de Configuración Completa

### Organización y Usuarios
- [ ] Organización creada con nombre correcto
- [ ] Branding configurado (nombre, logo si aplica)
- [ ] Usuarios creados con roles correctos:
  - OWNER: 1 usuario
  - ADMIN: X usuarios (según necesidad)
  - MANAGER: X usuarios (según necesidad)
  - SELLER: X usuarios (según necesidad)
- [ ] Permisos verificados (cada role ve/oculta acciones correctas)

### Módulos Core
- [ ] **Leads**:
  - Pipeline creado
  - Stages configurados
  - Al menos 5 leads creados
- [ ] **Stock**:
  - Items importados/creados (mínimo 10)
  - Estados funcionando
  - Reservas funcionando
- [ ] **Sales**:
  - Customers creados (mínimo 3)
  - Vendors creados (mínimo 2)
  - Purchases creadas (mínimo 1)
- [ ] **Dashboard**: KPIs visibles y correctos

### Inbox
- [ ] WhatsApp conectado (si aplica)
- [ ] Instagram conectado (si aplica)
- [ ] Conversaciones visibles
- [ ] Envío de mensajes funciona
- [ ] Asignación funciona

### Integraciones
- [ ] Meta Ads conectado (si aplica)
- [ ] Otras integraciones conectadas (si aplica)

---

## 🎯 Success Criteria (Qué tiene que estar funcionando)

### Funcionalidad Básica
- ✅ Login funciona con credenciales válidas
- ✅ Usuarios pueden acceder según sus roles
- ✅ Org switcher funciona (si tiene múltiples orgs)
- ✅ Branding visible en la app

### Módulos Core
- ✅ **Leads**: Crear, editar, asignar, mover entre stages
- ✅ **Stock**: Ver items, crear reservas, actualizar estados
- ✅ **Sales**: Crear customers, vendors, purchases
- ✅ **Dashboard**: Ver KPIs básicos

### Inbox
- ✅ Conversaciones visibles (WhatsApp y/o Instagram)
- ✅ Puede responder mensajes
- ✅ Asignación funciona
- ✅ Estados (OPEN, PENDING, CLOSED) funcionan

### Permisos
- ✅ Cada role ve/oculta acciones correctas
- ✅ Backend valida permisos (403 si falta permiso)
- ✅ UI gating funciona (botones se ocultan según permisos)

---

## 🔧 Troubleshooting

### Login
**Problema:** "No se pudo conectar con el servidor"

**Solución:**
1. Verificar que `NEXT_PUBLIC_API_BASE_URL` esté configurado en Vercel
2. Verificar que la URL sea `https://api.iphonealcosto.com/api` (no localhost)
3. Verificar CORS en Railway (debe incluir `https://app.iphonealcosto.com`)
4. Verificar que el API esté funcionando: `curl https://api.iphonealcosto.com/api/health`

**Problema:** "Credenciales incorrectas"

**Solución:**
1. Verificar que el email y password sean correctos
2. Verificar que el usuario esté activo en la base de datos
3. Verificar que el usuario tenga al menos una membership

---

### Org Switch
**Problema:** No puede cambiar de organización

**Solución:**
1. Verificar que el usuario tenga múltiples memberships
2. Verificar que el header `X-Organization-Id` se esté enviando
3. Verificar que el backend valide membership correctamente
4. Verificar localStorage: `localStorage.getItem('rm.currentOrgId')`

---

### Permisos
**Problema:** Usuario no ve botones/acciones que debería ver

**Solución:**
1. Verificar role del usuario: `GET /api/users/me` → `role`
2. Verificar permisos del role: Ver `docs/RBAC.md` → mapeo role → permisos
3. Verificar que el endpoint requiera el permiso correcto
4. Verificar que la UI use `usePermissions().can('permission')` correctamente

**Problema:** Backend devuelve 403 Forbidden

**Solución:**
1. Verificar que el usuario tenga el permiso requerido
2. Verificar que el role tenga el permiso en el mapeo
3. Verificar que el endpoint tenga `@RequirePermissions()` correcto
4. Verificar logs del backend para ver qué permiso falta

---

### API Base URL
**Problema:** Requests van a localhost en producción

**Solución:**
1. Verificar `NEXT_PUBLIC_API_BASE_URL` en Vercel
2. El código tiene fallback seguro a `https://api.iphonealcosto.com/api` en producción
3. Si el fallback no funciona, verificar que la detección de producción funcione
4. Verificar console del browser para ver qué URL se está usando

---

## 📚 Recursos para el Cliente

### Documentación
- **Launch Kit**: `docs/LAUNCH_KIT.md`
- **RBAC**: `docs/RBAC.md`
- **Multi-Org UX**: `docs/MULTI_ORG_UX.md`
- **Sales Purchases**: `docs/SALES_PURCHASES.md`

### Soporte
- **Email**: support@rememberme.com (o el email real)
- **Chat**: Disponible en Pro y Enterprise
- **Docs**: https://docs.rememberme.com (si existe)

---

**Última actualización:** Enero 2025
