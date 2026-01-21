import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export type IntegrationProviderKey = 'meta' | 'instagram' | 'whatsapp';

export interface IntegrationProviderStatus {
  accountId?: string | null;
  connected: boolean;
  lastSyncAt: string | null;
  tokenStatus: 'OK' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNKNOWN';
  tokenExpiresAt: string | null;
  errors: Array<{ message: string; at: string }>;
  configSummary: Record<string, any>;
  guardrails: Array<{ level: 'warning' | 'error'; message: string }>;
}

export interface IntegrationsStatusResponse {
  lastChecked: string;
  providers: {
    meta: IntegrationProviderStatus;
    instagram: IntegrationProviderStatus;
    whatsapp: IntegrationProviderStatus;
  };
}

export interface IntegrationAuditEvent {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  provider: string | null;
  event: string | null;
  ok: boolean | null;
  error: string | null;
  payload: any;
}

export function useIntegrationsStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => api.get<IntegrationsStatusResponse>('/integrations/status'),
    enabled,
    refetchInterval: 15000,
  });
}

export function useIntegrationsAudit(enabled: boolean, limit: number = 20) {
  return useQuery({
    queryKey: ['integrations-audit', limit],
    queryFn: () => api.get<IntegrationAuditEvent[]>(`/integrations/audit?limit=${limit}`),
    enabled,
    refetchInterval: 15000,
  });
}

export function useRunIntegrationTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: IntegrationProviderKey) => {
      if (provider === 'meta') return api.post<{ ok: boolean; error?: string }>('/integrations/meta/test');
      if (provider === 'instagram') return api.post<{ ok: boolean; error?: string }>('/integrations/instagram/test');
      return api.post<{ ok: boolean; error?: string }>('/integrations/whatsapp/test');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations-status'] });
      qc.invalidateQueries({ queryKey: ['integrations-audit'] });
    },
  });
}

