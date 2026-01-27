'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { usePipelines } from '@/lib/api/hooks/use-pipelines';
import { useLeads } from '@/lib/api/hooks/use-leads';
import { useOrgUsers } from '@/lib/api/hooks/use-org-users';
import { useUpdateLeadStage } from '@/lib/api/hooks/use-update-lead-stage';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { ZohoKanbanToolbar } from '@/components/kanban/zoho-kanban-toolbar';
import { ZohoKanbanBoard } from '@/components/kanban/zoho-kanban-board';
import { Plus, RefreshCw, Users } from 'lucide-react';
import { Permission, userCan } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/use-toast';
import type { Lead } from '@/types/api';

export default function BoardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { toast } = useToast();
  
  // Data hooks
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: orgUsers = [] } = useOrgUsers(!!user);
  const updateLeadStage = useUpdateLeadStage();

  // Filters state
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  // Get leads with filters
  const { data: leadsData, isLoading: leadsLoading } = useLeads({
    pipelineId: selectedPipelineId || undefined,
    assignedToId: selectedOwnerId || undefined,
    stageId: selectedStageId || undefined,
    q: searchQuery || undefined,
    limit: 1000, // Get all leads for the board
    enabled: !!selectedPipelineId,
  });

  // Auto-select first pipeline if available
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline = pipelines.find((p) => p.isDefault) || pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [pipelines, selectedPipelineId]);

  // Group leads by stageId
  const leadsByStage = (leadsData?.data || []).reduce(
    (acc, lead) => {
      const stageId = lead.stageId;
      if (!acc[stageId]) {
        acc[stageId] = [];
      }
      acc[stageId].push(lead);
      return acc;
    },
    {} as Record<string, Lead[]>
  );

  const selectedPipeline = pipelines?.find((p) => p.id === selectedPipelineId);
  const stages = selectedPipeline?.stages || [];

  // Handle drag & drop
  const handleDragStart = (leadId: string) => {
    setActiveLeadId(leadId);
  };

  const handleDragEnd = async (leadId: string, newStageId: string) => {
    if (!selectedPipelineId) return;

    const lead = leadsData?.data.find((l) => l.id === leadId);
    if (!lead || lead.stageId === newStageId) {
      return;
    }

    try {
      await updateLeadStage.mutateAsync({
        leadId,
        data: {
          stageId: newStageId,
          pipelineId: selectedPipelineId,
        },
      });
    } catch (error) {
      console.error('Error moving lead:', error);
      toast({
        title: 'Error',
        description: 'No se pudo mover el lead',
        variant: 'destructive',
      });
    }
  };

  // Handle lead click
  const handleLeadClick = (leadId: string) => {
    router.push(`/board/leads/${leadId}`);
  };

  // Handle refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['pipelines'] });
  };

  // Handle new lead
  const handleNewLead = () => {
    if (userCan(user, Permission.EDIT_LEADS)) {
      router.push('/board/leads/new');
    } else {
      toast({
        title: 'Próximamente',
        description: 'Esta funcionalidad estará disponible pronto',
      });
    }
  };

  // Prepare owners list (from org users)
  const owners = orgUsers
    .filter((u) => 
      (u.role === 'OWNER' || u.role === 'ADMIN' || u.role === 'MANAGER' || u.role === 'SELLER') &&
      u.name !== null
    )
    .map((u) => ({
      id: u.id,
      name: u.name!,
    }));

  // Mock stages for UI preview when no pipelines exist (TODO: remove when real data is available)
  const mockStages = [
    { id: 'mock-1', name: 'Nuevo', order: 0 },
    { id: 'mock-2', name: 'Contactado', order: 1 },
    { id: 'mock-3', name: 'Cerrado', order: 2 },
  ];

  const hasPipelines = pipelines && pipelines.length > 0;
  const hasStages = stages && stages.length > 0;
  const displayStages = hasStages ? stages : (hasPipelines ? [] : mockStages);
  const displayLeadsByStage = hasPipelines ? leadsByStage : {};

  return (
    <PageShell
      title="Board"
      description="Gestioná tus leads por etapas"
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Board', href: '/board' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleNewLead}
            disabled={!userCan(user, Permission.EDIT_LEADS)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo Lead
          </Button>
        </div>
      }
      toolbar={
        <ZohoKanbanToolbar
          pipelines={pipelines || []}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
          owners={owners}
          selectedOwnerId={selectedOwnerId}
          onOwnerChange={setSelectedOwnerId}
          stages={displayStages}
          selectedStageId={selectedStageId}
          onStageChange={setSelectedStageId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isCompact={isCompact}
          onCompactChange={setIsCompact}
        />
      }
    >
      {/* Loading state */}
      {pipelinesLoading ? (
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[280px]">
              <Skeleton className="h-[600px] rounded-lg" />
            </div>
          ))}
        </div>
      ) : !hasPipelines ? (
        /* No pipelines - show empty state inside PageShell */
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center">
            <Users className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay pipelines configurados
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Crea un pipeline primero para comenzar a gestionar tus leads en el Kanban.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  toast({
                    title: 'Próximamente',
                    description: 'La creación de pipelines estará disponible pronto',
                  });
                }}
              >
                Crear pipeline
              </Button>
              <Button
                onClick={() => router.push('/board/leads')}
              >
                Ver Leads
              </Button>
            </div>
          </div>
        </div>
      ) : !hasStages ? (
        /* Has pipelines but no stages - show empty state inside PageShell */
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="max-w-md text-center">
            <Users className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Este pipeline no tiene stages configurados
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Configura stages en tu pipeline para comenzar a usar el Kanban.
            </p>
            <Button
              onClick={() => router.push('/board/leads')}
            >
              Ver Leads
            </Button>
          </div>
        </div>
      ) : leadsLoading ? (
        /* Loading leads */
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[280px]">
              <Skeleton className="h-[600px] rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        /* Board with data */
        <ZohoKanbanBoard
          stages={displayStages}
          leadsByStage={displayLeadsByStage}
          isCompact={isCompact}
          activeLeadId={activeLeadId}
          onLeadClick={handleLeadClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      )}

      {/* Error message */}
      {updateLeadStage.isError && (
        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive">
            Error al mover el lead: {(updateLeadStage.error as Error)?.message || 'Error desconocido'}
          </p>
        </div>
      )}
    </PageShell>
  );
}
