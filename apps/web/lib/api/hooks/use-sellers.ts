import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';

export interface Seller {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  joinedAt: string;
}

export interface SellerStats {
  sellerId: string;
  name: string | null;
  email: string;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  invoicesCount: number;
  commissionsTotal: number;
}

export interface SellerOverview {
  seller: {
    id: string;
    name: string | null;
    email: string;
  };
  totals: {
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    invoicesCount: number;
  };
  invoices: Array<{
    id: string;
    number: string;
    issuedAt: string;
    amountTotal: number;
    paymentStatus: 'PAID' | 'UNPAID';
    deliveryStatus: 'DELIVERED' | 'SHIPPED' | 'NOT_DELIVERED';
    workflowStatus: 'ACTIVE' | 'CANCELLED' | 'STANDBY';
    customerName: string;
  }>;
  commissionConfig: {
    mode: string;
    value: number;
  } | null;
}

export interface SellerInvoice {
  id: string;
  number: string;
  issuedAt: string;
  amountTotal: number;
  paymentStatus: 'PAID' | 'UNPAID';
  deliveryStatus: 'DELIVERED' | 'SHIPPED' | 'NOT_DELIVERED';
  workflowStatus: 'ACTIVE' | 'CANCELLED' | 'STANDBY';
  customerName: string;
}

export interface CommissionConfig {
  mode: string;
  value: number;
}

export function useSellers(enabled: boolean = true) {
  return useQuery({
    queryKey: ['sellers'],
    queryFn: async () => {
      const data = await api.get<Seller[]>('/sellers');
      return { data };
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useSellersStats(enabled: boolean = true) {
  return useQuery({
    queryKey: ['sellers-stats'],
    queryFn: async () => {
      const data = await api.get<SellerStats[]>('/sellers/stats');
      return { data };
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useSellerOverview(sellerId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['seller-overview', sellerId],
    queryFn: () => api.get<SellerOverview>(`/sellers/${sellerId}/overview`),
    enabled: !!sellerId && enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useSellerInvoices(sellerId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['seller-invoices', sellerId],
    queryFn: () => api.get<SellerInvoice[]>(`/sellers/${sellerId}/invoices`),
    enabled: !!sellerId && enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useInviteSeller() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { email: string }) => api.post<{ id: string; email: string; inviteLink: string }>('/sellers/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      toast({
        title: 'Invitación enviada',
        description: 'La invitación se ha enviado correctamente.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al enviar la invitación. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}

export function useSellerCommissionConfig(sellerId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['seller-commission', sellerId],
    queryFn: () => api.get<CommissionConfig | null>(`/sellers/${sellerId}/commission`),
    enabled: !!sellerId && enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useUpdateSellerCommission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ sellerId, data }: { sellerId: string; data: { mode: string; value: number } }) =>
      api.put<CommissionConfig>(`/sellers/${sellerId}/commission`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['seller-commission', variables.sellerId] });
      queryClient.invalidateQueries({ queryKey: ['seller-overview', variables.sellerId] });
      queryClient.invalidateQueries({ queryKey: ['sellers-stats'] });
      toast({
        title: 'Comisión actualizada',
        description: 'La configuración de comisión se ha actualizado correctamente.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al actualizar la comisión. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}

export interface CreateSellerDto {
  name: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
}

export function useCreateSeller() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateSellerDto) => api.post<{ id: string; email: string; name: string; status: string }>('/sellers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] });
      queryClient.invalidateQueries({ queryKey: ['sellers-stats'] });
      toast({
        title: 'Vendedor creado',
        description: 'El vendedor se ha creado correctamente. Se ha enviado una invitación por email.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al crear el vendedor. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}
