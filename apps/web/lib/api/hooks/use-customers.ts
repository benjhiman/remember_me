import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';

export interface Customer {
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

export interface CustomerListResponse {
  items: Customer[];
  total: number;
  page: number;
  limit: number;
}

interface UseCustomersParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  enabled?: boolean;
}

export function useCustomers(params: UseCustomersParams = {}) {
  const { page = 1, limit = 20, enabled = true, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.q) queryParams.set('q', filters.q);
  if (filters.status) queryParams.set('status', filters.status);

  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.get<CustomerListResponse>(`/customers?${queryParams.toString()}`),
    enabled,
  });
}
