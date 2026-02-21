# FASE 1 - Implementación Audit Log "MOVIMIENTOS" (OWNER)

## Resumen de Implementación

Se ha implementado la FASE 1 del módulo "MOVIMIENTOS" (Audit Log) para rol OWNER, extendiendo el sistema de auditoría existente con campos adicionales y una interfaz completa para visualización y filtrado.

## Archivos Creados/Modificados

### Backend (NestJS)

1. **`packages/prisma/schema.prisma`**
   - Extendido modelo `AuditLog` con campos:
     - `actorRole` (String?)
     - `actorEmail` (String?)
     - `severity` (String, default: "info")
     - `source` (String, default: "api")
     - `ip` (String?)
     - `userAgent` (String?)
   - Agregados nuevos valores a enums `AuditAction` y `AuditEntityType`
   - Agregados índices para performance

2. **`packages/prisma/migrations/20260221154452_extend_audit_log_fields/migration.sql`**
   - Migración segura para agregar nuevos campos
   - Agregados nuevos valores a enums
   - Creados índices adicionales

3. **`apps/api/src/common/audit/audit-log.service.ts`**
   - Extendida interfaz `AuditLogData` con nuevos campos
   - Actualizado método `log()` para guardar nuevos campos

4. **`apps/api/src/common/interceptors/audit-log.interceptor.ts`**
   - Mejorado para capturar `actorRole`, `actorEmail`, `ip`, `userAgent`
   - Agregados campos `source` y `severity` en logs automáticos

5. **`apps/api/src/common/audit/audit-log.controller.ts`**
   - Cambiado endpoint de `/audit` a `/audit-logs`
   - Restringido a rol OWNER usando `@OwnerOnly()` y `OwnerOnlyGuard`
   - Agregados filtros avanzados:
     - `dateFrom`, `dateTo` (rango de fechas)
     - `actorUserId`, `actorRole` (filtro por usuario/rol)
     - `action`, `entityType`, `entityId` (filtro por entidad)
     - `search` (búsqueda en email, acción, ID - mínimo 3 caracteres)
   - Validación de `pageSize` (máximo 200)
   - Respuesta incluye todos los nuevos campos

6. **`apps/api/src/customers/customers.service.ts`**
   - Actualizado para usar nuevos campos en audit logs
   - Cambiado `AuditAction.CREATE` a `AuditAction.CUSTOMER_CREATED`
   - Cambiado `AuditAction.UPDATE` a `AuditAction.CUSTOMER_UPDATED`

7. **`apps/api/src/sales/sales.service.ts`**
   - Actualizado `updateSale()` para usar nuevos campos
   - Cambiado `AuditAction.UPDATE` a `AuditAction.SALE_UPDATED`

### Frontend (Next.js)

1. **`apps/web/lib/api/hooks/use-audit-logs.ts`**
   - Extendida interfaz `AuditLog` con nuevos campos
   - Actualizado hook para soportar todos los filtros nuevos
   - Cambiado endpoint a `/audit-logs`

2. **`apps/web/app/(dashboard)/owner/movimientos/page.tsx`** (NUEVO)
   - Página completa de "Movimientos" para OWNER
   - Filtros: fecha, rol, acción, tipo de entidad, ID, búsqueda
   - Tabla con paginación server-side
   - Dialog de detalles con JSON formateado
   - Protegida con `RoleGuard` (solo OWNER)

3. **`apps/web/components/layout/sidebar-zoho.tsx`**
   - Agregado ítem "Movimientos" visible solo para OWNER
   - Implementada verificación `ownerOnly` en `NavItemComponent`

## Checklist de Validación Post-Redeploy

### Backend (Railway)

1. **Migración de Base de Datos**
   - [ ] Verificar que la migración `20260221154452_extend_audit_log_fields` se ejecutó correctamente
   - [ ] Verificar que los nuevos campos existen en la tabla `AuditLog`
   - [ ] Verificar que los nuevos valores de enum fueron agregados

2. **Endpoint GET /audit-logs**
   - [ ] Verificar que solo OWNER puede acceder (otros roles deben recibir 403)
   - [ ] Probar filtros:
     ```bash
     # Filtro por fecha
     curl -H "Cookie: accessToken=..." "https://api.iphonealcosto.com/audit-logs?dateFrom=2026-02-01&dateTo=2026-02-28"
     
     # Filtro por rol
     curl -H "Cookie: accessToken=..." "https://api.iphonealcosto.com/audit-logs?actorRole=SELLER"
     
     # Filtro por acción
     curl -H "Cookie: accessToken=..." "https://api.iphonealcosto.com/audit-logs?action=CUSTOMER_CREATED"
     
     # Búsqueda
     curl -H "Cookie: accessToken=..." "https://api.iphonealcosto.com/audit-logs?search=test@example.com"
     ```
   - [ ] Verificar paginación (page, pageSize)
   - [ ] Verificar que la respuesta incluye: `actorRole`, `actorEmail`, `severity`, `source`, `ip`, `userAgent`

3. **Audit Logging Automático**
   - [ ] Crear un cliente y verificar que se genera log con `CUSTOMER_CREATED`
   - [ ] Actualizar un cliente y verificar que se genera log con `CUSTOMER_UPDATED`
   - [ ] Verificar que los logs incluyen `actorRole`, `actorEmail`, `ip`, `userAgent`

### Frontend (Vercel)

1. **Página Movimientos**
   - [ ] Acceder a `/owner/movimientos` como OWNER (debe cargar correctamente)
   - [ ] Acceder como ADMIN/MANAGER/SELLER (debe mostrar "Acceso Denegado")
   - [ ] Verificar que el link "Movimientos" aparece en el sidebar solo para OWNER

2. **Filtros**
   - [ ] Probar filtro por fecha (dateFrom, dateTo)
   - [ ] Probar filtro por rol (OWNER, ADMIN, MANAGER, SELLER)
   - [ ] Probar filtro por acción (CREATE, UPDATE, CUSTOMER_CREATED, etc.)
   - [ ] Probar filtro por tipo de entidad (Customer, Sale, etc.)
   - [ ] Probar búsqueda (mínimo 3 caracteres)
   - [ ] Verificar que "Limpiar filtros" funciona

3. **Tabla**
   - [ ] Verificar que muestra: Fecha, Usuario, Rol, Acción, Entidad, ID, Resumen
   - [ ] Verificar paginación (botones anterior/siguiente)
   - [ ] Verificar que al hacer click en una fila se abre el dialog de detalles

4. **Dialog de Detalles**
   - [ ] Verificar que muestra todos los campos del log
   - [ ] Verificar que `before`, `after`, y `metadata` se muestran como JSON formateado
   - [ ] Verificar que se puede cerrar el dialog

## Próximos Pasos (Fase 2)

1. **Instrumentación de Eventos Adicionales**
   - [ ] Agregar logs para PAYMENT_RECEIVED, PAYMENT_APPLIED
   - [ ] Agregar logs para STOCK_ADDED, STOCK_CONFIRMED, STOCK_ADJUSTED
   - [ ] Agregar logs para LOGIN_SUCCESS, LOGIN_FAILED en `auth.controller.ts`
   - [ ] Actualizar todos los servicios existentes para usar nuevos campos

2. **Mejoras de UI**
   - [ ] Exportar a CSV
   - [ ] Filtros avanzados (depoId, officeId, sellerId, customerId)
   - [ ] Gráficos de actividad por día/semana/mes
   - [ ] Alertas para eventos críticos (severity: error)

3. **Performance y Retención**
   - [ ] Implementar archiving de logs antiguos (> 1 año)
   - [ ] Optimizar queries con índices adicionales si es necesario
   - [ ] Considerar particionamiento de tabla por fecha

4. **Tests**
   - [ ] Tests unitarios para `AuditLogService`
   - [ ] Tests de integración para endpoint `/audit-logs`
   - [ ] Tests E2E para UI de Movimientos

## Notas Técnicas

- **Seguridad**: Todos los logs están scoped a `organizationId` (multi-tenant isolation)
- **Performance**: Índices optimizados para queries comunes (org+date, org+user+date, org+role+date)
- **Fail Mode**: El sistema usa `AUDIT_FAIL_MODE=OPEN` por defecto (no rompe requests si falla el log)
- **Búsqueda**: La búsqueda en JSONB metadata requiere raw SQL, por ahora solo busca en campos directos

## Comandos Útiles

```bash
# Generar Prisma client después de migración
cd packages/prisma && npx prisma generate

# Ejecutar migración en producción (Railway)
# Se ejecuta automáticamente en el build, pero se puede verificar con:
npx prisma migrate status

# Ver logs de audit en producción
# Usar la UI en /owner/movimientos o el endpoint directamente
```
