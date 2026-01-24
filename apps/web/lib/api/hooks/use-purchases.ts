import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';

export type PurchaseStatus = 'DRAFT' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseLine {
  id: string;
  purchaseId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  sku: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  organizationId: string;
  vendorId: string;
  status: PurchaseStatus;
  notes: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  approvedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  vendor: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  lines: PurchaseLine[];
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface PurchaseListItem {
  id: string;
  status: PurchaseStatus;
  notes: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  approvedAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  vendor: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface PurchaseListResponse {
  items: PurchaseListItem[];
  total: number;
  page: number;
  limit: number;
}

interface UsePurchasesParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: PurchaseStatus;
  vendorId?: string;
  enabled?: boolean;
}

export function usePurchases(params: UsePurchasesParams = {}) {
  const { page = 1, limit = 20, enabled = true, ...filters } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (filters.q) queryParams.set('q', filters.q);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.vendorId) queryParams.set('vendorId', filters.vendorId);

  return useQuery({
    queryKey: ['purchases', params],
    queryFn: () => api.get<PurchaseListResponse>(`/purchases?${queryParams.toString()}`),
    enabled,
  });
}
