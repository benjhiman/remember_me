'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';

export interface LedgerAccount {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerAccountsListResponse {
  items: LedgerAccount[];
  total: number;
  page: number;
  limit: number;
}

interface UseLedgerAccountsParams {
  page?: number;
  limit?: number;
  q?: string;
  type?: string;
  isActive?: boolean;
  enabled?: boolean;
}

export function useLedgerAccounts(params: UseLedgerAccountsParams = {}) {
  const { page = 1, limit = 20, enabled = true, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.q) queryParams.set('q', filters.q);
  if (filters.type) queryParams.set('type', filters.type);
  if (filters.isActive !== undefined) queryParams.set('isActive', filters.isActive.toString());

  return useQuery({
    queryKey: ['ledger-accounts', params],
    queryFn: () => api.get<LedgerAccountsListResponse>(`/ledger/accounts?${queryParams.toString()}`),
    enabled,
    staleTime: 30 * 1000, // 30s
  });
}
