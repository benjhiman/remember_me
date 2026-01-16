'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useConnectedAccounts } from '@/lib/api/hooks/use-connected-accounts';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { useHealth } from '@/lib/api/hooks/use-health';
import { useJobMetrics } from '@/lib/api/hooks/use-job-metrics';

function IntegrationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const { data: connectedAccounts, isLoading, error, refetch } = useConnectedAccounts(!!user);
  const { data: health, isLoading: healthLoading } = useHealth(!!user);
  const { data: jobMetrics, isLoading: jobMetricsLoading } = useJobMetrics(!!user);

  // Check for OAuth callback params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const accountId = searchParams.get('accountId');
    const errorParam = searchParams.get('error');

    if (connected === 'true' && accountId) {
      // Success - refresh accounts
      refetch();
      // Clean URL
      router.replace('/settings/integrations');
    } else if (errorParam) {
      // Error - show message (handled below)
      // Clean URL after showing error
      setTimeout(() => {
        router.replace('/settings/integrations');
      }, 5000);
    }
  }, [searchParams, router, refetch]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, router]);

  const handleConnectMeta = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ authorizationUrl: string }>('/integrations/meta/oauth/start');
      // Redirect to Meta OAuth URL
      window.location.href = response.authorizationUrl;
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('¿Estás seguro de que quieres desconectar esta cuenta?')) {
      return;
    }

    setDisconnecting(accountId);
    try {
      await api.post(`/integrations/meta/oauth/disconnect/${accountId}`);
      refetch();
    } catch (error: any) {
      alert(`Error al desconectar: ${error.message}`);
    } finally {
      setDisconnecting(null);
    }
  };

  if (!user) {
    return null;
  }

  const errorParam = searchParams.get('error');
  const errorReason = searchParams.get('reason');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Integraciones</h1>
          <p className="text-gray-600">Gestiona tus conexiones con plataformas externas</p>
        </div>

        {errorParam && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {errorParam}
                {errorReason && ` - ${errorReason}`}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Meta (Instagram + Marketing API)</CardTitle>
            <CardDescription>
              Conecta tu cuenta Meta para enviar/recibir mensajes de Instagram y obtener datos de
              spend para ROAS
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-gray-500">Cargando...</p>}
            {error && (
              <p className="text-sm text-red-500">
                Error al cargar cuentas: {(error as Error).message}
              </p>
            )}

            {connectedAccounts && connectedAccounts.length > 0 ? (
              <div className="space-y-4">
                {connectedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="border rounded-lg p-4 bg-white"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{account.displayName}</h3>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              account.status === 'CONNECTED'
                                ? 'bg-green-100 text-green-800'
                                : account.status === 'ERROR'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {account.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <strong>Provider:</strong> {account.provider}
                          </p>
                          {account.metadata.pageId && (
                            <p>
                              <strong>Page ID:</strong> {account.metadata.pageId}
                            </p>
                          )}
                          {account.metadata.igUserId && (
                            <p>
                              <strong>Instagram User ID:</strong> {account.metadata.igUserId}
                            </p>
                          )}
                          {account.metadata.adAccounts && account.metadata.adAccounts.length > 0 && (
                            <div>
                              <strong>Ad Accounts:</strong>
                              <ul className="list-disc list-inside ml-2">
                                {account.metadata.adAccounts.map((acc) => (
                                  <li key={acc.id}>
                                    {acc.name} ({acc.id})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {account.token && (
                            <p>
                              <strong>Token expira:</strong>{' '}
                              {formatDistanceToNow(new Date(account.token.expiresAt), {
                                addSuffix: true,
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnect(account.id)}
                        disabled={disconnecting === account.id}
                      >
                        {disconnecting === account.id ? 'Desconectando...' : 'Desconectar'}
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t">
                  <Button onClick={handleConnectMeta} disabled={loading} variant="outline">
                    {loading ? 'Conectando...' : '+ Conectar otra cuenta'}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 mb-4">No hay cuenta conectada</p>
                <Button onClick={handleConnectMeta} disabled={loading}>
                  {loading ? 'Conectando...' : 'Conectar cuenta Meta'}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Se abrirá una ventana para autorizar la conexión. Completa el flujo OAuth y serás
                  redirigido de vuelta.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job Runner Health */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Job Runner - Estado</CardTitle>
            <CardDescription>Métricas del procesador de trabajos en segundo plano</CardDescription>
          </CardHeader>
          <CardContent>
            {jobMetricsLoading ? (
              <p className="text-sm text-gray-500">Cargando métricas...</p>
            ) : jobMetrics ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Estado:</span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      jobMetrics.failedCount === 0 && (jobMetrics.oldestPendingAgeMs === null || jobMetrics.oldestPendingAgeMs < 600000)
                        ? 'bg-green-100 text-green-800'
                        : jobMetrics.failedCount > 0 || (jobMetrics.oldestPendingAgeMs !== null && jobMetrics.oldestPendingAgeMs > 600000)
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {jobMetrics.failedCount === 0 && (jobMetrics.oldestPendingAgeMs === null || jobMetrics.oldestPendingAgeMs < 600000)
                      ? '✓ OK'
                      : jobMetrics.failedCount > 0 || (jobMetrics.oldestPendingAgeMs !== null && jobMetrics.oldestPendingAgeMs > 600000)
                      ? '⚠ WARN'
                      : '✗ ERROR'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Pendientes:</span> {jobMetrics.pendingCount}
                </div>
                <div>
                  <span className="font-medium">Procesando:</span> {jobMetrics.processingCount}
                </div>
                <div>
                  <span className="font-medium">Fallidos:</span>{' '}
                  <span className={jobMetrics.failedCount > 0 ? 'text-red-600' : ''}>
                    {jobMetrics.failedCount}
                  </span>
                </div>
                {jobMetrics.oldestPendingAgeMs !== null && (
                  <div>
                    <span className="font-medium">Trabajo más antiguo:</span>{' '}
                    <span className={jobMetrics.oldestPendingAgeMs > 600000 ? 'text-yellow-600' : ''}>
                      {Math.round(jobMetrics.oldestPendingAgeMs / 1000 / 60)} minutos
                    </span>
                  </div>
                )}
                {jobMetrics.lastRunAt && (
                  <div className="text-xs text-gray-500 pt-2">
                    Última ejecución: {new Date(jobMetrics.lastRunAt).toLocaleString('es-ES')}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-500">No se pudieron obtener las métricas</p>
            )}
          </CardContent>
        </Card>

        {/* Health Status */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
            <CardDescription>Información de salud y versión del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <p className="text-sm text-gray-500">Cargando estado...</p>
            ) : health ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Estado:</span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      health.status === 'ok'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {health.status === 'ok' ? '✓ Operativo' : '✗ Error'}
                  </span>
                </div>
                {health.database && (
                  <div>
                    <span className="font-medium">Base de datos:</span>{' '}
                    <span
                      className={
                        health.database.status === 'connected'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {health.database.status === 'connected' ? '✓ Conectada' : '✗ Desconectada'}
                    </span>
                    {health.database.latency && (
                      <span className="text-gray-500 ml-2">
                        ({health.database.latency}ms)
                      </span>
                    )}
                  </div>
                )}
                {health.environment && (
                  <div>
                    <span className="font-medium">Ambiente:</span>{' '}
                    <span className="capitalize">{health.environment}</span>
                  </div>
                )}
                {health.version && (
                  <div>
                    <span className="font-medium">Versión:</span> {health.version}
                  </div>
                )}
                <div className="text-xs text-gray-500 pt-2">
                  Última verificación: {new Date(health.timestamp).toLocaleString('es-ES')}
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-500">No se pudo obtener el estado del sistema</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Cargando...</div>}>
      <IntegrationsPageContent />
    </Suspense>
  );
}
