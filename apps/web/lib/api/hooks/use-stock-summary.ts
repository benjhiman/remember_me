import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

interface StockSummaryParams {
  q?: string;
  itemId?: string;
  condition?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

interface StockSummaryRow {
  itemId: string;
  itemName: string;
  sku?: string;
  brand?: string;
  model?: string;
  storageGb?: number;
  color?: string;
  condition?: string;
  availableQty: number;
  reservedQty: number;
  totalQty: number;
  lastInAt: string | null;
}

interface StockSummaryResponse {
  data: StockSummaryRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function useStockSummary(params: StockSummaryParams = {}) {
  const { q, itemId, condition, page = 1, limit = 20, enabled = true } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (q) queryParams.set('q', q);
  if (itemId) queryParams.set('itemId', itemId);
  if (condition) queryParams.set('condition', condition);

  return useQuery({
    queryKey: ['stock-summary', params],
    queryFn: () => api.get<StockSummaryResponse>(`/stock/summary?${queryParams.toString()}`),
    enabled,
  });
}
