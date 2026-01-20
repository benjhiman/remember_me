import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface Pipeline {
  id: string;
  name: string;
  color?: string;
  order: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  stages?: Array<{
    id: string;
    name: string;
    color?: string;
    order: number;
  }>;
}

export function usePipelines(enabled: boolean = true) {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get<Pipeline[]>('/leads/pipelines'),
    enabled,
  });
}
