# Módulo Dashboard - Documentación Frontend

## 📋 Tabla de Endpoints

| Método | Ruta | Auth | Roles | Body | Response |
|--------|------|------|-------|------|----------|
| `GET` | `/api/dashboard/health` | ✅ | Todos | - | `{ ok: true, module: "dashboard" }` |
| `GET` | `/api/dashboard/kpis` | ✅ | Todos | - | `KPIsResponse` |
| `GET` | `/api/dashboard/leads-by-stage` | ✅ | Todos | - | `LeadsByStageResponse` |
| `GET` | `/api/dashboard/sales-by-status` | ✅ | Todos | - | `SalesByStatusResponse` |
| `GET` | `/api/dashboard/stock-by-status` | ✅ | Todos | - | `StockByStatusResponse` |

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
GET /api/dashboard/health
Authorization: Bearer <token>
```

**Response:**
```json
{
  "ok": true,
  "module": "dashboard"
}
```

---

### 2. KPIs (Todos los indicadores)

**Request:**
```http
GET /api/dashboard/kpis
Authorization: Bearer <token>
```

**Response:**
```json
{
  "leads": {
    "byStage": [
      {
        "stageId": "stage-1",
        "stageName": "New",
        "pipelineId": "pipeline-1",
        "pipelineName": "Default",
        "count": 5
      },
      {
        "stageId": "stage-2",
        "stageName": "Contacted",
        "pipelineId": "pipeline-1",
        "pipelineName": "Default",
        "count": 3
      },
      {
        "stageId": "stage-3",
        "stageName": "Won",
        "pipelineId": "pipeline-1",
        "pipelineName": "Default",
        "count": 2
      }
    ],
    "total": 10
  },
  "sales": {
    "byStatus": [
      {
        "status": "RESERVED",
        "count": 3,
        "totalAmount": "3000.00"
      },
      {
        "status": "PAID",
        "count": 2,
        "totalAmount": "2000.00"
      },
      {
        "status": "SHIPPED",
        "count": 1,
        "totalAmount": "1500.00"
      },
      {
        "status": "DELIVERED",
        "count": 5,
        "totalAmount": "7500.00"
      }
    ],
    "total": 11,
    "totalRevenue": "11000.00"
  },
  "stock": {
    "byStatus": [
      {
        "status": "AVAILABLE",
        "count": 20,
        "totalCost": "20000.00",
        "totalValue": "24000.00"
      },
      {
        "status": "RESERVED",
        "count": 3,
        "totalCost": "3000.00",
        "totalValue": "3600.00"
      },
      {
        "status": "SOLD",
        "count": 5,
        "totalCost": "5000.00",
        "totalValue": "6000.00"
      }
    ],
    "available": 20
  }
}
```

---

### 3. Leads por Stage

**Request:**
```http
GET /api/dashboard/leads-by-stage
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "stageId": "stage-1",
    "stageName": "New",
    "pipelineId": "pipeline-1",
    "pipelineName": "Default",
    "count": 5
  },
  {
    "stageId": "stage-2",
    "stageName": "Contacted",
    "pipelineId": "pipeline-1",
    "pipelineName": "Default",
    "count": 3
  },
  {
    "stageId": "stage-3",
    "stageName": "Won",
    "pipelineId": "pipeline-1",
    "pipelineName": "Default",
    "count": 2
  }
]
```

**Nota:** Solo incluye leads con status `ACTIVE`. Ordenado por pipeline (order) y stage (order).

---

### 4. Ventas por Estado

**Request:**
```http
GET /api/dashboard/sales-by-status
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "status": "RESERVED",
    "count": 3,
    "totalAmount": "3000.00"
  },
  {
    "status": "PAID",
    "count": 2,
    "totalAmount": "2000.00"
  },
  {
    "status": "SHIPPED",
    "count": 1,
    "totalAmount": "1500.00"
  },
  {
    "status": "DELIVERED",
    "count": 5,
    "totalAmount": "7500.00"
  },
  {
    "status": "CANCELLED",
    "count": 1,
    "totalAmount": "500.00"
  }
]
```

**Nota:** 
- `count`: Cantidad de sales con ese status
- `totalAmount`: Suma total de los montos (string, Decimal de Prisma)

---

### 5. Stock por Estado

**Request:**
```http
GET /api/dashboard/stock-by-status
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "status": "AVAILABLE",
    "count": 20,
    "totalCost": "20000.00",
    "totalValue": "24000.00"
  },
  {
    "status": "RESERVED",
    "count": 3,
    "totalCost": "3000.00",
    "totalValue": "3600.00"
  },
  {
    "status": "SOLD",
    "count": 5,
    "totalCost": "5000.00",
    "totalValue": "6000.00"
  },
  {
    "status": "DAMAGED",
    "count": 1,
    "totalCost": "1000.00",
    "totalValue": "1200.00"
  },
  {
    "status": "RETURNED",
    "count": 0,
    "totalCost": "0",
    "totalValue": "0"
  }
]
```

**Nota:**
- `count`: Cantidad de items con ese status
- `totalCost`: Suma de costPrice (costo de compra)
- `totalValue`: Suma de basePrice (valor de venta base)

---

## 🔒 Reglas de Permisos

### Roles y Acceso

#### Todos los Roles
- ✅ Todos los endpoints de dashboard están disponibles para todos los roles
- ✅ Los datos se filtran automáticamente por organización
- ✅ No hay restricciones adicionales (todos ven los mismos KPIs de la organización)

---

## 💡 Tips para Frontend

### Manejo de Decimales
Los valores monetarios (`totalAmount`, `totalRevenue`, `totalCost`, `totalValue`) se devuelven como strings (Decimal de Prisma). En frontend:
```typescript
const total = parseFloat(kpis.sales.totalRevenue);
```

### Endpoint Principal
Usa `GET /api/dashboard/kpis` para obtener todos los KPIs en una sola llamada (más eficiente).

### Endpoints Específicos
Usa los endpoints individuales si solo necesitas un tipo de dato específico:
- `GET /api/dashboard/leads-by-stage` - Solo leads
- `GET /api/dashboard/sales-by-status` - Solo ventas
- `GET /api/dashboard/stock-by-status` - Solo stock

### Actualización de Datos
Los KPIs se calculan en tiempo real. Para mejorar performance:
- Considera implementar polling con intervalo razonable (ej: 30-60 segundos)
- Puedes cachear en frontend por un tiempo corto
- Los datos pueden cambiar frecuentemente, así que evita cachear por mucho tiempo

### Visualización Recomendada

**Leads por Stage:**
- Gráfico de barras o pie chart
- Agrupar por pipeline si hay múltiples pipelines
- Mostrar total de leads activos

**Ventas por Estado:**
- Gráfico de barras o línea
- Destacar totalRevenue (ventas completadas)
- Mostrar pipeline: RESERVED → PAID → SHIPPED → DELIVERED

**Stock por Estado:**
- Gráfico de barras o pie chart
- Mostrar disponibilidad (AVAILABLE)
- Destacar valor total vs costo total (margen)

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

### 404 Not Found
**Causa:** Usuario no es miembro de la organización.

**Response:**
```json
{
  "statusCode": 404,
  "message": "Organization not found or you are not a member"
}
```

---

## 🔄 Flujo Recomendado

1. **Cargar KPIs al iniciar dashboard:**
   ```
   GET /api/dashboard/kpis
   ```

2. **Actualizar KPIs periódicamente:**
   - Polling cada 30-60 segundos
   - O cuando el usuario vuelve a la vista

3. **Usar endpoints específicos si necesitas:**
   - Solo actualizar una sección específica
   - Evitar recargar todo

---

## 📊 Métricas Disponibles

### Leads
- **Por Stage**: Distribución de leads activos por etapa del pipeline
- **Total**: Cantidad total de leads activos

### Ventas
- **Por Estado**: Cantidad y monto total por cada estado
- **Total**: Cantidad de ventas activas (RESERVED, PAID, SHIPPED, DELIVERED)
- **Revenue Total**: Suma de ventas completadas (PAID, SHIPPED, DELIVERED)

### Stock
- **Por Estado**: Cantidad, costo total y valor total por estado
- **Disponible**: Cantidad de items disponibles para venta

---

## 📞 Soporte

Para más información, consultar la documentación técnica del módulo.
