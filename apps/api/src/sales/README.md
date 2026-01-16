# Módulo Sales - Documentación Frontend

## 📋 Tabla de Endpoints

| Método | Ruta | Auth | Roles | Body | Response |
|--------|------|------|-------|------|----------|
| `GET` | `/api/sales/health` | ✅ | Todos | - | `{ ok: true, module: "sales" }` |
| `GET` | `/api/sales` | ✅ | Todos* | Query params | `ListSalesResponse` |
| `GET` | `/api/sales/:id` | ✅ | Todos* | - | `Sale` |
| `POST` | `/api/sales` | ✅ | Todos | `CreateSaleDto` | `Sale` |
| `PUT` | `/api/sales/:id` | ✅ | Todos* | `UpdateSaleDto` | `Sale` |
| `DELETE` | `/api/sales/:id` | ✅ | ADMIN, MANAGER, OWNER | - | `{ message: string }` |

*SELLER solo puede ver sus propias ventas.

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
GET /api/sales/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "sales"
}
```

---

### 2. Listar Sales

**Request:**
```http
GET /api/sales?page=1&limit=20&status=RESERVED&assignedToId=user-123
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (opcional, default: 1) - Número de página
- `limit` (opcional, default: 10) - Elementos por página
- `search` (opcional) - Búsqueda en saleNumber, customerName, email, phone
- `status` (opcional) - RESERVED, PAID, SHIPPED, DELIVERED, CANCELLED
- `assignedToId` (opcional) - Filtrar por vendedor
- `leadId` (opcional) - Filtrar por lead

**Response:**
```json
{
  "data": [
    {
      "id": "sale-123",
      "organizationId": "org-123",
      "leadId": "lead-456",
      "assignedToId": "user-789",
      "saleNumber": "SALE-2024-001",
      "status": "RESERVED",
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "customerPhone": "+1234567890",
      "customerCity": "Buenos Aires",
      "subtotal": "2000.00",
      "discount": "100.00",
      "total": "1900.00",
      "currency": "USD",
      "reservedAt": "2024-01-01T10:00:00.000Z",
      "paidAt": null,
      "shippedAt": null,
      "deliveredAt": null,
      "notes": "Cliente VIP",
      "metadata": {
        "trackingNumber": "TRACK123"
      },
      "createdAt": "2024-01-01T10:00:00.000Z",
      "updatedAt": "2024-01-01T10:00:00.000Z",
      "assignedTo": {
        "id": "user-789",
        "name": "Sales Rep",
        "email": "sales@example.com"
      },
      "lead": {
        "id": "lead-456",
        "name": "John Doe"
      },
      "items": [
        {
          "id": "item-1",
          "saleId": "sale-123",
          "stockItemId": "stock-789",
          "model": "iPhone 15 Pro 256GB",
          "quantity": 1,
          "unitPrice": "2000.00",
          "totalPrice": "2000.00",
          "createdAt": "2024-01-01T10:00:00.000Z",
          "stockItem": {
            "id": "stock-789",
            "sku": "IPHONE15PRO-256-NT",
            "imei": "123456789012345"
          }
        }
      ],
      "_count": {
        "items": 1
      }
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

### 3. Obtener Sale

**Request:**
```http
GET /api/sales/sale-123
Authorization: Bearer <token>
```

**Response:** (mismo formato que el item en listSales, pero completo)

---

### 4. Crear Sale

**Request:**
```http
POST /api/sales
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadId": "lead-456",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+1234567890",
  "customerCity": "Buenos Aires",
  "discount": 100,
  "currency": "USD",
  "items": [
    {
      "stockItemId": "stock-789",
      "model": "iPhone 15 Pro 256GB",
      "quantity": 1,
      "unitPrice": 2000
    }
  ],
  "notes": "Cliente VIP",
  "metadata": {
    "source": "instagram"
  }
}
```

**Campos requeridos:**
- `customerName` (string)
- `items` (array) - Debe tener al menos un item

**Campos opcionales:**
- `leadId` (string)
- `customerEmail`, `customerPhone`, `customerCity` (string)
- `discount` (number, default: 0)
- `currency` (string, default: "USD")
- `notes` (string)
- `metadata` (object)

**Items:**
- `stockItemId` (string, opcional) - Si se proporciona, el item se reserva del stock
- `model` (string) - Snapshot del modelo
- `quantity` (number) - Cantidad (mínimo 1)
- `unitPrice` (number) - Precio unitario

**Response:** (mismo formato que GET /api/sales/:id)

**Nota:** Al crear una sale, los stock items se marcan como RESERVED automáticamente.

---

### 5. Actualizar Sale

**Request:**
```http
PUT /api/sales/sale-123
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "PAID",
  "discount": 150,
  "notes": "Pago recibido"
}
```

**Campos opcionales:**
- `status` (RESERVED | PAID | SHIPPED | DELIVERED | CANCELLED)
- `customerName`, `customerEmail`, `customerPhone`, `customerCity`
- `discount` (number)
- `notes` (string)
- `metadata` (object)

**Response:** (mismo formato que GET /api/sales/:id)

**Nota:** Cambiar el status tiene efectos en el stock:
- `RESERVED` → `PAID`: No cambia stock (sigue RESERVED)
- `RESERVED/PAID` → `SHIPPED`: Stock cambia a SOLD
- Cualquier status → `CANCELLED`: Stock liberado (vuelve a AVAILABLE)

---

### 6. Eliminar Sale

**Request:**
```http
DELETE /api/sales/sale-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Sale deleted successfully"
}
```

**Nota:** Solo se pueden eliminar sales con status RESERVED o CANCELLED. El stock se libera automáticamente.

---

## 🔒 Reglas de Permisos

### Roles y Acceso

#### ADMIN / MANAGER / OWNER
- ✅ **Acceso completo** a todos los endpoints
- ✅ Puede ver todas las sales de la organización
- ✅ Puede crear/actualizar/eliminar cualquier sale
- ✅ Puede cambiar status de cualquier sale

#### SELLER
- ✅ Puede crear sales
- ✅ Puede ver **solo sus propias sales** (assignedToId === userId)
- ✅ Puede actualizar **solo sus propias sales**
- ❌ **No puede** eliminar sales
- ✅ Puede cambiar status de sus propias sales

---

## 📊 Estados de Sale (SaleStatus)

- `RESERVED` - Reservado (por defecto al crear)
- `PAID` - Pagado
- `SHIPPED` - Enviado
- `DELIVERED` - Entregado
- `CANCELLED` - Cancelado

---

## 🔄 Flujo de Estados y Stock

### Crear Sale (RESERVED)
1. Se crea la sale con status `RESERVED`
2. Los stock items se marcan como `RESERVED`
3. `reservedAt` se establece automáticamente

### Actualizar a PAID
1. Status cambia a `PAID`
2. Stock sigue como `RESERVED`
3. `paidAt` se establece automáticamente

### Actualizar a SHIPPED
1. Status cambia a `SHIPPED`
2. Stock cambia a `SOLD`
3. `shippedAt` se establece automáticamente

### Actualizar a DELIVERED
1. Status cambia a `DELIVERED`
2. Stock sigue como `SOLD`
3. `deliveredAt` se establece automáticamente

### Cancelar (CANCELLED)
1. Status cambia a `CANCELLED`
2. Stock se libera (vuelve a `AVAILABLE`)
3. Solo si el stock estaba como `RESERVED`

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
**Causa:** Usuario no tiene permisos suficientes.

**Ejemplos:**
- SELLER intentando acceder a sale de otro vendedor
- SELLER intentando eliminar sale

**Response:**
```json
{
  "statusCode": 403,
  "message": "You do not have access to this sale"
}
```

---

### 404 Not Found
**Causa:** Sale no existe o no pertenece a la organización.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Sale not found"
}
```

---

### 400 Bad Request
**Causa:** Datos inválidos o operación no permitida.

**Ejemplos:**
- Items vacíos
- Stock item no disponible
- Intentar eliminar sale que no es RESERVED/CANCELLED

**Response:**
```json
{
  "statusCode": 400,
  "message": "Sale must have at least one item"
}
```

---

## 💡 Tips para Frontend

### Manejo de Paginación
```typescript
interface ListSalesResponse {
  data: Sale[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### Números de Sale
Los números de sale se generan automáticamente con formato:
- `SALE-YYYY-NNN` (ej: SALE-2024-001)
- Secuencial por año y organización

### Campos Decimales
Los precios (`subtotal`, `discount`, `total`, `unitPrice`, `totalPrice`) se devuelven como strings (Decimal de Prisma). En frontend:
```typescript
const total = parseFloat(sale.total);
```

### Stock Items
- Si `stockItemId` está presente, el item viene del stock y se reserva
- Si `stockItemId` es null, el item es manual (no viene del stock)
- Al crear una sale, solo se pueden usar items con status AVAILABLE

### Actualizar Status
Cuando actualizas el status, considera:
- **RESERVED → PAID**: Solo cambia el status
- **PAID → SHIPPED**: Stock cambia a SOLD
- **Cualquier → CANCELLED**: Stock se libera (si estaba RESERVED)

### Campos JSON (metadata)
`metadata` es un objeto JSON flexible. Ejemplo:
```json
{
  "metadata": {
    "trackingNumber": "TRACK123",
    "shippingMethod": "express",
    "source": "instagram"
  }
}
```

### Filtros de Búsqueda
Los filtros en `GET /api/sales` son acumulativos. Ejemplo:
- `?status=RESERVED&assignedToId=user-123` → Sales reservadas del vendedor 123

---

## 🔄 Flujo Recomendado

1. **Listar sales con filtros:**
   ```
   GET /api/sales?status=RESERVED&page=1&limit=20
   ```

2. **Obtener detalles de una sale:**
   ```
   GET /api/sales/:id
   ```

3. **Crear sale:**
   ```
   POST /api/sales
   {
     "customerName": "...",
     "items": [...]
   }
   ```

4. **Actualizar status según el flujo:**
   ```
   PUT /api/sales/:id
   {
     "status": "PAID" // luego "SHIPPED", etc.
   }
   ```

---

## 📞 Soporte

Para más información, consultar la documentación técnica del módulo.
