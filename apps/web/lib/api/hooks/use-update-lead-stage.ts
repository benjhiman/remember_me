import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { Lead } from '@/types/api';

interface UpdateLeadStageData {
  stageId: string;
  pipelineId?: string;
}

export function useUpdateLeadStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: UpdateLeadStageData }) => {
      return api.put<Lead>(`/leads/${leadId}`, data);
    },
    onSuccess: (lead, variables) => {
      // Invalidate all lead queries
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] });
    },
  });
}
