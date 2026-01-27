'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useStockReservations, useReleaseReservation } from '@/lib/api/hooks/use-stock-reservations';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/lead-utils';
import { Permission, userCan } from '@/lib/auth/permissions';
import { Package, ArrowLeft } from 'lucide-react';
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

export default function InventoryReservasPage() {
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

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Reservas', href: '/inventory/reservas' },
  ];

  const actions = (
    <Button variant="outline" size="sm" onClick={() => router.push('/inventory/stock')}>
      <ArrowLeft className="h-4 w-4 mr-1.5" />
      Volver a Stock
    </Button>
  );

  const toolbar = (
    <div className="flex items-center gap-3">
      <select
        className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Todos los estados</option>
        <option value="ACTIVE">Activas</option>
        <option value="CONFIRMED">Confirmadas</option>
        <option value="EXPIRED">Expiradas</option>
        <option value="CANCELLED">Canceladas</option>
      </select>
      {statusFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatusFilter('');
            setPage(1);
          }}
          className="h-9"
        >
          Limpiar
        </Button>
      )}
    </div>
  );

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
    <PageShell
      title="Reservas de Stock"
      description="Gestión de reservas de inventario"
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
              <p className="text-red-600 font-medium mb-2">Error al cargar reservas</p>
              <p className="text-sm text-gray-600 mb-4">{(error as Error).message}</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {data && data.data.length === 0 && !isLoading && !error && (
          <div className="p-12 text-center">
            <div className="max-w-sm mx-auto">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No hay reservas</h3>
              <p className="text-xs text-gray-600">
                {statusFilter ? 'No se encontraron reservas con el filtro aplicado.' : 'No hay reservas para mostrar.'}
              </p>
            </div>
          </div>
        )}

        {data && data.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="zoho-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Cantidad</th>
                    <th>Estado</th>
                    <th>Creada</th>
                    <th>Expira</th>
                    <th>Creada Por</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>
                        <div
                          className="text-sm font-medium text-blue-600 cursor-pointer hover:underline"
                          onClick={() => router.push(`/inventory/stock/${reservation.stockItemId}`)}
                        >
                          {reservation.stockItem?.model || 'N/A'}
                        </div>
                        {reservation.stockItem?.sku && (
                          <div className="text-xs text-gray-500">{reservation.stockItem.sku}</div>
                        )}
                      </td>
                      <td className="text-sm text-gray-900">{reservation.quantity}</td>
                      <td>
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(
                            reservation.status
                          )}`}
                        >
                          {getStatusLabel(reservation.status)}
                        </span>
                      </td>
                      <td className="text-sm text-gray-600">{formatDate(reservation.createdAt)}</td>
                      <td className="text-sm text-gray-600">
                        {reservation.expiresAt ? formatDate(reservation.expiresAt) : '—'}
                      </td>
                      <td className="text-sm text-gray-600">{reservation.createdBy?.name || '—'}</td>
                      <td>
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
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
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
      </div>
    </PageShell>
  );
}
