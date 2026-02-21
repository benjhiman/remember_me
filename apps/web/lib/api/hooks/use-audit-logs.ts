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
  actorRole: string | null;
  actorEmail: string | null;
  before: any;
  after: any;
  metadata: any;
  requestId: string | null;
  severity: string;
  source: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface AuditLogsParams {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: string;
  actorRole?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
}

export function useAuditLogs(params?: AuditLogsParams) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
      if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
      if (params?.actorUserId) searchParams.set('actorUserId', params.actorUserId);
      if (params?.actorRole) searchParams.set('actorRole', params.actorRole);
      if (params?.action) searchParams.set('action', params.action);
      if (params?.entityType) searchParams.set('entityType', params.entityType);
      if (params?.entityId) searchParams.set('entityId', params.entityId);
      if (params?.search) searchParams.set('search', params.search);
      return api.get<AuditLogsResponse>(`/audit-logs?${searchParams.toString()}`);
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
