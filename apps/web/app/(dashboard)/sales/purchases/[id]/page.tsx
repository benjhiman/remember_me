'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { usePurchase } from '@/lib/api/hooks/use-purchase';
import { useTransitionPurchase } from '@/lib/api/hooks/use-purchase-mutations';
import { usePurchaseStockImpact } from '@/lib/api/hooks/use-purchase-stock-impact';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/lead-utils';
import { formatCurrency, getPurchaseStatusLabel, getPurchaseStatusColor } from '@/lib/utils/purchase-utils';
import { ArrowLeft, CheckCircle, XCircle, Package, Warehouse, ExternalLink } from 'lucide-react';
import type { PurchaseStatus } from '@/lib/api/hooks/use-purchases';

export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const { data: purchase, isLoading, error } = usePurchase(params.id, !!user);
  const transitionPurchase = useTransitionPurchase();
  const { data: stockImpact, isLoading: stockImpactLoading } = usePurchaseStockImpact(
    purchase?.id || null,
  );

  const handleTransition = async (newStatus: PurchaseStatus) => {
    if (!purchase) return;
    try {
      await transitionPurchase.mutateAsync({
        id: purchase.id,
        dto: { status: newStatus },
      });
      // If transitioning to RECEIVED, show toast about stock update
      if (newStatus === 'RECEIVED') {
        // Toast will be shown by mutation hook
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const breadcrumbs = [
    { label: 'Ventas', href: '/sales' },
    { label: 'Compras', href: '/sales/purchases' },
    { label: purchase ? `Compra ${purchase.id.slice(-8).toUpperCase()}` : '...', href: '#' },
  ];

  const actions = (
    <>
      {purchase && purchase.status === 'DRAFT' && can('purchases.write') && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/sales/purchases/${purchase.id}/edit`)}
        >
          Editar
        </Button>
      )}
      {purchase && purchase.status === 'DRAFT' && can('purchases.write') && (
        <Button size="sm" onClick={() => handleTransition('APPROVED')} disabled={transitionPurchase.isPending}>
          <CheckCircle className="h-4 w-4 mr-1.5" />
          Aprobar
        </Button>
      )}
      {purchase && purchase.status === 'APPROVED' && can('purchases.write') && (
        <Button size="sm" onClick={() => handleTransition('RECEIVED')} disabled={transitionPurchase.isPending}>
          <Package className="h-4 w-4 mr-1.5" />
          Marcar Recibida
        </Button>
      )}
      {purchase &&
        purchase.status !== 'RECEIVED' &&
        purchase.status !== 'CANCELLED' &&
        can('purchases.write') && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleTransition('CANCELLED')}
            disabled={transitionPurchase.isPending}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            Cancelar
          </Button>
        )}
    </>
  );

  if (isLoading) {
    return (
      <PageShell title="Cargando..." breadcrumbs={breadcrumbs}>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    );
  }

  if (error || !purchase) {
    return (
      <PageShell title="Error" breadcrumbs={breadcrumbs}>
        <div className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <p className="text-red-600 font-medium mb-2">Error al cargar la compra</p>
            <p className="text-sm text-gray-600 mb-4">
              {(error as Error)?.message || 'No se pudo conectar con el servidor'}
            </p>
            <Button onClick={() => router.push('/sales/purchases')} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Volver a Compras
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const purchaseTitle = `Compra ${purchase.id.slice(-8).toUpperCase()}`;
  
  return (
    <PageShell title={purchaseTitle} breadcrumbs={breadcrumbs} actions={actions}>
      <div className="space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Información General</h2>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPurchaseStatusColor(
                    purchase.status,
                  )}`}
                >
                  {getPurchaseStatusLabel(purchase.status)}
                </span>
              </div>
              <p className="text-sm text-gray-600">Creada el {formatDate(purchase.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Proveedor</label>
              <p className="text-sm font-medium text-gray-900 mt-1">{purchase.vendor.name}</p>
              {purchase.vendor.email && (
                <p className="text-xs text-gray-600 mt-0.5">{purchase.vendor.email}</p>
              )}
              {purchase.vendor.phone && (
                <p className="text-xs text-gray-600">{purchase.vendor.phone}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Creada por</label>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {purchase.createdBy?.name || purchase.createdBy?.email || 'N/A'}
              </p>
            </div>
          </div>

          {purchase.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="text-xs font-medium text-gray-500 uppercase">Notas</label>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{purchase.notes}</p>
            </div>
          )}

          {/* Status History */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Historial</label>
            <div className="space-y-1 text-xs text-gray-600">
              {purchase.approvedAt && (
                <p>
                  <span className="font-medium">Aprobada:</span> {formatDate(purchase.approvedAt)}
                </p>
              )}
              {purchase.receivedAt && (
                <p>
                  <span className="font-medium">Recibida:</span> {formatDate(purchase.receivedAt)}
                </p>
              )}
              {purchase.cancelledAt && (
                <p>
                  <span className="font-medium">Cancelada:</span> {formatDate(purchase.cancelledAt)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Lines Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Líneas de Compra</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cantidad
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Precio Unit.
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {purchase.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{line.description}</div>
                    {line.sku && (
                      <div className="text-xs text-gray-500 mt-0.5">SKU: {line.sku}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">{line.quantity}</td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">
                    {formatCurrency(line.unitPriceCents)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {formatCurrency(line.lineTotalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(purchase.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Impuestos:</span>
                <span>{formatCurrency(purchase.taxCents)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span>{formatCurrency(purchase.totalCents)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stock Impact Panel */}
        {purchase.status === 'RECEIVED' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">Impacto en Stock</h3>
              </div>
              {stockImpact?.isApplied && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Aplicado
                </span>
              )}
              {!stockImpact?.isApplied && !stockImpactLoading && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  No aplicado
                </span>
              )}
            </div>

            {stockImpactLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : stockImpact?.isApplied ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Aplicado el:</span>{' '}
                    {stockImpact.appliedAt ? formatDate(stockImpact.appliedAt) : 'N/A'}
                  </p>
                  {stockImpact.totalMovements > 0 && (
                    <p className="mt-1">
                      <span className="font-medium">Movimientos creados:</span> {stockImpact.totalMovements}
                    </p>
                  )}
                </div>
                {stockImpact.totalMovements > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/stock')}
                    className="mt-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Ver movimientos de stock
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                <p>Esta compra aún no ha impactado el stock.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
