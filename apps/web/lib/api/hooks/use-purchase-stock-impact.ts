'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';

export interface PurchaseStockImpact {
  isApplied: boolean;
  appliedAt: string | null;
  appliedBy: string | null;
  movements: Array<{
    id: string;
    stockItemId: string;
    type: string;
    quantity: number;
    createdAt: string;
    reason: string | null;
  }>;
  totalMovements: number;
}

export function usePurchaseStockImpact(purchaseId: string | null) {
  return useQuery<PurchaseStockImpact>({
    queryKey: ['purchase', purchaseId, 'stock-impact'],
    queryFn: async () => {
      if (!purchaseId) throw new Error('Purchase ID is required');
      return api.get<PurchaseStockImpact>(`/purchases/${purchaseId}/stock-impact`);
    },
    enabled: !!purchaseId,
    staleTime: 30 * 1000, // 30s
  });
}
