'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Permission, userCan } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { PermissionGuard } from '@/components/auth/permission-guard';
import {
  useIntegrationsAudit,
  useIntegrationsStatus,
  useRunIntegrationTest,
} from '@/lib/api/hooks/use-integrations-settings';

function IntegrationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const canManage = !!user && userCan(user, Permission.MANAGE_INTEGRATIONS);

  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
    refetch: refetchStatus,
  } = useIntegrationsStatus(!!user);
  const { data: audit, isLoading: auditLoading } = useIntegrationsAudit(!!user, 20);
  const runTest = useRunIntegrationTest();

  // Clean oauth params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const accountId = searchParams.get('accountId');
    const errorParam = searchParams.get('error');
    if ((connected === 'true' && accountId) || errorParam) {
      refetchStatus();
      setTimeout(() => router.replace('/settings/integrations'), 500);
    }
  }, [searchParams, router, refetchStatus]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!userCan(user, Permission.MANAGE_INTEGRATIONS)) {
      router.push('/forbidden');
    }
  }, [user, router]);

  const handleConnectMeta = async () => {
    setConnecting(true);
    try {
      const response = await api.get<{ authorizationUrl: string }>('/integrations/meta/oauth/start');
      window.location.href = response.authorizationUrl;
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e), variant: 'destructive' as any });
      setConnecting(false);
    }
  };

  const handleDisconnectMeta = async (accountId: string) => {
    if (!confirm('¿Desconectar Meta?')) return;
    setDisconnecting(true);
    try {
      await api.post(`/integrations/meta/oauth/disconnect/${accountId}`);
      await refetchStatus();
      toast({ title: 'OK', description: 'Cuenta desconectada' });
    } catch (e) {
      toast({ title: 'Error', description: getErrorMessage(e), variant: 'destructive' as any });
    } finally {
      setDisconnecting(false);
    }
  };

  const renderToken = (tokenStatus?: string) => {
    if (!tokenStatus) return '-';
    if (tokenStatus === 'OK') return 'OK';
    if (tokenStatus === 'EXPIRING_SOON') return 'Expiring soon';
    if (tokenStatus === 'EXPIRED') return 'Expired';
    return 'Unknown';
  };

  if (!user) return null;

  const meta = status?.providers.meta;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Integraciones</h1>
          <p className="text-gray-600">Panel real: estado + guardrails + tests + activity</p>
        </div>

        {statusError && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6 text-sm text-red-800">
              {getErrorMessage(statusError)}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Meta (OAuth + Ads)</CardTitle>
              <CardDescription>
                Connected: <strong>{meta?.connected ? 'true' : 'false'}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {statusLoading ? (
                <p className="text-gray-500">Cargando…</p>
              ) : (
                <>
                  <p><strong>Last sync:</strong> {meta?.lastSyncAt ? new Date(meta.lastSyncAt).toLocaleString('es-AR') : '-'}</p>
                  <p><strong>Last checked:</strong> {status?.lastChecked ? new Date(status.lastChecked).toLocaleString('es-AR') : '-'}</p>
                  <p><strong>Token:</strong> {renderToken(meta?.tokenStatus)} {meta?.tokenExpiresAt ? `(exp ${new Date(meta.tokenExpiresAt).toLocaleDateString('es-AR')})` : ''}</p>
                  <p><strong>adAccountId:</strong> {meta?.configSummary?.adAccountId || '-'}</p>

                  {meta?.guardrails?.map((g, idx) => (
                    <div key={idx} className="text-xs rounded border border-yellow-200 bg-yellow-50 p-2 text-yellow-800">
                      {g.message}{' '}
                    </div>
                  ))}

                  {!!meta?.errors?.length && (
                    <div className="text-xs text-gray-600">
                      <strong>Errors (últimos 5)</strong>
                      <ul className="list-disc list-inside">
                        {meta.errors.slice(0, 5).map((e, i) => <li key={i}>{e.message}</li>)}
                      </ul>
                    </div>
                  )}

                  {canManage && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <Button onClick={handleConnectMeta} disabled={connecting} variant="outline" size="sm">
                        {connecting ? 'Conectando…' : meta?.connected ? 'Conectar otra' : 'Conectar'}
                      </Button>
                      {meta?.accountId && meta.connected && (
                        <Button
                          onClick={() => handleDisconnectMeta(meta.accountId!)}
                          disabled={disconnecting}
                          variant="destructive"
                          size="sm"
                        >
                          {disconnecting ? 'Desconectando…' : 'Desconectar'}
                        </Button>
                      )}
                      <Button
                        onClick={async () => {
                          try {
                            const r = await runTest.mutateAsync('meta');
                            toast({ title: r.ok ? 'OK' : 'FAIL', description: r.error || 'Test Ads OK' });
                          } catch (e) {
                            toast({ title: 'FAIL', description: getErrorMessage(e), variant: 'destructive' as any });
                          }
                        }}
                        disabled={runTest.isPending}
                        size="sm"
                      >
                        Test Ads
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Últimos 20 eventos</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <p className="text-sm text-gray-500">Cargando…</p>
            ) : audit && audit.length ? (
              <div className="space-y-2 text-sm">
                {audit.map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-4 border-b pb-2">
                    <div>
                      <div className="font-medium">
                        {e.provider || '—'} • {e.event || 'EVENT'} {e.ok === null ? '' : e.ok ? '✓' : '✗'}
                      </div>
                      {e.error && <div className="text-xs text-red-600">{e.error}</div>}
                      {e.payload && <div className="text-xs text-gray-500">{JSON.stringify(e.payload)}</div>}
                    </div>
                    <div className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString('es-AR')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Sin actividad aún.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <PermissionGuard permission={Permission.MANAGE_INTEGRATIONS}>
      <Suspense fallback={<div className="min-h-screen bg-gray-50 p-6">Cargando...</div>}>
        <IntegrationsPageContent />
      </Suspense>
    </PermissionGuard>
  );
}
