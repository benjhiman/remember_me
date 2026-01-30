import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

interface StockMovementsParams {
  itemId?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface StockMovementRow {
  id: string;
  type: string;
  qty: number;
  itemId: string | null;
  stockItemId: string;
  createdAt: string;
  ref: string | null;
  reason?: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface StockMovementsResponse {
  data: StockMovementRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function useStockMovementsGlobal(params: StockMovementsParams = {}) {
  const { itemId, type, from, to, page = 1, limit = 50, enabled = true } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (itemId) queryParams.set('itemId', itemId);
  if (type) queryParams.set('type', type);
  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);

  return useQuery({
    queryKey: ['stock-movements-global', params],
    queryFn: () => api.get<StockMovementsResponse>(`/stock/movements?${queryParams.toString()}`),
    enabled,
  });
}
