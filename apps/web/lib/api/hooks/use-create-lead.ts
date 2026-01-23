import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';
import type { CreateLeadDto } from '@/types/api';

export function useCreateLead() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreateLeadDto) => {
      return api.post('/leads', dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead creado',
        description: 'El lead se creó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      
      // Handle 403 specifically
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: 'No tenés permisos para crear leads',
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
