import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  before: any;
  after: any;
  metadata: any;
  requestId: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export function useAuditLogs(params?: {
  page?: number;
  limit?: number;
  entityType?: string;
  action?: string;
}) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.limit) searchParams.set('limit', params.limit.toString());
      if (params?.entityType) searchParams.set('entityType', params.entityType);
      if (params?.action) searchParams.set('action', params.action);
      return api.get<AuditLogsResponse>(`/audit?${searchParams.toString()}`);
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
