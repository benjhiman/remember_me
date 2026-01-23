# RBAC System - Documentación

**Fecha:** Enero 2025  
**Estado:** Implementado

---

## 📋 RESUMEN

Sistema RBAC (Role-Based Access Control) centralizado y consistente para autorización en backend y UI gating en frontend. Integrado con multi-org (X-Organization-Id + membership role).

---

## 🏗️ ARQUITECTURA

### Backend

**Permissions Model:** `apps/api/src/auth/permissions.ts`
- Enum `Permission` con formato `<module>.<action>` (ej: `leads.read`, `leads.write`)
- Mapa `ROLE_PERMISSIONS`: role → permissions array
- Helpers: `getPermissionsForRole()`, `roleHasPermission()`, etc.

**Guard:** `apps/api/src/common/guards/permissions.guard.ts`
- Lee `@RequirePermissions()` decorator
- Valida que `request.user.role` tenga todos los permisos requeridos
- Responde 403 con payload estructurado si falla

**Decorator:** `apps/api/src/common/decorators/require-permissions.decorator.ts`
- `@RequirePermissions(Permission['leads.write'])`
- Soporta múltiples permisos (todos deben cumplirse)

### Frontend

**Hook:** `apps/web/lib/auth/use-permissions.ts`
- `usePermissions()` → `{ role, permissions, can(perm), canAny([...]), canAll([...]) }`
- Fuente de verdad: `/api/users/me` (backend calcula permisos)

**API Hook:** `apps/web/lib/api/hooks/use-me.ts`
- `useMe()` → carga user + org + role + permissions
- Se invalida automáticamente al cambiar org (via OrgProvider)

**Error Handling:** `apps/web/lib/utils/error-handler.ts`
- Detecta 403 Forbidden
- Muestra toast "No tenés permisos para esta acción"

---

## 🔐 ROLES Y PERMISOS

### Roles

- **OWNER**: Todo (incluye `org.manage`)
- **ADMIN**: Casi todo (excepto `org.manage`)
- **MANAGER**: Read/write en módulos, puede `members.manage`, no `settings.write` ni `integrations.manage`
- **SELLER**: Read/write en leads/sales/inbox, read-only en stock/settings, no members/integrations

### Permisos

Formato: `<module>.<action>`

**Módulos:**
- `dashboard.read`
- `leads.read` / `leads.write`
- `sales.read` / `sales.write`
- `stock.read` / `stock.write`
- `inbox.read` / `inbox.write`
- `settings.read` / `settings.write`
- `org.manage` (solo OWNER)
- `members.manage`
- `integrations.read` / `integrations.manage`

**Tabla completa:** Ver `apps/api/src/auth/permissions.ts` → `ROLE_PERMISSIONS`

---

## 🔄 FLUJO END-TO-END

### 1. Request Protegido

```
Frontend: apiRequest('/leads', { method: 'POST', body: {...} })
  ↓
Backend: LeadsController.createLead()
  ↓
@RequirePermissions(Permission['leads.write'])
  ↓
PermissionsGuard.canActivate():
  1. Lee requiredPermissions del decorator
  2. Lee request.user.role (seteado por OrganizationInterceptor)
  3. getPermissionsForRole(role)
  4. Verifica que todos los requiredPermissions estén en userPermissions
  ↓
Si OK: permite acceso
Si NO: 403 Forbidden con payload:
  {
    code: "FORBIDDEN",
    message: "Insufficient permissions",
    required: ["leads.write"],
    role: "SELLER",
    organizationId: "org-123",
    userPermissions: ["leads.read", "leads.write", ...]
  }
```

### 2. UI Gating

```
Component: <LeadsPage />
  ↓
usePermissions() hook
  ↓
useMe() → GET /api/users/me
  ↓
Backend calcula permissions desde role
  ↓
Frontend: can('leads.write')
  ↓
Si true: muestra botón "Nuevo Lead"
Si false: oculta botón
```

### 3. Cambio de Org

```
Usuario cambia org en OrgSwitcher
  ↓
OrgProvider invalida query ['me']
  ↓
useMe() refetch automático
  ↓
Backend: /api/users/me con nuevo organizationId
  ↓
Backend lee membership.role para nueva org
  ↓
Calcula permissions para nuevo role
  ↓
Frontend actualiza permissions
  ↓
UI se re-renderiza con nuevos permisos
```

---

## 📝 EJEMPLOS DE USO

### Backend: Proteger Endpoint

```typescript
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permission } from '../auth/permissions';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['leads.read'])
  async listLeads() {
    // Solo usuarios con leads.read pueden acceder
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['leads.write'])
  async createLead() {
    // Solo usuarios con leads.write pueden acceder
  }
}
```

### Frontend: Gatear UI

```typescript
import { usePermissions } from '@/lib/auth/use-permissions';

function LeadsPage() {
  const { can } = usePermissions();

  return (
    <div>
      {can('leads.write') && (
        <Button onClick={() => router.push('/leads/new')}>
          Nuevo Lead
        </Button>
      )}
    </div>
  );
}
```

### Frontend: Manejar Error 403

```typescript
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';

function MyComponent() {
  const { toast } = useToast();
  const createMutation = useMutation({
    mutationFn: async (data) => api.post('/leads', data),
    onError: (error) => {
      const message = getErrorMessage(error);
      // getErrorMessage detecta 403 y devuelve mensaje apropiado
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    },
  });
}
```

---

## 🧪 TESTING

### Tests Backend

**Archivo:** `apps/api/src/leads/leads.controller.spec.ts` (extender)

**Ejemplo:**
```typescript
describe('POST /leads', () => {
  it('should return 403 if user lacks leads.write permission', async () => {
    const user = { userId: 'user-123', role: 'SELLER', organizationId: 'org-123' };
    // SELLER tiene leads.write, pero podemos mockear que no
    // O usar un role que no tenga el permiso
  });

  it('should allow access if user has leads.write permission', async () => {
    const user = { userId: 'user-123', role: 'MANAGER', organizationId: 'org-123' };
    // MANAGER tiene leads.write
  });
});
```

**Ejecutar:**
```bash
cd apps/api
pnpm test leads.controller.spec
```

### Tests Manuales

1. **Login como SELLER:**
   - Verificar que puede ver leads (leads.read)
   - Verificar que puede crear leads (leads.write)
   - Verificar que NO puede editar settings (settings.write)

2. **Login como VIEWER (si existe) o role sin permisos:**
   - Intentar POST /leads → debe devolver 403
   - Verificar payload de error incluye `required`, `role`, `userPermissions`

3. **Cambiar org:**
   - Login con usuario que tiene 2 orgs con roles diferentes
   - Cambiar org → verificar que permisos cambian
   - Verificar que botones Create se ocultan/muestran según nuevo role

---

## 🐛 DEBUGGING

### Problema: 403 inesperado

**Checklist:**

1. **Verificar role en request:**
   ```typescript
   // En backend, agregar log:
   console.log('User role:', request.user.role);
   console.log('Required permissions:', requiredPermissions);
   ```

2. **Verificar permisos del role:**
   ```typescript
   import { getPermissionsForRole } from '../auth/permissions';
   const perms = getPermissionsForRole('SELLER');
   console.log('SELLER permissions:', perms);
   ```

3. **Verificar decorator:**
   - Confirmar que `@RequirePermissions()` está presente
   - Confirmar que `@UseGuards(PermissionsGuard)` está presente

4. **Verificar OrganizationInterceptor:**
   - Confirmar que `request.user.role` está seteado correctamente
   - Verificar que el role viene del membership, no del JWT

### Problema: UI no gatea correctamente

**Checklist:**

1. **Verificar /api/users/me:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
        -H "X-Organization-Id: <org-id>" \
        https://api.iphonealcosto.com/api/users/me
   # Debe devolver permissions array
   ```

2. **Verificar usePermissions:**
   ```typescript
   const { permissions, can } = usePermissions();
   console.log('Permissions:', permissions);
   console.log('Can write leads:', can('leads.write'));
   ```

3. **Verificar invalidación al cambiar org:**
   - Cambiar org
   - Verificar que `useMe()` refetch
   - Verificar que `permissions` se actualiza

---

## 📚 REFERENCIAS

- Permissions: `apps/api/src/auth/permissions.ts`
- Guard: `apps/api/src/common/guards/permissions.guard.ts`
- Decorator: `apps/api/src/common/decorators/require-permissions.decorator.ts`
- Endpoint /me: `apps/api/src/users/users.controller.ts` → `GET /users/me`
- Frontend hook: `apps/web/lib/auth/use-permissions.ts`
- Frontend API hook: `apps/web/lib/api/hooks/use-me.ts`

---

**Última actualización:** Enero 2025
