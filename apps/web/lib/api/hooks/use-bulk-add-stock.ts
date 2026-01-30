import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';

export interface BulkStockAddItem {
  itemId: string;
  quantity: number;
}

export interface BulkStockAddDto {
  items: BulkStockAddItem[];
  note?: string;
  source?: 'purchase' | 'manual';
}

export interface BulkStockAddResponse {
  success: boolean;
  applied: Array<{ itemId: string; quantityApplied: number }>;
  totalItems: number;
  totalQuantity: number;
}

export function useBulkAddStock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (dto: BulkStockAddDto) => api.post<BulkStockAddResponse>('/stock/bulk-add', dto),
    onSuccess: (data) => {
      // Invalidate all stock-related queries
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements-global'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });

      toast({
        title: 'Stock agregado',
        description: `Se agregaron ${data.totalItems} item${data.totalItems !== 1 ? 's' : ''} (${data.totalQuantity} unidades totales) al stock.`,
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al agregar stock. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error al agregar stock',
        description: errorMessage,
      });
    },
  });
}
