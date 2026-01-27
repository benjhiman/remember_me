import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';
import type { Pipeline } from './use-pipelines';

export interface CreatePipelineData {
  name: string;
  color?: string;
  stages?: Array<{
    name: string;
    color?: string;
  }>;
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreatePipelineData) => api.post<Pipeline>('/leads/pipelines', data),
    onSuccess: (pipeline) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      toast({
        variant: 'success',
        title: 'Pipeline creado',
        description: `El pipeline "${pipeline.name}" se creó exitosamente.`,
      });
      // Redirect to board with new pipeline selected
      router.push(`/board?pipelineId=${pipeline.id}`);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error al crear pipeline',
        description: getErrorMessage(error),
      });
    },
  });
}
