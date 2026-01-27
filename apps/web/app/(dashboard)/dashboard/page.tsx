'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { useDashboardOverview, useDashboardLeads, useDashboardSales, useDashboardStock } from '@/lib/api/hooks/use-dashboard';
import { useSales } from '@/lib/api/hooks/use-sales';
import { useLeads } from '@/lib/api/hooks/use-leads';
import { useStockReservations } from '@/lib/api/hooks/use-stock-reservations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { PageShell } from '@/components/layout/page-shell';
import { formatCurrency, formatNumber } from '@/lib/utils/date-range';
import { formatDate } from '@/lib/utils/lead-utils';
import { Permission, userCan } from '@/lib/auth/permissions';
import { parseDashboardFilters, toSearchParams, getPreviousPeriodRange, type DashboardFilters } from '@/lib/dashboard/filters';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
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

// Error component for sections
function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card>
      <CardContent className="p-6 text-center">
        <p className="text-sm text-muted-foreground mb-3">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Delta component for compare mode
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  const deltaPercent = previous !== 0 ? ((delta / previous) * 100).toFixed(1) : '0.0';
  const isPositive = delta >= 0;

  return (
    <div className="flex items-center gap-1 text-xs mt-1">
      {isPositive ? (
        <TrendingUp className="h-3 w-3 text-green-600" />
      ) : (
        <TrendingDown className="h-3 w-3 text-red-600" />
      )}
      <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
        {isPositive ? '+' : ''}
        {deltaPercent}%
      </span>
      <span className="text-muted-foreground">
        ({isPositive ? '+' : ''}
        {typeof delta === 'number' && delta % 1 !== 0 ? delta.toFixed(2) : delta})
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Parse filters from URL on mount
  const initialFilters = parseDashboardFilters(searchParams);
  const [filters, setFilters] = useState<DashboardFilters>({
    preset: initialFilters.preset,
    from: initialFilters.from,
    to: initialFilters.to,
    compare: initialFilters.compare,
    groupBy: initialFilters.groupBy,
  });

  // Local state for custom dates (for UI only)
  const [customFrom, setCustomFrom] = useState(() => {
    if (filters.preset === 'custom' && filters.from) {
      return new Date(filters.from).toISOString().split('T')[0];
    }
    return '';
  });
  const [customTo, setCustomTo] = useState(() => {
    if (filters.preset === 'custom' && filters.to) {
      return new Date(filters.to).toISOString().split('T')[0];
    }
    return '';
  });

  // Update URL when filters change
  const updateFilters = useCallback(
    (newFilters: Partial<DashboardFilters>) => {
      const updated = { ...filters, ...newFilters };
      setFilters(updated);
      const params = toSearchParams(updated);
      router.replace(`/dashboard?${params}`, { scroll: false });
    },
    [filters, router],
  );

  // Calculate previous period for compare
  const previousPeriod = filters.compare
    ? getPreviousPeriodRange(filters.from!, filters.to!)
    : null;

  // Main queries
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useDashboardOverview({ from: filters.from, to: filters.to, groupBy: filters.groupBy }, !!user);

  const {
    data: leadsData,
    isLoading: leadsLoading,
    error: leadsError,
    refetch: refetchLeads,
  } = useDashboardLeads({ from: filters.from, to: filters.to, groupBy: filters.groupBy }, !!user);

  const {
    data: salesData,
    isLoading: salesLoading,
    error: salesError,
    refetch: refetchSales,
  } = useDashboardSales({ from: filters.from, to: filters.to, groupBy: filters.groupBy }, !!user);

  // Previous period queries (only if compare is enabled)
  const {
    data: overviewPrevious,
    isLoading: overviewPreviousLoading,
  } = useDashboardOverview(
    previousPeriod ? { from: previousPeriod.from, to: previousPeriod.to, groupBy: filters.groupBy } : {},
    !!user && !!previousPeriod,
  );

  const {
    data: salesDataPrevious,
    isLoading: salesPreviousLoading,
  } = useDashboardSales(
    previousPeriod ? { from: previousPeriod.from, to: previousPeriod.to, groupBy: filters.groupBy } : {},
    !!user && !!previousPeriod,
  );

  // Stock query for low stock alerts
  const {
    data: stockData,
    isLoading: stockLoading,
    error: stockError,
  } = useDashboardStock({ from: filters.from, to: filters.to, groupBy: filters.groupBy }, !!user);

  // Recent data queries
  const { data: recentSales } = useSales({ limit: 10, sort: 'createdAt', order: 'desc', enabled: !!user });
  const { data: recentLeads } = useLeads({ limit: 10, sort: 'createdAt', order: 'desc', enabled: !!user });
  const { data: activeReservations } = useStockReservations({ status: 'ACTIVE', limit: 10, enabled: !!user });

  // Refresh handler
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-leads'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-sales'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stock'] });
    refetchOverview();
    refetchLeads();
    refetchSales();
  }, [queryClient, refetchOverview, refetchLeads, refetchSales]);

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

  // Calculate KPIs
  const totalRevenue = overview?.revenue ? parseFloat(overview.revenue) : 0;
  const totalSales = overview?.totalSales || 0;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const totalLeads = overview?.totalLeads || 0;
  const convertedLeads = overview?.salesByStatus?.find((s) => s.status === 'PAID' || s.status === 'DELIVERED')
    ?.count || 0;
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

  // Previous period KPIs (for compare)
  const previousRevenue = overviewPrevious?.revenue ? parseFloat(overviewPrevious.revenue) : 0;
  const previousSales = overviewPrevious?.totalSales || 0;
  const previousLeads = overviewPrevious?.totalLeads || 0;

  const breadcrumbs = [{ label: 'Dashboard', href: '/dashboard' }];

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleRefresh}>
        <RefreshCw className="h-4 w-4 mr-1.5" />
        Refresh
      </Button>
      <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/roas')}>
        Ver ROAS
      </Button>
    </div>
  );

  return (
    <PageShell title="Dashboard" description="Vista general del negocio" breadcrumbs={breadcrumbs} actions={actions}>
      {/* Date Range Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium">Período:</label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={filters.preset === 'today' ? 'default' : 'outline'}
                onClick={() => updateFilters({ preset: 'today' })}
              >
                Hoy
              </Button>
              <Button
                size="sm"
                variant={filters.preset === '7d' ? 'default' : 'outline'}
                onClick={() => updateFilters({ preset: '7d' })}
              >
                7 días
              </Button>
              <Button
                size="sm"
                variant={filters.preset === '30d' ? 'default' : 'outline'}
                onClick={() => updateFilters({ preset: '30d' })}
              >
                30 días
              </Button>
              <Button
                size="sm"
                variant={filters.preset === 'custom' ? 'default' : 'outline'}
                onClick={() => updateFilters({ preset: 'custom' })}
              >
                Personalizado
              </Button>
            </div>
            {filters.preset === 'custom' && (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value);
                    if (e.target.value && customTo) {
                      updateFilters({
                        from: new Date(e.target.value).toISOString(),
                        to: new Date(customTo).toISOString(),
                      });
                    }
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
                <span>a</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value);
                    if (customFrom && e.target.value) {
                      updateFilters({
                        from: new Date(customFrom).toISOString(),
                        to: new Date(e.target.value).toISOString(),
                      });
                    }
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                <Switch checked={filters.compare || false} onCheckedChange={(checked) => updateFilters({ compare: checked })} />
                <span>Comparar con período anterior</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {overviewError ? (
        <SectionError message="No se pudo cargar los KPIs" onRetry={() => refetchOverview()} />
      ) : overviewLoading ? (
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
              {filters.compare && !overviewPreviousLoading && (
                <DeltaBadge current={totalRevenue} previous={previousRevenue} />
              )}
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
              {filters.compare && !overviewPreviousLoading && (
                <DeltaBadge current={totalLeads} previous={previousLeads} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Leads Convertidos</div>
              <div className="text-2xl font-bold">{formatNumber(convertedLeads)}</div>
              <div className="text-xs text-muted-foreground mt-1">{conversionRate.toFixed(1)}% tasa de conversión</div>
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
                  <div className="text-2xl font-bold text-yellow-600">{formatNumber(overview.stockReservedCount)}</div>
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
            {salesError ? (
              <SectionError message="No se pudo cargar el gráfico de ventas" onRetry={() => refetchSales()} />
            ) : salesLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando...</div>
            ) : salesData?.salesCreated && salesData.salesCreated.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesData.salesCreated}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString('es-AR')} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Ventas" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">No hay datos de ventas</div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue por Día</CardTitle>
          </CardHeader>
          <CardContent>
            {salesError ? (
              <SectionError message="No se pudo cargar el gráfico de revenue" onRetry={() => refetchSales()} />
            ) : salesLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando...</div>
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
              <div className="h-64 flex items-center justify-center text-muted-foreground">No hay datos de revenue</div>
            )}
          </CardContent>
        </Card>

        {/* Leads by Stage */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsError ? (
              <SectionError message="No se pudo cargar el gráfico de leads" onRetry={() => refetchLeads()} />
            ) : leadsLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando...</div>
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
              <div className="h-64 flex items-center justify-center text-muted-foreground">No hay datos de leads</div>
            )}
          </CardContent>
        </Card>

        {/* Sales by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewError ? (
              <SectionError message="No se pudo cargar el gráfico de ventas por estado" onRetry={() => refetchOverview()} />
            ) : overviewLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">Cargando...</div>
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
              <div className="h-64 flex items-center justify-center text-muted-foreground">No hay datos de ventas</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewError ? (
              <div className="text-sm text-muted-foreground">No se pudo cargar</div>
            ) : overviewLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : overview?.topProductsByVolume && overview.topProductsByVolume.length > 0 ? (
              <div className="space-y-2">
                {overview.topProductsByVolume.slice(0, 5).map((product, idx) => (
                  <div key={idx} className="p-2 border rounded">
                    <div className="text-sm font-medium">{product.model}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.quantitySold} vendidos · {product.salesCount} ventas
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No hay productos todavía.</div>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
          </CardHeader>
          <CardContent>
            {salesError ? (
              <div className="text-sm text-muted-foreground">No se pudo cargar</div>
            ) : salesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : salesData?.topCustomers && salesData.topCustomers.length > 0 ? (
              <div className="space-y-2">
                {salesData.topCustomers.slice(0, 5).map((customer, idx) => (
                  <div key={idx} className="p-2 border rounded">
                    <div className="text-sm font-medium">{customer.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {customer.salesCount} ventas · {formatCurrency(parseFloat(customer.totalSpent))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No hay clientes todavía.</div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Leads por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsError ? (
              <div className="text-sm text-muted-foreground">No se pudo cargar</div>
            ) : leadsLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : leadsData?.assignedLeadsCount && leadsData.assignedLeadsCount.length > 0 ? (
              <div className="space-y-2">
                {leadsData.assignedLeadsCount.slice(0, 5).map((assigned, idx) => (
                  <div key={idx} className="p-2 border rounded">
                    <div className="text-sm font-medium">{assigned.userName || assigned.userEmail}</div>
                    <div className="text-xs text-muted-foreground">{assigned.count} leads</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No hay leads asignados todavía.</div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {stockError ? (
              <div className="text-sm text-muted-foreground">No se pudo cargar</div>
            ) : stockLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : stockData?.lowStock && stockData.lowStock.length > 0 ? (
              <div className="space-y-2">
                {stockData.lowStock.slice(0, 5).map((item) => (
                  <div key={item.id} className="p-2 border rounded">
                    <div className="text-sm font-medium">{item.model}</div>
                    <div className="text-xs text-muted-foreground">
                      Cantidad: {item.quantity} · {item.location || 'Sin ubicación'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No hay alertas de stock bajo.</div>
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
                    <div className="text-sm font-medium">{reservation.stockItem?.model || 'N/A'}</div>
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
