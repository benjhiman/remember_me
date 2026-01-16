import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { Conversation } from '@/types/api';

export function useConversation(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => api.get<Conversation>(`/inbox/conversations/${conversationId}`),
    enabled: enabled && !!conversationId,
  });
}
