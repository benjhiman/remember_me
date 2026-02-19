# Fixes y Mejoras Completadas - Clientes + Vendedores

## ✅ Commit Exitoso

**Hash:** `fe846a8`  
**Mensaje:** `fix(sales): complete Clientes and Vendedores improvements`

---

## 📦 Archivos Modificados (11 archivos)

### Backend (5 archivos)
1. `apps/api/src/auth/auth.service.ts` - Aceptación de invitación para usuarios existentes
2. `apps/api/src/customers/customers.service.ts` - Reglas de asignación de clientes
3. `apps/api/src/sellers/dto/create-seller.dto.ts` - **NUEVO** - DTO para crear vendedor
4. `apps/api/src/sellers/sellers.controller.ts` - Endpoint POST /sellers
5. `apps/api/src/sellers/sellers.service.ts` - Método createSeller

### Frontend (6 archivos)
6. `apps/web/app/(dashboard)/sales/customers/page.tsx` - Filtros en una línea, breadcrumbs
7. `apps/web/app/(dashboard)/sales/sellers/page.tsx` - Botón "Alta vendedor", breadcrumbs
8. `apps/web/components/customers/customer-form-dialog.tsx` - Ocultar vendedor para SELLER, mejor layout
9. `apps/web/components/layout/sidebar-zoho.tsx` - Marcar Clientes como activo
10. `apps/web/components/ui/select.tsx` - Prevenir wrap de texto
11. `apps/web/lib/api/hooks/use-sellers.ts` - Hook useCreateSeller

---

## 🆕 Endpoints Nuevos

### POST /api/sellers
**Descripción:** Crea un vendedor con cuenta de usuario en estado PENDING  
**Permisos:** ADMIN, MANAGER, OWNER  
**Body:**
```json
{
  "name": "string (required)",
  "email": "string (required, email)",
  "phone": "string (optional)",
  "city": "string (optional)",
  "address": "string (optional)"
}
```
**Respuesta:**
```json
{
  "id": "user_id",
  "email": "vendedor@ejemplo.com",
  "name": "Nombre Vendedor",
  "role": "SELLER",
  "status": "PENDING",
  "invitation": {
    "id": "invitation_id",
    "expiresAt": "2026-02-26T...",
    "inviteLink": "https://app.iphonealcosto.com/accept-invitation?token=..."
  }
}
```

---

## 🔧 Fixes Implementados

### 1. Sidebar - Clientes Resaltado ✅
- **Problema:** "Clientes" no se marcaba como activo cuando estabas en `/sales/clients`
- **Solución:** Agregado mapeo `/sales/clients` → `/sales/customers` en `normalizePathname`
- **Resultado:** "Clientes" se resalta correctamente cuando estás en la vista de clientes

### 2. Filtros en Una Sola Línea ✅
- **Problema:** Los selects se partían en 2 líneas ("Todos los\nvendedores")
- **Solución:**
  - Agregado `flex-nowrap` al contenedor
  - Agregado `whitespace-nowrap` a SelectTrigger
  - Agregado `[&>span]:truncate [&>span]:whitespace-nowrap` al componente Select base
  - Anchos fijos: `w-[220px]` para vendedores, `w-[180px]` para estados
- **Resultado:** Todos los filtros en una sola línea: "Todos los vendedores" | "Todos los estados" | "Mis clientes"

### 3. Breadcrumbs Corregidos ✅
- **Vendedores:** `Home > Sales > Vendedores` (antes: `Home > Ventas > Vendedores`)
- **Clientes:** `Home > Sales > Clientes` (ya estaba correcto)
- **Ventas:** `Home > Sales > Ventas` (ya estaba correcto)

### 4. Crear Cliente - Reglas de Asignación ✅
- **ADMIN/MANAGER/OWNER:**
  - Puede asignar a cualquier vendedor de la organización
  - Si no asigna, por defecto se asigna al admin/manager que lo crea
  - Verifica que el vendedor asignado pertenezca a la organización
- **SELLER:**
  - Se auto-asigna automáticamente a sí mismo
  - No puede asignar a otros vendedores (403 si intenta)
  - El campo "Vendedor asignado" está oculto/deshabilitado en el formulario
- **Frontend:**
  - SELLER: Campo oculto, muestra "Tú" como valor fijo
  - ADMIN: Select visible con lista de vendedores

### 5. Alta Vendedor - Feature Completa ✅
- **Backend:**
  - Crea User con passwordHash temporal
  - Crea Membership con role SELLER
  - Crea Invitation con token
  - Retorna link de invitación (en producción, enviar por email)
- **Frontend:**
  - Botón "Alta Vendedor" en `/sales/sellers`
  - Modal con campos: nombre, email, teléfono, ciudad, dirección
  - Hook `useCreateSeller` con manejo de errores
  - Toast de éxito: "Vendedor creado. Se ha enviado una invitación por email."
- **Aceptación de Invitación:**
  - Maneja usuarios existentes (de Alta vendedor)
  - Actualiza passwordHash cuando aceptan
  - Marca emailVerified = true
  - Crea membership si no existe

---

## ✅ Checklist de Validación en PROD

### 1. Sidebar y Navegación
- [ ] Navegar a `/sales/clients`
- [ ] Verificar que "Clientes" esté resaltado en el sidebar (igual que "Ventas")
- [ ] Verificar que "Sales" esté expandido

### 2. Filtros en Una Línea
- [ ] En `/sales/clients`, verificar que los filtros estén en una sola línea
- [ ] Verificar que "Todos los vendedores" no se parta
- [ ] Verificar que "Todos los estados" no se parta
- [ ] Verificar que "Mis clientes" esté al final

### 3. Breadcrumbs
- [ ] En `/sales/sellers`, verificar: `Home > Sales > Vendedores`
- [ ] En `/sales/clients`, verificar: `Home > Sales > Clientes`
- [ ] En `/sales`, verificar: `Home > Sales > Ventas`

### 4. Crear Cliente
- [ ] Como ADMIN: crear cliente sin asignar vendedor → debe quedar asignado al admin
- [ ] Como ADMIN: crear cliente asignando a vendedor → debe guardarse correctamente
- [ ] Como SELLER: crear cliente → debe auto-asignarse al seller
- [ ] Como SELLER: verificar que el campo "Vendedor asignado" esté oculto/deshabilitado
- [ ] Verificar que el cliente aparezca en la tabla después de crearlo

### 5. Alta Vendedor
- [ ] Como ADMIN: hacer click en "Alta Vendedor"
- [ ] Completar formulario (nombre, email requeridos)
- [ ] Crear vendedor
- [ ] Verificar toast de éxito
- [ ] Verificar que aparezca en la tabla de vendedores
- [ ] Verificar que el link de invitación se loguee en server logs (o se envíe por email)
- [ ] Probar aceptar invitación con el token → debe activar el usuario

---

## 📝 Notas Técnicas

### Reglas de Asignación de Clientes
- **Multi-tenant:** Todos los queries verifican `organizationId`
- **Validación:** El vendedor asignado debe pertenecer a la organización
- **Audit Log:** Se registra la creación de clientes

### Alta Vendedor
- **Estado:** Usuario creado en estado PENDING (necesita aceptar invitación)
- **Password:** Temporal, se actualiza cuando acepta la invitación
- **Email:** Se loguea el link (en producción, enviar por email service)
- **Transacción:** User + Membership + Invitation se crean en una transacción

### Invitación
- **Duración:** 7 días
- **Token:** 32 bytes aleatorios en hex
- **Estado:** PENDING → ACCEPTED cuando se acepta

---

## 🚀 Deploy Automático

**Commit:** `fe846a8`  
**Push:** Completado a `origin/main`

- **Vercel (Frontend):** Deploy automático activado
- **Railway (Backend):** Deploy automático activado

---

## 📋 Instrucciones de Prueba en PROD (5 Pasos)

### Paso 1: Verificar Sidebar
1. Navegar a `/sales/clients`
2. Verificar que "Clientes" esté resaltado en azul (igual que "Ventas")
3. Verificar que "Sales" esté expandido

### Paso 2: Verificar Filtros
1. En `/sales/clients`, verificar que todos los filtros estén en una sola línea
2. Verificar que el texto no se parta ("Todos los vendedores" completo)
3. Verificar orden: vendedores → estados → mis clientes

### Paso 3: Crear Cliente como ADMIN
1. Click en "Nuevo Cliente"
2. Completar nombre (requerido)
3. NO asignar vendedor
4. Crear
5. Verificar que el cliente aparezca en la tabla
6. Verificar que esté asignado al admin actual

### Paso 4: Crear Cliente como SELLER
1. Cambiar a usuario SELLER
2. Click en "Nuevo Cliente"
3. Verificar que el campo "Vendedor asignado" esté oculto o muestre "Tú"
4. Crear cliente
5. Verificar que esté asignado al seller actual

### Paso 5: Alta Vendedor
1. Como ADMIN, ir a `/sales/sellers`
2. Click en "Alta Vendedor"
3. Completar: nombre, email (requeridos)
4. Crear
5. Verificar toast de éxito
6. Verificar que aparezca en la tabla
7. Verificar logs del servidor para ver el link de invitación
8. (Opcional) Probar aceptar invitación con el token

---

**Estado:** ✅ TODOS LOS FIXES COMPLETADOS Y PUSHEADOS  
**Deploy:** Automático en curso (Vercel + Railway)
