'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Building2, Plug, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Permission, userCan } from '@/lib/auth/permissions';

export default function SettingsPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-gray-600">Gestioná la configuración de tu cuenta y organización</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Organización */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Organización</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-600">Nombre</label>
                <p className="text-sm text-gray-900">{user.organizationName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Rol</label>
                <p className="text-sm text-gray-900">{user.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integraciones */}
        {userCan(user, Permission.VIEW_INTEGRATIONS) && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                <CardTitle>Integraciones</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Configurá tus integraciones con WhatsApp, Instagram y Meta Ads.
              </p>
              <Link href="/settings/integrations">
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Gestionar Integraciones
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Mi Cuenta */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Mi Cuenta</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-sm text-gray-900">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Nombre</label>
                <p className="text-sm text-gray-900">{user.name || 'No especificado'}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
