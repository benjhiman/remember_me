import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface SellerStockViewRow {
  label: string;
  qty: number;
}

export interface SellerStockViewSection {
  section: string;
  rows: SellerStockViewRow[];
}

export function useSellerStockView(search?: string) {
  return useQuery({
    queryKey: ['seller-stock-view', search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      return api.get<SellerStockViewSection[]>(`/stock/seller-view?${params.toString()}`);
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}
