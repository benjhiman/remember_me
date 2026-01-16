# Stock Module Design - Integration with Sales & Pricing

## Design Decision

El schema actual tiene StockItem como **unidades individuales** (cada item tiene IMEI único). 
Para soportar Sales y Pricing, necesitamos:

1. **StockItem**: Mantener como está (unidades individuales o lote sin IMEI)
   - Agregar campo `quantity` para lotes
   - Mantener status por item

2. **StockMovement**: Auditoría de TODOS los cambios
   - IN: Entrada de stock
   - OUT: Salida de stock  
   - RESERVE: Reserva temporal
   - RELEASE: Liberar reserva
   - ADJUST: Ajuste manual
   - SOLD: Confirmación de venta

3. **StockReservation**: Reservas temporales (linkeable con Sale)
   - Expiración opcional
   - Status: ACTIVE, CONFIRMED, EXPIRED, CANCELLED
   - Link con Sale (opcional)

## Flujo de Integración con Sales

1. **Sales Module reserva stock:**
   - Llama a `POST /api/stock/reservations` 
   - Crea StockReservation (status: ACTIVE)
   - Genera StockMovement (type: RESERVE)
   - StockItem.status cambia a RESERVED

2. **Sales Module confirma venta:**
   - Llama a `POST /api/stock/reservations/:id/confirm` o endpoint en Sales
   - StockReservation.status → CONFIRMED
   - StockMovement (type: SOLD)
   - StockItem.status → SOLD

3. **Sales Module cancela:**
   - Llama a `POST /api/stock/reservations/:id/release`
   - StockReservation.status → CANCELLED
   - StockMovement (type: RELEASE)
   - StockItem.status → AVAILABLE

## Supuestos

1. StockItem puede ser:
   - Unidad individual (con IMEI) → quantity siempre 1
   - Lote (sin IMEI) → quantity variable

2. Reservar = cambiar status a RESERVED, NO descontar cantidad
3. Vender = cambiar status a SOLD, mover a StockMovement
4. Nunca permitir stock negativo
5. Toda modificación genera StockMovement

