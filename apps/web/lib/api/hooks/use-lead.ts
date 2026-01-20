import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { Lead } from '@/types/api';

export function useLead(leadId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => api.get<Lead>(`/leads/${leadId}`),
    enabled: enabled && !!leadId,
  });
}
