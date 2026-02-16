import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

interface StockEntryDetailsResponse {
  id: string;
  type: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  metadata: any;
  items: Array<{
    itemId: string;
    itemName: string;
    sku: string | null;
    quantity: number;
    imeis: string[];
  }>;
  totalItems: number;
  totalQuantity: number;
  totalImeis: number;
}

export function useStockEntryDetails(movementId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['stock-entry-details', movementId],
    queryFn: () => api.get<StockEntryDetailsResponse>(`/stock/movements/${movementId}`),
    enabled: enabled && !!movementId,
  });
}
