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
      const statusCode = error?.response?.status || 'Unknown';
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Error al agregar stock. Por favor, intentá nuevamente.';

      // Build detailed error message
      let title = 'Error al agregar stock';
      let description = errorMessage;

      if (statusCode === 403) {
        title = 'Sin permisos';
        description = 'No tenés permisos para agregar stock. Contactá a un administrador.';
      } else if (statusCode === 400) {
        title = `Error de validación (${statusCode})`;
        description = errorMessage;
      } else if (statusCode === 404) {
        title = `Item no encontrado (${statusCode})`;
        description = errorMessage;
      } else if (statusCode !== 'Unknown') {
        title = `Error (${statusCode})`;
        description = errorMessage;
      }

      toast({
        variant: 'destructive',
        title,
        description,
      });

      // Debug log (dev only)
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useBulkAddStock] Error details:', {
          status: statusCode,
          message: errorMessage,
          response: error?.response?.data,
          error,
        });
      }
    },
  });
}
