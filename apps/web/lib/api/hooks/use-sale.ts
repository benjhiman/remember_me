import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { Sale } from '@/types/sales';

export function useSale(saleId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => api.get<Sale>(`/sales/${saleId}`),
    enabled: enabled && !!saleId,
  });
}
