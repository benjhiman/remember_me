# Sales - Customers & Vendors Module

**Fecha:** Enero 2025  
**Estado:** Implementado (v0.1 - Skeleton Premium)

---

## 📋 RESUMEN

Módulos Customers y Vendors dentro de Sales, con CRUD básico, multi-tenant, RBAC, y audit log. UI estilo Zoho con tablas, modales, y empty states profesionales.

---

## 🏗️ ARQUITECTURA

### Backend

**Models Prisma:**
- `Customer`: id, organizationId, name, email, phone, notes, status (ACTIVE/INACTIVE), createdById, timestamps
- `Vendor`: id, organizationId, name, email, phone, notes, status (ACTIVE/INACTIVE), createdById, timestamps

**Endpoints:**
- `GET /api/customers` - Lista con paginación y búsqueda
- `POST /api/customers` - Crear cliente
- `PATCH /api/customers/:id` - Actualizar cliente
- `GET /api/vendors` - Lista con paginación y búsqueda
- `POST /api/vendors` - Crear proveedor
- `PATCH /api/vendors/:id` - Actualizar proveedor

**Permisos:**
- `customers.read` / `customers.write`
- `vendors.read` / `vendors.write`

**Multi-tenant:**
- Todos los endpoints filtran por `organizationId` (vía `@CurrentOrganization()`)
- Update por id que no pertenece a org → 404

**Audit Log:**
- CREATE y UPDATE registran eventos en `AuditLog` con `entityType: Customer/Vendor`

### Frontend

**Páginas:**
- `/sales/customers` - Lista de clientes
- `/sales/vendors` - Lista de proveedores

**UI Components:**
- `CustomerFormDialog` - Modal para crear/editar cliente
- `VendorFormDialog` - Modal para crear/editar proveedor

**Hooks:**
- `useCustomers()` - Lista con paginación y búsqueda
- `useVendors()` - Lista con paginación y búsqueda
- `useCreateCustomer()` / `useUpdateCustomer()` - Mutations
- `useCreateVendor()` / `useUpdateVendor()` - Mutations

**Navegación:**
- Sales sidebar expandido con subitems: Ventas, Clientes, Proveedores

---

## 🔐 PERMISOS

### Roles

**OWNER / ADMIN / MANAGER:**
- ✅ `customers.read` / `customers.write`
- ✅ `vendors.read` / `vendors.write`

**SELLER:**
- ✅ `customers.read` / `customers.write`
- ✅ `vendors.read` / `vendors.write`

Todos los roles tienen acceso completo a customers/vendors (por ahora).

---

## 📝 ENDPOINTS

### GET /api/customers

**Query Params:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `q` (string, optional) - Busca en name o email
- `status` (string, optional) - ACTIVE o INACTIVE

**Response:**
```json
{
  "items": [
    {
      "id": "cust-123",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "phone": "+54 11 1234-5678",
      "notes": "Cliente preferencial",
      "status": "ACTIVE",
      "createdAt": "2025-01-23T10:00:00Z",
      "updatedAt": "2025-01-23T10:00:00Z",
      "createdById": "user-123"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**Permisos:** `customers.read`

### POST /api/customers

**Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+54 11 1234-5678",
  "notes": "Cliente preferencial",
  "status": "ACTIVE"
}
```

**Response:** Customer object

**Permisos:** `customers.write`

### PATCH /api/customers/:id

**Body:** Mismo formato que POST (todos los campos opcionales)

**Response:** Customer actualizado

**Permisos:** `customers.write`

**Errores:**
- 404 si el customer no existe o no pertenece a la org

### GET /api/vendors

Mismo formato que `/api/customers` pero para vendors.

**Permisos:** `vendors.read`

### POST /api/vendors

**Permisos:** `vendors.write`

### PATCH /api/vendors/:id

**Permisos:** `vendors.write`

---

## 🎨 UI / UX

### Customers Page (`/sales/customers`)

**Header:**
- Título: "Clientes"
- Descripción: "Gestiona tu base de clientes"
- Breadcrumbs: Ventas > Clientes
- CTA: "Nuevo Cliente" (si `can('customers.write')`)

**Toolbar:**
- Search input (busca en name/email, debounced)
- Filtro por estado (ACTIVE/INACTIVE/Todos)

**Table:**
- Columnas: Nombre, Email, Teléfono, Estado, Actualizado, Acciones
- Row hover: bg-gray-50
- Estado badge: verde (ACTIVE) / gris (INACTIVE)
- Acciones: Edit icon (si `can('customers.write')`)

**Empty State:**
- Icon: Users
- Título: "No hay clientes" o "No hay clientes con estos filtros"
- Descripción contextual
- CTA: "Nuevo Cliente" (si `can('customers.write')`)

**Pagination:**
- "Mostrando X - Y de Z"
- Botones Anterior/Siguiente

**Modals:**
- `CustomerFormDialog` para crear/editar
- Campos: name (required), email, phone, status (select), notes (textarea)
- Validación client-side
- Loading states
- Error toast si falla

### Vendors Page (`/sales/vendors`)

Mismo formato que Customers pero:
- Título: "Proveedores"
- Icon: Building2
- Endpoints: `/api/vendors`
- Permisos: `vendors.read` / `vendors.write`

---

## 🔄 FLUJO END-TO-END

### Crear Cliente

```
Usuario click en "Nuevo Cliente"
  ↓
CustomerFormDialog abre
  ↓
Usuario completa formulario (name requerido)
  ↓
Submit → useCreateCustomer.mutateAsync()
  ↓
POST /api/customers con X-Organization-Id header
  ↓
Backend:
  1. PermissionsGuard valida customers.write
  2. CustomersService.createCustomer()
  3. Prisma create con organizationId
  4. AuditLogService.log(CREATE, Customer)
  ↓
Response: Customer object
  ↓
Frontend:
  1. queryClient.invalidateQueries(['customers'])
  2. Toast: "Cliente creado"
  3. Modal se cierra
  4. Lista se refresca automáticamente
```

### Editar Cliente

```
Usuario click en Edit icon en row
  ↓
setEditingCustomer(customer)
  ↓
CustomerFormDialog abre con customer data
  ↓
Usuario modifica campos
  ↓
Submit → useUpdateCustomer.mutateAsync({ id, dto })
  ↓
PATCH /api/customers/:id con X-Organization-Id header
  ↓
Backend:
  1. PermissionsGuard valida customers.write
  2. CustomersService.updateCustomer()
  3. Verifica que customer pertenece a org (404 si no)
  4. Prisma update
  5. AuditLogService.log(UPDATE, Customer, before/after)
  ↓
Response: Customer actualizado
  ↓
Frontend: igual que create
```

### Cambio de Org

```
Usuario cambia org en OrgSwitcher
  ↓
OrgProvider invalida queries
  ↓
useCustomers() refetch automático
  ↓
Request incluye nuevo X-Organization-Id
  ↓
Backend filtra por nuevo organizationId
  ↓
Frontend muestra customers de nueva org
```

---

## 🧪 TESTING

### Tests Backend (Mínimos)

**Archivo:** `apps/api/src/customers/customers.controller.spec.ts` (crear)

**Tests sugeridos:**
```typescript
describe('POST /customers', () => {
  it('should return 403 if user lacks customers.write permission', async () => {
    // Mock user con role sin customers.write
    // Verificar 403
  });

  it('should create customer with organizationId', async () => {
    // Verificar que customer se crea con org correcta
  });
});

describe('PATCH /customers/:id', () => {
  it('should return 404 if customer belongs to different org', async () => {
    // Crear customer en org A
    // Intentar update desde org B
    // Verificar 404
  });
});
```

**Ejecutar:**
```bash
cd apps/api
pnpm test customers.controller.spec
```

### Tests Manuales

1. **Crear cliente:**
   - Ir a `/sales/customers`
   - Click "Nuevo Cliente"
   - Completar formulario
   - Verificar que aparece en lista

2. **Editar cliente:**
   - Click en Edit icon
   - Modificar campos
   - Verificar que se actualiza

3. **Búsqueda:**
   - Escribir en search
   - Verificar que filtra por name/email

4. **Filtro por estado:**
   - Seleccionar "Inactivo"
   - Verificar que solo muestra inactivos

5. **Multi-org:**
   - Crear cliente en Org A
   - Cambiar a Org B
   - Verificar que no aparece
   - Cambiar de vuelta a Org A
   - Verificar que aparece

6. **RBAC:**
   - Login como role sin `customers.write`
   - Verificar que botón "Nuevo Cliente" está oculto
   - Intentar POST manual → 403

---

## 🚀 QUÉ FALTA PARA V1.1

- **Detail Page:** Vista detallada de customer/vendor con historial
- **Contacts Múltiples:** Un customer puede tener múltiples contactos
- **Addresses:** Direcciones físicas
- **Tags:** Sistema de tags para categorizar
- **Import/Export:** CSV import/export
- **Bulk Actions:** Selección múltiple y acciones masivas
- **Advanced Search:** Filtros por fecha, tags, etc.
- **Relations:** Vincular customers con sales, vendors con purchases
- **Notes/Timeline:** Historial de interacciones

---

## 📚 REFERENCIAS

- Models: `packages/prisma/schema.prisma` → `Customer`, `Vendor`
- Backend: `apps/api/src/customers/`, `apps/api/src/vendors/`
- Frontend: `apps/web/app/(dashboard)/sales/customers/`, `apps/web/app/(dashboard)/sales/vendors/`
- Hooks: `apps/web/lib/api/hooks/use-customers.ts`, `use-vendors.ts`
- Components: `apps/web/components/customers/`, `apps/web/components/vendors/`
- Permisos: `apps/api/src/auth/permissions.ts` → `customers.*`, `vendors.*`

---

**Última actualización:** Enero 2025
