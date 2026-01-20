import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

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

  return useMutation({
    mutationFn: (data: CreateNoteData) => api.post<Note>('/leads/notes', data),
    onSuccess: (note) => {
      // Invalidate notes for the lead
      queryClient.invalidateQueries({ queryKey: ['lead-notes', note.leadId] });
      // Invalidate lead detail (to update _count.notes)
      queryClient.invalidateQueries({ queryKey: ['lead', note.leadId] });
    },
  });
}
