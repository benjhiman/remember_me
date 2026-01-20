import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../client';
import type { Sale } from '@/types/sales';

interface CreateSaleData {
  stockReservationIds: string[];
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  discount?: number;
  currency?: string;
  notes?: string;
  leadId?: string;
  metadata?: Record<string, any>;
}

interface UpdateSaleData {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  discount?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreateSaleData) => api.post<Sale>('/sales', data),
    onSuccess: (sale) => {
      // Invalidate sales list
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      // Redirect to sale detail
      router.push(`/sales/${sale.id}`);
    },
  });
}

export function useUpdateSale(saleId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: UpdateSaleData) => api.patch<Sale>(`/sales/${saleId}`, data),
    onSuccess: (sale) => {
      // Invalidate sale detail and list
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      // Redirect to sale detail
      router.push(`/sales/${sale.id}`);
    },
  });
}
