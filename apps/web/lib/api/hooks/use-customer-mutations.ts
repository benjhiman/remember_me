import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';

export interface CreateCustomerDto {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  status?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  status?: string;
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreateCustomerDto) => {
      return api.post('/customers', dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Cliente creado',
        description: 'El cliente se creó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: 'No tenés permisos para crear clientes',
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

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateCustomerDto }) => {
      return api.patch(`/customers/${id}`, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Cliente actualizado',
        description: 'El cliente se actualizó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: 'No tenés permisos para editar clientes',
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
