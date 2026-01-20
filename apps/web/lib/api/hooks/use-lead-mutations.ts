import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../client';
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

  return useMutation({
    mutationFn: (data: CreateLeadData) => api.post<Lead>('/leads', data),
    onSuccess: (lead) => {
      // Invalidate leads list
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Redirect to lead detail
      router.push(`/leads/${lead.id}`);
    },
  });
}

export function useUpdateLead(leadId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: UpdateLeadData) => {
      // Backend uses PUT, not PATCH
      return api.put<Lead>(`/leads/${leadId}`, data);
    },
    onSuccess: (lead) => {
      // Invalidate lead detail and list
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      // Redirect to lead detail
      router.push(`/leads/${lead.id}`);
    },
  });
}
