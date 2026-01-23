# Multi-Organization UX - Documentación

**Fecha:** Enero 2025  
**Estado:** Implementado

---

## 📋 RESUMEN

Sistema multi-tenant con switcher de organización tipo Zoho. Permite cambiar de organización sin logout, con contexto consistente en toda la app.

---

## 🏗️ ARQUITECTURA

### Frontend

**Store Principal:** `apps/web/lib/store/org-store.ts`
- `currentOrganizationId`: ID de la org activa
- `currentOrganization`: Objeto completo de la org activa
- `memberships`: Lista de todas las orgs del usuario
- Persistencia: `localStorage` key `rm.currentOrgId`

**Provider:** `apps/web/components/organizations/org-provider.tsx`
- Carga organizaciones al montar el layout
- Sincroniza con `useOrganizations` hook
- Inicializa org desde `user.organizationId` si no hay selección previa

**Switcher:** `apps/web/components/organizations/org-switcher.tsx`
- Dropdown en TopbarZoho
- Lista todas las orgs disponibles
- Cambio sin logout
- Invalidación automática de queries

**API Client:** `apps/web/lib/api/auth-client.ts`
- Todas las requests incluyen `X-Organization-Id` header
- Prioridad: `orgStore.currentOrganizationId` > `user.organizationId` (backward compat)

### Backend

**Interceptor:** `apps/api/src/common/interceptors/organization.interceptor.ts`
- Lee `X-Organization-Id` header si está presente
- Valida membership del usuario
- Sobrescribe `request.user.organizationId` si header es válido
- Si header falta, usa JWT organizationId (comportamiento existente)

**Validación:**
- Si header presente: valida membership → 403 si no es miembro
- Si header ausente: usa JWT (comportamiento existente)
- Endpoints públicos (`/health`) no requieren org

---

## 🔄 FLUJO END-TO-END

### 1. Login y Carga Inicial

```
Usuario hace login
  ↓
AuthService genera JWT con organizationId del login
  ↓
Frontend guarda user.organizationId en auth-store
  ↓
OrgProvider carga organizaciones via GET /api/organizations
  ↓
org-store inicializa:
  - Si hay localStorage['rm.currentOrgId'] → usa esa
  - Si no, usa user.organizationId del login
  - Si no, usa primera membership
  ↓
OrgSwitcher muestra org activa en topbar
```

### 2. Cambio de Organización

```
Usuario hace click en OrgSwitcher
  ↓
Selecciona otra org del dropdown
  ↓
useSwitchOrganization mutation:
  1. Valida que orgId existe en memberships
  2. setCurrentOrganization(orgId)
  3. localStorage.setItem('rm.currentOrgId', orgId)
  4. queryClient.invalidateQueries() (fuerza refetch)
  ↓
Próxima request al API:
  - auth-client lee orgStore.currentOrganizationId
  - Agrega header: X-Organization-Id: <nuevo-org-id>
  ↓
Backend OrganizationInterceptor:
  1. Lee header X-Organization-Id
  2. Valida membership: prisma.membership.findFirst({ userId, organizationId })
  3. Si válido: request.user.organizationId = headerOrgId
  4. Si inválido: 403 Forbidden
  ↓
Todas las queries se ejecutan con nuevo orgId
  ↓
UI se actualiza con datos de la nueva org
```

### 3. Request sin Header (Backward Compat)

```
Request sin X-Organization-Id header
  ↓
OrganizationInterceptor: no header → skip
  ↓
JWT tiene organizationId → se usa ese
  ↓
Comportamiento normal (sin cambio)
```

---

## 🛡️ VALIDACIÓN Y SEGURIDAD

### Frontend

- **Validación de membership:** Solo muestra orgs donde el usuario es miembro
- **Persistencia segura:** Solo guarda orgId, no datos sensibles
- **Invalidación de cache:** Al cambiar org, todas las queries se invalidan

### Backend

- **Validación obligatoria:** Si header presente, DEBE validar membership
- **403 si no es miembro:** `ForbiddenException` con mensaje claro
- **Logging:** OrganizationInterceptor puede loggear org switches (opcional)

### Endpoints Públicos

- `/api/health` y `/api/health/extended` no requieren org
- OrganizationInterceptor se salta si no hay `request.user`

---

## 🐛 DEBUGGING

### Problema: Usuario ve datos de otra org

**Checklist:**

1. **Verificar header en request:**
   ```bash
   # En DevTools Network tab, verificar:
   X-Organization-Id: <org-id>
   ```

2. **Verificar org store:**
   ```javascript
   // En DevTools Console:
   import { useOrgStore } from '@/lib/store/org-store';
   useOrgStore.getState()
   // Debe mostrar currentOrganizationId correcto
   ```

3. **Verificar localStorage:**
   ```javascript
   localStorage.getItem('rm.currentOrgId')
   // Debe ser el orgId esperado
   ```

4. **Verificar backend logs:**
   - Buscar logs de OrganizationInterceptor
   - Verificar que membership existe
   - Verificar que no hay 403

5. **Verificar JWT:**
   - JWT puede tener organizationId viejo
   - Pero header X-Organization-Id debe sobrescribirlo
   - Si header falta, se usa JWT (puede ser problema)

### Problema: Switcher no muestra orgs

**Checklist:**

1. **Verificar endpoint:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
        https://api.iphonealcosto.com/api/organizations
   # Debe devolver array de orgs
   ```

2. **Verificar hook:**
   ```javascript
   // useOrganizations debe estar enabled si user existe
   // Verificar en React DevTools
   ```

3. **Verificar permisos:**
   - Usuario debe tener al menos una membership
   - Si no tiene, mostrar mensaje + CTA "Create org"

### Problema: Cambio de org no actualiza datos

**Checklist:**

1. **Verificar invalidación:**
   ```javascript
   // useSwitchOrganization debe llamar:
   queryClient.invalidateQueries()
   ```

2. **Verificar refetch:**
   - Queries deben tener `staleTime` razonable
   - Invalidación debe forzar refetch

3. **Verificar header en próxima request:**
   - Network tab debe mostrar nuevo `X-Organization-Id`
   - Backend debe recibirlo y validarlo

---

## 📝 EJEMPLOS DE USO

### Cambiar org programáticamente

```typescript
import { useSwitchOrganization } from '@/lib/api/hooks/use-organizations';

function MyComponent() {
  const switchOrg = useSwitchOrganization();
  
  const handleSwitch = async () => {
    try {
      await switchOrg.mutateAsync('org-123');
      // Org cambiada, queries se invalidan automáticamente
    } catch (error) {
      console.error('Failed to switch org:', error);
    }
  };
  
  return <button onClick={handleSwitch}>Switch to Org 123</button>;
}
```

### Leer org actual

```typescript
import { useOrgStore } from '@/lib/store/org-store';

function MyComponent() {
  const { currentOrganization, currentOrganizationId } = useOrgStore();
  
  return <div>Current org: {currentOrganization?.name}</div>;
}
```

### Mostrar indicador de org

```typescript
import { OrgIndicator } from '@/components/organizations/org-indicator';

function MyPage() {
  return (
    <div>
      <h1>My Page</h1>
      <OrgIndicator variant="subtle" />
    </div>
  );
}
```

---

## 🧪 TESTING

### Tests E2E (Playwright)

Ver: `apps/web/__tests__/e2e/org-switcher.spec.ts`

**Tests incluidos:**
1. Login → Org switcher visible
2. Cambiar org → indicador actualiza + request con nuevo orgId
3. Org inválida → error graceful

**Ejecutar:**
```bash
cd apps/web
pnpm test:e2e
```

### Tests Manuales

1. **Login con múltiples orgs:**
   - Login con usuario que tiene 2+ orgs
   - Verificar que switcher muestra todas
   - Verificar que org activa es la del login (o última usada)

2. **Cambio de org:**
   - Click en switcher
   - Seleccionar otra org
   - Verificar que:
     - Topbar muestra nuevo nombre
     - Datos se refrescan (leads, sales, etc.)
     - Network tab muestra nuevo `X-Organization-Id`

3. **Persistencia:**
   - Cambiar org
   - Refrescar página
   - Verificar que org seleccionada se mantiene

4. **Validación backend:**
   - Modificar header manualmente (DevTools)
   - Enviar request con orgId inválido
   - Verificar 403 Forbidden

---

## 🔧 CONFIGURACIÓN

### Variables de Entorno

Ninguna nueva variable requerida. Usa:
- `JWT_SECRET` (existente)
- `DATABASE_URL` (existente)

### LocalStorage Keys

- `rm.currentOrgId`: ID de la org seleccionada (persistida)

---

## 📚 REFERENCIAS

- Store: `apps/web/lib/store/org-store.ts`
- Switcher: `apps/web/components/organizations/org-switcher.tsx`
- Provider: `apps/web/components/organizations/org-provider.tsx`
- Hook: `apps/web/lib/api/hooks/use-organizations.ts`
- Interceptor: `apps/api/src/common/interceptors/organization.interceptor.ts`
- Endpoint: `GET /api/organizations`

---

**Última actualización:** Enero 2025
