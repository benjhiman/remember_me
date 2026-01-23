'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useDashboardOverview, useDashboardLeads, useDashboardSales } from '@/lib/api/hooks/use-dashboard';
import { useSales } from '@/lib/api/hooks/use-sales';
import { useLeads } from '@/lib/api/hooks/use-leads';
import { useStockReservations } from '@/lib/api/hooks/use-stock-reservations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/layout/page-shell';
import { getDateRange, formatCurrency, formatNumber } from '@/lib/utils/date-range';
import { formatDate } from '@/lib/utils/lead-utils';
import { Permission, userCan } from '@/lib/auth/permissions';
import type { DateRangePreset } from '@/lib/utils/date-range';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const dateRange = getDateRange(
    datePreset,
    datePreset === 'custom' && customFrom && customTo
      ? { from: new Date(customFrom).toISOString(), to: new Date(customTo).toISOString() }
      : undefined
  );

  const { data: overview, isLoading: overviewLoading } = useDashboardOverview(
    { from: dateRange.from, to: dateRange.to },
    !!user
  );
  const { data: leadsData, isLoading: leadsLoading } = useDashboardLeads(
    { from: dateRange.from, to: dateRange.to, groupBy: 'day' },
    !!user
  );
  const { data: salesData, isLoading: salesLoading } = useDashboardSales(
    { from: dateRange.from, to: dateRange.to, groupBy: 'day' },
    !!user
  );

  // Get recent sales and leads for tables
  const { data: recentSales } = useSales({ limit: 10, sort: 'createdAt', order: 'desc', enabled: !!user });
  const { data: recentLeads } = useLeads({ limit: 10, sort: 'createdAt', order: 'desc', enabled: !!user });
  const { data: activeReservations } = useStockReservations({ status: 'ACTIVE', limit: 10, enabled: !!user });

  // Auth is handled by RouteGuard in layout
  // Permission check
  if (user && !userCan(user, Permission.VIEW_DASHBOARD)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Acceso denegado</h2>
            <p className="text-sm text-muted-foreground">No tenés permisos para ver el dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = overviewLoading || leadsLoading || salesLoading;

  // Calculate KPIs
  const totalRevenue = overview?.revenue ? parseFloat(overview.revenue) : 0;
  const totalSales = overview?.totalSales || 0;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const totalLeads = overview?.totalLeads || 0;
  const convertedLeads = overview?.salesByStatus?.find((s) => s.status === 'PAID' || s.status === 'DELIVERED')
    ?.count || 0;
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

  const breadcrumbs = [
    { label: 'Dashboard', href: '/dashboard' },
  ];

  const actions = (
    <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/roas')}>
      Ver ROAS
    </Button>
  );

  return (
    <PageShell
      title="Dashboard"
      description="Vista general del negocio"
      breadcrumbs={breadcrumbs}
      actions={actions}
    >

        {/* Date Range Filter */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="text-sm font-medium">Período:</label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={datePreset === 'today' ? 'default' : 'outline'}
                  onClick={() => setDatePreset('today')}
                >
                  Hoy
                </Button>
                <Button
                  size="sm"
                  variant={datePreset === '7d' ? 'default' : 'outline'}
                  onClick={() => setDatePreset('7d')}
                >
                  7 días
                </Button>
                <Button
                  size="sm"
                  variant={datePreset === '30d' ? 'default' : 'outline'}
                  onClick={() => setDatePreset('30d')}
                >
                  30 días
                </Button>
                <Button
                  size="sm"
                  variant={datePreset === 'custom' ? 'default' : 'outline'}
                  onClick={() => setDatePreset('custom')}
                >
                  Personalizado
                </Button>
              </div>
              {datePreset === 'custom' && (
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <span>a</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Ventas Totales</div>
                <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
                <div className="text-xs text-muted-foreground mt-1">{totalSales} ventas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Ticket Promedio</div>
                <div className="text-2xl font-bold">{formatCurrency(avgTicket)}</div>
                <div className="text-xs text-muted-foreground mt-1">Por venta</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Leads Nuevos</div>
                <div className="text-2xl font-bold">{formatNumber(totalLeads)}</div>
                <div className="text-xs text-muted-foreground mt-1">En el período</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Leads Convertidos</div>
                <div className="text-2xl font-bold">{formatNumber(convertedLeads)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {conversionRate.toFixed(1)}% tasa de conversión
                </div>
              </CardContent>
            </Card>
            {overview && (
              <>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Stock Disponible</div>
                    <div className="text-2xl font-bold">{formatNumber(overview.stockAvailableCount)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Items disponibles</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground mb-1">Stock Reservado</div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {formatNumber(overview.stockReservedCount)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Items reservados</div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Sales Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Día</CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Cargando...
                </div>
              ) : salesData?.salesCreated && salesData.salesCreated.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData.salesCreated}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString('es-AR')}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Ventas" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No hay datos de ventas
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue por Día</CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Cargando...
                </div>
              ) : salesData?.revenue && salesData.revenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesData.revenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="period"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value as string).toLocaleDateString('es-AR')}
                      formatter={(value: string | number | undefined) => {
                        if (value === undefined) return '';
                        return formatCurrency(typeof value === 'string' ? parseFloat(value) : value);
                      }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No hay datos de revenue
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leads by Stage */}
          <Card>
            <CardHeader>
              <CardTitle>Leads por Stage</CardTitle>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Cargando...
                </div>
              ) : leadsData?.breakdown && leadsData.breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadsData.breakdown}
                      dataKey="count"
                      nameKey="stageName"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry: any) => `${entry.stageName}: ${entry.count}`}
                    >
                      {leadsData.breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.stageColor || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No hay datos de leads
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales by Status */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              {overviewLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Cargando...
                </div>
              ) : overview?.salesByStatus && overview.salesByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={overview.salesByStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8b5cf6" name="Cantidad" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  No hay datos de ventas
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Sales */}
          <Card>
            <CardHeader>
              <CardTitle>Últimas Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              {recentSales?.data && recentSales.data.length > 0 ? (
                <div className="space-y-2">
                  {recentSales.data.slice(0, 10).map((sale) => (
                    <div
                      key={sale.id}
                      className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/sales/${sale.id}`)}
                    >
                      <div className="text-sm font-medium">{sale.saleNumber || sale.id.slice(0, 8)}</div>
                      <div className="text-xs text-gray-600">
                        {sale.customerName} · {formatCurrency(parseFloat(sale.total))}
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(sale.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No hay ventas recientes</div>
              )}
            </CardContent>
          </Card>

          {/* Recent Leads */}
          <Card>
            <CardHeader>
              <CardTitle>Últimos Leads</CardTitle>
            </CardHeader>
            <CardContent>
              {recentLeads?.data && recentLeads.data.length > 0 ? (
                <div className="space-y-2">
                  {recentLeads.data.slice(0, 10).map((lead) => (
                    <div
                      key={lead.id}
                      className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                    >
                      <div className="text-sm font-medium">{lead.name}</div>
                      <div className="text-xs text-gray-600">
                        {lead.pipeline?.name} / {lead.stage?.name}
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(lead.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No hay leads recientes</div>
              )}
            </CardContent>
          </Card>

          {/* Active Reservations */}
          <Card>
            <CardHeader>
              <CardTitle>Reservas Activas</CardTitle>
            </CardHeader>
            <CardContent>
              {activeReservations?.data && activeReservations.data.length > 0 ? (
                <div className="space-y-2">
                  {activeReservations.data.slice(0, 10).map((reservation) => (
                    <div
                      key={reservation.id}
                      className="p-2 border rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/stock/${reservation.stockItemId}`)}
                    >
                      <div className="text-sm font-medium">
                        {reservation.stockItem?.model || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-600">Cantidad: {reservation.quantity}</div>
                      <div className="text-xs text-gray-500">{formatDate(reservation.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No hay reservas activas</div>
              )}
            </CardContent>
          </Card>
        </div>
    </PageShell>
  );
}
