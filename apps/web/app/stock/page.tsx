'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useStockItems } from '@/lib/api/hooks/use-stock-items';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/lead-utils';
import { Permission, userCan } from '@/lib/auth/permissions';
import { Skeleton } from '@/components/ui/skeleton';
import type { StockStatus, ItemCondition } from '@/types/stock';

export default function StockPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockStatus | undefined>(undefined);
  const [conditionFilter, setConditionFilter] = useState<ItemCondition | undefined>(undefined);

  const { data, isLoading, error, refetch } = useStockItems({
    page,
    limit: 20,
    search: search || undefined,
    status: statusFilter,
    condition: conditionFilter,
    enabled: !!user,
  });

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

  const getStatusColor = (status: StockStatus) => {
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
  };

  const getStatusLabel = (status: StockStatus) => {
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
  };

  const getConditionLabel = (condition: ItemCondition) => {
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
  };

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Stock</h1>
            <p className="text-muted-foreground">Gestión de inventario</p>
          </div>
          <Button onClick={() => router.push('/stock/reservations')}>
            Ver Reservas
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Búsqueda</label>
                <Input
                  placeholder="Modelo, SKU, IMEI..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={statusFilter || ''}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as StockStatus | undefined);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="AVAILABLE">Disponible</option>
                  <option value="RESERVED">Reservado</option>
                  <option value="SOLD">Vendido</option>
                  <option value="DAMAGED">Dañado</option>
                  <option value="RETURNED">Devuelto</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Condición</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={conditionFilter || ''}
                  onChange={(e) => {
                    setConditionFilter(e.target.value as ItemCondition | undefined);
                    setPage(1);
                  }}
                >
                  <option value="">Todas</option>
                  <option value="NEW">Nuevo</option>
                  <option value="USED">Usado</option>
                  <option value="REFURBISHED">Reacondicionado</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter(undefined);
                    setConditionFilter(undefined);
                    setPage(1);
                  }}
                  className="w-full"
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading && (
              <div className="p-4 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {error && (
              <div className="p-8 text-center text-red-500">
                <p>Error al cargar stock: {(error as Error).message}</p>
                <Button onClick={() => refetch()} className="mt-4">
                  Reintentar
                </Button>
              </div>
            )}

            {data && data.data.length === 0 && !isLoading && !error && (
              <div className="p-8 text-center text-gray-500">
                <p>No hay items en stock.</p>
              </div>
            )}

            {data && data.data.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item / SKU
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Condición
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cantidad Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reservado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Disponible
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Última Actualización
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.data.map((item) => {
                        const reserved = item.reservedQuantity || 0;
                        const available = item.availableQuantity ?? (item.quantity - reserved);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => router.push(`/stock/${item.id}`)}
                            className="hover:bg-gray-50 cursor-pointer"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {item.model}
                              </div>
                              {item.sku && (
                                <div className="text-sm text-gray-500">{item.sku}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {getConditionLabel(item.condition)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                              {reserved}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                              {available}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                  item.status
                                )}`}
                              >
                                {getStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(item.updatedAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data?.meta?.totalPages && data.meta.totalPages > 1 && (
                  <div className="p-4 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Mostrando {data?.data?.length ?? 0} de {data?.meta?.total ?? 0} items
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                        disabled={page === data.meta.totalPages}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
