import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useMemo } from 'react';
import { useDebounce } from '@/lib/hooks/use-debounce';

export interface Item {
  id: string;
  organizationId: string;
  name: string;
  sku: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  storageGb: number | null;
  condition: 'NEW' | 'USED' | 'REFURBISHED' | 'OEM' | null;
  color: string | null;
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

interface UseItemSearchParams {
  q?: string;
  limit?: number;
  enabled?: boolean;
}

export function useItemSearch(params: UseItemSearchParams = {}) {
  const { q = '', limit = 20, enabled = true } = params;
  
  // Debounce search query
  const debouncedQ = useDebounce(q, 300);

  return useInfiniteQuery({
    queryKey: ['items', 'search', debouncedQ, limit],
    queryFn: async ({ pageParam = 1 }) => {
      const queryParams = new URLSearchParams({
        page: pageParam.toString(),
        limit: limit.toString(),
      });
      
      // Always send q, even if empty (to get initial items)
      queryParams.set('q', debouncedQ);

      const response = await api.get<ItemListResponse>(`/items?${queryParams.toString()}`);
      return {
        ...response,
        nextPage: response.meta.page < response.meta.totalPages ? response.meta.page + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    initialPageParam: 1,
  });
}

// Helper to flatten all pages into a single array
export function useItemSearchFlattened(params: UseItemSearchParams = {}) {
  const query = useItemSearch(params);
  
  const items = useMemo(() => {
    return query.data?.pages.flatMap((page) => page.data) || [];
  }, [query.data]);

  return {
    ...query,
    items,
  };
}
