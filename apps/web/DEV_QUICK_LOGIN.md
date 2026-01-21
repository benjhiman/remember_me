# Dev Quick Login

Sistema de login rápido para testing en producción (Vercel) sin pasar por `/login`.

## URL

```
https://app.iphonealcosto.com/__dev/login?k=YOUR_KEY&redirect=/inbox
```

## Parámetros

- `k` (required): Key de autenticación (debe coincidir con `DEV_QUICK_LOGIN_KEY`)
- `redirect` (optional): Ruta a la que redirigir después del login (default: `/leads`)

## Variables de Entorno

### Vercel (Frontend)

- `DEV_QUICK_LOGIN_ENABLED`: `true` para habilitar, `false` para deshabilitar (default: deshabilitado)
- `DEV_QUICK_LOGIN_KEY`: Token largo y seguro (ej: 64 caracteres aleatorios)

### Railway (Backend)

- `DEV_QUICK_LOGIN_ENABLED`: `true` para habilitar, `false` para deshabilitar (default: deshabilitado)
- `DEV_QUICK_LOGIN_KEY`: Mismo token que en Vercel (debe coincidir exactamente)

## Comportamiento

1. **Idempotente**: Si el usuario/org de prueba no existe, los crea. Si existen, simplemente loguea.
2. **Usuario de prueba**:
   - Email: `test@iphonealcosto.com`
   - Password: `Test1234!!`
   - Nombre: `Test User`
   - Organización: `iPhone al costo` (slug: `iphone-al-costo`)
   - Rol: `OWNER`

3. **Seguridad**:
   - Deshabilitado por defecto
   - Requiere key válida
   - Retorna 404 si está deshabilitado o key inválida (no revela existencia del endpoint)
   - No expone tokens en logs

## Uso

1. Configurar variables de entorno en Vercel y Railway
2. Acceder a: `https://app.iphonealcosto.com/__dev/login?k=YOUR_KEY&redirect=/inbox`
3. El sistema automáticamente:
   - Valida la key
   - Crea o loguea el usuario de prueba
   - Guarda tokens en el auth store
   - Redirige a la ruta especificada

## Notas

- **Mantener deshabilitado en producción normalmente**
- Solo habilitar cuando se necesite testing rápido
- La key debe ser fuerte (64+ caracteres aleatorios)
- No usar `NEXT_PUBLIC_` para la key (no debe exponerse al cliente)
