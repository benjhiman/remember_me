'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppNav } from './app-nav';
import { Button } from '@/components/ui/button';
import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Remember Me</h1>
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
            'bg-white border-r min-h-screen transition-all duration-300',
            sidebarOpen ? 'w-64' : 'w-0 overflow-hidden',
            'hidden lg:block lg:relative'
          )}
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
          {children}
        </main>
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils/cn';
