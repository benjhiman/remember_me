'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useStockReservations, useReleaseReservation } from '@/lib/api/hooks/use-stock-reservations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/lead-utils';
import { Permission, userCan } from '@/lib/auth/permissions';
import type { ReservationStatus } from '@/types/stock';

function getStatusColor(status: ReservationStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-yellow-100 text-yellow-800';
    case 'CONFIRMED':
      return 'bg-green-100 text-green-800';
    case 'EXPIRED':
      return 'bg-red-100 text-red-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusLabel(status: ReservationStatus) {
  switch (status) {
    case 'ACTIVE':
      return 'Activa';
    case 'CONFIRMED':
      return 'Confirmada';
    case 'EXPIRED':
      return 'Expirada';
    case 'CANCELLED':
      return 'Cancelada';
    default:
      return status;
  }
}

export default function StockReservationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useStockReservations({
    status: statusFilter,
    page,
    limit: 20,
    enabled: !!user,
  });

  const releaseReservation = useReleaseReservation();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const handleReleaseReservation = async (reservationId: string) => {
    if (!confirm('¿Estás seguro de que quieres liberar esta reserva?')) {
      return;
    }

    try {
      await releaseReservation.mutateAsync(reservationId);
    } catch (error) {
      console.error('Error releasing reservation:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reservas de Stock</h1>
            <p className="text-gray-600">Gestión de reservas de inventario</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/stock')}>
            Volver a Stock
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="ACTIVE">Activas</option>
                  <option value="CONFIRMED">Confirmadas</option>
                  <option value="EXPIRED">Expiradas</option>
                  <option value="CANCELLED">Canceladas</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter('');
                    setPage(1);
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reservations List */}
        <Card>
          <CardContent className="p-0">
            {isLoading && (
              <div className="p-8 text-center text-gray-500">Cargando reservas...</div>
            )}

            {error && (
              <div className="p-8 text-center text-red-500">
                <p>Error al cargar reservas: {(error as Error).message}</p>
                <Button onClick={() => refetch()} className="mt-4">
                  Reintentar
                </Button>
              </div>
            )}

            {data && data.data.length === 0 && !isLoading && !error && (
              <div className="p-8 text-center text-gray-500">
                <p>No hay reservas para mostrar.</p>
              </div>
            )}

            {data && data.data.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cantidad
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Creada
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Expira
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Creada Por
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.data.map((reservation) => (
                        <tr key={reservation.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div
                              className="text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                              onClick={() => router.push(`/stock/${reservation.stockItemId}`)}
                            >
                              {reservation.stockItem?.model || 'N/A'}
                            </div>
                            {reservation.stockItem?.sku && (
                              <div className="text-sm text-gray-500">
                                {reservation.stockItem.sku}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {reservation.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                reservation.status
                              )}`}
                            >
                              {getStatusLabel(reservation.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(reservation.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {reservation.expiresAt ? formatDate(reservation.expiresAt) : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {reservation.createdBy?.name || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {reservation.status === 'ACTIVE' && userCan(user, Permission.EDIT_STOCK) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReleaseReservation(reservation.id)}
                                disabled={releaseReservation.isPending}
                              >
                                {releaseReservation.isPending ? 'Liberando...' : 'Liberar'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data?.meta?.totalPages && data.meta.totalPages > 1 && (
                  <div className="p-4 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Mostrando {data?.data?.length ?? 0} de {data?.meta?.total ?? 0} reservas
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
