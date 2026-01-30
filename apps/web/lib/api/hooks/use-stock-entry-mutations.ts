import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';

export enum StockEntryMode {
  IMEI = 'IMEI',
  QUANTITY = 'QUANTITY',
}

export interface CreateStockEntryDto {
  mode: StockEntryMode;
  itemId: string;
  quantity?: number;
  imeis?: string[];
  condition?: 'NEW' | 'USED' | 'REFURBISHED';
  status?: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'DAMAGED' | 'RETURNED' | 'CANCELLED';
  cost?: number;
  location?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface CreateStockEntryResponse {
  created: number;
  items: Array<{
    id: string;
    organizationId: string;
    itemId: string;
    model: string;
    imei: string | null;
    quantity: number;
    status: string;
    createdAt: string;
  }>;
}

export function useCreateStockEntry() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (dto: CreateStockEntryDto) => {
      // Debug logging (only in dev)
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[useCreateStockEntry] Payload:', {
          mode: dto.mode,
          itemId: dto.itemId,
          quantity: dto.quantity,
          imeisCount: dto.imeis?.length,
        });
      }

      return api.post<CreateStockEntryResponse>('/stock/entries', dto).then((res) => {
        // Debug logging (only in dev)
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[useCreateStockEntry] Response:', {
            created: res.created,
            itemsCount: res.items?.length,
            firstItem: res.items?.[0] ? {
              id: res.items[0].id,
              itemId: res.items[0].itemId,
              quantity: res.items[0].quantity,
            } : null,
          });
        }
        return res;
      });
    },
    onSuccess: (data) => {
      // Invalidate all stock-related queries
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] }); // Critical: refresh summary
      queryClient.invalidateQueries({ queryKey: ['stock-movements-global'] }); // Refresh movements
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['items'] }); // In case items show stock counts

      // Also refetch active queries to ensure immediate UI update
      queryClient.refetchQueries({ queryKey: ['stock-summary'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['stock-movements-global'], type: 'active' });

      // Debug logging (only in dev)
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[useCreateStockEntry] Invalidated queries and refetched active ones');
      }

      const count = data.created;
      const modeLabel = data.items[0]?.imei ? 'IMEI' : 'cantidad';
      toast({
        variant: 'default',
        title: 'Stock agregado',
        description: `Se agregaron ${count} ${count === 1 ? 'item' : 'items'} al stock (modo ${modeLabel}).`,
      });
    },
    onError: (error: any) => {
      // Debug logging (only in dev)
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useCreateStockEntry] Error:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
        });
      }

      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.duplicateImeis
          ? `IMEIs duplicados: ${error.response.data.duplicateImeis.join(', ')}`
          : error?.message ||
            'No se pudo agregar el stock. Por favor, intentá nuevamente.';

      toast({
        variant: 'destructive',
        title: 'Error al agregar stock',
        description: errorMessage,
      });
    },
  });
}
