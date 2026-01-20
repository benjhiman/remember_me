# Development Auto-Login

## Objetivo

Permitir probar rutas protegidas (`/leads`, `/inbox`, etc.) sin fricción durante el desarrollo del frontend, sin necesidad de crear usuarios manualmente cada vez.

## Funcionamiento

### En Development (NODE_ENV !== 'production')

1. **Auto-creación de usuario de prueba** (idempotente):
   - Email: `test@iphonealcosto.com`
   - Password: `Test1234!!`
   - Name: `Test User`
   - Organization: `iPhone al costo` (slug: `iphone-al-costo`)

2. **Auto-login automático**:
   - Si el usuario no existe, se crea automáticamente
   - Si el usuario ya existe, se hace login automático
   - Los tokens se guardan en el auth store (Zustand)
   - Redirige automáticamente a `/leads` si estás en `/login` o `/`

### En Production (NODE_ENV === 'production')

- **NO se ejecuta nada**: El componente `DevAutoLogin` no hace nada
- **Comportamiento normal**: Login manual requerido
- **Seguridad intacta**: No hay bypass de autenticación

## Archivos

### `lib/auth/dev-auth-helper.ts`
Helper que:
- Crea usuario de prueba si no existe (idempotente)
- Hace login con credenciales de prueba
- Solo funciona en development

### `components/auth/dev-auto-login.tsx`
Componente React que:
- Se ejecuta solo en development
- Llama a `devAutoLogin()` si no hay usuario logueado
- Guarda tokens en el auth store
- Redirige a `/leads` si es necesario

### `app/providers.tsx`
Providers que incluyen `DevAutoLogin` para que se ejecute en toda la app.

## Endpoints Usados

### POST /api/auth/register
**Payload:**
```json
{
  "email": "test@iphonealcosto.com",
  "password": "Test1234!!",
  "name": "Test User",
  "organizationName": "iPhone al costo",
  "organizationSlug": "iphone-al-costo"
}
```

**Response (éxito):**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "test@iphonealcosto.com",
    "name": "Test User",
    "organizationId": "...",
    "organizationName": "iPhone al costo",
    "role": "OWNER"
  }
}
```

**Response (usuario ya existe - 409):**
- Se ignora silenciosamente (idempotente)

### POST /api/auth/login
**Payload:**
```json
{
  "email": "test@iphonealcosto.com",
  "password": "Test1234!!"
}
```

**Response:**
```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "test@iphonealcosto.com",
    "name": "Test User",
    "organizationId": "...",
    "organizationName": "iPhone al costo",
    "role": "OWNER"
  }
}
```

## Validación End-to-End

### En Development

1. **Abrir `/leads`**:
   - ✅ NO redirige a `/login`
   - ✅ Auto-login funciona
   - ✅ `useLeads` hace requests correctamente
   - ✅ Headers incluyen `Authorization: Bearer <token>`
   - ✅ Headers incluyen `X-Organization-Id: <orgId>`

2. **Abrir `/login`**:
   - ✅ Auto-login y redirige a `/leads`

3. **Abrir `/`**:
   - ✅ Auto-login y redirige a `/leads`

### En Production

1. **Abrir `/leads` sin sesión**:
   - ✅ Redirige a `/login` (comportamiento normal)
   - ✅ NO hay auto-login

2. **Abrir `/login`**:
   - ✅ Muestra formulario de login normal
   - ✅ NO hay auto-login

## Restricciones

- ✅ NO hardcodea bypass de auth en production
- ✅ NO toca backend
- ✅ NO rompe refresh token logic
- ✅ Mantiene seguridad en prod intacta
- ✅ Idempotente (puede ejecutarse múltiples veces sin problemas)

## Troubleshooting

### El auto-login no funciona

1. Verificar que `NODE_ENV !== 'production'`
2. Verificar que el backend esté corriendo en `http://localhost:4000`
3. Verificar que `NEXT_PUBLIC_API_BASE_URL` esté configurado correctamente
4. Revisar la consola del navegador para warnings/errores

### El usuario de prueba ya existe pero no puedo hacer login

- El auto-login debería funcionar automáticamente
- Si no funciona, puedes hacer login manual con:
  - Email: `test@iphonealcosto.com`
  - Password: `Test1234!!`

### Quiero resetear el usuario de prueba

- Eliminar el usuario desde la base de datos o desde el backend
- El auto-login lo recreará automáticamente en el próximo acceso
