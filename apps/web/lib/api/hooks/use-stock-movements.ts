import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { MovementListResponse, StockMovement, StockItem } from '@/types/stock';

interface UseStockMovementsParams {
  itemId: string | undefined;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useStockMovements(params: UseStockMovementsParams) {
  const { itemId, page = 1, limit = 50, enabled = true } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  return useQuery({
    queryKey: ['stock-movements', itemId, page, limit],
    queryFn: () => api.get<MovementListResponse>(`/stock/${itemId}/movements?${queryParams.toString()}`),
    enabled: enabled && !!itemId,
  });
}

interface AdjustStockData {
  quantityChange: number;
  reason: string;
  metadata?: Record<string, any>;
}

export function useAdjustStock(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AdjustStockData) =>
      api.post<StockItem>(`/stock/${itemId}/adjust`, data),
    onSuccess: () => {
      // Invalidate stock item and movements
      queryClient.invalidateQueries({ queryKey: ['stock-item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements', itemId] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    },
  });
}
