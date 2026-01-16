import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { env } from '@/lib/config/env';
import type { MessageListResponse } from '@/types/api';

interface UseMessagesParams {
  conversationId: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number; // Polling interval in ms
}

export function useMessages({
  conversationId,
  page = 1,
  limit = 50,
  enabled = true,
  refetchInterval,
}: UseMessagesParams) {
  return useQuery({
    queryKey: ['messages', conversationId, page, limit],
    queryFn: () =>
      api.get<MessageListResponse>(
        `/inbox/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
      ),
    enabled: enabled && !!conversationId,
    refetchInterval, // Dynamic polling based on conversation state
  });
}
