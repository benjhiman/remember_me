'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Plus,
} from 'lucide-react';
import { Permission, userCan } from '@/lib/auth/permissions';

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { user } = useAuthStore();

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  if (!user) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar comandos..." />
      <CommandList>
        <CommandEmpty>No se encontraron comandos.</CommandEmpty>
        <CommandGroup heading="Navegación">
          {userCan(user, Permission.VIEW_DASHBOARD) && (
            <CommandItem
              onSelect={() => runCommand(() => router.push('/dashboard'))}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Ir a Dashboard</span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
