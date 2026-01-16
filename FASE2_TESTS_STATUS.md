# FASE 2 - ESTADO ACTUAL DE TESTS

**Fecha:** 2026-01-13  
**Estado:** ⚠️ EN PROGRESO - Hay tests fallando

---

## RESUMEN ACTUAL

- **Tests:** 111 failed, 70 passed, 181 total
- **Test Suites:** 5 failed, 7 passed, 12 total
- **Build:** ✅ SUCCESS
- **TypeCheck:** ✅ 0 errores

---

## PROBLEMAS IDENTIFICADOS

### 1. Request-Scoped Services (CRÍTICO - ~100 tests)
**Problema:** Services con `@Inject(REQUEST)` (LeadsService, SalesService, PricingService, StockService) no pueden usar `module.get()` en tests.

**Archivos afectados:**
- `leads.service.spec.ts` - usar `module.resolve()` en lugar de `module.get()`
- `sales.service.spec.ts` - usar `module.resolve()` en lugar de `module.get()`
- `pricing.service.spec.ts` - usar `module.resolve()` en lugar de `module.get()`
- `stock.service.spec.ts` - ya usa `module.resolve()` correctamente

**Solución:** Cambiar `module.get<Service>(Service)` a `module.resolve<Service>(Service)` y hacer los tests async donde corresponda.

### 2. StockService Soft Delete Tests (3 tests)
**Problema:** Mocks de `$transaction` incompletos para tests de soft delete.

**Tests afectados:**
- `should soft delete stockItem and exclude from list` - falta `quantity` en mock de `item`
- `should block reserve on soft-deleted stockItem` - falta `stockReservation.create` en `mockTx`
- `should block adjust on soft-deleted stockItem` - falta `stockItem.update` en `mockTx`

**Solución:** Agregar mocks completos de `$transaction` con todos los métodos necesarios.

### 3. SalesController Test (2 tests)
**Problema:** ThrottlerGuard es un guard global y necesita `THROTTLER:MODULE_OPTIONS`.

**Solución:** Override del guard o excluir temporalmente del test suite.

### 4. RequestIdMiddleware Test (4 tests)
**Problema:** uuid@13.0.0 es ESM y Jest no puede parsearlo sin configuración adicional.

**Solución:** Excluir temporalmente del test suite (no crítico para Fase 2).

---

## PLAN DE ACCIÓN

1. ✅ **Controller health tests** - Ya arreglados (async/await)
2. ⏳ **Request-scoped services** - Cambiar a `module.resolve()` (PRIORIDAD 1)
3. ⏳ **StockService mocks** - Completar mocks de `$transaction` (PRIORIDAD 2)
4. ⏳ **SalesController** - Override ThrottlerGuard o excluir (PRIORIDAD 3)
5. ⏳ **RequestIdMiddleware** - Excluir del test suite (PRIORIDAD 4)

---

## EXCLUSIÓN TEMPORAL

Para avanzar con Fase 2, se pueden excluir temporalmente:
- `request-id.middleware.spec.ts` (problema ESM/uuid)
- `sales.controller.spec.ts` (problema ThrottlerGuard global)

Esto deja ~105 tests fallando (principalmente request-scoped services).

---

## SIGUIENTE PASO

**PRIORIDAD MÁXIMA:** Arreglar request-scoped services cambiando `module.get()` a `module.resolve()` en:
1. `leads.service.spec.ts`
2. `sales.service.spec.ts`
3. `pricing.service.spec.ts`

Esto debería resolver ~100 tests.
