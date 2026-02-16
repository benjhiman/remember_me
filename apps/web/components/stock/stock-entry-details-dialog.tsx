'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useStockEntryDetails } from '@/lib/api/hooks/use-stock-entry-details';
import { formatDate } from '@/lib/utils/lead-utils';
import { Loader2, Package } from 'lucide-react';
import { useState } from 'react';

interface StockEntryDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementId: string | null;
}

export function StockEntryDetailsDialog({ open, onOpenChange, movementId }: StockEntryDetailsDialogProps) {
  const [expandedImeis, setExpandedImeis] = useState<Set<string>>(new Set());
  
  const { data, isLoading, error } = useStockEntryDetails(movementId, open);

  const toggleImeis = (itemId: string) => {
    setExpandedImeis((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de Movimiento</DialogTitle>
          <DialogDescription>
            Información completa de la operación de stock
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <p className="text-red-600 font-medium mb-2">Error al cargar el detalle</p>
            <p className="text-sm text-gray-600">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && data && (
          <div className="space-y-6 py-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-500">Tipo</div>
                <div className="text-lg font-semibold">{data.type}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Cantidad</div>
                <div className="text-lg font-semibold">{data.quantity}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Fecha</div>
                <div className="text-sm">{formatDate(data.createdAt)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">Usuario</div>
                <div className="text-sm">{data.createdBy.name || data.createdBy.email}</div>
              </div>
              {data.reason && (
                <div className="col-span-2">
                  <div className="text-sm font-medium text-gray-500">Motivo</div>
                  <div className="text-sm">{data.reason}</div>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <div className="text-sm font-medium text-gray-500 mb-2">
                Items afectados ({data.totalItems})
              </div>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cantidad</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">IMEIs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.items.map((item) => (
                      <tr key={item.itemId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{item.itemName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.sku || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          {item.imeis.length > 0 ? (
                            <div>
                              <button
                                onClick={() => toggleImeis(item.itemId)}
                                className="text-primary hover:underline"
                              >
                                {item.imeis.length} IMEI{item.imeis.length !== 1 ? 's' : ''}
                              </button>
                              {expandedImeis.has(item.itemId) && (
                                <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono space-y-1">
                                  {item.imeis.map((imei, idx) => (
                                    <div key={idx}>{imei}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Total items:</span>
                <span>{data.totalItems}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Total cantidad:</span>
                <span>{data.totalQuantity}</span>
              </div>
              {data.totalImeis > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Total IMEIs:</span>
                  <span>{data.totalImeis}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
