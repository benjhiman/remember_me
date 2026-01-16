# Módulo Stock - Documentación Frontend

## 📋 Tabla de Endpoints

| Método | Ruta | Auth | Roles | Body | Response |
|--------|------|------|-------|------|----------|
| `GET` | `/api/stock/health` | ✅ | Todos | - | `{ ok: true, module: "stock" }` |
| `GET` | `/api/stock` | ✅ | Todos | Query params | `ListStockItemsResponse` |
| `GET` | `/api/stock/:id` | ✅ | Todos | - | `StockItem` |
| `POST` | `/api/stock` | ✅ | ADMIN, MANAGER, OWNER | `CreateStockItemDto` | `StockItem` |
| `PUT` | `/api/stock/:id` | ✅ | ADMIN, MANAGER, OWNER | `UpdateStockItemDto` | `StockItem` |
| `DELETE` | `/api/stock/:id` | ✅ | ADMIN, MANAGER, OWNER | - | `{ message: string }` |

---

## 🔐 Autenticación

Todos los endpoints requieren el header:
```
Authorization: Bearer <accessToken>
```

---

## 📝 Ejemplos de Requests/Responses

### 1. Health Check

**Request:**
```http
GET /api/stock/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "stock"
}
```

---

### 2. Listar Stock Items

**Request:**
```http
GET /api/stock?page=1&limit=20&status=AVAILABLE&model=iPhone&search=15
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (opcional, default: 1) - Número de página
- `limit` (opcional, default: 10) - Elementos por página
- `search` (opcional) - Búsqueda en model, sku, imei, serialNumber
- `status` (opcional) - AVAILABLE, RESERVED, SOLD, DAMAGED, RETURNED
- `condition` (opcional) - NEW, USED, REFURBISHED
- `model` (opcional) - Filtrar por modelo
- `location` (opcional) - Filtrar por ubicación

**Response:**
```json
{
  "data": [
    {
      "id": "item-123",
      "organizationId": "org-123",
      "sku": "IPHONE15PRO-256-NT",
      "model": "iPhone 15 Pro 256GB",
      "storage": "256GB",
      "color": "Natural Titanium",
      "condition": "NEW",
      "imei": "123456789012345",
      "serialNumber": "SN123456789",
      "costPrice": "1000.00",
      "basePrice": "1200.00",
      "status": "AVAILABLE",
      "location": "Almacén A",
      "notes": "Nuevo en caja",
      "metadata": {
        "supplier": "Apple",
        "purchaseDate": "2024-01-01"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

### 3. Obtener Stock Item

**Request:**
```http
GET /api/stock/item-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "item-123",
  "organizationId": "org-123",
  "sku": "IPHONE15PRO-256-NT",
  "model": "iPhone 15 Pro 256GB",
  "storage": "256GB",
  "color": "Natural Titanium",
  "condition": "NEW",
  "imei": "123456789012345",
  "serialNumber": "SN123456789",
  "costPrice": "1000.00",
  "basePrice": "1200.00",
  "status": "AVAILABLE",
  "location": "Almacén A",
  "notes": "Nuevo en caja",
  "metadata": {
    "supplier": "Apple",
    "purchaseDate": "2024-01-01"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 4. Crear Stock Item

**Request:**
```http
POST /api/stock
Authorization: Bearer <token>
Content-Type: application/json

{
  "sku": "IPHONE15PRO-256-NT",
  "model": "iPhone 15 Pro 256GB",
  "storage": "256GB",
  "color": "Natural Titanium",
  "condition": "NEW",
  "imei": "123456789012345",
  "serialNumber": "SN123456789",
  "costPrice": 1000.00,
  "basePrice": 1200.00,
  "status": "AVAILABLE",
  "location": "Almacén A",
  "notes": "Nuevo en caja",
  "metadata": {
    "supplier": "Apple",
    "purchaseDate": "2024-01-01"
  }
}
```

**Campos requeridos:**
- `model` (string)
- `costPrice` (number)
- `basePrice` (number)

**Campos opcionales:**
- `sku`, `storage`, `color`, `imei`, `serialNumber`, `location`, `notes`, `metadata`
- `condition` (default: NEW)
- `status` (default: AVAILABLE)

**Response:** (mismo formato que GET /api/stock/:id)

---

### 5. Actualizar Stock Item

**Request:**
```http
PUT /api/stock/item-123
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "RESERVED",
  "location": "Almacén B",
  "notes": "Item reservado para venta"
}
```

**Nota:** Todos los campos son opcionales. Solo incluye los campos que quieres actualizar.

**Response:** (mismo formato que GET /api/stock/:id)

---

### 6. Eliminar Stock Item

**Request:**
```http
DELETE /api/stock/item-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Stock item deleted successfully"
}
```

**Nota:** No se puede eliminar items con status RESERVED o SOLD, o con reservaciones activas.

---

## 🔒 Reglas de Permisos

### Roles y Acceso

#### ADMIN / MANAGER / OWNER
- ✅ **Acceso completo** a todos los endpoints
- ✅ Puede crear/actualizar/eliminar stock items
- ✅ Puede ver todos los stock items de la organización

#### SELLER
- ✅ Puede **ver** todos los stock items de la organización
- ❌ **No puede** crear/actualizar/eliminar stock items

---

## 📊 Estados de Stock (StockStatus)

- `AVAILABLE` - Disponible para venta (por defecto)
- `RESERVED` - Reservado para una venta
- `SOLD` - Vendido
- `DAMAGED` - Dañado
- `RETURNED` - Devuelto

---

## 📦 Condiciones de Item (ItemCondition)

- `NEW` - Nuevo (por defecto)
- `USED` - Usado
- `REFURBISHED` - Reacondicionado

---

## ❌ Errores Comunes

### 401 Unauthorized
**Causa:** Token inválido, expirado o no proporcionado.

**Response:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

### 403 Forbidden
**Causa:** Usuario no tiene permisos suficientes (SELLER intentando crear/actualizar/eliminar).

**Response:**
```json
{
  "statusCode": 403,
  "message": "Only admins and managers can create stock items"
}
```

---

### 404 Not Found
**Causa:** Stock item no existe o no pertenece a la organización.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Stock item not found"
}
```

---

### 400 Bad Request
**Causa:** Datos inválidos o operación no permitida.

**Ejemplos:**
- Intentar cambiar status de SOLD a AVAILABLE
- Intentar eliminar item con status RESERVED o SOLD

**Response:**
```json
{
  "statusCode": 400,
  "message": "Cannot set status to AVAILABLE for sold items"
}
```

---

### 409 Conflict
**Causa:** IMEI duplicado (el IMEI debe ser único).

**Response:**
```json
{
  "statusCode": 409,
  "message": "IMEI already exists"
}
```

---

## 💡 Tips para Frontend

### Manejo de Paginación
```typescript
interface ListStockItemsResponse {
  data: StockItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### Campos Decimales
Los precios (`costPrice`, `basePrice`) se devuelven como strings (Decimal de Prisma). En frontend, puedes convertirlos:
```typescript
const price = parseFloat(item.costPrice);
```

### Campos JSON (metadata)
`metadata` es un objeto JSON flexible. Ejemplo:
```json
{
  "metadata": {
    "supplier": "Apple",
    "purchaseDate": "2024-01-01",
    "warranty": "1 year",
    "invoiceNumber": "INV-001"
  }
}
```

### Validación de IMEI
- IMEI es opcional pero debe ser único si se proporciona
- Al actualizar, si cambias el IMEI, debe seguir siendo único

### Estados y Validaciones
- **No se puede** cambiar status de SOLD a AVAILABLE
- **No se puede** eliminar items con status RESERVED o SOLD
- **No se puede** eliminar items con reservaciones activas

### Filtros de Búsqueda
Los filtros en `GET /api/stock` son acumulativos. Ejemplo:
- `?status=AVAILABLE&condition=NEW&model=iPhone` → Items disponibles, nuevos, que contengan "iPhone" en el modelo

---

## 🔄 Flujo Recomendado

1. **Listar stock items con filtros:**
   ```
   GET /api/stock?status=AVAILABLE&page=1&limit=20
   ```

2. **Obtener detalles de un item:**
   ```
   GET /api/stock/:id
   ```

3. **Crear/actualizar items según necesidad** (solo ADMIN/MANAGER/OWNER)

4. **Actualizar status cuando se reserva/vende:**
   ```
   PUT /api/stock/:id
   {
     "status": "RESERVED" // o "SOLD"
   }
   ```

---

## 📞 Soporte

Para más información, consultar la documentación técnica del módulo.
