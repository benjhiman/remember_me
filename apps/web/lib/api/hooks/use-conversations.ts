import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { env } from '@/lib/config/env';
import type { ConversationListResponse, IntegrationProvider, ConversationStatus } from '@/types/api';

interface UseConversationsParams {
  provider?: IntegrationProvider;
  status?: ConversationStatus;
  assignedToId?: string;
  tagId?: string;
  q?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number; // Polling interval in ms
}

export function useConversations(params: UseConversationsParams = {}) {
  const { page = 1, limit = 20, enabled = true, refetchInterval, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.provider) queryParams.set('provider', filters.provider);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.assignedToId) queryParams.set('assignedToId', filters.assignedToId);
  if (filters.tagId) queryParams.set('tag', filters.tagId);
  if (filters.q) queryParams.set('q', filters.q);

  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => api.get<ConversationListResponse>(`/inbox/conversations?${queryParams}`),
    enabled,
    refetchInterval: refetchInterval || env.NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS,
  });
}
