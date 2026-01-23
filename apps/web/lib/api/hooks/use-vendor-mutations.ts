import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';

export interface CreateVendorDto {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  status?: string;
}

export interface UpdateVendorDto {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status?: string;
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreateVendorDto) => {
      return api.post('/vendors', dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: 'Proveedor creado',
        description: 'El proveedor se creó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: 'No tenés permisos para crear proveedores',
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

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateVendorDto }) => {
      return api.patch(`/vendors/${id}`, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast({
        title: 'Proveedor actualizado',
        description: 'El proveedor se actualizó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: 'No tenés permisos para editar proveedores',
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
