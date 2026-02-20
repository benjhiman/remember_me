import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export type UiDensity = 'comfortable' | 'compact';
export type UiTheme = 'light' | 'dark';
export type UiAccentColor = 'blue' | 'violet' | 'green';

export interface OrgSettingsResponse {
  crm: {
    branding?: {
      name: string;
      logoUrl: string | null;
      faviconUrl: string | null;
      accentColor: string;
      density: UiDensity;
    };
    permissions: {
      sellerCanEditSales: boolean;
      sellerCanEditLeads: boolean;
    };
    ui: {
      density: UiDensity;
      theme: UiTheme;
      accentColor: UiAccentColor;
    };
  };
}

export type UpdateOrgSettingsPayload = Partial<OrgSettingsResponse>;

export function useOrgSettings(enabled: boolean) {
  return useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.get<OrgSettingsResponse>('/settings'),
    enabled,
    staleTime: 30000,
  });
}

export function useUpdateOrgSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateOrgSettingsPayload) =>
      api.put<OrgSettingsResponse>('/settings', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-settings'] });
    },
  });
}

