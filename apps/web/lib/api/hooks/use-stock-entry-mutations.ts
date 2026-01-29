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
      return api.post<CreateStockEntryResponse>('/stock/entries', dto);
    },
    onSuccess: (data) => {
      // Invalidate stock queries
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['items'] }); // In case items show stock counts

      const count = data.created;
      const modeLabel = data.items[0]?.imei ? 'IMEI' : 'cantidad';
      toast({
        variant: 'default',
        title: 'Stock agregado',
        description: `Se agregaron ${count} ${count === 1 ? 'item' : 'items'} al stock (modo ${modeLabel}).`,
      });
    },
    onError: (error: any) => {
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
