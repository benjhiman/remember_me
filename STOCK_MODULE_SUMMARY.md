# Stock Module - Design Summary & Status

## ✅ Schema Completo

1. **StockItem** - Con `quantity` agregado
2. **StockMovement** - Auditoría completa
3. **StockReservation** - Reservas temporales

## ⚠️ Decisiones de Diseño Críticas

### 1. StockItem Quantity
- **Con IMEI**: quantity = 1 (unidad individual, validar en create)
- **Sin IMEI**: quantity puede ser > 1 (lote)
- **Reservar NO reduce quantity** (solo se trackea en Reservation)
- **Vender SÍ reduce quantity** (status → SOLD, quantity decrementa)

### 2. Reservas vs Status
- **Reservar**: Crea StockReservation (status ACTIVE), NO cambia StockItem.status
- **Confirmar venta**: StockReservation → CONFIRMED, StockItem.status → SOLD, quantity decrementa
- **Cancelar**: StockReservation → CANCELLED, quantity NO cambia

### 3. Movimientos (StockMovement)
- **IN**: Entrada inicial (createStockItem)
- **ADJUST**: Ajuste manual (adjustStock)
- **RESERVE**: Crear reserva
- **RELEASE**: Liberar reserva
- **SOLD**: Confirmar venta
- **OUT**: Salida manual (futuro)

### 4. Integración con Sales
Sales Module solo necesita:
- `POST /api/stock/reservations` - Crear reserva
- `POST /api/stock/reservations/:id/confirm` - Confirmar venta
- `POST /api/stock/reservations/:id/release` - Cancelar

## 📋 Endpoints Necesarios

### CRUD StockItem (ajustar existentes)
- GET /stock
- GET /stock/:id  
- POST /stock (agregar quantity, crear movimiento IN)
- PUT /stock/:id
- DELETE /stock/:id

### Nuevos Endpoints
- POST /stock/:id/adjust - Ajuste manual con motivo
- GET /stock/:id/movements - Ver movimientos
- POST /stock/reservations - Crear reserva
- GET /stock/reservations - Listar reservas
- GET /stock/reservations/:id - Obtener reserva
- POST /stock/reservations/:id/release - Liberar
- POST /stock/reservations/:id/confirm - Confirmar venta

## 🔒 Reglas NO Negociables

1. ✅ Nunca permitir stock negativo
2. ✅ Toda modificación genera StockMovement
3. ✅ Reservar ≠ vender (no descontar quantity)
4. ✅ Multi-org estricto
5. ✅ Validar IMEI único
6. ✅ Concurrencia: usar transacciones para reservas

## ⚠️ Supuestos

1. **Quantity en StockItem**: Para items con IMEI, quantity siempre 1
2. **Reservas**: No bloquean quantity hasta confirmar venta
3. **Movimientos**: Siempre se crean, incluso en ajustes manuales
4. **Sales Integration**: Sales llama a endpoints de Stock, no viceversa

## 🚨 Riesgos Alto Volumen

1. **Concurrencia en reservas**: Usar `SELECT FOR UPDATE` o transacciones serializables
2. **Índices**: Ya existen en stockItemId, status, organizationId
3. **Movimientos**: Pueden crecer mucho → considerar particionamiento por fecha (futuro)

## 📝 Próximos Pasos

1. Actualizar CreateStockItemDto (agregar quantity)
2. Crear DTOs: AdjustStockDto, CreateReservationDto
3. Reescribir StockService completo
4. Actualizar StockController
5. Tests (mínimo 15)
6. Seed con items demo
7. Documentación completa

