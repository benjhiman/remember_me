'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppNav } from './app-nav';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Breadcrumb } from '@/components/ui/breadcrumb';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const breadcrumbs = (() => {
    const parts = (pathname || '').split('/').filter(Boolean);
    if (!parts.length) return [];

    const pretty = (s: string) => {
      if (s === 'leads') return 'Leads';
      if (s === 'stock') return 'Stock';
      if (s === 'sales') return 'Ventas';
      if (s === 'inbox') return 'Inbox';
      if (s === 'ads') return 'Meta Ads';
      if (s === 'settings') return 'Settings';
      if (s === 'integrations') return 'Integraciones';
      if (s === 'board') return 'Board';
      return s;
    };

    const items = [];
    let href = '';
    for (let i = 0; i < parts.length; i++) {
      href += '/' + parts[i];
      items.push({ label: pretty(parts[i]), href });
    }
    return items;
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <div className="lg:hidden bg-background border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">CRM</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            'bg-background border-r min-h-screen transition-all duration-200 hidden lg:flex lg:flex-col lg:relative',
            sidebarCollapsed ? 'w-[72px]' : 'w-72'
          )}
        >
          <div className="px-4 py-4 border-b flex items-center justify-between gap-2">
            <div className={cn('min-w-0', sidebarCollapsed && 'hidden')}>
              <h2 className="text-base font-semibold truncate">{user.organizationName || 'CRM'}</h2>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className={cn('p-3 flex-1', sidebarCollapsed && 'px-2')}>
            <AppNav collapsed={sidebarCollapsed} />
          </div>
          <div className="p-3 border-t">
            <Button variant="outline" size="sm" className="w-full" onClick={handleLogout} title="Cerrar sesión">
              <LogOut className={cn('h-4 w-4', !sidebarCollapsed && 'mr-2')} />
              {!sidebarCollapsed && 'Cerrar sesión'}
            </Button>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="bg-white w-64 h-full shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b">
                <h2 className="text-lg font-bold text-gray-900">Remember Me</h2>
                <p className="text-sm text-gray-600">{user.organizationName || 'CRM'}</p>
              </div>
              <div className="p-4">
                <AppNav />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
                <div className="mb-2 text-sm text-gray-600">
                  <div className="font-medium">{user.name || user.email}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen">
          {/* Desktop header */}
          <div className="hidden lg:block border-b bg-background">
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Breadcrumb items={breadcrumbs} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border px-2 py-1">{user.role}</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
