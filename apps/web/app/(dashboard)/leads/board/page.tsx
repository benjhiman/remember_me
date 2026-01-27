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

export default function LeadsBoardPage() {
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
    router.push(`/leads/${leadId}`);
  };

  // Handle refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['pipelines'] });
  };

  // Handle new lead
  const handleNewLead = () => {
    if (userCan(user, Permission.EDIT_LEADS)) {
      router.push('/leads/new');
    } else {
      toast({
        title: 'Próximamente',
        description: 'Esta funcionalidad estará disponible pronto',
      });
    }
  };

  // Loading state
  if (pipelinesLoading) {
    return (
      <PageShell
        title="Kanban"
        description="Gestioná tus leads por etapas"
        breadcrumbs={[
          { label: 'Leads', href: '/leads' },
          { label: 'Kanban', href: '/leads/board' },
        ]}
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-[280px]">
                <Skeleton className="h-[600px] rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  // No pipelines
  if (!pipelines || pipelines.length === 0) {
    return (
      <ZohoEmptyState
        title="Kanban"
        headline="No hay pipelines configurados"
        description="Crea un pipeline primero para comenzar a gestionar tus leads en el Kanban."
        primaryActionLabel="Volver a Leads"
        onPrimaryAction={() => router.push('/leads')}
      />
    );
  }

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

  return (
    <PageShell
      title="Kanban"
      description="Gestioná tus leads por etapas"
      breadcrumbs={[
        { label: 'Leads', href: '/leads' },
        { label: 'Kanban', href: '/leads/board' },
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
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onPipelineChange={setSelectedPipelineId}
          owners={owners}
          selectedOwnerId={selectedOwnerId}
          onOwnerChange={setSelectedOwnerId}
          stages={stages}
          selectedStageId={selectedStageId}
          onStageChange={setSelectedStageId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isCompact={isCompact}
          onCompactChange={setIsCompact}
        />
      }
    >
      {/* Board */}
      {leadsLoading ? (
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-shrink-0 w-[280px]">
              <Skeleton className="h-[600px] rounded-lg" />
            </div>
          ))}
        </div>
      ) : !selectedPipelineId || stages.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {!selectedPipelineId
                ? 'Selecciona un pipeline para ver el board'
                : 'Este pipeline no tiene stages configurados'}
            </h3>
          </div>
        </div>
      ) : (
        <ZohoKanbanBoard
          stages={stages}
          leadsByStage={leadsByStage}
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
