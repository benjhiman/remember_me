'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAttribution } from '@/lib/api/hooks/use-attribution';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
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
  const { user } = useAuthStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState<AttributionGroupBy>('campaign');
  const [includeZeroRevenue, setIncludeZeroRevenue] = useState(false);

  const { data, isLoading, error } = useAttribution({
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard ROAS</h1>
            <p className="text-gray-600">Métricas de atribución Meta Ads</p>
          </div>
          {data && data.length > 0 && (
            <Button onClick={() => exportToCSV(data, groupBy)} variant="outline">
              Exportar CSV
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Desde</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hasta</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Agrupar por</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as AttributionGroupBy)}
              >
                <option value="campaign">Campaign</option>
                <option value="adset">Adset</option>
                <option value="ad">Ad</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeZeroRevenue}
                  onChange={(e) => setIncludeZeroRevenue(e.target.checked)}
                />
                <span className="text-sm">Incluir sin revenue</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {isLoading && (
            <div className="p-8 text-center text-gray-500">Cargando métricas...</div>
          )}
          {error && (
            <div className="p-8 text-center text-red-500">
              Error: {(error as Error).message}
            </div>
          )}
          {data && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {groupBy === 'campaign' ? 'Campaign' : groupBy === 'adset' ? 'Adset' : 'Ad'} ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sales
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Spend
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROAS
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conv. Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Ticket
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        No hay datos para mostrar
                      </td>
                    </tr>
                  ) : (
                    data.map((metric, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
