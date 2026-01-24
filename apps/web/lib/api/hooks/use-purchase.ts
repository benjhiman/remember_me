import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';
import type { Purchase } from './use-purchases';

export function usePurchase(id: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['purchase', id],
    queryFn: () => api.get<Purchase>(`/purchases/${id}`),
    enabled: enabled && !!id,
  });
}
