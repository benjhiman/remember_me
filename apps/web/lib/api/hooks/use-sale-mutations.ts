import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../client';
import type { Sale } from '@/types/sales';

interface CreateSaleItem {
  stockItemId?: string;
  model: string;
  quantity: number;
  unitPrice: number;
}

interface CreateSaleData {
  stockReservationIds?: string[];
  items?: CreateSaleItem[];
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCity?: string;
  customerAddress?: string;
  customerInstagram?: string;
  customerWeb?: string;
  discount?: number;
  currency?: string;
  notes?: string;
  subject?: string;
  location?: string;
  orderNumber?: string;
  saleNumber?: string; // Manual invoice number
  priceListId?: string; // Selected price list ID
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
