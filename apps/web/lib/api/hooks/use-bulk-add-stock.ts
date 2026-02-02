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
      const errorData = error?.response?.data || {};
      const errorMessage =
        errorData?.message ||
        errorData?.error ||
        error?.message ||
        'Error al agregar stock. Por favor, intentá nuevamente.';

      // Check for structured error with missing item IDs
      const missingItemIds = errorData?.missingItemIds || [];
      const errorCode = errorData?.code;

      // Build detailed error message
      let title = 'Error al agregar stock';
      let description = errorMessage;

      if (statusCode === 403) {
        title = 'Sin permisos';
        description = 'No tenés permisos para agregar stock. Contactá a un administrador.';
      } else if (statusCode === 400 || statusCode === 404) {
        if (errorCode === 'ITEMS_NOT_FOUND' && missingItemIds.length > 0) {
          title = `Items no encontrados (${statusCode})`;
          const details = errorData?.details || {};
          const reasons: string[] = [];
          if (details.notFound?.length > 0) {
            reasons.push(`${details.notFound.length} no existen`);
          }
          if (details.notInOrganization?.length > 0) {
            reasons.push(`${details.notInOrganization.length} no pertenecen a tu organización`);
          }
          if (details.deleted?.length > 0) {
            reasons.push(`${details.deleted.length} están eliminados`);
          }
          if (details.inactive?.length > 0) {
            reasons.push(`${details.inactive.length} están inactivos`);
          }
          description = `${errorMessage}. ${reasons.join(', ')}.`;
          
          // Return missing IDs for row marking (via callback or event)
          // This will be handled by the component that calls the mutation
          (error as any).missingItemIds = missingItemIds;
        } else {
          title = `Error de validación (${statusCode})`;
          description = errorMessage;
        }
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
          code: errorCode,
          message: errorMessage,
          missingItemIds,
          details: errorData?.details,
          response: errorData,
          error,
        });
      }
    },
  });
}
