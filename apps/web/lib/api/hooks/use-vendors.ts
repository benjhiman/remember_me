import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';

export interface Vendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
}

export interface VendorListResponse {
  items: Vendor[];
  total: number;
  page: number;
  limit: number;
}

interface UseVendorsParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  enabled?: boolean;
}

export function useVendors(params: UseVendorsParams = {}) {
  const { page = 1, limit = 20, enabled = true, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.q) queryParams.set('q', filters.q);
  if (filters.status) queryParams.set('status', filters.status);

  return useQuery({
    queryKey: ['vendors', params],
    queryFn: () => api.get<VendorListResponse>(`/vendors?${queryParams.toString()}`),
    enabled,
  });
}
