import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';

export interface PriceList {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceListResponse {
  data: PriceList[];
}

export interface PriceListItem {
  id: string;
  itemGroupKey: string;
  displayName: string;
  baseSku?: string | null;
  basePrice?: number | null;
  overrideCount: number;
}

export interface PriceListDetail {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: PriceListItem[];
}

export function usePriceLists() {
  return useQuery({
    queryKey: ['price-lists'],
    queryFn: async () => {
      const response = await api.get<PriceListResponse>('/price-lists');
      return response;
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function usePriceList(priceListId: string | null) {
  return useQuery({
    queryKey: ['price-lists', priceListId],
    queryFn: async () => {
      if (!priceListId) return null;
      const response = await api.get<PriceListDetail>(`/price-lists/${priceListId}`);
      return response;
    },
    enabled: !!priceListId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useCreatePriceList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: {
      name: string;
      mode: 'ALL' | 'FOLDERS' | 'ITEMS';
      folderIds?: string[];
      itemIds?: string[];
    }) => api.post<PriceList>('/price-lists', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      toast({
        title: 'Lista de precios creada',
        description: 'La lista de precios se ha creado correctamente.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al crear la lista de precios. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}

export function useUpdatePriceListItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      priceListId,
      priceListItemId,
      basePrice,
    }: {
      priceListId: string;
      priceListItemId: string;
      basePrice: number | null;
    }) =>
      api.patch<PriceListItem>(`/price-lists/${priceListId}/items/${priceListItemId}`, {
        basePrice,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['price-lists', variables.priceListId] });
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      toast({
        title: 'Precio actualizado',
        description: 'El precio se ha actualizado correctamente.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al actualizar el precio. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}
