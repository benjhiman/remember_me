import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface HealthStatus {
  status: string;
  timestamp: string;
  database?: {
    status: string;
    latency?: number;
  };
  environment?: string;
  version?: string;
}

export function useHealth(enabled = true) {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthStatus>('/health/extended'),
    enabled,
    refetchInterval: 30000, // Check every 30s
    retry: 1,
  });
}
