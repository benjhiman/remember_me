import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useToast } from '@/components/ui/use-toast';
import type { Customer } from './use-customers';

export interface CreateCustomerDto {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  instagram?: string;
  web?: string;
  notes?: string;
  status?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  address?: string;
  instagram?: string;
  web?: string;
  notes?: string;
  status?: string;
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateCustomerDto) => api.post<Customer>('/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Cliente creado',
        description: 'El cliente se ha creado correctamente.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al crear el cliente. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCustomerDto }) =>
      api.patch<Customer>(`/customers/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: 'Cliente actualizado',
        description: 'El cliente se ha actualizado correctamente.',
      });
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message || 'Error al actualizar el cliente. Por favor, intentá nuevamente.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    },
  });
}
