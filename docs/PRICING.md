# Pricing — CRM Remember Me

## 📊 Tiers de Precios

### Starter
**Ideal para:** Operaciones pequeñas, 1-5 usuarios, necesidades básicas de CRM e inventario.

**Incluye:**
- **Usuarios**: Hasta 5 usuarios
- **Organizaciones**: 1 organización
- **Módulos**:
  - Leads (CRM completo)
  - Stock (gestión de inventario)
  - Sales (ventas, customers, vendors)
  - Dashboard básico
- **Soporte**: Email (respuesta en 48h)
- **Onboarding**: Self-service (documentación + video tutoriales)
- **Storage**: 10GB
- **API calls**: 10,000/mes

**Add-ons disponibles:**
- Inbox (WhatsApp + Instagram): +$X/mes
- Purchases: +$X/mes
- Meta Ads sync: +$X/mes
- White-label: +$X/mes

**Precio sugerido:** $X/mes (facturación mensual) o $X/año (facturación anual, 2 meses gratis)

---

### Pro
**Ideal para:** Equipos medianos, 6-25 usuarios, operaciones multi-canal con inbox y compras.

**Incluye:**
- **Usuarios**: Hasta 25 usuarios
- **Organizaciones**: Hasta 3 organizaciones
- **Módulos**:
  - Leads (CRM completo)
  - Stock (gestión de inventario)
  - Sales (ventas, customers, vendors, purchases)
  - Inbox (WhatsApp + Instagram)
  - Dashboard avanzado
  - Pricing rules
- **Soporte**: Email prioritario (respuesta en 24h) + Chat (horario laboral)
- **Onboarding**: Asistido (1 sesión de 1h + documentación)
- **Storage**: 50GB
- **API calls**: 50,000/mes
- **Audit log**: 90 días de retención

**Add-ons disponibles:**
- Meta Ads sync: +$X/mes
- White-label: +$X/mes
- Integraciones avanzadas (TikTok, Email marketing, SMS): +$X/mes cada una

**Precio sugerido:** $X/mes (facturación mensual) o $X/año (facturación anual, 2 meses gratis)

---

### Enterprise
**Ideal para:** Operaciones grandes, 26+ usuarios, múltiples organizaciones, compliance y soporte dedicado.

**Incluye:**
- **Usuarios**: Ilimitados
- **Organizaciones**: Ilimitadas
- **Módulos**: Todos incluidos
  - Leads (CRM completo)
  - Stock (gestión de inventario)
  - Sales (ventas, customers, vendors, purchases)
  - Inbox (WhatsApp + Instagram)
  - Dashboard avanzado
  - Pricing rules
  - Meta Ads sync
  - White-label
- **Soporte**: Dedicado (SLA 4h, chat 24/7, email prioritario)
- **Onboarding**: Personalizado (sesiones dedicadas, migración de datos, configuración inicial)
- **Storage**: Ilimitado
- **API calls**: Ilimitados
- **Audit log**: Retención ilimitada
- **Custom integrations**: Soporte para integraciones personalizadas
- **Dedicated account manager**: Gestor de cuenta asignado

**Onboarding fee:** $X (one-time, incluye configuración inicial, migración de datos, y sesiones de entrenamiento)

**Precio sugerido:** $X/mes (facturación mensual) o $X/año (facturación anual, 2 meses gratis)

---

## 💰 Recomendaciones de Precios

### Rango Sugerido (USD)
- **Starter**: $49-99/mes
- **Pro**: $199-399/mes
- **Enterprise**: $799-1,499/mes (más onboarding fee)

### Facturación Anual
- **Descuento**: 2 meses gratis (equivalente a ~17% de descuento)
- **Ejemplo**: Starter $99/mes → $990/año (vs $1,188 si fuera mensual)

### Add-ons (Precios Sugeridos)
- **Inbox (WhatsApp + Instagram)**: $29-49/mes
- **Purchases**: $19-29/mes
- **Meta Ads sync**: $39-59/mes
- **White-label**: $99-199/mes
- **Integraciones avanzadas**: $49-99/mes cada una

---

## 📋 Comparativa de Tiers

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| Usuarios | 5 | 25 | Ilimitados |
| Organizaciones | 1 | 3 | Ilimitadas |
| Leads (CRM) | ✅ | ✅ | ✅ |
| Stock | ✅ | ✅ | ✅ |
| Sales | ✅ | ✅ | ✅ |
| Purchases | Add-on | ✅ | ✅ |
| Inbox (WA/IG) | Add-on | ✅ | ✅ |
| Dashboard | Básico | Avanzado | Avanzado |
| Meta Ads sync | Add-on | Add-on | ✅ |
| White-label | Add-on | Add-on | ✅ |
| Soporte | Email (48h) | Email + Chat (24h) | Dedicado (4h SLA) |
| Onboarding | Self-service | Asistido (1h) | Personalizado |
| Storage | 10GB | 50GB | Ilimitado |
| API calls | 10K/mes | 50K/mes | Ilimitados |
| Audit log | 30 días | 90 días | Ilimitado |
| Custom integrations | ❌ | ❌ | ✅ |
| Account manager | ❌ | ❌ | ✅ |

---

## 🎯 Estrategia de Pricing

### Objetivos
1. **Starter**: Bajo costo de entrada para validar el producto
2. **Pro**: Tier principal para la mayoría de clientes (sweet spot)
3. **Enterprise**: Para clientes grandes con necesidades específicas

### Upsell Path
- **Starter → Pro**: Agregar inbox, purchases, más usuarios
- **Pro → Enterprise**: Necesidad de múltiples orgs, white-label, soporte dedicado

### Add-ons Strategy
- **Inbox**: Crítico para operaciones multi-canal → alto valor
- **Purchases**: Útil para gestión de compras → valor medio
- **Meta Ads sync**: Específico para marketing → valor alto si se usa
- **White-label**: Para agencias/resellers → valor muy alto

---

## 📝 Notas de Implementación

### Facturación
- **Mensual**: Stripe subscription (recurring)
- **Anual**: Stripe subscription anual (descuento aplicado)
- **Onboarding fee**: One-time charge (solo Enterprise)

### Límites
- **Usuarios**: Contar `Membership` activos por organización
- **Organizaciones**: Contar `Organization` donde el usuario es miembro
- **Storage**: Medir attachments, avatares, logos (futuro)
- **API calls**: Contar requests autenticadas (excluir health checks)

### Upgrades/Downgrades
- **Upgrade**: Efectivo inmediato, prorrateo del mes actual
- **Downgrade**: Efectivo al final del período de facturación actual
- **Add-ons**: Se pueden agregar/remover en cualquier momento

---

**Última actualización:** Enero 2025  
**Nota:** Precios son placeholders. Ajustar según mercado y competencia.
