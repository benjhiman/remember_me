import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface JobMetrics {
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  oldestPendingAgeMs: number | null;
  lastRunAt: string | null;
  lastRunDurationMs: number | null;
}

export function useJobMetrics(enabled: boolean = true) {
  return useQuery<JobMetrics>({
    queryKey: ['job-metrics'],
    queryFn: () => api.get<JobMetrics>('/integrations/jobs/metrics'),
    enabled: enabled,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
