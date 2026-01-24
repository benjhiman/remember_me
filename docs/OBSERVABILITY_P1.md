# Observabilidad P1 — Request ID Correlation

## 📋 Overview

Sistema de correlación de requests end-to-end usando Request ID para poder rastrear un error desde la UI hasta los logs del backend/worker en menos de 2 minutos.

---

## 🔍 Cómo seguir un Request

### Desde la UI (Error Toast)

1. **Cuando ocurre un error**, el toast muestra:
   - Mensaje de error
   - **ID de error** (Request ID)
   - Botón "Copiar" para copiar el ID

2. **Copiar el Request ID**:
   - Click en el botón de copiar
   - El ID se copia al clipboard

### Buscar en Logs del Backend

1. **En Railway (API logs)**:
   ```bash
   # Buscar por requestId en los logs
   railway logs --filter "requestId: <ID_COPIADO>"
   ```

2. **En los logs estructurados**, buscar:
   ```json
   {
     "requestId": "abc-123-def",
     "method": "POST",
     "url": "/api/purchases",
     "statusCode": 500,
     "userId": "user-123",
     "organizationId": "org-456"
   }
   ```

3. **El Request ID aparece en**:
   - Logs de request (inicio)
   - Logs de response (fin)
   - Logs de error (si hay)
   - Headers de respuesta HTTP (`X-Request-Id`)

---

## 📊 Flujo End-to-End

### 1. Frontend (Web)

**Generación:**
- Cada request genera un UUID v4 único
- Se guarda en memoria (scoped por request lifecycle)
- Se envía en header `X-Request-Id`

**Headers enviados:**
```
X-Request-Id: <uuid>
X-Client: web
X-Client-Version: <commit-hash> (si disponible)
X-Organization-Id: <org-id>
Authorization: Bearer <token>
```

**Ubicación del código:**
- `apps/web/lib/observability/request-id.ts` - Generación de Request ID
- `apps/web/lib/api/auth-client.ts` - Envío de headers

### 2. Backend (API)

**Middleware (RequestIdMiddleware):**
- Lee `X-Request-Id` del header
- Si no existe, genera uno nuevo (UUID v4)
- Lo pone en `req.requestId` para acceso en toda la request
- Lo setea en response header `X-Request-Id`

**Logging (LoggingInterceptor):**
- Loguea SIEMPRE al inicio y fin de cada request:
  - `requestId`
  - `method`, `url`, `statusCode`
  - `userId`, `organizationId` (si existe)
  - `durationMs`
  - `userAgent` (opcional)

**Errores (AllExceptionsFilter):**
- Incluye `requestId` en el JSON de error:
  ```json
  {
    "statusCode": 500,
    "message": "Error message",
    "error": "ErrorType",
    "requestId": "abc-123-def",
    "timestamp": "2025-01-24T10:00:00Z",
    "path": "/api/purchases"
  }
  ```

**Ubicación del código:**
- `apps/api/src/common/middleware/request-id.middleware.ts`
- `apps/api/src/common/interceptors/logging.interceptor.ts`
- `apps/api/src/common/filters/all-exceptions.filter.ts`

### 3. Worker (si aplica)

**Correlación:**
- Si un job se encola desde el API, el `requestId` debe incluirse en el payload del job
- Al procesar el job, el worker loguea con `requestId` + `jobId`

**Ejemplo de log:**
```
[Worker] Processing job job-123 (requestId: abc-123-def, orgId: org-456)
```

---

## 📝 Ejemplo de Log

### Request exitoso

```
2025-01-24T10:00:00Z [info]: POST /api/purchases HTTP Request
{
  "requestId": "abc-123-def-456",
  "method": "POST",
  "url": "/api/purchases",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "userId": "user-123",
  "organizationId": "org-456"
}

2025-01-24T10:00:00.123Z [info]: POST /api/purchases 201 123ms HTTP Response
{
  "requestId": "abc-123-def-456",
  "method": "POST",
  "url": "/api/purchases",
  "statusCode": 201,
  "duration": 123,
  "userId": "user-123",
  "organizationId": "org-456"
}
```

### Request con error

```
2025-01-24T10:00:00Z [info]: POST /api/purchases HTTP Request
{
  "requestId": "abc-123-def-456",
  "method": "POST",
  "url": "/api/purchases",
  "userId": "user-123",
  "organizationId": "org-456"
}

2025-01-24T10:00:00.456Z [error]: POST /api/purchases 500 456ms HTTP Error
{
  "requestId": "abc-123-def-456",
  "method": "POST",
  "url": "/api/purchases",
  "statusCode": 500,
  "duration": 456,
  "error": "Internal server error",
  "userId": "user-123",
  "organizationId": "org-456"
}
```

**Response JSON:**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "InternalServerError",
  "requestId": "abc-123-def-456",
  "timestamp": "2025-01-24T10:00:00.456Z",
  "path": "/api/purchases"
}
```

---

## 🎯 Dónde ver Request ID en UI

### Error Toast

Cuando ocurre un error en una mutación (create, update, delete), el toast muestra:

```
┌─────────────────────────────────────┐
│ Error                              │
│ No se pudo crear la compra         │
│ ─────────────────────────────────  │
│ ID de error: abc-123-def-456 [📋] │
└─────────────────────────────────────┘
```

- Click en el botón de copiar (📋) copia el Request ID al clipboard

### Componente

**Ubicación:** `apps/web/components/ui/error-toast-with-request-id.tsx`

**Uso en hooks:**
```typescript
import { getRequestIdFromError } from '@/lib/utils/error-handler';
import { ErrorToastWithRequestId } from '@/components/ui/error-toast-with-request-id';

onError: (error: any) => {
  const requestId = getRequestIdFromError(error);
  toast({
    title: 'Error',
    description: (
      <div>
        <p>{message}</p>
        {requestId && <ErrorToastWithRequestId requestId={requestId} />}
      </div>
    ),
    variant: 'destructive',
  });
}
```

---

## ✅ Checklist de Verificación

### Frontend

- [ ] Request ID se genera en cada request
- [ ] Headers `X-Request-Id`, `X-Client`, `X-Client-Version` se envían
- [ ] Request ID se captura de response headers
- [ ] Request ID se muestra en error toasts
- [ ] Botón "Copiar" funciona

### Backend

- [ ] `RequestIdMiddleware` lee/genera Request ID
- [ ] Request ID está en `req.requestId`
- [ ] Response header `X-Request-Id` se setea
- [ ] `LoggingInterceptor` loguea requestId + userId + orgId
- [ ] `AllExceptionsFilter` incluye requestId en error JSON
- [ ] Logs muestran requestId en formato estructurado

### Validación End-to-End

1. **Hacer una request que falle** (ej: crear purchase sin permisos)
2. **Copiar Request ID del toast**
3. **Buscar en logs del API**:
   ```bash
   # En Railway
   railway logs --filter "requestId: <ID>"
   ```
4. **Verificar que aparece**:
   - Request log (inicio)
   - Error log (si hay)
   - Response log (fin)

---

## 🔧 Debugging

### Request ID no aparece en UI

**Causas posibles:**
1. Error no viene del API (network error, CORS, etc.)
2. Response no incluye `X-Request-Id` header
3. Error response no incluye `requestId` en body

**Solución:**
- Verificar Network tab en DevTools
- Verificar que el backend esté corriendo
- Verificar que `RequestIdMiddleware` esté aplicado

### Request ID no aparece en logs

**Causas posibles:**
1. `LoggingInterceptor` no está registrado
2. Logs no están en formato estructurado
3. Request no pasa por el interceptor

**Solución:**
- Verificar `app.module.ts` que `LoggingInterceptor` esté en providers
- Verificar formato de logs (JSON vs simple)
- Verificar que el endpoint no esté marcado como `@Public()` sin interceptor

---

## 📚 Referencias

- **Frontend Request ID**: `apps/web/lib/observability/request-id.ts`
- **API Client**: `apps/web/lib/api/auth-client.ts`
- **Error Handler**: `apps/web/lib/utils/error-handler.ts`
- **Error Toast Component**: `apps/web/components/ui/error-toast-with-request-id.tsx`
- **Backend Middleware**: `apps/api/src/common/middleware/request-id.middleware.ts`
- **Backend Interceptor**: `apps/api/src/common/interceptors/logging.interceptor.ts`
- **Backend Exception Filter**: `apps/api/src/common/filters/all-exceptions.filter.ts`

---

**Última actualización:** Enero 2025
