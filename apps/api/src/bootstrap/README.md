# Bootstrap Helpers

## seed-owner-on-boot.ts

Helper que crea automáticamente un usuario OWNER al boot del API en Railway, **sin necesidad de shell ni run command**.

### ¿Cuándo se ejecuta?

Solo si `SEED_OWNER_ON_BOOT === 'true'` está configurado en las variables de entorno.

### Variables de Entorno Requeridas

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `SEED_OWNER_ON_BOOT` | **Sí** | Debe ser exactamente `'true'` para activar el seed |
| `OWNER_EMAIL` | **Sí** | Email del usuario OWNER a crear |
| `OWNER_PASSWORD` | **Sí** | Password (mínimo 8 caracteres) |
| `OWNER_ORG_NAME` | **Sí** | Nombre de la organización |
| `OWNER_ORG_SLUG` | **Sí** | Slug único de la organización |

### Instrucciones para Railway

#### Paso 1: Configurar Variables de Entorno

En Railway Dashboard, ve a tu servicio API y agrega/verifica estas variables:

```
SEED_OWNER_ON_BOOT=true
OWNER_EMAIL=admin@example.com
OWNER_PASSWORD=SecurePass123!
OWNER_ORG_NAME=Mi Organización
OWNER_ORG_SLUG=mi-organizacion
```

#### Paso 2: Deploy

1. Haz commit y push de tus cambios (si aún no lo hiciste)
2. Railway detectará el cambio y hará deploy automáticamente
3. O manualmente: ve a Railway Dashboard → Deployments → "Redeploy"

#### Paso 3: Ver Logs

En Railway Dashboard:
1. Ve a tu servicio API
2. Click en "Logs"
3. Busca líneas que empiecen con `[SEED]`

**Logs esperados (éxito):**
```
[SEED] 🚀 Iniciando seed de OWNER al boot...
[SEED]    Email: admin@example.com
[SEED]    Org: Mi Organización (mi-organizacion)
[SEED]    Usuario creado: clx1234567890
[SEED] ✅ user ok
[SEED]    Organización creada: clx0987654321
[SEED] ✅ org ok
[SEED]    Membership creado como OWNER: clx1122334455
[SEED] ✅ membership ok
[SEED] ✅ Seed completado exitosamente
[SEED]    User ID: clx1234567890
[SEED]    Organization ID: clx0987654321
[SEED]    Role: OWNER
```

**Si ya existe (idempotente):**
```
[SEED] 🚀 Iniciando seed de OWNER al boot...
[SEED]    Email: admin@example.com
[SEED]    Org: Mi Organización (mi-organizacion)
[SEED]    Usuario ya existe: clx1234567890
[SEED] ✅ user ok
[SEED]    Organización ya existe: clx0987654321
[SEED] ✅ org ok
[SEED]    Membership ya existe como OWNER: clx1122334455
[SEED] ✅ membership ok
[SEED] ✅ Seed completado exitosamente
```

**Si falta alguna variable:**
```
[SEED] ⚠️  Variables de entorno faltantes. Seed omitido.
[SEED]    Requeridas: OWNER_EMAIL, OWNER_PASSWORD, OWNER_ORG_NAME, OWNER_ORG_SLUG
```

#### Paso 4: Apagar la Variable (IMPORTANTE)

**Una vez que veas los logs de éxito, apaga inmediatamente la variable:**

1. En Railway Dashboard → Variables de Entorno
2. Cambia `SEED_OWNER_ON_BOOT` de `true` a `false` (o elimínala)
3. Railway hará redeploy automáticamente

**¿Por qué apagarla?**
- El seed es idempotente, pero no necesitas que corra en cada boot
- Reduce logs innecesarios
- Mejora tiempos de arranque
- Mejor práctica de seguridad: solo activar cuando se necesita

### Comportamiento

- **Idempotente**: Puede ejecutarse múltiples veces sin duplicar datos
- **No bloquea arranque**: Si hay error, solo lo loguea, no rompe el API
- **Una sola ejecución**: Solo corre si `SEED_OWNER_ON_BOOT === 'true'`
- **Seguro**: No expone endpoints, no depende de dev login
- **Logueo claro**: Todos los logs empiezan con `[SEED]` para fácil identificación

### Troubleshooting

**No veo logs de `[SEED]`**
- Verifica que `SEED_OWNER_ON_BOOT === 'true'` (exactamente el string 'true')
- Verifica que todas las variables requeridas estén configuradas
- Revisa los logs completos del servicio en Railway

**Error: "Variables de entorno faltantes"**
- Verifica que todas las variables estén configuradas en Railway Dashboard
- Asegúrate de que los nombres sean exactos (case-sensitive)

**Error: "OWNER_PASSWORD debe tener al menos 8 caracteres"**
- Aumenta la longitud del password a mínimo 8 caracteres

**El API no arranca**
- El seed NO debería romper el arranque (errores están en try/catch)
- Si el API no arranca, revisa otros errores en los logs (no relacionados con seed)

### Seguridad

- ✅ El seed solo corre si la variable está explícitamente en `'true'`
- ✅ No expone endpoints públicos
- ✅ No depende de dev login
- ✅ Errores no bloquean el arranque
- ✅ Password se hashea con bcrypt (cost 12)
- ✅ Idempotente: no duplica datos

### Comparación con Script CLI

| Característica | Script CLI (`seed:owner`) | Bootstrap (`seed-owner-on-boot`) |
|----------------|---------------------------|----------------------------------|
| Requiere shell | ✅ Sí | ❌ No |
| Requiere run command | ✅ Sí | ❌ No |
| Ejecución manual | ✅ Sí | ❌ No (automático) |
| Ejecución en boot | ❌ No | ✅ Sí |
| Idempotente | ✅ Sí | ✅ Sí |
| Logueo claro | ✅ Sí | ✅ Sí |

**Recomendación**: Usa el bootstrap helper para Railway (sin shell), y el script CLI para desarrollo local.
