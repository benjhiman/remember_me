'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { useStockSummary } from '@/lib/api/hooks/use-stock-summary';
import { useStockMovementsGlobal } from '@/lib/api/hooks/use-stock-movements-global';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Plus, Package, Eye } from 'lucide-react';
import { formatDate } from '@/lib/utils/lead-utils';
import { AddStockItemDialog } from '@/components/stock/add-stock-item-dialog';
import { conditionLabel } from '@/lib/items/condition-label';

type TabType = 'summary' | 'movements';

export default function InventoryStockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  const summaryParams = useMemo(
    () => ({
      q: search || undefined,
      condition: conditionFilter || undefined,
      page,
      limit: 20,
    }),
    [search, conditionFilter, page],
  );

  const { data: summaryData, isLoading: isLoadingSummary, refetch: refetchSummary } = useStockSummary({
    ...summaryParams,
    enabled: activeTab === 'summary' && !!user,
  });

  const movementsParams = useMemo(
    () => ({
      page,
      limit: 50,
    }),
    [page],
  );

  const { data: movementsData, isLoading: isLoadingMovements, refetch: refetchMovements } = useStockMovementsGlobal({
    ...movementsParams,
    enabled: activeTab === 'movements' && !!user,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements-global'] }),
        activeTab === 'summary' ? refetchSummary() : refetchMovements(),
      ]);
      toast({
        title: 'Actualizado',
        description: 'Los datos se actualizaron correctamente',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la lista',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, activeTab, refetchSummary, refetchMovements, toast]);

  const handleOpenCreate = useCallback(() => {
    setIsAddDialogOpen(true);
  }, []);

  const handleViewReservations = useCallback(
    (itemId: string) => {
      router.push(`/inventory/reservas?itemId=${itemId}`);
    },
    [router],
  );

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Stock', href: '/inventory/stock' },
  ];

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
        <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        Actualizar
      </Button>
      <Button size="sm" onClick={handleOpenCreate}>
        <Plus className="h-4 w-4 mr-1.5" />
        Agregar Stock
      </Button>
    </div>
  );

  const toolbar = (
    <div className="flex items-center gap-3">
      <div className="flex-1 max-w-sm">
        <Input
          placeholder="Buscar por nombre, SKU, categoría o marca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {activeTab === 'summary' && (
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={conditionFilter}
          onChange={(e) => {
            setConditionFilter(e.target.value);
            setPage(1); // Reset to first page when filter changes
          }}
        >
          <option value="">Todas las condiciones</option>
          <option value="NEW">Nuevo</option>
          <option value="USED">Usado</option>
          <option value="REFURBISHED">Reacondicionado</option>
          <option value="OEM">OEM</option>
        </select>
      )}
    </div>
  );

  return (
    <>
      <PageShell
        title="Stock"
        description="Gestiona tu inventario"
        breadcrumbs={breadcrumbs}
        actions={actions}
        toolbar={toolbar}
      >
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('summary')}
              className={`${
                activeTab === 'summary'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`${
                activeTab === 'movements'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Movimientos
            </button>
          </nav>
        </div>

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <>
            {isLoadingSummary && (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}

            {!isLoadingSummary && summaryData && (
              <>
                {summaryData.data.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="max-w-sm mx-auto">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      {search.trim() ? (
                        <>
                          <h3 className="text-sm font-semibold text-gray-900 mb-1">Sin resultados para tu búsqueda</h3>
                          <p className="text-xs text-gray-600 mb-4">
                            No se encontraron items que coincidan con &quot;{search}&quot;.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearch('');
                              setPage(1);
                            }}
                          >
                            Limpiar búsqueda
                          </Button>
                        </>
                      ) : (
                        <>
                          <h3 className="text-sm font-semibold text-gray-900 mb-1">Sin stock aún</h3>
                          <p className="text-xs text-gray-600 mb-4">
                            Agregá items a tu inventario para comenzar a gestionar el stock.
                          </p>
                          <Button onClick={handleOpenCreate} size="sm">
                            <Plus className="h-4 w-4 mr-1.5" />
                            Agregar Stock
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Disponible
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reservado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Último ingreso
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {summaryData.data.map((row) => (
                          <tr key={row.itemId} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">
                                {row.brand && `${row.brand} `}
                                {row.model || row.itemName}
                                {row.storageGb && ` ${row.storageGb}GB`}
                                {row.color && ` ${row.color}`}
                              </div>
                              <div className="text-xs text-gray-500">
                                {row.sku && `SKU: ${row.sku}`}
                                {row.condition && ` • ${conditionLabel(row.condition)}`}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-green-600 font-medium">{row.availableQty}</td>
                            <td className="px-4 py-3 text-sm text-yellow-600">{row.reservedQty}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{row.totalQty}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {row.lastInAt ? formatDate(row.lastInAt) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setIsAddDialogOpen(true);
                                    // TODO: Preload itemId in dialog
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Agregar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewReservations(row.itemId)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver Reservas
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Movements Tab */}
        {activeTab === 'movements' && (
          <>
            {isLoadingMovements && (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}

            {!isLoadingMovements && movementsData && (
              <>
                {movementsData.data.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="max-w-sm mx-auto">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">No hay movimientos</h3>
                      <p className="text-xs text-gray-600">Los movimientos de stock aparecerán aquí.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cantidad
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Motivo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuario
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {movementsData.data.map((movement) => (
                          <tr key={movement.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{movement.type}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{movement.qty}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{formatDate(movement.createdAt)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{movement.reason || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {movement.createdBy.name || movement.createdBy.email}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </PageShell>

      <AddStockItemDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </>
  );
}
