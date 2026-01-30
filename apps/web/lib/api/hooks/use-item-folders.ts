import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';

export interface ItemFolder {
  prefix: string;
  count: number;
  pinned: boolean;
}

export interface ItemFoldersResponse {
  data: ItemFolder[];
}

export function useItemFolders(enabled: boolean = true) {
  return useQuery({
    queryKey: ['item-folders'],
    queryFn: () => api.get<ItemFoldersResponse>('/items/folders'),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePinFolder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (prefix: string) =>
      api.post<ItemFolder>('/items/folders', { prefix: prefix.toUpperCase().trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-folders'] });
      toast({
        title: 'Carpeta creada',
        description: 'La carpeta se ha creado correctamente.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al crear la carpeta. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}

export function useUnpinFolder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (prefix: string) => api.delete(`/items/folders/${encodeURIComponent(prefix.toUpperCase().trim())}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-folders'] });
      toast({
        title: 'Carpeta eliminada',
        description: 'La carpeta se ha eliminado correctamente.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al eliminar la carpeta. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}
