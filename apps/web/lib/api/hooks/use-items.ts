import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';

export interface Item {
  id: string;
  organizationId: string;
  name: string;
  sku: string | null;
  category: string | null;
  brand: string | null;
  description: string | null;
  attributes: Record<string, any> | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemListResponse {
  data: Item[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface UseItemsParams {
  page?: number;
  limit?: number;
  q?: string;
  enabled?: boolean;
}

export function useItems(params: UseItemsParams = {}) {
  const { page = 1, limit = 20, enabled = true, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.q) queryParams.set('q', filters.q);

  return useQuery({
    queryKey: ['items', 'list', params],
    queryFn: () => api.get<ItemListResponse>(`/items?${queryParams.toString()}`),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useItem(itemId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['items', 'detail', itemId],
    queryFn: () => api.get<Item>(`/items/${itemId}`),
    enabled: enabled && !!itemId,
  });
}
