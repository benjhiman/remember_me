import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';

export interface CreateItemDto {
  name?: string; // Optional: auto-generated if not provided
  brand: string; // Required, default "Apple" in service
  model: string; // Required
  storageGb: number; // Required
  condition: 'NEW' | 'USED' | 'REFURBISHED' | 'OEM'; // Required
  color: string; // Required
  sku?: string;
  category?: string;
  description?: string;
  attributes?: Record<string, any>;
  isActive?: boolean;
}

export interface UpdateItemDto {
  name?: string;
  brand?: string;
  model?: string;
  storageGb?: number;
  condition?: 'NEW' | 'USED' | 'REFURBISHED' | 'OEM';
  color?: string;
  sku?: string;
  category?: string;
  description?: string;
  attributes?: Record<string, any>;
  isActive?: boolean;
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreateItemDto) => {
      return api.post('/items', dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: 'Item creado',
        description: 'El item se creó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: 'No tenés permisos para crear items',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      }
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateItemDto }) => {
      return api.patch(`/items/${id}`, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: 'Item actualizado',
        description: 'El item se actualizó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: 'No tenés permisos para editar items',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      }
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast({
        title: 'Item eliminado',
        description: 'El item se eliminó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: 'No tenés permisos para eliminar items',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      }
    },
  });
}
