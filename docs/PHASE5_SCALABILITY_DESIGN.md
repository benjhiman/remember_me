# Phase 5 — Escalabilidad: Diseño Arquitectónico

## Contexto Actual

### Estado Actual del Sistema

**Job Runner:**
- Implementado como servicio dentro de la API (`JobRunnerService`)
- Ejecuta en el mismo proceso que la API
- Usa polling de DB cada 5 segundos (configurable)
- Procesa jobs de: WhatsApp, Instagram, Meta Spend, Token Refresh, Automations
- Mutex simple para prevenir ejecución concurrente

**Colas:**
- Implementación actual: `IntegrationJob` en PostgreSQL
- Polling-based: workers consultan DB por jobs pendientes
- Sin priorización ni rate limiting por organización
- Sin distribución de carga entre múltiples workers

**Rate Limiting:**
- Global a nivel de API (ThrottlerModule de NestJS)
- No hay rate limiting por organización
- No hay rate limiting específico para Inbox

**Observabilidad:**
- Logs básicos (Winston)
- Health check endpoint
- Métricas básicas del Job Runner (pending/processing/failed counts)
- Sin métricas de SLA por usuario
- Sin percentiles de latencia

---

## 1. Separar Job Runner en Worker Dedicado

### Opción A: Worker como Servicio NestJS Separado

**Arquitectura:**
```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   API App   │      │   Worker    │      │  PostgreSQL │
│  (NestJS)   │─────▶│  (NestJS)   │─────▶│     DB      │
│             │      │             │      │             │
│ - Endpoints │      │ - JobRunner │      │ - Jobs      │
│ - Webhooks  │      │ - Processors │     │ - Data      │
└─────────────┘      └─────────────┘      └─────────────┘
```

**Ventajas:**
- ✅ Separación clara de responsabilidades
- ✅ Escalado independiente (API puede escalar sin afectar workers)
- ✅ Mismo stack tecnológico (NestJS, TypeScript, Prisma)
- ✅ Comparte código fácilmente (packages compartidos)
- ✅ Fácil de implementar (refactor mínimo)

**Desventajas:**
- ⚠️ Dos procesos para mantener
- ⚠️ Dos deployments
- ⚠️ Comparte DB (puede ser cuello de botella)

**Recomendación:** ✅ **OPCIÓN A** (mejor balance para MVP escalable)

---

### Opción B: Worker como Microservicio Independiente

**Arquitectura:**
```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   API App   │      │   Worker    │      │  PostgreSQL │
│  (NestJS)   │      │  (Go/Node)  │      │     DB      │
│             │      │             │      │             │
│ - Endpoints │      │ - JobRunner │      │ - Jobs      │
│ - Webhooks  │      │ - Processors │     │ - Data      │
└─────────────┘      └─────────────┘      └─────────────┘
```

**Ventajas:**
- ✅ Máxima separación
- ✅ Puede usar tecnología diferente (Go para performance)
- ✅ Escalado completamente independiente

**Desventajas:**
- ❌ Overhead de mantenimiento (dos stacks)
- ❌ Complejidad de deployment
- ❌ Más difícil compartir código
- ❌ Overkill para el tamaño actual

**Recomendación:** ❌ No recomendado para esta fase (complejidad innecesaria)

---

### Opción C: Worker como Container/Process Separado (Mismo Código)

**Arquitectura:**
```
┌─────────────────────────────────────────┐
│         Docker Compose / K8s            │
│  ┌─────────────┐      ┌─────────────┐  │
│  │   API App   │      │   Worker    │  │
│  │  (NestJS)   │      │  (NestJS)   │  │
│  │             │      │             │  │
│  │ - Endpoints │      │ - JobRunner │  │
│  │ - Webhooks  │      │ - Processors│  │
│  └─────────────┘      └─────────────┘  │
│         │                    │          │
│         └──────────┬──────────┘          │
│                   ▼                     │
│            ┌─────────────┐              │
│            │  PostgreSQL │              │
│            └─────────────┘              │
└─────────────────────────────────────────┘
```

**Ventajas:**
- ✅ Mismo código base, diferentes entry points
- ✅ Fácil de containerizar
- ✅ Escalado independiente
- ✅ Comparte dependencias

**Desventajas:**
- ⚠️ Requiere refactor de entry points
- ⚠️ Dos imágenes Docker (o una con modo)

**Recomendación:** ✅ **OPCIÓN C** (mejor para producción containerizada)

---

### Plan de Implementación (Opción C)

1. **Refactor de Entry Points:**
   - `apps/api/src/main.ts` → API mode
   - `apps/worker/src/main.ts` → Worker mode
   - Compartir módulos comunes

2. **Configuración:**
   - Env var `APP_MODE=api|worker`
   - Worker solo carga módulos necesarios (JobRunner, Processors)
   - API no carga JobRunner

3. **Deployment:**
   - Docker: dos servicios en `docker-compose.yml`
   - K8s: dos deployments con mismo código, diferentes comandos

---

## 2. Estrategia de Colas: DB vs Redis/BullMQ

### Opción A: Mantener DB-Based Queue (Actual)

**Arquitectura:**
```
Worker → Polling PostgreSQL → IntegrationJob table
```

**Ventajas:**
- ✅ Ya implementado
- ✅ Sin dependencias adicionales
- ✅ Transaccional (ACID)
- ✅ Persistencia garantizada
- ✅ Fácil debugging (ver jobs en DB)
- ✅ No requiere infraestructura adicional

**Desventajas:**
- ❌ Polling ineficiente (consulta DB cada 5s)
- ❌ No escala bien (múltiples workers = múltiples polls)
- ❌ Sin priorización nativa
- ❌ Sin rate limiting por org
- ❌ Sin delayed jobs eficientes
- ❌ Contención en DB bajo carga alta

**Cuándo usar:**
- ✅ Volumen bajo-medio (< 1000 jobs/min)
- ✅ Pocos workers (< 5)
- ✅ Simplicidad > performance

**Recomendación:** ✅ **OK para MVP, migrar cuando crezca**

---

### Opción B: Redis + BullMQ

**Arquitectura:**
```
API → Enqueue → Redis (BullMQ) → Worker → Process
```

**Ventajas:**
- ✅ Muy rápido (in-memory)
- ✅ Escala horizontalmente (múltiples workers)
- ✅ Priorización nativa
- ✅ Rate limiting por queue/worker
- ✅ Delayed jobs eficientes
- ✅ Retry automático con backoff
- ✅ Job progress tracking
- ✅ Eventos (completed, failed, stalled)

**Desventajas:**
- ❌ Dependencia adicional (Redis)
- ❌ Persistencia opcional (puede perder jobs si Redis cae)
- ❌ Más complejidad operacional
- ❌ Requiere monitoreo de Redis

**Cuándo usar:**
- ✅ Volumen alto (> 1000 jobs/min)
- ✅ Múltiples workers
- ✅ Necesitas priorización/rate limiting
- ✅ Latencia crítica

**Recomendación:** ✅ **MEJOR para producción escalable**

---

### Opción C: Híbrido (DB + Redis)

**Arquitectura:**
```
API → Enqueue → Redis (BullMQ) → Worker → Process
                ↓
         Persist to DB (audit)
```

**Ventajas:**
- ✅ Performance de Redis
- ✅ Persistencia de DB (audit trail)
- ✅ Lo mejor de ambos mundos

**Desventajas:**
- ❌ Complejidad (dos sistemas)
- ❌ Sincronización (Redis → DB)
- ❌ Overhead de escritura doble

**Recomendación:** ⚠️ **Solo si necesitas audit trail completo**

---

### Plan de Migración Recomendado

**Fase 1 (Actual):** DB-based queue
- Mantener como está
- Optimizar polling (usar `LISTEN/NOTIFY` de PostgreSQL)

**Fase 2 (Escalabilidad):** Migrar a BullMQ
- Implementar BullMQ en paralelo
- Dual-write (DB + Redis) durante transición
- Migrar workers gradualmente

**Fase 3 (Producción):** Solo BullMQ
- Remover DB-based queue
- Mantener DB solo para audit/histórico

---

## 3. Rate Limiting por Org en Inbox

### Requisitos

- Rate limiting por organización (no global)
- Diferentes límites según tipo de acción:
  - Enviar mensaje: X por minuto
  - Enviar template: Y por minuto
  - Retry: Z por minuto
- No bloquear otras organizaciones si una excede límite

### Opción A: In-Memory (NestJS Throttler con Key por Org)

**Implementación:**
```typescript
@Throttle({ default: { limit: 100, ttl: 60000 } })
@UseGuards(ThrottlerGuard)
// Key: `${organizationId}:${action}`
```

**Ventajas:**
- ✅ Simple de implementar
- ✅ Sin dependencias adicionales
- ✅ Bajo overhead

**Desventajas:**
- ❌ No escala horizontalmente (cada instancia tiene su propio contador)
- ❌ Se resetea al reiniciar
- ❌ No funciona con múltiples API instances

**Recomendación:** ❌ **Solo para single-instance**

---

### Opción B: Redis-Based Rate Limiting

**Implementación:**
- Usar `ioredis` con algoritmo de "sliding window" o "token bucket"
- Key: `rate_limit:${organizationId}:${action}:${timeWindow}`
- TTL automático

**Ventajas:**
- ✅ Escala horizontalmente (compartido entre instancias)
- ✅ Persistente (sobrevive reinicios)
- ✅ Preciso (algoritmos probados)
- ✅ Flexible (diferentes límites por org/acción)

**Desventajas:**
- ⚠️ Dependencia de Redis
- ⚠️ Latencia adicional (llamada a Redis)

**Recomendación:** ✅ **MEJOR para producción**

---

### Opción C: DB-Based Rate Limiting

**Implementación:**
- Tabla `RateLimitLog` con `organizationId`, `action`, `timestamp`
- Query: `COUNT(*) WHERE organizationId = X AND action = Y AND timestamp > NOW() - INTERVAL '1 minute'`

**Ventajas:**
- ✅ Sin dependencias adicionales
- ✅ Persistente
- ✅ Audit trail completo

**Desventajas:**
- ❌ Muy lento (query DB en cada request)
- ❌ Contención en DB
- ❌ No escala

**Recomendación:** ❌ **No recomendado**

---

### Plan de Implementación (Opción B: Redis)

**Estructura:**
```
rate_limit:inbox:send_text:org-123:2026-01-15T10:30:00
  → Counter (increment)
  → TTL: 60 seconds
```

**Algoritmo: Sliding Window Log**
1. Obtener timestamp actual (segundos)
2. Key: `rate_limit:${orgId}:${action}:${windowStart}`
3. Incrementar contador
4. Si contador > límite → 429 Too Many Requests
5. TTL = window size

**Límites Recomendados:**
- `send_text`: 60/min por org
- `send_template`: 20/min por org
- `retry`: 10/min por org
- `assign`: 100/min por org (menos crítico)

**Middleware:**
```typescript
@Injectable()
export class OrgRateLimitGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const orgId = getOrgId(context);
    const action = getAction(context);
    const limit = getLimitForAction(action);
    
    const count = await redis.incr(`rate_limit:${orgId}:${action}:${window}`);
    if (count > limit) {
      throw new ThrottlerException('Rate limit exceeded');
    }
    return true;
  }
}
```

---

## 4. Observabilidad Avanzada

### 4.1 SLA por Usuario

**Requisitos:**
- Track tiempo de respuesta por usuario asignado
- SLA objetivo: 80% de mensajes respondidos en < 5 minutos
- Alertas si SLA cae debajo del umbral

**Implementación:**

**Opción A: Métricas en DB**
- Tabla `UserSlaMetrics`:
  - `userId`, `organizationId`
  - `firstResponseTimeMs` (promedio)
  - `slaComplianceRate` (porcentaje)
  - `lastCalculatedAt`

**Opción B: Métricas en Time-Series DB (Prometheus/InfluxDB)**
- Métricas: `inbox_first_response_time_ms{user_id, org_id}`
- Query: percentiles, promedios, alertas

**Recomendación:** ✅ **Opción B** (más flexible, mejor para alertas)

---

### 4.2 Job Latency Percentiles

**Requisitos:**
- P50, P95, P99 de latencia de jobs
- Por tipo de job (SEND_MESSAGE, SEND_TEMPLATE, etc.)
- Por organización (opcional)

**Implementación:**

**Opción A: Logs Estructurados + Agregación**
- Log cada job con `duration_ms`, `job_type`, `org_id`
- Agregar con herramienta externa (ELK, Datadog, etc.)

**Opción B: Métricas en Time-Series DB**
- Métricas: `job_duration_ms{job_type, org_id}`
- Histogramas para percentiles automáticos

**Recomendación:** ✅ **Opción B** (más eficiente, mejor para alertas)

---

### 4.3 Stack de Observabilidad Recomendado

**Componentes:**
1. **Prometheus** (métricas)
   - Job latency percentiles
   - Rate limit hits
   - Queue depths
   - Error rates

2. **Grafana** (visualización)
   - Dashboards por organización
   - Alertas (SLA breaches, high latency)

3. **Loki** (logs) - Opcional
   - Logs estructurados
   - Búsqueda y agregación

4. **Jaeger/Tempo** (tracing) - Futuro
   - Distributed tracing
   - End-to-end latency

**Métricas Clave a Trackear:**

```
# Job Metrics
job_duration_seconds{job_type, org_id, status} (histogram)
job_queue_depth{job_type, org_id} (gauge)
job_retry_count{job_type, org_id} (counter)

# Inbox Metrics
inbox_first_response_time_seconds{user_id, org_id} (histogram)
inbox_sla_compliance_rate{user_id, org_id} (gauge)
inbox_rate_limit_hits{org_id, action} (counter)

# System Metrics
api_request_duration_seconds{endpoint, method, status} (histogram)
api_request_count{endpoint, method, status} (counter)
db_query_duration_seconds{query_type} (histogram)
```

---

## Plan de Implementación Fase 5

### Fase 5.1: Separar Worker (2-3 semanas)
1. Refactor entry points (API vs Worker)
2. Docker Compose con dos servicios
3. Tests de integración
4. Deploy a staging

### Fase 5.2: Migrar a BullMQ (3-4 semanas)
1. Setup Redis
2. Implementar BullMQ queues
3. Dual-write (DB + Redis)
4. Migrar workers gradualmente
5. Remover DB-based queue

### Fase 5.3: Rate Limiting por Org (1-2 semanas)
1. Setup Redis (si no existe)
2. Implementar rate limiting guard
3. Configurar límites por acción
4. Tests y monitoreo

### Fase 5.4: Observabilidad Avanzada (2-3 semanas)
1. Setup Prometheus + Grafana
2. Instrumentar código (métricas)
3. Dashboards
4. Alertas
5. SLA tracking

**Total estimado: 8-12 semanas**

---

## Tradeoffs y Decisiones

### Decisión 1: Worker Separado
**Elegido:** Opción C (Container separado, mismo código)
**Razón:** Balance entre simplicidad y escalabilidad

### Decisión 2: Colas
**Elegido:** Migrar a BullMQ (Fase 2)
**Razón:** Escalabilidad horizontal, features avanzadas

### Decisión 3: Rate Limiting
**Elegido:** Redis-based (Opción B)
**Razón:** Escala horizontalmente, preciso

### Decisión 4: Observabilidad
**Elegido:** Prometheus + Grafana
**Razón:** Estándar de la industria, flexible, open-source

---

## Riesgos y Mitigaciones

### Riesgo 1: Complejidad Operacional
**Mitigación:** Documentación exhaustiva, runbooks, monitoreo

### Riesgo 2: Dependencia de Redis
**Mitigación:** Redis cluster, backups, fallback a DB si Redis cae

### Riesgo 3: Overhead de Métricas
**Mitigación:** Sampling, agregación, métricas opcionales

### Riesgo 4: Migración de Colas
**Mitigación:** Dual-write durante transición, rollback plan

---

## Próximos Pasos

1. **Revisar y aprobar este diseño**
2. **Crear issues/tickets para cada fase**
3. **Priorizar según necesidades de negocio**
4. **Empezar con Fase 5.1 (Worker Separado)**

---

## Referencias

- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS Throttler](https://docs.nestjs.com/security/rate-limiting)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Redis Rate Limiting Patterns](https://redis.io/docs/manual/patterns/rate-limiting/)
