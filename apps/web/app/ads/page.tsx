'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Permission, userCan } from '@/lib/auth/permissions';
import {
  useMetaAdAccounts,
  useMetaConfig,
  useUpdateMetaConfig,
  useMetaCampaigns,
} from '@/lib/api/hooks/use-meta-ads';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getDateRange, formatCurrency, formatNumber, type DateRangePreset } from '@/lib/utils/date-range';
import { AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function AdsPageContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>('');
  const [paginationAfter, setPaginationAfter] = useState<string | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<Array<{
    id: string;
    name: string;
    status: string;
    objective?: string;
    createdTime?: string;
    updatedTime?: string;
    insights: {
      spend: string;
      impressions: number;
      clicks: number;
      ctr: string;
      cpc: string;
    };
  }>>([]);

  // Get date range
  const dateRange = getDateRange(
    datePreset,
    datePreset === 'custom' && customFrom && customTo
      ? { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() }
      : undefined
  );

  // Fetch ad accounts and config
  const { data: adAccountsData, isLoading: adAccountsLoading } = useMetaAdAccounts(!!user);
  const { data: configData, isLoading: configLoading } = useMetaConfig(!!user);
  const updateConfigMutation = useUpdateMetaConfig();

  // Set selected ad account from config when loaded
  useEffect(() => {
    if (configData?.adAccountId && !selectedAdAccountId) {
      setSelectedAdAccountId(configData.adAccountId);
    }
  }, [configData, selectedAdAccountId]);

  // Reset pagination when filters change
  useEffect(() => {
    setPaginationAfter(null);
    setAllCampaigns([]);
  }, [dateRange.from, dateRange.to, selectedAdAccountId]);

  // Accumulate campaigns for pagination
  useEffect(() => {
    if (campaignsData?.data) {
      if (paginationAfter) {
        // Append new campaigns when loading more
        setAllCampaigns((prev) => [...prev, ...campaignsData.data]);
      } else {
        // Reset when filters change
        setAllCampaigns(campaignsData.data);
      }
    }
  }, [campaignsData, paginationAfter]);

  // Fetch campaigns
  const {
    data: campaignsData,
    isLoading: campaignsLoading,
    error: campaignsError,
    refetch: refetchCampaigns,
  } = useMetaCampaigns({
    from: dateRange.from,
    to: dateRange.to,
    limit: 25,
    after: paginationAfter || undefined,
    adAccountId: selectedAdAccountId || undefined,
    enabled: !!user && !!selectedAdAccountId,
  });

  // Handle ad account selection
  const handleAdAccountChange = async (adAccountId: string) => {
    setSelectedAdAccountId(adAccountId);
    try {
      await updateConfigMutation.mutateAsync(adAccountId);
      // Refetch campaigns after config update
      refetchCampaigns();
    } catch (error) {
      console.error('Error updating ad account config:', error);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const isLoading = adAccountsLoading || configLoading;
  const hasAdAccount = !!selectedAdAccountId;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Meta Ads</h1>
        <p className="text-gray-600">Gestión de campañas y métricas de Meta Ads</p>
      </div>

      {/* Ad Account Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Ad Account</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando cuentas de anuncios...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Seleccionar Ad Account</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedAdAccountId}
                  onChange={(e) => handleAdAccountChange(e.target.value)}
                  disabled={updateConfigMutation.isPending}
                >
                  <option value="">-- Seleccionar Ad Account --</option>
                  {adAccountsData?.data.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.id})
                    </option>
                  ))}
                </select>
              </div>
              {!hasAdAccount && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                  <AlertCircle className="h-4 w-4" />
                  <span>Seleccioná una Ad Account para ver campañas</span>
                </div>
              )}
              {!configData?.connected && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    Meta no está conectado.{' '}
                    <Link href="/settings/integrations" className="underline">
                      Conectar cuenta Meta
                    </Link>
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date Range Filter */}
      {hasAdAccount && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Rango de Fechas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={datePreset === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDatePreset('today')}
                >
                  Hoy
                </Button>
                <Button
                  variant={datePreset === '7d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDatePreset('7d')}
                >
                  7 días
                </Button>
                <Button
                  variant={datePreset === '30d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDatePreset('30d')}
                >
                  30 días
                </Button>
                <Button
                  variant={datePreset === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDatePreset('custom')}
                >
                  Personalizado
                </Button>
              </div>
              {datePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Desde</label>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Hasta</label>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaigns Table */}
      {hasAdAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Campañas</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-600">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Cargando campañas...</span>
              </div>
            ) : campaignsError ? (
              <div className="text-center py-8">
                <div className="text-red-600 mb-4">
                  Error al cargar campañas: {(campaignsError as Error).message}
                </div>
                <Button onClick={() => refetchCampaigns()} variant="outline">
                  Reintentar
                </Button>
              </div>
            ) : !allCampaigns || allCampaigns.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                No hay campañas disponibles para el rango de fechas seleccionado
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-semibold text-sm">Name</th>
                        <th className="text-left p-2 font-semibold text-sm">Status</th>
                        <th className="text-left p-2 font-semibold text-sm">Objective</th>
                        <th className="text-right p-2 font-semibold text-sm">Spend</th>
                        <th className="text-right p-2 font-semibold text-sm">Impressions</th>
                        <th className="text-right p-2 font-semibold text-sm">Clicks</th>
                        <th className="text-right p-2 font-semibold text-sm">CTR</th>
                        <th className="text-right p-2 font-semibold text-sm">CPC</th>
                        <th className="text-left p-2 font-semibold text-sm">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allCampaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-sm font-medium">{campaign.name}</td>
                          <td className="p-2 text-sm">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                campaign.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : campaign.status === 'PAUSED'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {campaign.status}
                            </span>
                          </td>
                          <td className="p-2 text-sm text-gray-600">{campaign.objective || '-'}</td>
                          <td className="p-2 text-sm text-right font-medium">
                            {formatCurrency(parseFloat(campaign.insights.spend))}
                          </td>
                          <td className="p-2 text-sm text-right">
                            {formatNumber(campaign.insights.impressions)}
                          </td>
                          <td className="p-2 text-sm text-right">
                            {formatNumber(campaign.insights.clicks)}
                          </td>
                          <td className="p-2 text-sm text-right">
                            {parseFloat(campaign.insights.ctr).toFixed(2)}%
                          </td>
                          <td className="p-2 text-sm text-right">
                            {formatCurrency(parseFloat(campaign.insights.cpc))}
                          </td>
                          <td className="p-2 text-sm text-gray-600">
                            {campaign.updatedTime
                              ? new Date(campaign.updatedTime).toLocaleDateString('es-AR')
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {campaignsData.paging.after && (
                  <div className="flex justify-center pt-4">
                    <Button
                      onClick={() => {
                        // TODO: Implement pagination with 'after' cursor
                        // For now, just refetch with the same params
                        refetchCampaigns();
                      }}
                      variant="outline"
                      disabled={campaignsLoading}
                    >
                      {campaignsLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Cargando...
                        </>
                      ) : (
                        'Cargar más'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!userCan(user, Permission.VIEW_INTEGRATIONS)) {
      router.push('/forbidden');
      return;
    }
  }, [user, router]);

  if (!user || !userCan(user, Permission.VIEW_INTEGRATIONS)) {
    return null;
  }

  return <AdsPageContent />;
}
