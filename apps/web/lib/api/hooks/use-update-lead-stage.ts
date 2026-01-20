import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';
import type { Lead } from '@/types/api';

interface UpdateLeadStageData {
  stageId: string;
  pipelineId?: string;
}

export function useUpdateLeadStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: UpdateLeadStageData }) => {
      return api.put<Lead>(`/leads/${leadId}`, data);
    },
    onSuccess: (lead, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
      toast({
        variant: 'success',
        title: 'Lead movido',
        description: 'El lead se movió exitosamente.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error al mover lead',
        description: getErrorMessage(error),
      });
    },
  });
}
