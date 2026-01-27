import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';
import type { Lead, LeadStatus } from '@/types/api';

interface CreateLeadData {
  pipelineId: string;
  stageId: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  city?: string;
  budget?: number;
  model?: string;
  tags?: string[];
  assignedToId?: string;
}

interface UpdateLeadData {
  pipelineId?: string;
  stageId?: string;
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  city?: string;
  budget?: number;
  model?: string;
  tags?: string[];
  assignedToId?: string;
  status?: LeadStatus;
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateLeadData) => api.post<Lead>('/leads', data),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        variant: 'success',
        title: 'Lead creado',
        description: 'El lead se creó exitosamente.',
      });
      router.push(`/board/leads/${lead.id}`);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error al crear lead',
        description: getErrorMessage(error),
      });
    },
  });
}

export function useUpdateLead(leadId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: UpdateLeadData) => {
      return api.put<Lead>(`/leads/${leadId}`, data);
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        variant: 'success',
        title: 'Lead actualizado',
        description: 'Los cambios se guardaron exitosamente.',
      });
      router.push(`/board/leads/${lead.id}`);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar lead',
        description: getErrorMessage(error),
      });
    },
  });
}
