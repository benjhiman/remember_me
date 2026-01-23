'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStockItem } from '@/lib/api/hooks/use-stock-item';
import { useStockMovements, useAdjustStock } from '@/lib/api/hooks/use-stock-movements';
import { useStockReservations, useReleaseReservation } from '@/lib/api/hooks/use-stock-reservations';
import { formatDate } from '@/lib/utils/lead-utils';
import { Permission, userCan } from '@/lib/auth/permissions';
import type { StockStatus, ItemCondition, MovementType } from '@/types/stock';

function getStatusColor(status: StockStatus) {
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
}

function getStatusLabel(status: StockStatus) {
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
}

function getConditionLabel(condition: ItemCondition) {
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
}

function getMovementTypeLabel(type: MovementType) {
  switch (type) {
    case 'IN':
      return 'Entrada';
    case 'OUT':
      return 'Salida';
    case 'ADJUST':
      return 'Ajuste';
    case 'RESERVE':
      return 'Reserva';
    case 'RELEASE':
      return 'Liberación';
    case 'SOLD':
      return 'Vendido';
    default:
      return type;
  }
}

export default function StockItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.id as string;
  const { user } = useAuthStore();

  const { data: item, isLoading: itemLoading, error: itemError } = useStockItem(itemId);
  const { data: movementsData, isLoading: movementsLoading } = useStockMovements({
    itemId,
    limit: 100,
  });
  const { data: reservationsData, isLoading: reservationsLoading } = useStockReservations({
    itemId,
    status: 'ACTIVE',
  });

  const adjustStock = useAdjustStock(itemId);
  const releaseReservation = useReleaseReservation();

  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (itemLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Cargando item...</p>
        </div>
      </div>
    );
  }

  if (itemError || !item) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Error</h1>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">
              {(itemError as Error)?.message || 'Item no encontrado'}
            </p>
            <Button onClick={() => router.push('/stock')} variant="outline" className="mt-4">
              Volver a Stock
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const reserved = item.reservedQuantity || 0;
  const available = item.availableQuantity ?? (item.quantity - reserved);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustQuantity || !adjustReason.trim()) return;

    const quantityChange = parseInt(adjustQuantity, 10);
    if (isNaN(quantityChange) || quantityChange === 0) return;

    try {
      await adjustStock.mutateAsync({
        quantityChange,
        reason: adjustReason.trim(),
      });
      setAdjustQuantity('');
      setAdjustReason('');
    } catch (error) {
      console.error('Error adjusting stock:', error);
    }
  };

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
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Button variant="ghost" onClick={() => router.push('/stock')} className="mb-2">
              ← Volver a Stock
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{item.model}</h1>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                  item.status
                )}`}
              >
                {getStatusLabel(item.status)}
              </span>
            </div>
            <div className="text-gray-600 space-y-1">
              {item.sku && <div>SKU: {item.sku}</div>}
              <div>Condición: {getConditionLabel(item.condition)}</div>
              {item.location && <div>Ubicación: {item.location}</div>}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Cantidad Total</div>
              <div className="text-2xl font-bold">{item.quantity}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Reservado</div>
              <div className="text-2xl font-bold text-yellow-600">{reserved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Disponible</div>
              <div className="text-2xl font-bold text-green-600">{available}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Movements */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Movimientos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create Movement Form */}
                {userCan(user, Permission.EDIT_STOCK) && (
                  <form onSubmit={handleAdjustStock} className="space-y-2 border-b pb-4">
                    <div className="text-sm font-medium mb-2">Ajustar Stock</div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Cantidad (+/-)"
                        value={adjustQuantity}
                        onChange={(e) => setAdjustQuantity(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <Input
                      placeholder="Motivo del ajuste (requerido)"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      required
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={adjustStock.isPending || !adjustQuantity || !adjustReason.trim()}
                    >
                      {adjustStock.isPending ? 'Ajustando...' : 'Ajustar'}
                    </Button>
                    {adjustStock.isError && (
                      <p className="text-sm text-red-600">
                        Error: {(adjustStock.error as Error)?.message || 'Error al ajustar stock'}
                      </p>
                    )}
                  </form>
                )}

                {/* Movements List */}
                {movementsLoading ? (
                  <div className="text-sm text-gray-500">Cargando movimientos...</div>
                ) : movementsData && movementsData.data.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {movementsData.data.map((movement) => (
                      <div
                        key={movement.id}
                        className="border-l-2 border-gray-200 pl-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            {getMovementTypeLabel(movement.type)}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatDate(movement.createdAt)}
                          </span>
                        </div>
                        <div className="text-gray-600">
                          Cantidad: {movement.quantity > 0 ? '+' : ''}
                          {movement.quantity} ({movement.quantityBefore} → {movement.quantityAfter})
                        </div>
                        {movement.reason && (
                          <div className="text-gray-500 text-xs mt-1">{movement.reason}</div>
                        )}
                        {movement.createdBy && (
                          <div className="text-gray-500 text-xs mt-1">
                            Por: {movement.createdBy.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No hay movimientos aún</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Reservations */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Reservas Activas</CardTitle>
              </CardHeader>
              <CardContent>
                {reservationsLoading ? (
                  <div className="text-sm text-gray-500">Cargando reservas...</div>
                ) : reservationsData && reservationsData.data.length > 0 ? (
                  <div className="space-y-3">
                    {reservationsData.data.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="border rounded-lg p-3 hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm">
                              Cantidad: {reservation.quantity}
                            </div>
                            {reservation.notes && (
                              <div className="text-xs text-gray-600 mt-1">
                                {reservation.notes}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              Creada: {formatDate(reservation.createdAt)}
                            </div>
                            {reservation.expiresAt && (
                              <div className="text-xs text-gray-500">
                                Expira: {formatDate(reservation.expiresAt)}
                              </div>
                            )}
                          </div>
                          {userCan(user, Permission.EDIT_STOCK) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReleaseReservation(reservation.id)}
                              disabled={releaseReservation.isPending}
                            >
                              {releaseReservation.isPending ? 'Liberando...' : 'Liberar'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No hay reservas activas</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
