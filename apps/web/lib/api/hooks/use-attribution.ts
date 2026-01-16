import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { AttributionMetric, AttributionGroupBy } from '@/types/api';

interface UseAttributionParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  groupBy?: AttributionGroupBy;
  includeZeroRevenue?: boolean;
  enabled?: boolean;
}

export function useAttribution(params: UseAttributionParams = {}) {
  const { from, to, groupBy = 'campaign', includeZeroRevenue = false, enabled = true } = params;

  const queryParams = new URLSearchParams({
    groupBy,
    includeZeroRevenue: includeZeroRevenue.toString(),
  });

  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);

  return useQuery({
    queryKey: ['attribution', params],
    queryFn: () => api.get<AttributionMetric[]>(`/dashboard/attribution/meta?${queryParams}`),
    enabled,
  });
}
