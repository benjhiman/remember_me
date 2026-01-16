# Módulo Pricing - Documentación Frontend

## 📋 Tabla de Endpoints

| Método | Ruta | Auth | Roles | Body | Response |
|--------|------|------|-------|------|----------|
| `GET` | `/api/pricing/health` | ✅ | Todos | - | `{ ok: true, module: "pricing" }` |
| `GET` | `/api/pricing` | ✅ | Todos | Query params | `ListPricingRulesResponse` |
| `GET` | `/api/pricing/:id` | ✅ | Todos | - | `PricingRule` |
| `POST` | `/api/pricing` | ✅ | ADMIN, MANAGER, OWNER | `CreatePricingRuleDto` | `PricingRule` |
| `PUT` | `/api/pricing/:id` | ✅ | ADMIN, MANAGER, OWNER | `UpdatePricingRuleDto` | `PricingRule` |
| `DELETE` | `/api/pricing/:id` | ✅ | ADMIN, MANAGER, OWNER | - | `{ message: string }` |
| `POST` | `/api/pricing/calculate` | ✅ | Todos | `CalculatePriceDto` | `CalculatePriceResponse` |

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
GET /api/pricing/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "pricing"
}
```

---

### 2. Listar Pricing Rules

**Request:**
```http
GET /api/pricing?page=1&limit=20&isActive=true&search=VIP
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (opcional, default: 1) - Número de página
- `limit` (opcional, default: 10) - Elementos por página
- `search` (opcional) - Búsqueda en nombre
- `isActive` (opcional) - Filtrar por reglas activas/inactivas

**Response:**
```json
{
  "data": [
    {
      "id": "rule-123",
      "organizationId": "org-123",
      "name": "VIP Discount",
      "priority": 10,
      "isActive": true,
      "conditions": {
        "customerType": "vip"
      },
      "markupType": "PERCENTAGE",
      "markupValue": "10.00",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 3. Obtener Pricing Rule

**Request:**
```http
GET /api/pricing/rule-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "rule-123",
  "organizationId": "org-123",
  "name": "VIP Discount",
  "priority": 10,
  "isActive": true,
  "conditions": {
    "customerType": "vip"
  },
  "markupType": "PERCENTAGE",
  "markupValue": "10.00",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 4. Crear Pricing Rule

**Request:**
```http
POST /api/pricing
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "VIP Discount",
  "priority": 10,
  "isActive": true,
  "conditions": {
    "customerType": "vip"
  },
  "markupType": "PERCENTAGE",
  "markupValue": 10
}
```

**Ejemplo con condiciones múltiples:**
```json
{
  "name": "iPhone 15 Pro Premium",
  "priority": 15,
  "isActive": true,
  "conditions": {
    "model": "iPhone 15 Pro",
    "condition": "NEW"
  },
  "markupType": "FIXED",
  "markupValue": 50
}
```

**Campos requeridos:**
- `name` (string)
- `conditions` (object) - Condiciones para aplicar la regla
- `markupType` (PERCENTAGE | FIXED)
- `markupValue` (number)

**Campos opcionales:**
- `priority` (number, default: 0) - Mayor prioridad = se aplica primero
- `isActive` (boolean, default: true)

**Response:** (mismo formato que GET /api/pricing/:id)

---

### 5. Actualizar Pricing Rule

**Request:**
```http
PUT /api/pricing/rule-123
Authorization: Bearer <token>
Content-Type: application/json

{
  "priority": 15,
  "markupValue": 12
}
```

**Nota:** Todos los campos son opcionales. Solo incluye los campos que quieres actualizar.

**Response:** (mismo formato que GET /api/pricing/:id)

---

### 6. Eliminar Pricing Rule

**Request:**
```http
DELETE /api/pricing/rule-123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Pricing rule deleted successfully"
}
```

---

### 7. Calcular Precio

**Request:**
```http
POST /api/pricing/calculate
Authorization: Bearer <token>
Content-Type: application/json

{
  "basePrice": 1000,
  "model": "iPhone 15 Pro 256GB",
  "condition": "NEW",
  "storage": "256GB",
  "color": "Natural Titanium",
  "customerContext": {
    "customerType": "vip",
    "country": "AR"
  }
}
```

**Campos requeridos:**
- `basePrice` (number)
- `model` (string)

**Campos opcionales:**
- `condition` (NEW | USED | REFURBISHED)
- `storage` (string)
- `color` (string)
- `customerContext` (object) - Información del cliente para reglas basadas en cliente

**Response:**
```json
{
  "basePrice": 1000,
  "finalPrice": 1100,
  "appliedRules": [
    {
      "ruleId": "rule-123",
      "ruleName": "VIP Discount",
      "markupType": "PERCENTAGE",
      "markupValue": 10,
      "priceBefore": 1000,
      "priceAfter": 1100
    }
  ]
}
```

**Ejemplo con múltiples reglas:**
```json
{
  "basePrice": 1000,
  "finalPrice": 1150,
  "appliedRules": [
    {
      "ruleId": "rule-1",
      "ruleName": "High Priority Rule",
      "markupType": "PERCENTAGE",
      "markupValue": 10,
      "priceBefore": 1000,
      "priceAfter": 1100
    },
    {
      "ruleId": "rule-2",
      "ruleName": "Low Priority Rule",
      "markupType": "FIXED",
      "markupValue": 50,
      "priceBefore": 1100,
      "priceAfter": 1150
    }
  ]
}
```

---

## 🔒 Reglas de Permisos

### Roles y Acceso

#### ADMIN / MANAGER / OWNER
- ✅ **Acceso completo** a todos los endpoints
- ✅ Puede crear/actualizar/eliminar pricing rules
- ✅ Puede calcular precios

#### SELLER
- ✅ Puede **ver** pricing rules
- ✅ Puede **calcular precios**
- ❌ **No puede** crear/actualizar/eliminar pricing rules

---

## 💡 Sistema de Prioridades

Las reglas se aplican en orden de **prioridad descendente** (mayor prioridad primero):

1. **Priority 10** → Se aplica primero
2. **Priority 5** → Se aplica después
3. **Priority 0** → Se aplica al final

**Ejemplo:**
- Regla A: Priority 10, +10% → Precio: 1000 → 1100
- Regla B: Priority 5, +50 fijo → Precio: 1100 → 1150

---

## 🎯 Condiciones (Conditions)

Las condiciones se definen como un objeto JSON. Las claves pueden ser:

### Condiciones de Item
- `model` (string) - Coincidencia parcial (case-insensitive)
- `condition` (NEW | USED | REFURBISHED)
- `storage` (string) - Coincidencia exacta
- `color` (string) - Coincidencia exacta

### Condiciones de Cliente (customerContext)
- `customerType` (string) - ej: "vip", "regular"
- `country` (string) - ej: "AR", "US"
- Cualquier campo personalizado en `customerContext`

**Ejemplos de conditions:**
```json
// Solo modelo
{ "model": "iPhone 15 Pro" }

// Modelo y condición
{ "model": "iPhone 15 Pro", "condition": "NEW" }

// Cliente VIP
{ "customerType": "vip" }

// Combinación
{ "model": "iPhone 15 Pro", "customerType": "vip", "country": "AR" }
```

---

## 💰 Tipos de Markup

### PERCENTAGE (Porcentaje)
Aplica un porcentaje sobre el precio actual.

**Ejemplo:**
- Precio base: 1000
- Markup: 10% PERCENTAGE
- Resultado: 1000 * 1.10 = 1100

### FIXED (Fijo)
Suma un valor fijo al precio actual.

**Ejemplo:**
- Precio base: 1000
- Markup: 50 FIXED
- Resultado: 1000 + 50 = 1050

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
  "message": "Only admins and managers can create pricing rules"
}
```

---

### 404 Not Found
**Causa:** Pricing rule no existe o no pertenece a la organización.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Pricing rule not found"
}
```

---

### 400 Bad Request
**Causa:** Datos inválidos en el body.

**Ejemplos:**
- Campos requeridos faltantes
- markupType inválido
- markupValue negativo (aunque se permite, podría causar problemas)

**Response:**
```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "markupType must be one of the following values: PERCENTAGE, FIXED"
  ]
}
```

---

## 💡 Tips para Frontend

### Manejo de Prioridades
- Mayor prioridad = se aplica primero
- Las reglas se aplican en cascada (el resultado de una es entrada de la siguiente)
- Usa números altos (10, 20, 30) para facilitar la reorganización

### Cálculo de Precios
1. Envía el `basePrice` del item
2. Incluye información del item (model, condition, etc.)
3. Incluye `customerContext` si tienes información del cliente
4. El servicio aplica todas las reglas que coincidan
5. Recibe el precio final y las reglas aplicadas

### Condiciones de Modelo
El campo `model` usa coincidencia parcial (case-insensitive):
- Regla: `{ "model": "iPhone 15 Pro" }`
- Coincide con: "iPhone 15 Pro", "iPhone 15 Pro 256GB", "iPhone 15 Pro Max"

### Reglas Activas/Inactivas
- Usa `isActive: false` para desactivar reglas temporalmente
- Las reglas inactivas no se aplican en el cálculo de precios
- Útil para testing o reglas estacionales

### Campos Decimales
Los valores de markup (`markupValue`) se devuelven como strings (Decimal de Prisma). En frontend:
```typescript
const markupValue = parseFloat(rule.markupValue);
```

---

## 🔄 Flujo Recomendado

1. **Listar reglas activas:**
   ```
   GET /api/pricing?isActive=true
   ```

2. **Calcular precio para un item:**
   ```
   POST /api/pricing/calculate
   {
     "basePrice": 1000,
     "model": "iPhone 15 Pro",
     "customerContext": { "customerType": "vip" }
   }
   ```

3. **Crear/actualizar reglas según necesidad** (solo ADMIN/MANAGER/OWNER)

---

## 📊 Ejemplos de Casos de Uso

### Caso 1: Descuento VIP
```json
{
  "name": "VIP 10% Discount",
  "priority": 10,
  "conditions": { "customerType": "vip" },
  "markupType": "PERCENTAGE",
  "markupValue": -10  // Negativo para descuento
}
```

### Caso 2: Markup por Modelo
```json
{
  "name": "iPhone 15 Pro Premium",
  "priority": 5,
  "conditions": { "model": "iPhone 15 Pro" },
  "markupType": "FIXED",
  "markupValue": 50
}
```

### Caso 3: Descuento por País
```json
{
  "name": "Argentina Discount",
  "priority": 8,
  "conditions": { "country": "AR" },
  "markupType": "PERCENTAGE",
  "markupValue": -5
}
```

---

## 📞 Soporte

Para más información, consultar la documentación técnica del módulo.
