# E2E Testing — Playwright Smoke Suite

## 📋 Overview

Suite de tests E2E críticos usando Playwright para validar flujos de usuario end-to-end sin depender de data aleatoria.

---

## 🚀 Setup

### Prerequisitos

1. **Playwright instalado**:
   ```bash
   cd apps/web
   pnpm exec playwright install chromium
   ```

2. **Variables de entorno**:
   ```bash
   export E2E_BASE_URL=https://app.iphonealcosto.com  # Default
   export E2E_EMAIL=test@example.com
   export E2E_PASSWORD=TestPassword123!
   ```

3. **Seed de datos E2E** (obligatorio antes de correr tests):
   ```bash
   # Desde la raíz del proyecto
   cd apps/api
   E2E_EMAIL=test@example.com E2E_PASSWORD=TestPassword123! pnpm ops:e2e-seed
   ```

   Esto crea:
   - Organización "E2E"
   - Usuario con role OWNER
   - 1 Vendor
   - 1 Customer
   - 1 Lead
   - 1 Purchase DRAFT

---

## 🧪 Correr Tests

### Local

```bash
# Desde apps/web
cd apps/web
pnpm test:e2e

# O con UI interactiva
pnpm test:e2e:ui
```

### CI (GitHub Actions)

Los tests se ejecutan automáticamente en `.github/workflows/e2e.yml` cuando:
- Se hace push a `main`
- Se abre un PR a `main`

**Requisitos en CI:**
- Secrets configurados: `E2E_EMAIL`, `E2E_PASSWORD`
- Base de datos accesible (mismo que API)
- Seed ejecutado antes de los tests (o en setup step)

---

## 📝 Tests Implementados

### 1. Login → Dashboard Shell
- Verifica que login funciona
- Verifica que se llega al dashboard con sidebar + topbar

### 2. Org Switch
- Verifica que org switcher funciona (si hay 2+ orgs)
- Verifica que cambia el contexto

### 3. Abrir /leads
- Verifica que la página carga
- Verifica que muestra tabla o empty state

### 4. Crear Lead
- Verifica que se puede crear un lead (si hay permisos)
- Verifica que aparece en la lista

### 5. Abrir /stock
- Verifica que la página carga
- Verifica que scroll y "Load more" no rompen

### 6. Abrir /inbox/whatsapp
- Verifica que la lista carga
- Si hay conversaciones, verifica que se puede abrir una
- Si no hay, verifica empty state (NO skip)

### 7. Abrir /sales/purchases
- Verifica que la página carga
- Verifica que muestra tabla o empty state

### 8. Crear Purchase DRAFT
- Verifica que se puede crear una compra (si hay UI)
- Si no hay UI, verifica que la página carga correctamente

### 9. Settings Branding
- Verifica que la página carga

### 10. RBAC Gating
- Verifica que la página carga sin errores
- (No valida permisos específicos, solo que no rompe)

---

## 🔧 Seed Script

**Ubicación**: `apps/api/src/scripts/e2e-seed.ts`

**Qué hace:**
1. Crea/asegura organización "E2E"
2. Crea/asegura usuario con email/password de env vars
3. Asegura membership con role OWNER
4. Crea/asegura 1 vendor ("E2E Test Vendor")
5. Crea/asegura 1 customer ("E2E Test Customer")
6. Crea/asegura pipeline y stage para leads
7. Crea/asegura 1 lead ("E2E Test Lead")
8. Crea/asegura 1 purchase DRAFT con 1 línea

**Idempotente**: Puede correrse múltiples veces sin duplicar datos.

**Comando:**
```bash
E2E_EMAIL=test@example.com E2E_PASSWORD=TestPassword123! pnpm --filter @remember-me/api ops:e2e-seed
```

---

## 🐛 Troubleshooting

### Tests fallan con "Element not found"

**Causa**: Seed no ejecutado o data no existe.

**Solución:**
1. Ejecutar seed: `pnpm --filter @remember-me/api ops:e2e-seed`
2. Verificar que las credenciales en env vars coinciden con el seed

### Tests fallan con "Timeout"

**Causa**: API no responde o base URL incorrecta.

**Solución:**
1. Verificar que `E2E_BASE_URL` apunta al ambiente correcto
2. Verificar que el API está corriendo
3. Aumentar timeouts si es necesario (en `playwright.config.ts`)

### Tests fallan con "Login failed"

**Causa**: Credenciales incorrectas o usuario no existe.

**Solución:**
1. Ejecutar seed con las mismas credenciales que los tests
2. Verificar que `E2E_EMAIL` y `E2E_PASSWORD` coinciden

---

## 📚 Referencias

- **Playwright Config**: `apps/web/playwright.config.ts`
- **Tests**: `apps/web/tests/e2e/smoke.spec.ts`
- **Seed Script**: `apps/api/src/scripts/e2e-seed.ts`
- **CI Workflow**: `.github/workflows/e2e.yml`

---

**Última actualización:** Enero 2025
