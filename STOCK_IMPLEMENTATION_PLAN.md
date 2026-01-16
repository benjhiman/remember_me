# Stock Module Implementation Plan

## Estado Actual
- ✅ Schema actualizado con StockMovement y StockReservation
- ✅ Migración aplicada
- ✅ StockItem tiene quantity
- ⚠️ StockService necesita reescritura completa para soportar movimientos y reservas

## Nuevos Endpoints Necesarios

1. **CRUD StockItem** (ya existe, necesita ajustes)
   - GET /stock
   - GET /stock/:id
   - POST /stock
   - PUT /stock/:id
   - DELETE /stock/:id

2. **Movimientos** (nuevos)
   - POST /stock/:id/adjust - Ajuste manual
   - GET /stock/:id/movements - Ver movimientos de un item

3. **Reservas** (nuevos)
   - POST /stock/reservations - Crear reserva
   - GET /stock/reservations - Listar reservas
   - GET /stock/reservations/:id - Obtener reserva
   - POST /stock/reservations/:id/release - Liberar reserva
   - POST /stock/reservations/:id/confirm - Confirmar (convertir a SOLD)

## Lógica Crítica

1. **createStockItem**: 
   - Si tiene IMEI: quantity = 1 (validar)
   - Si no tiene IMEI: quantity puede ser > 1
   - Crear movimiento IN inicial

2. **adjustStock**:
   - Validar que no resulte en cantidad negativa
   - Crear movimiento ADJUST
   - Actualizar quantity

3. **reserveStock**:
   - Verificar que item esté AVAILABLE
   - Verificar cantidad disponible (quantity - reservas activas)
   - Crear StockReservation
   - Crear movimiento RESERVE
   - NO cambiar status a RESERVED (solo trackear en reservation)

4. **releaseReservation**:
   - Verificar que reserva esté ACTIVE
   - Cambiar status a CANCELLED
   - Crear movimiento RELEASE

5. **confirmReservation**:
   - Verificar que reserva esté ACTIVE
   - Cambiar status a CONFIRMED
   - Cambiar StockItem.status a SOLD
   - Crear movimiento SOLD
   - Reducir quantity

## Tests Necesarios (mínimo 15)

1. createStockItem - unidad individual (con IMEI)
2. createStockItem - lote (sin IMEI, quantity > 1)
3. createStockItem - validar IMEI único
4. adjustStock - ajuste positivo
5. adjustStock - ajuste negativo (no permitir negativo)
6. reserveStock - reserva exitosa
7. reserveStock - no permitir reservar más que quantity disponible
8. releaseReservation - liberar reserva
9. confirmReservation - confirmar venta
10. listMovements - ver movimientos
11. Multi-org isolation
12. Permisos (SELLER no puede crear/eliminar)
13. Concurrencia: dos reservas al mismo tiempo
14. Reserva expira
15. Integración con Sales (mock)

