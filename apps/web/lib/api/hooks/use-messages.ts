import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { env } from '@/lib/config/env';
import type { MessageListResponse } from '@/types/api';

interface UseMessagesParams {
  conversationId: string;
  page?: number;
  limit?: number;
  before?: string; // ISO timestamp cursor (fetch older messages)
  enabled?: boolean;
  refetchInterval?: number; // Polling interval in ms
}

export function useMessages({
  conversationId,
  page = 1,
  limit = 50,
  before,
  enabled = true,
  refetchInterval,
}: UseMessagesParams) {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (before) queryParams.set('before', before);

  return useQuery({
    queryKey: ['messages', conversationId, page, limit, before],
    queryFn: () =>
      api.get<MessageListResponse>(
        `/inbox/conversations/${conversationId}/messages?${queryParams.toString()}`
      ),
    enabled: enabled && !!conversationId,
    refetchInterval, // Dynamic polling based on conversation state
  });
}
