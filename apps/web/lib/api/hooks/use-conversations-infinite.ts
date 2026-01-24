import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { api } from '../client';
import { env } from '@/lib/config/env';
import type { ConversationListResponse, IntegrationProvider, ConversationStatus } from '@/types/api';

interface UseConversationsInfiniteParams {
  provider?: IntegrationProvider;
  status?: ConversationStatus;
  assignedToId?: string;
  tagId?: string;
  q?: string;
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number; // Polling interval in ms
}

export function useConversationsInfinite(params: UseConversationsInfiniteParams = {}) {
  const { limit = 50, enabled = true, refetchInterval, ...filters } = params;

  return useInfiniteQuery({
    queryKey: ['conversations-infinite', params] as const,
    queryFn: ({ pageParam }: { pageParam: number }) => {
      const page = pageParam ?? 1;
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.provider) queryParams.set('provider', filters.provider);
      if (filters.status) queryParams.set('status', filters.status);
      if (filters.assignedToId) queryParams.set('assignedToId', filters.assignedToId);
      if (filters.tagId) queryParams.set('tag', filters.tagId);
      if (filters.q) queryParams.set('q', filters.q);

      return api.get<ConversationListResponse>(`/inbox/conversations?${queryParams}`);
    },
    getNextPageParam: (lastPage: ConversationListResponse): number | undefined => {
      if (!lastPage.meta) return undefined;
      const { meta } = lastPage;
      if (meta.page < meta.totalPages) {
        return meta.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled,
    refetchInterval: refetchInterval || env.NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS,
    staleTime: 30 * 1000, // 30 seconds (shorter for real-time inbox)
  });
}
