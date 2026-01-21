import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

// Types
export interface MetaAdAccount {
  id: string;
  name: string;
  accountStatus: number;
  currency: string;
  timezone: string;
}

export interface MetaAdAccountsResponse {
  data: MetaAdAccount[];
}

export interface MetaConfig {
  adAccountId: string | null;
  connected: boolean;
}

export interface CampaignInsights {
  spend: string;
  impressions: number;
  clicks: number;
  ctr: string;
  cpc: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  createdTime?: string;
  updatedTime?: string;
  insights: CampaignInsights;
}

export interface CampaignsListResponse {
  data: Campaign[];
  paging: {
    after: string | null;
  };
}

export interface Adset {
  id: string;
  name: string;
  status: string;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  startTime?: string;
  endTime?: string | null;
  campaignId: string;
  insights: CampaignInsights;
}

export interface AdsetsListResponse {
  data: Adset[];
  paging: {
    after: string | null;
  };
}

interface UseMetaCampaignsParams {
  from?: string;
  to?: string;
  limit?: number;
  after?: string;
  adAccountId?: string;
  enabled?: boolean;
}

interface UseMetaAdsetsParams {
  campaignId: string;
  from?: string;
  to?: string;
  limit?: number;
  after?: string;
  enabled?: boolean;
}

// Hooks
export function useMetaAdAccounts(enabled: boolean = true) {
  return useQuery({
    queryKey: ['meta-ad-accounts'],
    queryFn: () => api.get<MetaAdAccountsResponse>('/integrations/meta/ad-accounts'),
    enabled,
  });
}

export function useMetaConfig(enabled: boolean = true) {
  return useQuery({
    queryKey: ['meta-config'],
    queryFn: () => api.get<MetaConfig>('/integrations/meta/config'),
    enabled,
  });
}

export function useUpdateMetaConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (adAccountId: string) =>
      api.put<{ adAccountId: string }>('/integrations/meta/config', { adAccountId }),
    onSuccess: () => {
      // Invalidate config and campaigns queries
      queryClient.invalidateQueries({ queryKey: ['meta-config'] });
      queryClient.invalidateQueries({ queryKey: ['meta-campaigns'] });
    },
  });
}

export function useMetaCampaigns(params: UseMetaCampaignsParams = {}) {
  const { from, to, limit, after, adAccountId, enabled = true } = params;

  const queryParams = new URLSearchParams();
  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);
  if (limit) queryParams.set('limit', limit.toString());
  if (after) queryParams.set('after', after);
  if (adAccountId) queryParams.set('adAccountId', adAccountId);

  return useQuery({
    queryKey: ['meta-campaigns', { from, to, limit, after, adAccountId }],
    queryFn: () => api.get<CampaignsListResponse>(`/integrations/meta/campaigns?${queryParams.toString()}`),
    enabled,
  });
}

export function useMetaAdsets(params: UseMetaAdsetsParams) {
  const { campaignId, from, to, limit, after, enabled = true } = params;

  const queryParams = new URLSearchParams();
  queryParams.set('campaignId', campaignId);
  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);
  if (limit) queryParams.set('limit', limit.toString());
  if (after) queryParams.set('after', after);

  return useQuery({
    queryKey: ['meta-adsets', { campaignId, from, to, limit, after }],
    queryFn: () => api.get<AdsetsListResponse>(`/integrations/meta/adsets?${queryParams.toString()}`),
    enabled: enabled && !!campaignId,
  });
}
