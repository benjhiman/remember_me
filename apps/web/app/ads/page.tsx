'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Permission, userCan } from '@/lib/auth/permissions';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    // Check permission (anyone with VIEW_INTEGRATIONS can view ads)
    if (!userCan(user, Permission.VIEW_INTEGRATIONS)) {
      router.push('/forbidden');
      return;
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  // Check if Meta account is connected
  const hasMetaConnection = true; // TODO: Check ConnectedAccount from API

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Meta Ads</h1>
        <p className="text-gray-600">Gestión de campañas y métricas de Meta Ads</p>
      </div>

      {!hasMetaConnection ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Meta Ads no conectado</h2>
              <p className="text-gray-600 mb-4">
                Necesitás conectar tu cuenta de Meta para ver campañas y métricas.
              </p>
              <Link href="/settings/integrations">
                <Button>Conectar cuenta Meta</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Estado de Integración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>Cuenta Meta conectada</span>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-3">Endpoints Faltantes (Backend)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Los siguientes endpoints necesitan ser implementados en el backend para que esta sección sea funcional:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <code className="text-xs bg-gray-100 px-1 rounded">GET /api/integrations/meta/campaigns</code>
                      <p className="text-gray-600 text-xs mt-1">Listar campañas de Meta Ads</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <code className="text-xs bg-gray-100 px-1 rounded">GET /api/integrations/meta/campaigns/:id</code>
                      <p className="text-gray-600 text-xs mt-1">Detalle de campaña con métricas</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <code className="text-xs bg-gray-100 px-1 rounded">GET /api/integrations/meta/adsets</code>
                      <p className="text-gray-600 text-xs mt-1">Listar adsets de Meta Ads</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <code className="text-xs bg-gray-100 px-1 rounded">GET /api/integrations/meta/ads</code>
                      <p className="text-gray-600 text-xs mt-1">Listar ads individuales</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold mb-2">Documentación</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Estos endpoints deberían usar la Meta Marketing API:
                </p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li><code>/act_{ad_account_id}/campaigns</code> - Listar campañas</li>
                  <li><code>/act_{ad_account_id}/adsets</code> - Listar adsets</li>
                  <li><code>/act_{ad_account_id}/ads</code> - Listar ads</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  Ver: <code>apps/api/src/integrations/META_OAUTH.md</code> para detalles de OAuth y tokens.
                </p>
              </div>

              <div className="border-t pt-4 mt-4">
                <Link href="/settings/integrations">
                  <Button variant="outline">Gestionar Integraciones</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
