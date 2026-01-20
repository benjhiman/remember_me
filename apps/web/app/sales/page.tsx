'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useSales } from '@/lib/api/hooks/use-sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/lead-utils';
import { getStatusColor, getStatusLabel } from '@/lib/utils/sales-utils';
import type { SaleStatus } from '@/types/sales';

export default function SalesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
            <p className="text-gray-600">Gestión de ventas</p>
          </div>
          <Button onClick={() => router.push('/sales/new')}>Nueva Venta</Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Búsqueda</label>
                <Input
                  placeholder="Número, cliente, email, teléfono..."
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
                    setStatusFilter(e.target.value as SaleStatus | undefined);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="DRAFT">Borrador</option>
                  <option value="RESERVED">Reservado</option>
                  <option value="PAID">Pagado</option>
                  <option value="SHIPPED">Enviado</option>
                  <option value="DELIVERED">Entregado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter(undefined);
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
              <div className="p-8 text-center text-gray-500">Cargando ventas...</div>
            )}

            {error && (
              <div className="p-8 text-center text-red-500">
                <p>Error al cargar ventas: {(error as Error).message}</p>
                <Button onClick={() => refetch()} className="mt-4">
                  Reintentar
                </Button>
              </div>
            )}

            {data && data.data.length === 0 && !isLoading && !error && (
              <div className="p-8 text-center text-gray-500">
                <p>No hay ventas para mostrar.</p>
                <Button onClick={() => router.push('/sales/new')} className="mt-4">
                  Crear Primera Venta
                </Button>
              </div>
            )}

            {data && data.data.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Número / ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Lead
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cliente
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Moneda
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Creada
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.data.map((sale) => (
                        <tr
                          key={sale.id}
                          onClick={() => router.push(`/sales/${sale.id}`)}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {sale.saleNumber || sale.id}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {sale.lead ? (
                              <div
                                className="text-sm text-blue-600 hover:underline cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/leads/${sale.leadId}`);
                                }}
                              >
                                {sale.lead.name}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">—</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {sale.customerName}
                            </div>
                            {sale.customerEmail && (
                              <div className="text-sm text-gray-500">{sale.customerEmail}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                sale.status
                              )}`}
                            >
                              {getStatusLabel(sale.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {sale.total}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sale.currency}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(sale.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.meta.totalPages > 1 && (
                  <div className="p-4 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Mostrando {data.data.length} de {data.meta.total} ventas
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
    </div>
  );
}
