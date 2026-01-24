# Dark Mode Implementation

## 📋 Overview

Implementación completa de dark mode usando Tailwind CSS con variables CSS y ThemeProvider para persistencia.

---

## 🎨 Implementación

### ThemeProvider

**Ubicación**: `apps/web/components/providers/theme-provider.tsx`

**Características:**
- Soporta `light`, `dark`, `system`
- Persiste preferencia en `localStorage`
- Resuelve `system` según `prefers-color-scheme`
- Actualiza clase `dark` en `<html>` automáticamente

### Toggle

**Ubicación**: `apps/web/components/layout/topbar-zoho.tsx`

**Uso:**
- Click en avatar → dropdown → "Dark Mode" / "Light Mode"
- Alterna entre light y dark (no system toggle en UI por ahora)

### Variables CSS

**Ubicación**: `apps/web/app/globals.css`

**Tokens definidos:**
- `--background`, `--foreground`
- `--card`, `--popover`
- `--primary`, `--secondary`, `--muted`, `--accent`
- `--destructive`
- `--border`, `--input`, `--ring`

**Modo dark:**
- Fondo oscuro (`222.2 84% 4.9%`)
- Texto claro (`210 40% 98%`)
- Bordes sutiles
- Contraste AAA razonable

---

## ✅ Checklist de Páginas

### Páginas Principales (Verificadas)

- [x] Leads (`/leads`)
- [x] Stock (`/stock`)
- [x] Inbox (`/inbox/*`)
- [x] Sales (`/sales`)
- [x] Customers (`/sales/customers`)
- [x] Vendors (`/sales/vendors`)
- [x] Purchases (`/sales/purchases`)
- [x] Settings (`/settings`)
- [x] Sidebar/Topbar (Zoho shell)

### Componentes Base

- [x] Buttons (usa `bg-primary`, `text-primary-foreground`)
- [x] Inputs (usa `bg-background`, `border-border`)
- [x] Select (usa tokens)
- [x] Dialog (usa `bg-popover`)
- [x] Tabs (usa tokens)
- [x] Table (usa `bg-card`, `border-border`)
- [x] Badge (usa tokens)
- [x] Dropdown (usa tokens)

---

## 🔧 Uso en Componentes

### Clases Tailwind

```tsx
// Usar tokens en lugar de colores hardcodeados
<div className="bg-background text-foreground">
  <div className="bg-card border border-border">
    <p className="text-muted-foreground">Subtle text</p>
  </div>
</div>
```

### Hook useTheme

```tsx
import { useTheme } from '@/components/providers/theme-provider';

function MyComponent() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  return (
    <button onClick={() => setTheme('dark')}>
      {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
```

---

## 🐛 Troubleshooting

### Dark mode no aplica

**Causa**: Clase `dark` no está en `<html>`.

**Solución:**
1. Verificar que `ThemeProvider` está en el árbol de componentes
2. Verificar que `suppressHydrationWarning` está en `<html>`
3. Verificar que `localStorage` no está bloqueado

### Colores no cambian

**Causa**: Componente usa colores hardcodeados en lugar de tokens.

**Solución:**
1. Reemplazar `bg-gray-100` por `bg-muted`
2. Reemplazar `text-gray-900` por `text-foreground`
3. Usar variables CSS: `hsl(var(--background))`

### Flash de contenido incorrecto (FOUC)

**Causa**: Theme se resuelve después del render inicial.

**Solución:**
1. Ya manejado con `suppressHydrationWarning` en `<html>`
2. ThemeProvider aplica clase inmediatamente en `useEffect`

---

## 📚 Referencias

- **ThemeProvider**: `apps/web/components/providers/theme-provider.tsx`
- **Toggle**: `apps/web/components/layout/topbar-zoho.tsx`
- **Variables CSS**: `apps/web/app/globals.css`
- **Tailwind Config**: `apps/web/tailwind.config.ts`

---

**Última actualización:** Enero 2025
