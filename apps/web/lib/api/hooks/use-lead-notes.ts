import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';

export interface Note {
  id: string;
  organizationId: string;
  leadId: string;
  userId: string;
  content: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
  lead?: {
    id: string;
    name: string;
  };
}

interface CreateNoteData {
  leadId: string;
  content: string;
  isPrivate?: boolean;
}

export function useLeadNotes(leadId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['lead-notes', leadId],
    queryFn: () => api.get<Note[]>(`/leads/${leadId}/notes`),
    enabled: enabled && !!leadId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateNoteData) => api.post<Note>('/leads/notes', data),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['lead-notes', note.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', note.leadId] });
      toast({
        variant: 'success',
        title: 'Nota creada',
        description: 'La nota se agregó exitosamente.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error al crear nota',
        description: getErrorMessage(error),
      });
    },
  });
}
