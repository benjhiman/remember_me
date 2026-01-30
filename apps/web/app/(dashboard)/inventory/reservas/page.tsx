'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import {
  useStockReservations,
  useCreateReservation,
  useReleaseReservation,
  useExtendReservation,
} from '@/lib/api/hooks/use-stock-reservations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/utils/lead-utils';
import { RefreshCw, Plus, Clock } from 'lucide-react';
import { CreateReservationDialog } from '@/components/stock/create-reservation-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-yellow-100 text-yellow-800';
    case 'CONFIRMED':
      return 'bg-green-100 text-green-800';
    case 'EXPIRED':
      return 'bg-red-100 text-red-800';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-800';
    case 'RELEASED':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Activa';
    case 'CONFIRMED':
      return 'Confirmada';
    case 'EXPIRED':
      return 'Expirada';
    case 'CANCELLED':
      return 'Cancelada';
    case 'RELEASED':
      return 'Liberada';
    default:
      return status;
  }
}

export default function InventoryReservasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [page, setPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);

  // Get itemId from query params if present
  const itemIdFromQuery = searchParams.get('itemId') || undefined;

  const { data, isLoading, error, refetch } = useStockReservations({
    q: search || undefined,
    status: statusFilter || undefined,
    itemId: itemIdFromQuery,
    page,
    limit: 50,
    enabled: !!user,
  });

  const createReservation = useCreateReservation();
  const releaseReservation = useReleaseReservation();
  const extendReservation = useExtendReservation();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-reservations'] }),
        refetch(),
      ]);
      toast({
        title: 'Actualizado',
        description: 'Las reservas se actualizaron correctamente',
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
  }, [queryClient, refetch, toast]);

  const handleReleaseReservation = useCallback(
    async (reservationId: string) => {
      try {
        await releaseReservation.mutateAsync(reservationId);
        toast({
          title: 'Reserva liberada',
          description: 'La reserva se liberó correctamente',
        });
        setReleasingId(null);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.message || 'No se pudo liberar la reserva',
        });
      }
    },
    [releaseReservation, toast],
  );

  const handleExtendReservation = useCallback(
    async (reservationId: string) => {
      try {
        await extendReservation.mutateAsync({ reservationId, hours: 24 });
        toast({
          title: 'Reserva extendida',
          description: 'La reserva se extendió 24 horas',
        });
        setExtendingId(null);
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.message || 'No se pudo extender la reserva',
        });
      }
    },
    [extendReservation, toast],
  );

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Reservas', href: '/inventory/reservas' },
  ];

  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
        <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        Actualizar
      </Button>
      <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Crear Reserva
      </Button>
    </div>
  );

  const toolbar = (
    <div className="flex items-center gap-3">
      <div className="flex-1 max-w-sm">
        <Input
          placeholder="Buscar por item, SKU, cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setPage(1);
        }}
      >
        <option value="">Todas</option>
        <option value="ACTIVE">Activas</option>
        <option value="RELEASED">Liberadas</option>
        <option value="EXPIRED">Expiradas</option>
        <option value="CONFIRMED">Confirmadas</option>
        <option value="CANCELLED">Canceladas</option>
      </select>
      {(search || statusFilter) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
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

  return (
    <>
      <PageShell
        title="Reservas"
        description="Gestiona las reservas de stock"
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
              <p className="text-red-600 font-medium mb-2">Error al cargar reservas</p>
              <p className="text-sm text-gray-600 mb-4">{(error as Error).message}</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {!isLoading && data && (
          <>
            {data.data.length === 0 ? (
              <div className="p-12 text-center">
                <div className="max-w-sm mx-auto">
                  <Plus className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">No hay reservas</h3>
                  <p className="text-xs text-gray-600 mb-4">
                    {search || statusFilter
                      ? 'No se encontraron reservas con los filtros aplicados.'
                      : 'Creá tu primera reserva para empezar.'}
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Crear Reserva
                  </Button>
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
                        Cantidad
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expira
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Creada
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.data.map((reservation: any) => {
                      const item = reservation.item || reservation.stockItem;
                      return (
                        <tr key={reservation.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {item?.name || item?.model || 'N/A'}
                            </div>
                            {item?.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{reservation.quantity}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                reservation.status
                              )}`}
                            >
                              {getStatusLabel(reservation.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {reservation.customerName || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {reservation.expiresAt ? formatDate(reservation.expiresAt) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(reservation.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                              {reservation.status === 'ACTIVE' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleExtendReservation(reservation.id)}
                                    disabled={extendReservation.isPending}
                                  >
                                    <Clock className="h-4 w-4 mr-1" />
                                    Extender
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setReleasingId(reservation.id)}
                                  >
                                    Liberar
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {data.meta.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando {((page - 1) * data.meta.limit) + 1} - {Math.min(page * data.meta.limit, data.meta.total)} de {data.meta.total}
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
                    disabled={page * data.meta.limit >= data.meta.total}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </PageShell>

      <CreateReservationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultItemId={itemIdFromQuery}
      />

      <AlertDialog open={!!releasingId} onOpenChange={(open) => !open && setReleasingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Liberar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción liberará la reserva y el stock volverá a estar disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={releaseReservation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => releasingId && handleReleaseReservation(releasingId)}
              disabled={releaseReservation.isPending}
            >
              {releaseReservation.isPending ? 'Liberando...' : 'Liberar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
