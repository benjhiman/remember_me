'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { usePipelines } from '@/lib/api/hooks/use-pipelines';
import { useDeletePipeline } from '@/lib/api/hooks/use-delete-pipeline';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, ExternalLink } from 'lucide-react';
import { Permission, userCan } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/utils/lead-utils';

export default function PipelinesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { data: pipelines, isLoading, error } = usePipelines(!!user);
  const deletePipeline = useDeletePipeline();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pipelineToDelete, setPipelineToDelete] = useState<{ id: string; name: string } | null>(null);

  const canManagePipelines = userCan(user, Permission.EDIT_LEADS);

  const handleDeleteClick = (pipeline: { id: string; name: string }) => {
    setPipelineToDelete(pipeline);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pipelineToDelete) return;

    try {
      await deletePipeline.mutateAsync(pipelineToDelete.id);
      setDeleteDialogOpen(false);
      setPipelineToDelete(null);
    } catch (error) {
      // Error is handled by the mutation
      console.error('Error deleting pipeline:', error);
    }
  };

  const handleOpenInKanban = (pipelineId: string) => {
    router.push(`/board?pipelineId=${pipelineId}`);
  };

  const breadcrumbs = [
    { label: 'Home', href: '/dashboard' },
    { label: 'Kanban', href: '/board' },
    { label: 'Pipelines', href: '/board/pipelines' },
  ];

  return (
    <PageShell
      title="Pipelines"
      description="Gestiona tus pipelines y stages"
      breadcrumbs={breadcrumbs}
      actions={
        canManagePipelines && (
          <Button size="sm" onClick={() => router.push('/board/pipelines/new')}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Pipeline
          </Button>
        )
      }
    >
      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive mb-3">
              Error: {(error as Error).message || 'No se pudo cargar los pipelines'}
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && pipelines && pipelines.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-sm font-semibold text-foreground mb-2">No hay pipelines</p>
            <p className="text-sm text-muted-foreground mb-6">
              Crea tu primer pipeline para comenzar a gestionar leads.
            </p>
            {canManagePipelines && (
              <Button onClick={() => router.push('/board/pipelines/new')}>
                <Plus className="h-4 w-4 mr-1.5" />
                Crear Pipeline
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pipelines List */}
      {!isLoading && !error && pipelines && pipelines.length > 0 && (
        <div className="space-y-3">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {pipeline.color && (
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: pipeline.color }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{pipeline.name}</h3>
                        {pipeline.isDefault && (
                          <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{pipeline.stages?.length || 0} stages</span>
                        {pipeline.createdAt && (
                          <span>Created {formatDate(pipeline.createdAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenInKanban(pipeline.id)}
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Open in Kanban
                    </Button>
                    {canManagePipelines && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick({ id: pipeline.id, name: pipeline.name })}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete pipeline?</DialogTitle>
            <DialogDescription>
              This will remove the pipeline &quot;{pipelineToDelete?.name}&quot; and all its stages.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setPipelineToDelete(null);
              }}
              disabled={deletePipeline.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deletePipeline.isPending}
            >
              {deletePipeline.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
