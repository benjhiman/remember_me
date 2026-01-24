# Accounting-Lite Data Models

## 📋 Overview

Modelos de datos mínimos para preparar el terreno para integración con Zoho Books. **NO implementa contabilidad real todavía**, solo estructura de datos base.

---

## 🗄️ Modelos Prisma

### LedgerAccount

Cuentas contables básicas.

**Campos:**
- `id`: UUID
- `organizationId`: Multi-tenant
- `code`: Código de cuenta (ej: "1000", "2000")
- `name`: Nombre de la cuenta
- `type`: Tipo (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE)
- `isActive`: Activa/inactiva
- `createdAt`, `updatedAt`

**Índices:**
- `(organizationId, code)` - Unique
- `(organizationId, type)`
- `(organizationId, isActive)`

### LedgerCategory

Categorías para agrupar transacciones (opcional).

**Campos:**
- `id`: UUID
- `organizationId`: Multi-tenant
- `name`: Nombre de categoría
- `createdAt`, `updatedAt`

**Índices:**
- `(organizationId, name)`

### CustomerBalanceSnapshot

Snapshots de balance de clientes en un momento dado.

**Campos:**
- `id`: UUID
- `organizationId`: Multi-tenant
- `customerId`: Relación con Customer
- `balanceCents`: Balance en centavos (puede ser negativo para crédito)
- `asOfDate`: Fecha del snapshot
- `createdAt`, `updatedAt`

**Índices:**
- `(organizationId, customerId)`
- `(organizationId, asOfDate)`
- `(organizationId, customerId, asOfDate)` - Unique

---

## 🔧 Purchase "Prep"

**Campos agregados a Purchase:**
- `currency`: String (default "USD")
- `referenceNumber`: String? (opcional)

**Campos ya existentes (listos para contabilidad):**
- `subtotalCents`, `taxCents`, `totalCents`: Totales en centavos
- `status`: Estados de compra

**NO implementado todavía:**
- Posteo de asientos contables al aprobar/recibir compra
- Mapeo de Purchase a LedgerAccount
- Cálculo automático de balances

---

## 📡 API Endpoints (Mínimos)

### GET /api/ledger/accounts

Lista de cuentas contables.

**Query params:**
- `type`: Filtrar por tipo (ASSET, LIABILITY, etc.)
- `isActive`: Filtrar por activas/inactivas

**Response:**
```json
{
  "items": [
    {
      "id": "...",
      "code": "1000",
      "name": "Cash",
      "type": "ASSET",
      "isActive": true
    }
  ],
  "total": 1
}
```

### POST /api/ledger/accounts

Crear cuenta contable (gated por OWNER/ADMIN).

**Body:**
```json
{
  "code": "1000",
  "name": "Cash",
  "type": "ASSET"
}
```

**RBAC:**
- Requiere `settings.write` o role OWNER/ADMIN

---

## 🚧 Límites Actuales

### NO Implementado

1. **Posteo de asientos contables**:
   - Al crear/editar Purchase, no se postean asientos
   - Al cambiar estado de Purchase, no se registran movimientos contables

2. **Cálculo de balances**:
   - `CustomerBalanceSnapshot` es manual (no se calcula automáticamente)
   - No hay cálculo de balances de cuentas contables

3. **Integración con Zoho Books**:
   - No hay sync bidireccional
   - No hay mapeo de cuentas

4. **UI**:
   - No hay UI para gestionar cuentas contables (solo API)
   - No hay reportes contables

---

## 🗺️ Roadmap v1.1

1. **Posteo automático de asientos**:
   - Al aprobar Purchase → débito en cuenta de gastos, crédito en cuenta por pagar
   - Al recibir Purchase → débito en cuenta por pagar, crédito en cuenta de proveedores

2. **Cálculo de balances**:
   - Balance automático de cuentas contables
   - Balance automático de clientes (desde Sales)

3. **UI básica**:
   - Lista de cuentas contables en Settings
   - Crear/editar cuentas

4. **Integración Zoho Books**:
   - Sync de cuentas
   - Sync de transacciones
   - Mapeo de cuentas

---

## 📚 Referencias

- **Schema**: `packages/prisma/schema.prisma`
- **API Endpoints**: `apps/api/src/ledger/` (si existe)
- **Migrations**: `packages/prisma/migrations/`

---

**Última actualización:** Enero 2025
