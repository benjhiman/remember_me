import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { ConnectedAccount } from '@/types/api';

export function useConnectedAccounts(enabled = true) {
  return useQuery({
    queryKey: ['connected-accounts'],
    queryFn: () => api.get<ConnectedAccount[]>('/integrations/meta/connected-accounts'),
    enabled,
    refetchOnWindowFocus: true,
  });
}
