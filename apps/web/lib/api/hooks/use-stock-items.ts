import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { StockListResponse, StockStatus, ItemCondition } from '@/types/stock';

interface UseStockItemsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: StockStatus;
  condition?: ItemCondition;
  model?: string;
  location?: string;
  enabled?: boolean;
}

export function useStockItems(params: UseStockItemsParams = {}) {
  const { page = 1, limit = 20, enabled = true, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.search) queryParams.set('search', filters.search);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.condition) queryParams.set('condition', filters.condition);
  if (filters.model) queryParams.set('model', filters.model);
  if (filters.location) queryParams.set('location', filters.location);

  return useQuery({
    queryKey: ['stock-items', params],
    queryFn: () => api.get<StockListResponse>(`/stock?${queryParams.toString()}`),
    enabled,
  });
}
