'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useSales } from '@/lib/api/hooks/use-sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/lead-utils';
import { getStatusColor, getStatusLabel } from '@/lib/utils/sales-utils';
import { Permission, userCan } from '@/lib/auth/permissions';
import { usePermissions } from '@/lib/auth/use-permissions';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { ShoppingCart, Plus, Search } from 'lucide-react';
import type { SaleStatus } from '@/types/sales';

export default function SalesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatus | undefined>(undefined);

  const { data, isLoading, error, refetch } = useSales({
    page,
    limit: 20,
    q: search || undefined,
    status: statusFilter,
    enabled: !!user,
  });

  useEffect(() => {
    perfMark('sales-page-mount');
  }, []);

  useEffect(() => {
    if (data && !isLoading) {
      perfMeasureToNow('sales-page-data-loaded', 'sales-page-mount');
    }
  }, [data, isLoading]);

  const breadcrumbs = [
    { label: 'Ventas', href: '/sales' },
  ];

  const actions = (
    <>
      {can('sales.write') && (
        <Button size="sm" onClick={() => router.push('/sales/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva Venta
        </Button>
      )}
    </>
  );

  const toolbar = (
    <div className="flex items-center gap-3">
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar ventas..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>
      <select
        className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={statusFilter || ''}
        onChange={(e) => {
          setStatusFilter(e.target.value as SaleStatus | undefined);
          setPage(1);
        }}
      >
        <option value="">Todos los estados</option>
        <option value="DRAFT">Borrador</option>
        <option value="PENDING">Pendiente</option>
        <option value="PAID">Pagado</option>
        <option value="DELIVERED">Entregado</option>
        <option value="CANCELLED">Cancelado</option>
      </select>
      {(search || statusFilter) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatusFilter(undefined);
            setSearch('');
            setPage(1);
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
      title="Ventas"
      description="Gestión de ventas"
      breadcrumbs={breadcrumbs}
      actions={actions}
      toolbar={toolbar}
    >
      <div className="zoho-card">
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
              <p className="text-red-600 font-medium mb-2">Error al cargar las ventas</p>
              <p className="text-sm text-gray-600 mb-4">{(error as Error).message || 'No se pudo conectar con el servidor'}</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {data && (
          <>
            {data.data.length === 0 ? (
              <div className="p-12 text-center">
                <div className="max-w-sm mx-auto">
                  <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {search || statusFilter ? 'No hay ventas con estos filtros' : 'No hay ventas'}
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">
                    {search || statusFilter
                      ? 'Intentá ajustar los filtros para ver más resultados.'
                      : 'Creá tu primera venta para empezar a gestionar transacciones.'}
                  </p>
                  {can('sales.write') && (
                    <Button onClick={() => router.push('/sales/new')} size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Nueva Venta
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="zoho-table">
                    <thead>
                      <tr>
                        <th>Número</th>
                        <th>Cliente</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Asignado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((sale) => (
                        <tr
                          key={sale.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/sales/${sale.id}`)}
                        >
                          <td>
                            <div className="text-sm font-medium text-gray-900">
                              {sale.saleNumber || sale.id.slice(0, 8)}
                            </div>
                          </td>
                          <td>
                            <div className="text-sm text-gray-900">{sale.customerName || '—'}</div>
                            {sale.customerEmail && (
                              <div className="text-xs text-gray-500">{sale.customerEmail}</div>
                            )}
                          </td>
                          <td className="text-sm font-medium text-gray-900">
                            ${parseFloat(sale.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td>
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(
                                sale.status
                              )}`}
                            >
                              {getStatusLabel(sale.status)}
                            </span>
                          </td>
                          <td className="text-sm text-gray-600">{formatDate(sale.createdAt)}</td>
                          <td className="text-sm text-gray-600">{sale.assignedTo?.name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data?.meta?.totalPages && data.meta.totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="text-sm text-gray-600">
                      Mostrando {data?.data?.length ?? 0} de {data?.meta?.total ?? 0} ventas
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
          </>
        )}
      </div>
    </PageShell>
  );
}
