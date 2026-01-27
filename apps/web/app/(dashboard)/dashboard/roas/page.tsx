'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAttribution } from '@/lib/api/hooks/use-attribution';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';
import type { AttributionGroupBy } from '@/types/api';

function exportToCSV(data: any[], groupBy: AttributionGroupBy) {
  const headers = [
    `${groupBy === 'campaign' ? 'Campaign' : groupBy === 'adset' ? 'Adset' : 'Ad'} ID`,
    'Leads',
    'Sales',
    'Revenue',
    'Spend',
    'ROAS',
    'Conversion Rate',
    'Avg Ticket',
  ];

  const rows = data.map((item) => [
    item[`${groupBy}Id`] || '-',
    item.leadsCount,
    item.salesCount,
    item.revenue.toFixed(2),
    item.spend.toFixed(2),
    item.roas?.toFixed(2) || '-',
    (item.conversionRate * 100).toFixed(2) + '%',
    item.avgTicket.toFixed(2),
  ]);

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `roas-${groupBy}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

export default function RoasPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState<AttributionGroupBy>('campaign');
  const [includeZeroRevenue, setIncludeZeroRevenue] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, error, refetch } = useAttribution({
    from: from || undefined,
    to: to || undefined,
    groupBy,
    includeZeroRevenue,
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['attribution'] });
      await refetch();
      toast({
        title: 'Actualizado',
        description: 'Los datos de ROAS se han actualizado',
      });
    } catch (error) {
      console.error('Error refreshing ROAS:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar los datos de ROAS',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!user) {
    return null;
  }

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'ROAS', href: '/dashboard/roas' },
  ];

  return (
    <PageShell
      title="Dashboard ROAS"
      description="Métricas de atribución Meta Ads"
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          {data && data.length > 0 && (
            <Button onClick={() => exportToCSV(data, groupBy)} variant="outline" size="sm">
              Exportar CSV
            </Button>
          )}
        </div>
      }
      toolbar={
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Desde</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hasta</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Agrupar por</label>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as AttributionGroupBy)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="adset">Adset</SelectItem>
                <SelectItem value="ad">Ad</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch
                checked={includeZeroRevenue}
                onCheckedChange={setIncludeZeroRevenue}
              />
              <span className="text-sm">Incluir sin revenue</span>
            </label>
          </div>
        </div>
      }
    >

      {/* Table */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Métricas de Atribución</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-destructive mb-3">
                Error: {(error as Error).message || 'No se pudo cargar los datos'}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          ) : data && data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {groupBy === 'campaign' ? 'Campaign' : groupBy === 'adset' ? 'Adset' : 'Ad'} ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Leads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Sales
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Spend
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      ROAS
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Conv. Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Avg Ticket
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {data.map((metric, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {metric[`${groupBy}Id`] || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{metric.leadsCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{metric.salesCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        ${metric.revenue.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        ${metric.spend.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {metric.roas ? metric.roas.toFixed(2) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(metric.conversionRate * 100).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        ${metric.avgTicket.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No hay datos para mostrar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
