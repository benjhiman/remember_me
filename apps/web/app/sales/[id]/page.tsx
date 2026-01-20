'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSale } from '@/lib/api/hooks/use-sale';
import { formatDate } from '@/lib/utils/lead-utils';
import { getStatusColor, getStatusLabel } from '@/lib/utils/sales-utils';

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const saleId = params.id as string;
  const { user } = useAuthStore();

  const { data: sale, isLoading, error } = useSale(saleId);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Cargando venta...</p>
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Error</h1>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">
              {(error as Error)?.message || 'Venta no encontrada'}
            </p>
            <Button onClick={() => router.push('/sales')} variant="outline" className="mt-4">
              Volver a Ventas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Button variant="ghost" onClick={() => router.push('/sales')} className="mb-2">
              ← Volver a Ventas
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">
                {sale.saleNumber || `Venta ${sale.id.slice(0, 8)}`}
              </h1>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                  sale.status
                )}`}
              >
                {getStatusLabel(sale.status)}
              </span>
            </div>
            <div className="text-gray-600 space-y-1">
              <div>Cliente: {sale.customerName}</div>
              {sale.customerEmail && <div>Email: {sale.customerEmail}</div>}
              {sale.customerPhone && <div>Teléfono: {sale.customerPhone}</div>}
              {sale.lead && (
                <div>
                  Lead:{' '}
                  <button
                    onClick={() => router.push(`/leads/${sale.leadId}`)}
                    className="text-blue-600 hover:underline"
                  >
                    {sale.lead.name}
                  </button>
                </div>
              )}
            </div>
          </div>
          <Button onClick={() => router.push(`/sales/${saleId}/edit`)}>Editar</Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Subtotal</div>
              <div className="text-2xl font-bold">{sale.subtotal}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Descuento</div>
              <div className="text-2xl font-bold text-red-600">-{sale.discount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600 mb-1">Total</div>
              <div className="text-2xl font-bold text-green-600">
                {sale.total} {sale.currency}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              {sale.items && sale.items.length > 0 ? (
                <div className="space-y-3">
                  {sale.items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="font-medium text-sm mb-1">{item.model}</div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <div>
                          Cantidad: {item.quantity} × {item.unitPrice} = {item.totalPrice}
                        </div>
                        {item.stockItem?.sku && <div>SKU: {item.stockItem.sku}</div>}
                        {item.stockItem?.imei && <div>IMEI: {item.stockItem.imei}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No hay items</div>
              )}
            </CardContent>
          </Card>

          {/* Reservations */}
          <Card>
            <CardHeader>
              <CardTitle>Reservas de Stock</CardTitle>
            </CardHeader>
            <CardContent>
              {sale.stockReservations && sale.stockReservations.length > 0 ? (
                <div className="space-y-2">
                  {sale.stockReservations.map((reservation) => (
                    <div key={reservation.id} className="border rounded-lg p-2 text-sm">
                      <div className="font-medium">{reservation.stockItem?.model || 'N/A'}</div>
                      <div className="text-xs text-gray-600">
                        Cantidad: {reservation.quantity} | Estado: {reservation.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500">No hay reservas</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {sale.notes && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{sale.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Dates */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Fechas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Creada:</div>
                <div className="font-medium">{formatDate(sale.createdAt)}</div>
              </div>
              {sale.reservedAt && (
                <div>
                  <div className="text-gray-600">Reservada:</div>
                  <div className="font-medium">{formatDate(sale.reservedAt)}</div>
                </div>
              )}
              {sale.paidAt && (
                <div>
                  <div className="text-gray-600">Pagada:</div>
                  <div className="font-medium">{formatDate(sale.paidAt)}</div>
                </div>
              )}
              {sale.shippedAt && (
                <div>
                  <div className="text-gray-600">Enviada:</div>
                  <div className="font-medium">{formatDate(sale.shippedAt)}</div>
                </div>
              )}
              {sale.deliveredAt && (
                <div>
                  <div className="text-gray-600">Entregada:</div>
                  <div className="font-medium">{formatDate(sale.deliveredAt)}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
