# Módulo de Compras (Purchases) v0

## 1. Overview

**Purchases v0** es un módulo básico de gestión de órdenes de compra (Purchase Orders) dentro del CRM, diseñado como "skeleton premium" con UI estilo Zoho, funcionalidad CRUD completa, soporte multi-tenant y RBAC.

### ✅ Incluye (v0)

- Listado de compras con paginación, búsqueda y filtros
- Creación de compras con múltiples líneas (items)
- Edición de compras en estado DRAFT
- Transiciones de estado (DRAFT → APPROVED → RECEIVED, cancelación)
- Cálculo automático de totales (subtotal, tax placeholder, total)
- Relación con Vendors (proveedores)
- Multi-tenant (datos separados por organización)
- RBAC (permisos `purchases.read` / `purchases.write`)
- Audit log de eventos clave

### ❌ NO incluye (v0)

- **Impacto en stock real**: Las compras no afectan `StockItem` ni crean `StockMovement` al recibirse
- **Taxes reales**: El campo `taxCents` existe pero siempre es 0 (placeholder)
- **SKU mapping**: El campo `sku` en `PurchaseLine` existe pero no se valida ni mapea a `StockItem`
- **Attachments**: No hay gestión de archivos adjuntos
- **Accounting integration**: No hay integración con contabilidad

---

## 2. Rutas Web

### `/sales/purchases` (Listado)

**Componente**: `apps/web/app/(dashboard)/sales/purchases/page.tsx`

**Funcionalidades**:
- Tabla con columnas: Compra #, Proveedor, Estado, Total, Actualizado, Acciones
- Búsqueda por número de compra o nombre de proveedor
- Filtro por estado (DRAFT, APPROVED, RECEIVED, CANCELLED)
- Paginación (20 items por página)
- Botón "Nueva Compra" (visible solo si `can('purchases.write')`)
- Link "Ver" por fila que lleva a `/sales/purchases/[id]`
- Empty state con CTA si no hay compras

### `/sales/purchases/[id]` (Detalle)

**Componente**: `apps/web/app/(dashboard)/sales/purchases/[id]/page.tsx`

**Funcionalidades**:
- Header con número de compra y badge de estado
- Información del proveedor (nombre, email, teléfono)
- Tabla de líneas de compra (descripción, cantidad, precio unitario, total por línea)
- Resumen de totales (subtotal, impuestos, total)
- Historial de estados (approvedAt, receivedAt, cancelledAt)
- **Acciones disponibles según estado**:
  - **DRAFT**: Botón "Editar" (redirige a `/sales/purchases/[id]/edit`), "Aprobar", "Cancelar"
  - **APPROVED**: "Marcar Recibida", "Cancelar"
  - **RECEIVED**: Solo lectura (sin acciones)
  - **CANCELLED**: Solo lectura (sin acciones)

**Nota**: Las acciones requieren `purchases.write`. Si el usuario no tiene el permiso, los botones no se muestran.

---

## 3. Endpoints API

### `GET /api/purchases`

**Descripción**: Lista compras con paginación, búsqueda y filtros.

**Query params**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `q` (string, opcional): Búsqueda por ID de compra o nombre de proveedor
- `status` (PurchaseStatus, opcional): Filtro por estado
- `vendorId` (string, opcional): Filtro por proveedor

**Permisos**: `purchases.read`

**Response**:
```json
{
  "items": [
    {
      "id": "purchase-1",
      "status": "DRAFT",
      "subtotalCents": 2000,
      "taxCents": 0,
      "totalCents": 2000,
      "vendor": { "id": "vendor-1", "name": "Proveedor A" },
      "createdBy": { "id": "user-1", "name": "Juan", "email": "juan@test.com" },
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

### `GET /api/purchases/:id`

**Descripción**: Obtiene el detalle completo de una compra, incluyendo líneas y relaciones.

**Permisos**: `purchases.read`

**Response**:
```json
{
  "id": "purchase-1",
  "organizationId": "org-1",
  "vendorId": "vendor-1",
  "status": "DRAFT",
  "notes": "Notas opcionales",
  "subtotalCents": 2000,
  "taxCents": 0,
  "totalCents": 2000,
  "approvedAt": null,
  "receivedAt": null,
  "cancelledAt": null,
  "vendor": {
    "id": "vendor-1",
    "name": "Proveedor A",
    "email": "proveedor@test.com",
    "phone": "123456789"
  },
  "lines": [
    {
      "id": "line-1",
      "description": "Item 1",
      "quantity": 2,
      "unitPriceCents": 1000,
      "lineTotalCents": 2000,
      "sku": null
    }
  ],
  "createdBy": { "id": "user-1", "name": "Juan", "email": "juan@test.com" }
}
```

**Errores**:
- `404`: Si la compra no existe o pertenece a otra organización

### `POST /api/purchases`

**Descripción**: Crea una nueva compra con líneas.

**Body**:
```json
{
  "vendorId": "vendor-1",
  "notes": "Notas opcionales",
  "lines": [
    {
      "description": "Item 1",
      "quantity": 2,
      "unitPriceCents": 1000,
      "sku": "SKU-001" // Opcional
    }
  ]
}
```

**Permisos**: `purchases.write`

**Validaciones**:
- `vendorId` debe existir y pertenecer a la organización
- Debe tener al menos una línea
- `quantity` > 0
- `unitPriceCents` >= 0

**Response**: Purchase completo con líneas (mismo formato que `GET /api/purchases/:id`)

**Errores**:
- `400`: Si no hay líneas o validación falla
- `404`: Si el vendor no existe
- `403`: Si no tiene `purchases.write`

### `PATCH /api/purchases/:id`

**Descripción**: Actualiza una compra (solo si está en estado DRAFT).

**Body** (todos los campos opcionales):
```json
{
  "vendorId": "vendor-2", // Opcional
  "notes": "Notas actualizadas", // Opcional
  "lines": [ // Opcional, reemplaza todas las líneas existentes
    {
      "description": "Item actualizado",
      "quantity": 3,
      "unitPriceCents": 1500,
      "sku": "SKU-002"
    }
  ]
}
```

**Permisos**: `purchases.write`

**Validaciones**:
- La compra debe existir y pertenecer a la organización
- La compra debe estar en estado `DRAFT`
- Si se actualizan líneas, debe haber al menos una
- Si se cambia `vendorId`, el nuevo vendor debe existir y pertenecer a la organización

**Response**: Purchase actualizado con líneas recalculadas

**Errores**:
- `400`: Si la compra no está en DRAFT (`code: "INVALID_STATUS"`)
- `404`: Si la compra no existe o el vendor no existe
- `403`: Si no tiene `purchases.write`

### `POST /api/purchases/:id/transition`

**Descripción**: Cambia el estado de una compra siguiendo las reglas de transición.

**Body**:
```json
{
  "status": "APPROVED" // PurchaseStatus: DRAFT | APPROVED | RECEIVED | CANCELLED
}
```

**Permisos**: `purchases.write`

**Validaciones**:
- La compra debe existir y pertenecer a la organización
- La transición debe ser válida según las reglas (ver sección 5)

**Response**: Purchase actualizado con timestamps (`approvedAt`, `receivedAt`, `cancelledAt`) según corresponda

**Errores**:
- `400`: Si la transición es inválida (`code: "INVALID_TRANSITION"`, incluye `from` y `to`)
- `404`: Si la compra no existe
- `403`: Si no tiene `purchases.write`

---

## 4. Permisos (RBAC)

### Permisos disponibles

- **`purchases.read`**: Permite ver compras (listado y detalle)
- **`purchases.write`**: Permite crear, editar y transicionar compras

### Mapeo a roles

| Rol      | purchases.read | purchases.write |
|----------|----------------|-----------------|
| OWNER    | ✅             | ✅              |
| ADMIN    | ✅             | ✅              |
| MANAGER  | ✅             | ✅              |
| SELLER   | ✅             | ✅              |
| VIEWER   | ✅             | ❌              |

### UI Gating

**Si falta `purchases.write`**:
- Botón "Nueva Compra" oculto en `/sales/purchases`
- Botones de transición ocultos en `/sales/purchases/[id]`
- Botón "Editar" oculto en `/sales/purchases/[id]`

**Backend siempre valida**: Aunque la UI oculte acciones, el backend rechaza con `403 Forbidden` si falta el permiso.

### Endpoints y permisos requeridos

| Endpoint                          | Método | Permiso requerido |
|-----------------------------------|--------|-------------------|
| `/api/purchases`                  | GET    | `purchases.read`  |
| `/api/purchases/:id`              | GET    | `purchases.read`  |
| `/api/purchases`                  | POST   | `purchases.write` |
| `/api/purchases/:id`              | PATCH  | `purchases.write` |
| `/api/purchases/:id/transition`  | POST   | `purchases.write` |

---

## 5. Reglas de transición

| Desde      | Hacia        | Válido | Notas                                    |
|------------|--------------|--------|------------------------------------------|
| DRAFT      | APPROVED     | ✅     | Primera aprobación                       |
| DRAFT      | CANCELLED    | ✅     | Cancelación antes de aprobar             |
| APPROVED   | RECEIVED     | ✅     | Marca como recibida                      |
| APPROVED   | CANCELLED    | ✅     | Cancelación después de aprobar           |
| RECEIVED   | CANCELLED    | ❌     | **No permitido** (ya recibida)           |
| RECEIVED   | *            | ❌     | No se puede cambiar desde RECEIVED       |
| CANCELLED  | *            | ❌     | No se puede cambiar desde CANCELLED      |
| *          | * (mismo)    | ✅     | No-op (permitido pero no hace nada)      |

**Errores de transición inválida**:
- Status code: `400 Bad Request`
- Body:
  ```json
  {
    "code": "INVALID_TRANSITION",
    "message": "Cannot transition from RECEIVED to CANCELLED",
    "from": "RECEIVED",
    "to": "CANCELLED"
  }
  ```

---

## 6. Data Model (Prisma)

### Model `Purchase`

```prisma
model Purchase {
  id             String        @id @default(cuid())
  organizationId String
  vendorId       String
  createdById    String?
  
  status         PurchaseStatus @default(DRAFT)
  notes          String?
  
  subtotalCents  Int
  taxCents       Int            @default(0)
  totalCents     Int
  
  approvedAt     DateTime?
  receivedAt     DateTime?
  cancelledAt    DateTime?
  
  createdAt      DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  
  organization   Organization   @relation(...)
  vendor         Vendor         @relation(...)
  createdBy      User?          @relation("PurchaseCreator", ...)
  lines          PurchaseLine[]
  
  @@index([organizationId, createdAt])
  @@index([organizationId, status])
  @@index([organizationId, vendorId])
}
```

**Campos clave**:
- `subtotalCents`, `taxCents`, `totalCents`: Calculados server-side en `createPurchase` y `updatePurchase`
- `status`: Enum `PurchaseStatus` (DRAFT, APPROVED, RECEIVED, CANCELLED)
- Timestamps automáticos: `approvedAt`, `receivedAt`, `cancelledAt` se setean en transiciones

### Model `PurchaseLine`

```prisma
model PurchaseLine {
  id              String   @id @default(cuid())
  purchaseId      String
  description     String
  quantity        Int
  unitPriceCents  Int
  lineTotalCents  Int      // Calculado: quantity * unitPriceCents
  sku             String?  // Para futuro mapeo a StockItem
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  purchase        Purchase @relation(...)
  
  @@index([purchaseId])
}
```

**Notas**:
- `lineTotalCents` se calcula automáticamente al crear/actualizar
- `sku` es nullable y no se valida en v0 (placeholder para v1.1)

### Enum `PurchaseStatus`

```prisma
enum PurchaseStatus {
  DRAFT
  APPROVED
  RECEIVED
  CANCELLED
}
```

---

## 7. Testing

### Cómo correr tests

```bash
pnpm --filter @remember-me/api test purchases
```

### Tests implementados (4)

**Archivo**: `apps/api/src/purchases/purchases.service.spec.ts`

1. **`createPurchase should calculate totals correctly`**
   - Verifica que con `quantity: 2` y `unitPriceCents: 1000` se calculen:
     - `subtotalCents = 2000`
     - `taxCents = 0`
     - `totalCents = 2000`

2. **`updatePurchase should reject update if status is not DRAFT`**
   - Verifica que al intentar editar una compra con `status = APPROVED` se lance `BadRequestException` con mensaje "Only DRAFT purchases can be edited"

3. **`transitionPurchase should reject invalid transition from RECEIVED to CANCELLED`**
   - Verifica que la transición `RECEIVED → CANCELLED` se rechace con:
     - `BadRequestException`
     - `code: "INVALID_TRANSITION"`
     - Payload con `from` y `to`

4. **`getPurchase should return 404 if purchase belongs to another organization`**
   - Verifica que al buscar una compra de `org-a` con `org-b` se lance `NotFoundException` con "Purchase not found"

**Cobertura**: Lógica de negocio crítica (cálculos, validaciones de estado, multi-tenant).

---

## 8. Roadmap v1.1

### Impacto en stock real

- Al transicionar a `RECEIVED`, crear `StockMovement` de tipo `IN` por cada línea
- Mapear `PurchaseLine.sku` a `StockItem` (validar existencia)
- Si `sku` no existe, crear `StockItem` automáticamente o rechazar según configuración
- Actualizar `StockItem.quantity` según movimientos

### SKU mapping

- Validar que `PurchaseLine.sku` exista en `StockItem` (o crear si está configurado)
- Mostrar información del `StockItem` en la UI (nombre, categoría, ubicación)
- Permitir búsqueda de items por SKU al crear líneas

### Taxes reales

- Implementar cálculo de impuestos según configuración de organización
- Soporte para múltiples tax rates (IVA, otros)
- Campo `taxCents` calculado según reglas de negocio
- Mostrar desglose de impuestos en UI

### Attachments

- Permitir adjuntar archivos a compras (PDFs de órdenes, facturas, etc.)
- Almacenamiento en S3 o similar
- Endpoints: `POST /api/purchases/:id/attachments`, `GET /api/purchases/:id/attachments/:attachmentId`
- UI para subir/ver/descargar attachments

### Vendor Bills / Accounting-lite hooks

- Generar "Vendor Bill" automáticamente al recibir compra
- Integración básica con módulo de contabilidad (si existe)
- Exportar compras a formatos contables (CSV, JSON)
- Campos adicionales: `billNumber`, `billDate`, `dueDate`

---

## Referencias

- **Backend Service**: `apps/api/src/purchases/purchases.service.ts`
- **Backend Controller**: `apps/api/src/purchases/purchases.controller.ts`
- **Frontend List Page**: `apps/web/app/(dashboard)/sales/purchases/page.tsx`
- **Frontend Detail Page**: `apps/web/app/(dashboard)/sales/purchases/[id]/page.tsx`
- **Prisma Schema**: `packages/prisma/schema.prisma` (models `Purchase`, `PurchaseLine`, enum `PurchaseStatus`)

---

## Manual Smoke Checklist (2 minutes)

**Objetivo**: Validar que Purchases v0 funciona end-to-end sin herramientas especiales.

### Checklist

- [ ] **Abrir `/sales/purchases`**
  - Verificar que la página carga sin errores
  - Verificar que se muestra la tabla (vacía o con datos)
  - Verificar que el botón "Nueva Compra" es visible (si tienes `purchases.write`)

- [ ] **Crear purchase DRAFT con vendor + 1 línea**
  - Click en "Nueva Compra"
  - Seleccionar un vendor existente
  - Agregar al menos 1 línea (descripción, cantidad, precio unitario)
  - Verificar que los totales se calculan automáticamente
  - Guardar
  - Verificar que aparece en el listado con estado "Borrador"

- [ ] **Aprobar**
  - Abrir el detalle de la compra creada
  - Click en "Aprobar"
  - Verificar que el estado cambia a "Aprobada"
  - Verificar que `approvedAt` aparece en el historial

- [ ] **Marcar recibida**
  - Con la compra en estado APPROVED, click en "Marcar Recibida"
  - Verificar que el estado cambia a "Recibida"
  - Verificar que `receivedAt` aparece en el historial

- [ ] **Confirmar que no se puede cancelar recibida**
  - Con la compra en estado RECEIVED, verificar que el botón "Cancelar" NO aparece
  - Si intentas transicionar manualmente (API), debe devolver 400 con `code: "INVALID_TRANSITION"`

- [ ] **Org switch verifica aislamiento**
  - Crear una compra en Org A
  - Cambiar a Org B usando el org switcher
  - Verificar que la compra de Org A NO es visible en Org B
  - Volver a Org A y verificar que la compra es visible

- [ ] **Role sin purchases.write no ve CTA**
  - Iniciar sesión con un usuario que tenga `purchases.read` pero NO `purchases.write` (ej: VIEWER)
  - Verificar que el botón "Nueva Compra" NO aparece en `/sales/purchases`
  - Verificar que los botones de transición NO aparecen en el detalle
  - Si intentas crear vía API, debe devolver 403 Forbidden

**Tiempo estimado**: 2 minutos si todo funciona correctamente.
