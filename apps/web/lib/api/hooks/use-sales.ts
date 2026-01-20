import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { SaleListResponse, SaleStatus } from '@/types/sales';

interface UseSalesParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SaleStatus;
  createdFrom?: string;
  createdTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  enabled?: boolean;
}

export function useSales(params: UseSalesParams = {}) {
  const { page = 1, limit = 20, enabled = true, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.q) queryParams.set('q', filters.q);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.createdFrom) queryParams.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) queryParams.set('createdTo', filters.createdTo);
  if (filters.sort) queryParams.set('sort', filters.sort);
  if (filters.order) queryParams.set('order', filters.order);

  return useQuery({
    queryKey: ['sales', params],
    queryFn: () => api.get<SaleListResponse>(`/sales?${queryParams.toString()}`),
    enabled,
  });
}
