import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxId?: string | null;
  city?: string | null;
  address?: string | null;
  instagram?: string | null;
  web?: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  assignedToId?: string | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
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
  sellerId?: string;
  mine?: boolean;
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
  if (filters.sellerId) queryParams.set('sellerId', filters.sellerId);
  if (filters.mine !== undefined) queryParams.set('mine', filters.mine.toString());

  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.get<CustomerListResponse>(`/customers?${queryParams.toString()}`),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export interface CustomerInvoice {
  id: string;
  number: string;
  issuedAt: string;
  amountTotal: number;
  paymentStatus: 'PAID' | 'UNPAID';
  deliveryStatus: 'DELIVERED' | 'SHIPPED' | 'NOT_DELIVERED';
  workflowStatus: 'ACTIVE' | 'CANCELLED' | 'STANDBY';
  seller?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export function useCustomerInvoices(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-invoices', customerId],
    queryFn: () => api.get<CustomerInvoice[]>(`/customers/${customerId}/invoices`),
    enabled: !!customerId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// Re-export for convenience
export { useCreateCustomer, useUpdateCustomer } from './use-customer-mutations';
