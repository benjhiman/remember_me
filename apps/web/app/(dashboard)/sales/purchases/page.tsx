'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { usePurchases, type PurchaseStatus } from '@/lib/api/hooks/use-purchases';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/lead-utils';
import { formatCurrency, getPurchaseStatusLabel, getPurchaseStatusColor } from '@/lib/utils/purchase-utils';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { Plus, Search, Eye, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

export default function PurchasesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | undefined>(undefined);

  const { data, isLoading, error, refetch } = usePurchases({
    page,
    limit: 20,
    q: search || undefined,
    status: statusFilter,
    enabled: !!user,
  });

  useEffect(() => {
    perfMark('purchases-page-mount');
  }, []);

  useEffect(() => {
    if (data && !isLoading) {
      perfMeasureToNow('purchases-page-data-loaded', 'purchases-page-mount');
    }
  }, [data, isLoading]);

  const breadcrumbs = [
    { label: 'Ventas', href: '/sales' },
    { label: 'Compras', href: '/sales/purchases' },
  ];

  const actions = (
    <>
      {can('purchases.write') && (
        <Button size="sm" onClick={() => router.push('/sales/purchases/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva Compra
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
            placeholder="Buscar por número o proveedor..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>
      <select
        value={statusFilter || ''}
        onChange={(e) => {
          setStatusFilter(e.target.value as PurchaseStatus | undefined);
          setPage(1);
        }}
        className="px-3 py-1.5 text-sm border rounded-md bg-white"
      >
        <option value="">Todos los estados</option>
        <option value="DRAFT">Borrador</option>
        <option value="APPROVED">Aprobada</option>
        <option value="RECEIVED">Recibida</option>
        <option value="CANCELLED">Cancelada</option>
      </select>
    </div>
  );

  return (
    <PageShell
      title="Compras"
      description="Gestiona tus compras y órdenes de compra"
      breadcrumbs={breadcrumbs}
      actions={actions}
      toolbar={toolbar}
    >
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <p className="text-red-600 font-medium mb-2">Error al cargar las compras</p>
            <p className="text-sm text-gray-600 mb-4">
              {(error as Error).message || 'No se pudo conectar con el servidor'}
            </p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {data && (
        <>
          {data.items.length === 0 ? (
            <div className="p-12 text-center">
              <div className="max-w-sm mx-auto">
                <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {search || statusFilter ? 'No hay compras con estos filtros' : 'No hay compras'}
                </h3>
                <p className="text-xs text-gray-600 mb-4">
                  {search || statusFilter
                    ? 'Intentá ajustar los filtros para ver más resultados.'
                    : 'Creá tu primera compra para empezar a gestionar órdenes de compra.'}
                </p>
                {can('purchases.write') && (
                  <Button onClick={() => router.push('/sales/purchases/new')} size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Nueva Compra
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Compra #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Proveedor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actualizado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.items.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {purchase.id.slice(-8).toUpperCase()}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{purchase.vendor.name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPurchaseStatusColor(
                              purchase.status,
                            )}`}
                          >
                            {getPurchaseStatusLabel(purchase.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(purchase.totalCents)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(purchase.updatedAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/sales/purchases/${purchase.id}`}
                            className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.total > data.limit && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Mostrando {((page - 1) * data.limit) + 1} - {Math.min(page * data.limit, data.total)} de{' '}
                    {data.total}
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
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * data.limit >= data.total}
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
    </PageShell>
  );
}
