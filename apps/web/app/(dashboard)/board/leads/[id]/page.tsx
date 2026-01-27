'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLead } from '@/lib/api/hooks/use-lead';
import { useLeadNotes, useCreateNote } from '@/lib/api/hooks/use-lead-notes';
import { useLeadTasks, useCreateTask, useUpdateTask } from '@/lib/api/hooks/use-lead-tasks';
import { getStatusBadgeColor, getStatusLabel, formatDate } from '@/lib/utils/lead-utils';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { Permission, userCan } from '@/lib/auth/permissions';

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;
  const { user } = useAuthStore();

  const { data: lead, isLoading: leadLoading, error: leadError } = useLead(leadId);
  const { data: notes, isLoading: notesLoading } = useLeadNotes(leadId);
  const { data: tasks, isLoading: tasksLoading } = useLeadTasks(leadId);

  const createNote = useCreateNote();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [newNoteContent, setNewNoteContent] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (leadLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Cargando lead...</p>
        </div>
      </div>
    );
  }

  if (leadError || !lead) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Error</h1>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">
              {(leadError as Error)?.message || 'Lead no encontrado'}
            </p>
            <Button onClick={() => router.push('/board/leads')} variant="outline" className="mt-4">
              Volver a leads
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    try {
      await createNote.mutateAsync({
        leadId: lead.id,
        content: newNoteContent.trim(),
        isPrivate: false,
      });
      setNewNoteContent('');
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      await createTask.mutateAsync({
        leadId: lead.id,
        title: newTaskTitle.trim(),
        description: '',
        dueDate: newTaskDueDate || undefined,
      });
      setNewTaskTitle('');
      setNewTaskDueDate('');
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    try {
      await updateTask.mutateAsync({
        taskId,
        data: { completed: !currentCompleted },
      });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Breadcrumb items={[{ label: 'Board', href: '/board' }, { label: 'Leads', href: '/board/leads' }, { label: lead.name }]} />
      {/* Header */}
      <div className="mb-6 mt-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{lead.name}</h1>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                  lead.status
                )}`}
              >
                {getStatusLabel(lead.status)}
              </span>
            </div>
            <div className="text-gray-600 space-y-1">
              {lead.email && <div>📧 {lead.email}</div>}
              {lead.phone && <div>📱 {lead.phone}</div>}
              {lead.pipeline && lead.stage && (
                <div>
                  {lead.pipeline.name} / {lead.stage.name}
                </div>
              )}
            </div>
          </div>
          {userCan(user, Permission.EDIT_LEADS) && (
            <Button onClick={() => router.push(`/board/leads/${leadId}/edit`)}>Editar</Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create Note Form */}
                {userCan(user, Permission.EDIT_LEADS) && (
                  <form onSubmit={handleCreateNote} className="space-y-2">
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Escribir una nota..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                    />
                    <Button type="submit" size="sm" disabled={createNote.isPending || !newNoteContent.trim()}>
                      {createNote.isPending ? 'Guardando...' : 'Agregar Nota'}
                    </Button>
                  </form>
                )}

                {/* Notes List */}
                {notesLoading ? (
                  <div className="text-sm text-gray-500">Cargando notas...</div>
                ) : notes && notes.length > 0 ? (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="border-l-2 border-gray-200 pl-3 py-2">
                        <div className="text-sm text-gray-600 mb-1">
                          {note.user?.name || 'Usuario'} · {formatDate(note.createdAt)}
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{note.content}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No hay notas aún</div>
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Tareas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create Task Form */}
                {userCan(user, Permission.EDIT_LEADS) && (
                  <form onSubmit={handleCreateTask} className="space-y-2">
                    <Input
                      placeholder="Título de la tarea"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                    <Input
                      type="datetime-local"
                      placeholder="Fecha límite (opcional)"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                    />
                    <Button type="submit" size="sm" disabled={createTask.isPending || !newTaskTitle.trim()}>
                      {createTask.isPending ? 'Guardando...' : 'Agregar Tarea'}
                    </Button>
                  </form>
                )}

                {/* Tasks List */}
                {tasksLoading ? (
                  <div className="text-sm text-gray-500">Cargando tareas...</div>
                ) : tasks && tasks.length > 0 ? (
                  <div className="space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-2 p-2 border rounded-lg hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleTask(task.id, task.completed)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className={`text-sm ${task.completed ? 'line-through text-gray-500' : ''}`}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-xs text-gray-500 mt-1">{task.description}</div>
                          )}
                          {task.dueDate && (
                            <div className="text-xs text-gray-500 mt-1">
                              📅 {formatDate(task.dueDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No hay tareas aún</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Activity Timeline */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Actividad</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Notes in timeline */}
                  {notes && notes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Notas</h3>
                      <div className="space-y-2">
                        {notes.map((note) => (
                          <div key={note.id} className="text-sm border-l-2 border-blue-200 pl-3 py-1">
                            <div className="text-gray-600">
                              {note.user?.name || 'Usuario'} agregó una nota
                            </div>
                            <div className="text-xs text-gray-500">{formatDate(note.createdAt)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks in timeline */}
                  {tasks && tasks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Tareas</h3>
                      <div className="space-y-2">
                        {tasks.map((task) => (
                          <div key={task.id} className="text-sm border-l-2 border-green-200 pl-3 py-1">
                            <div className="text-gray-600">
                              {task.completed ? '✅' : '⏳'} {task.title}
                              {task.completed && task.completedAt && (
                                <span className="text-xs text-gray-500 ml-2">
                                  (completada {formatDate(task.completedAt)})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              Creada {formatDate(task.createdAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!notes || notes.length === 0) && (!tasks || tasks.length === 0) && (
                    <div className="text-sm text-gray-500">No hay actividad aún</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
