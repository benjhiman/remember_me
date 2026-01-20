import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/lib/utils/error-handler';

export interface Task {
  id: string;
  organizationId: string;
  leadId: string;
  assignedToId?: string;
  createdById: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: {
    id: string;
    name: string;
    email?: string;
  };
  creator?: {
    id: string;
    name: string;
    email?: string;
  };
}

interface CreateTaskData {
  leadId: string;
  title: string;
  description?: string;
  dueDate?: string;
  assignedToId?: string;
}

interface UpdateTaskData {
  title?: string;
  description?: string;
  dueDate?: string;
  completed?: boolean;
  assignedToId?: string;
}

export function useLeadTasks(leadId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['lead-tasks', leadId],
    queryFn: () => api.get<Task[]>(`/leads/${leadId}/tasks`),
    enabled: enabled && !!leadId,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateTaskData) => api.post<Task>('/leads/tasks', data),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', task.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', task.leadId] });
      toast({
        variant: 'success',
        title: 'Tarea creada',
        description: 'La tarea se agregó exitosamente.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error al crear tarea',
        description: getErrorMessage(error),
      });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskData }) =>
      api.patch<Task>(`/leads/tasks/${taskId}`, data),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', task.leadId] });
      toast({
        variant: 'success',
        title: 'Tarea actualizada',
        description: 'Los cambios se guardaron exitosamente.',
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar tarea',
        description: getErrorMessage(error),
      });
    },
  });
}
