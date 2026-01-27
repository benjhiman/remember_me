import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';

export function useDeletePipeline() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (pipelineId: string) => api.delete(`/leads/pipelines/${pipelineId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast({
        variant: 'success',
        title: 'Pipeline eliminado',
        description: 'El pipeline se eliminó exitosamente.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar pipeline',
        description: getErrorMessage(error),
      });
    },
  });
}
