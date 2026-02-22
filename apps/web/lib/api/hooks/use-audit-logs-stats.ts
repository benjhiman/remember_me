import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface AuditLogStats {
  totalMovements: number;
  movementsByRole: Array<{ role: string; count: number }>;
  movementsByAction: Array<{ action: string; count: number }>;
  movementsByEntity: Array<{ entityType: string; count: number }>;
  movementsLast7Days: number;
  movementsLast30Days: number;
  topActors: Array<{ userId: string | null; email: string; count: number }>;
}

export function useAuditLogsStats() {
  return useQuery({
    queryKey: ['audit-logs-stats'],
    queryFn: () => api.get<AuditLogStats>('/audit-logs/stats'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
