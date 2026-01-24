# Performance P1 - Virtualización e Infinite Loading

## Resumen

Este documento describe las optimizaciones de performance implementadas en el PASO 6 del proyecto, enfocadas en virtualización de listas grandes e infinite loading para mejorar la experiencia de usuario en páginas con miles de items.

## Qué se hizo

### 1. Virtualización de Listas

Se implementó virtualización usando `@tanstack/react-virtual` para renderizar solo los items visibles en el viewport, mejorando significativamente el rendimiento en listas con 50+ items.

**Componentes creados:**
- `VirtualizedStockTable` - Tabla virtualizada para stock items
- `VirtualizedConversationList` - Lista virtualizada para conversaciones
- `VirtualizedTable` (base) - Componente base reutilizable

**Características:**
- Solo virtualiza el body/rows, mantiene header fijo
- Estimación de altura configurable (default: 60-80px)
- Overscan configurable (default: 5-10 items) para scroll suave
- Carga automática de más items cuando se acerca al final (threshold: 10 items)

### 2. Infinite Loading

Se implementó infinite loading usando `useInfiniteQuery` de React Query para cargar datos de forma progresiva.

**Hooks creados:**
- `useStockItemsInfinite` - Hook para stock con infinite loading
- `useConverationsInfinite` - Hook para conversaciones con infinite loading

**Características:**
- Limit por defecto: **50 items por página**
- Carga automática cuando quedan 10 items visibles
- Botón "Cargar más" cuando hay más páginas disponibles
- Invalidación automática al cambiar organización
- Reinicio de paginación al cambiar filtros/búsqueda

### 3. Micro-optimizaciones

**Memoización:**
- Funciones de formateo (`getStatusColor`, `getStatusLabel`, etc.) con `useCallback`
- Render functions con `useMemo` y `useCallback`
- Componentes de lista memoizados (`React.memo` con comparación custom)
- Arrays derivados memoizados (`useMemo`)

**Estabilización de props:**
- Callbacks estables para evitar re-renders innecesarios
- Props de infinite loading estables (`hasMore`, `isLoadingMore`)

## Páginas Virtualizadas

### `/stock`

- **Componente**: `VirtualizedStockTable`
- **Condición**: Se activa automáticamente cuando hay más de 50 items
- **Infinite loading**: ✅ (limit=50)
- **Filtros**: Search, Status, Condition
- **Perf marks**: `stock-page-mount`, `stock-page-data-loaded`

### `/inbox/unified`

- **Componente**: `VirtualizedConversationList`
- **Condición**: Se activa automáticamente cuando hay más de 50 conversaciones
- **Infinite loading**: ✅ (limit=50, separado por provider)
- **Filtros**: Search, Status, Provider (WHATSAPP/INSTAGRAM)
- **Perf marks**: `inbox-list-mount`, `inbox-list-data-loaded`
- **Polling**: Mantiene polling para inbox en tiempo real sin resetear scroll

### `/inbox/whatsapp`

- **Componente**: `VirtualizedConversationList`
- **Condición**: Se activa automáticamente cuando hay más de 50 conversaciones
- **Infinite loading**: ✅ (limit=50)
- **Filtros**: Search, Status
- **Perf marks**: `inbox-whatsapp-mount`, `inbox-whatsapp-data-loaded`
- **Polling**: Mantiene polling para inbox en tiempo real

## Cómo medir Performance

### Habilitar logs de performance

1. Agregar variable de entorno en `.env.local`:
   ```bash
   NEXT_PUBLIC_PERF_LOG=1
   ```

2. Reiniciar el servidor de desarrollo:
   ```bash
   pnpm --filter @remember-me/web dev
   ```

3. Abrir la consola del navegador (F12 → Console)

4. Navegar a las páginas virtualizadas (`/stock`, `/inbox/unified`, `/inbox/whatsapp`)

5. Ver logs con formato:
   ```
   [PERF] Mark: stock-page-mount
   [PERF] Measure (to now): stock-page-data-loaded - 234.56ms
   ```

### Nombres de marks

**Stock:**
- `stock-page-mount` - Cuando se monta el componente
- `stock-page-data-loaded` - Cuando se carga la primera página de datos

**Inbox Unified:**
- `inbox-list-mount` - Cuando se monta el componente
- `inbox-list-data-loaded` - Cuando se cargan las conversaciones

**Inbox WhatsApp:**
- `inbox-whatsapp-mount` - Cuando se monta el componente
- `inbox-whatsapp-data-loaded` - Cuando se cargan las conversaciones

## Gotchas y Consideraciones

### 1. Cambio de Organización

Al cambiar de organización, React Query invalida automáticamente todas las queries, lo que resetea la paginación. Esto es el comportamiento esperado para evitar mezclar datos de diferentes organizaciones.

**Solución**: El `queryKey` incluye el `organizationId` implícitamente (vía `X-Organization-Id` header), por lo que el cambio de org automáticamente crea una nueva query.

### 2. Polling + Virtualized List

El polling de conversaciones (inbox) puede causar re-renders si no está bien configurado.

**Solución implementada:**
- `refetchInterval` configurado en el hook
- React Query solo actualiza los items que cambiaron
- El virtualizador mantiene la posición de scroll

### 3. Filtros y Búsqueda

Al cambiar filtros o búsqueda, la paginación se reinicia automáticamente (nueva query key).

**Comportamiento esperado:**
- Cambiar `q` (search) → nueva query, página 1
- Cambiar `status` → nueva query, página 1
- Cambiar `providerFilter` → nueva query, página 1

### 4. Threshold de carga automática

La carga automática se dispara cuando quedan 10 items visibles antes del final. Esto puede causar múltiples requests si el usuario scrollea muy rápido.

**Mitigación**: React Query cachea las páginas, por lo que requests duplicados no ocurren.

## Manual QA (5 minutos)

### Stock (`/stock`)

- [ ] Abrir `/stock`
- [ ] Verificar que la tabla se renderiza correctamente
- [ ] Scrollear 2-3 pantallas sin lag notable
- [ ] Verificar que se cargan más páginas automáticamente al acercarse al final
- [ ] Verificar que el botón "Cargar más" aparece cuando hay más páginas
- [ ] Probar búsqueda: escribir en el campo de búsqueda y verificar que reinicia la paginación
- [ ] Probar filtros: cambiar Status/Condition y verificar que reinicia la paginación

### Inbox Unified (`/inbox/unified`)

- [ ] Abrir `/inbox/unified`
- [ ] Verificar que la lista se renderiza correctamente
- [ ] Scrollear 2-3 pantallas sin lag notable
- [ ] Click en una conversación y verificar que abre correctamente
- [ ] Cambiar filtros (Provider, Status) y verificar que reinicia la paginación
- [ ] Cambiar organización y verificar que no mezcla datos

### Inbox WhatsApp (`/inbox/whatsapp`)

- [ ] Abrir `/inbox/whatsapp`
- [ ] Verificar que la lista se renderiza correctamente
- [ ] Scrollear 2-3 pantallas sin lag notable
- [ ] Click en una conversación y verificar que abre correctamente
- [ ] Verificar que el polling no resetea el scroll

### Build

- [ ] Ejecutar `pnpm --filter @remember-me/web build`
- [ ] Verificar que el build pasa sin errores
- [ ] Verificar que no hay warnings críticos

## Próximos Pasos Sugeridos (PASO 6.4 - Opcional)

### 1. Virtualización para Leads/Sales

Si las listas de Leads o Sales crecen mucho, aplicar el mismo patrón:
- Crear `VirtualizedLeadsTable` o similar
- Implementar `useLeadsInfinite` hook
- Aplicar en `/leads` y `/sales`

### 2. Server-side Filtering Optimizations

- Agregar índices en la base de datos para búsquedas frecuentes
- Implementar full-text search si es necesario
- Cachear resultados de búsqueda comunes

### 3. Performance Budget y Smoke Perf Check

- Definir performance budgets (ej: "First Contentful Paint < 1.5s")
- Agregar smoke tests de performance en CI
- Monitorear Core Web Vitals en producción

### 4. Optimizaciones Adicionales

- Lazy loading de imágenes en listas
- Prefetching inteligente de páginas siguientes
- Service Worker para cache de datos estáticos

## Referencias

- **Componentes**: `apps/web/components/stock/virtualized-stock-table.tsx`, `apps/web/components/inbox/virtualized-conversation-list.tsx`
- **Hooks**: `apps/web/lib/api/hooks/use-stock-items-infinite.ts`, `apps/web/lib/api/hooks/use-conversations-infinite.ts`
- **Páginas**: `apps/web/app/(dashboard)/stock/page.tsx`, `apps/web/app/(dashboard)/inbox/unified/page.tsx`, `apps/web/app/(dashboard)/inbox/whatsapp/page.tsx`
- **Utils**: `apps/web/lib/utils/perf.ts`
