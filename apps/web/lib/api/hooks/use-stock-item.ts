import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { StockItem } from '@/types/stock';

export function useStockItem(itemId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['stock-item', itemId],
    queryFn: () => api.get<StockItem>(`/stock/item/${itemId}`),
    enabled: enabled && !!itemId,
  });
}
