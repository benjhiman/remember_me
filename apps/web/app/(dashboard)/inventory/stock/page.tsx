'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { useStockItemsInfinite } from '@/lib/api/hooks/use-stock-items-infinite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { VirtualizedStockTable } from '@/components/stock/virtualized-stock-table';
import { Permission, userCan } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Loader2, Package } from 'lucide-react';
import { formatDate } from '@/lib/utils/lead-utils';
import type { StockStatus, ItemCondition } from '@/types/stock';

export default function InventoryStockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatus | undefined>(undefined);
  const [conditionFilter, setConditionFilter] = useState<ItemCondition | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useStockItemsInfinite({
    search: search || undefined,
    status: statusFilter,
    condition: conditionFilter,
    limit: 50,
    enabled: !!user,
  });

  // Flatten pages into single array (memoized to avoid recalculation)
  const allItems = useMemo(() => data?.pages.flatMap((page) => page.data) || [], [data?.pages]);

  // Stable callbacks (must be before any early returns)
  const getStatusColor = useCallback((status: StockStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-green-100 text-green-800';
      case 'RESERVED':
        return 'bg-yellow-100 text-yellow-800';
      case 'SOLD':
        return 'bg-blue-100 text-blue-800';
      case 'DAMAGED':
        return 'bg-red-100 text-red-800';
      case 'RETURNED':
        return 'bg-purple-100 text-purple-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getStatusLabel = useCallback((status: StockStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return 'Disponible';
      case 'RESERVED':
        return 'Reservado';
      case 'SOLD':
        return 'Vendido';
      case 'DAMAGED':
        return 'Dañado';
      case 'RETURNED':
        return 'Devuelto';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status;
    }
  }, []);

  const getConditionLabel = useCallback((condition: ItemCondition) => {
    switch (condition) {
      case 'NEW':
        return 'Nuevo';
      case 'USED':
        return 'Usado';
      case 'REFURBISHED':
        return 'Reacondicionado';
      default:
        return condition;
    }
  }, []);

  const handleItemClick = useCallback(
    (item: any) => {
      router.push(`/inventory/stock/${item.id}`);
    },
    [router],
  );

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-items'] }),
        refetch(),
      ]);
      toast({
        variant: 'default',
        title: 'Stock actualizado',
        description: 'Los datos del stock se han refrescado.',
      });
    } catch (error) {
      console.error('Error refreshing stock:', error);
      toast({
        variant: 'destructive',
        title: 'Error al refrescar',
        description: 'No se pudieron cargar los datos del stock.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, refetch, toast]);

  useEffect(() => {
    perfMark('stock-page-mount');
  }, []);

  useEffect(() => {
    if (data && !isLoading) {
      perfMeasureToNow('stock-page-data-loaded', 'stock-page-mount');
    }
  }, [data, isLoading]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    // Check permission
    if (!userCan(user, Permission.VIEW_STOCK)) {
      router.push('/forbidden');
      return;
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Stock', href: '/inventory/stock' },
  ];

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
        {isRefreshing ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-1.5" />
        )}
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </Button>
      <Button size="sm" onClick={() => router.push('/inventory/reservas')}>
        Ver Reservas
      </Button>
    </div>
  );

  const toolbar = (
    <div className="flex items-center gap-3">
      <Input
        placeholder="Modelo, SKU, IMEI..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />
      <select
        className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        value={statusFilter || ''}
        onChange={(e) => {
          setStatusFilter(e.target.value as StockStatus | undefined);
        }}
      >
        <option value="">Todos los estados</option>
        <option value="AVAILABLE">Disponible</option>
        <option value="RESERVED">Reservado</option>
        <option value="SOLD">Vendido</option>
        <option value="DAMAGED">Dañado</option>
        <option value="RETURNED">Devuelto</option>
        <option value="CANCELLED">Cancelado</option>
      </select>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        value={conditionFilter || ''}
        onChange={(e) => {
          setConditionFilter(e.target.value as ItemCondition | undefined);
        }}
      >
        <option value="">Todas las condiciones</option>
        <option value="NEW">Nuevo</option>
        <option value="USED">Usado</option>
        <option value="REFURBISHED">Reacondicionado</option>
      </select>
      {(search || statusFilter || conditionFilter) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            setStatusFilter(undefined);
            setConditionFilter(undefined);
          }}
          className="h-9"
        >
          Limpiar
        </Button>
      )}
    </div>
  );

  return (
    <PageShell
      title="Stock"
      description="Gestión de inventario"
      breadcrumbs={breadcrumbs}
      actions={actions}
      toolbar={toolbar}
    >
      {isLoading && (
        <div className="p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {error && (
        <div className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <p className="text-red-600 font-medium mb-2">Error al cargar stock</p>
            <p className="text-sm text-gray-600 mb-4">{(error as Error).message}</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {allItems.length === 0 && !isLoading && !error && (
        <ZohoEmptyState
          title="No hay items en stock"
          headline="Start managing your inventory"
          description="Agregá items a tu inventario para comenzar a gestionar el stock."
          primaryActionLabel="AGREGAR ITEM"
          showDropdown
        />
      )}

      {allItems.length > 0 && (
        <>
          {allItems.length > 50 ? (
            // Use virtualized table for large lists
            <VirtualizedStockTable
              items={allItems}
              onItemClick={handleItemClick}
              getStatusColor={getStatusColor}
              getStatusLabel={getStatusLabel}
              getConditionLabel={getConditionLabel}
              formatDate={formatDate}
              onLoadMore={handleLoadMore}
              hasMore={hasNextPage}
              isLoadingMore={isFetchingNextPage}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="zoho-table">
                <thead>
                  <tr>
                    <th>Item / SKU</th>
                    <th>Condición</th>
                    <th>Cantidad Total</th>
                    <th>Reservado</th>
                    <th>Disponible</th>
                    <th>Estado</th>
                    <th>Última Actualización</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map((item) => {
                    const reserved = item.reservedQuantity || 0;
                    const available = item.availableQuantity ?? (item.quantity - reserved);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => router.push(`/inventory/stock/${item.id}`)}
                        className="hover:bg-gray-50 cursor-pointer"
                      >
                        <td>
                          <div className="text-sm font-medium text-gray-900">{item.model}</div>
                          {item.sku && <div className="text-sm text-gray-500">{item.sku}</div>}
                        </td>
                        <td className="text-sm text-gray-500">{getConditionLabel(item.condition)}</td>
                        <td className="text-sm text-gray-900">{item.quantity}</td>
                        <td className="text-sm text-yellow-600">{reserved}</td>
                        <td className="text-sm text-green-600 font-medium">{available}</td>
                        <td>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                              item.status
                            )}`}
                          >
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="text-sm text-gray-500">{formatDate(item.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Infinite loading indicator */}
          {hasNextPage && (
            <div className="p-4 border-t flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
              </Button>
            </div>
          )}
          {!hasNextPage && allItems.length > 0 && (
            <div className="p-4 border-t text-center text-sm text-gray-600">
              Mostrando {allItems.length} items
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
