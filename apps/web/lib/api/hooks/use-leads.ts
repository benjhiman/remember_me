import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { LeadListResponse, LeadStatus } from '@/types/api';

interface UseLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
  q?: string;
  pipelineId?: string;
  stageId?: string;
  assignedToId?: string;
  status?: LeadStatus;
  createdFrom?: string;
  createdTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  enabled?: boolean;
}

export function useLeads(params: UseLeadsParams = {}) {
  const { page = 1, limit = 20, enabled = true, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  // Use 'q' or 'search' for search query
  if (filters.q) queryParams.set('q', filters.q);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.pipelineId) queryParams.set('pipelineId', filters.pipelineId);
  if (filters.stageId) queryParams.set('stageId', filters.stageId);
  if (filters.assignedToId) queryParams.set('assignedToId', filters.assignedToId);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.createdFrom) queryParams.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) queryParams.set('createdTo', filters.createdTo);
  if (filters.sort) queryParams.set('sort', filters.sort);
  if (filters.order) queryParams.set('order', filters.order);

  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => api.get<LeadListResponse>(`/leads?${queryParams}`),
    enabled,
  });
}
