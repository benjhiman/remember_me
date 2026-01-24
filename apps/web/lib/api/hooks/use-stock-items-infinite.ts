import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { StockListResponse, StockStatus, ItemCondition } from '@/types/stock';

interface UseStockItemsInfiniteParams {
  search?: string;
  status?: StockStatus;
  condition?: ItemCondition;
  model?: string;
  location?: string;
  limit?: number;
  enabled?: boolean;
}

export function useStockItemsInfinite(params: UseStockItemsInfiniteParams = {}) {
  const { limit = 50, enabled = true, ...filters } = params;

  return useInfiniteQuery<StockListResponse, Error, StockListResponse, string[], number>({
    queryKey: ['stock-items-infinite', params],
    queryFn: ({ pageParam = 1 }: { pageParam: number }) => {
      const queryParams = new URLSearchParams({
        page: pageParam.toString(),
        limit: limit.toString(),
      });

      if (filters.search) queryParams.set('search', filters.search);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.condition) queryParams.set('condition', filters.condition);
      if (filters.model) queryParams.set('model', filters.model);
      if (filters.location) queryParams.set('location', filters.location);

      return api.get<StockListResponse>(`/stock?${queryParams.toString()}`);
    },
    getNextPageParam: (lastPage) => {
      const { meta } = lastPage;
      if (meta.page < meta.totalPages) {
        return meta.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
