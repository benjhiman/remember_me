import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';
import type { Lead, LeadStatus } from '@/types/api';

interface CreateLeadData {
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
    mutationFn: (data: CreateLeadData & { status?: any }) => {
      // Remove status field (only allowed in updates, not creation)
      // Normalize empty strings to undefined for optional fields
      const { status, ...dataWithoutStatus } = data;
      const normalizedData: CreateLeadData = {
        ...dataWithoutStatus,
        email: data.email && data.email.trim() !== '' ? data.email.trim() : undefined,
        phone: data.phone && data.phone.trim() !== '' ? data.phone.trim() : undefined,
        source: data.source && data.source.trim() !== '' ? data.source.trim() : undefined,
        city: data.city && data.city.trim() !== '' ? data.city.trim() : undefined,
        model: data.model && data.model.trim() !== '' ? data.model.trim() : undefined,
      };
      
      // Debug logging (only in dev)
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[useCreateLead] Payload:', normalizedData);
      }
      
      return api.post<Lead>('/leads', normalizedData);
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        variant: 'success',
        title: 'Lead creado',
        description: 'El lead se creó exitosamente.',
      });
      router.push(`/dashboard`);
    },
    onError: (error: any) => {
      // Debug logging (only in dev)
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useCreateLead] Error:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
        });
      }
      
      const errorMessage = getErrorMessage(error);
      toast({
        variant: 'destructive',
        title: 'Error al crear lead',
        description: errorMessage,
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
      // Normalize empty strings to undefined for optional fields
      const normalizedData: UpdateLeadData = {
        ...data,
        email: data.email && data.email.trim() !== '' ? data.email.trim() : undefined,
        phone: data.phone && data.phone.trim() !== '' ? data.phone.trim() : undefined,
        source: data.source && data.source.trim() !== '' ? data.source.trim() : undefined,
        city: data.city && data.city.trim() !== '' ? data.city.trim() : undefined,
        model: data.model && data.model.trim() !== '' ? data.model.trim() : undefined,
      };
      
      return api.put<Lead>(`/leads/${leadId}`, normalizedData);
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        variant: 'success',
        title: 'Lead actualizado',
        description: 'Los cambios se guardaron exitosamente.',
      });
      router.push(`/dashboard`);
    },
    onError: (error: any) => {
      // Debug logging (only in dev)
      if (process.env.NODE_ENV !== 'production') {
        console.error('[useUpdateLead] Error:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
        });
      }
      
      const errorMessage = getErrorMessage(error);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar lead',
        description: errorMessage,
      });
    },
  });
}
