'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { usePipelines } from '@/lib/api/hooks/use-pipelines';
import { useLeads } from '@/lib/api/hooks/use-leads';
import { useUpdateLeadStage } from '@/lib/api/hooks/use-update-lead-stage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getStatusBadgeColor, getStatusLabel, formatDate } from '@/lib/utils/lead-utils';
import type { Lead, LeadStatus } from '@/types/api';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  isDragging?: boolean;
}

function LeadCard({ lead, onClick, isDragging: externalIsDragging }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: internalIsDragging,
  } = useSortable({ id: lead.id });

  const isDraggingNow = externalIsDragging || internalIsDragging;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDraggingNow ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="mb-2 cursor-move hover:shadow-md transition-shadow"
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="font-medium text-sm mb-1">{lead.name}</div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                lead.status
              )}`}
            >
              {getStatusLabel(lead.status)}
            </span>
          </div>
          {lead.assignedTo && (
            <div className="text-xs text-gray-600 mb-1">
              👤 {lead.assignedTo.name}
            </div>
          )}
          <div className="text-xs text-gray-500">
            {formatDate(lead.updatedAt)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StageColumnProps {
  stageId: string;
  stageName: string;
  leads: Lead[];
  onLeadClick: (leadId: string) => void;
  activeLeadId: string | null;
}

function StageColumn({ stageId, stageName, leads, onLeadClick, activeLeadId }: StageColumnProps) {
  const sortableIds = leads.map((lead) => lead.id);
  const { setNodeRef, isOver } = useDroppable({
    id: stageId,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] bg-gray-50 rounded-lg p-4 transition-colors ${
        isOver ? 'bg-blue-50 border-2 border-blue-300' : ''
      }`}
    >
      <div className="font-semibold text-sm mb-3 text-gray-700">
        {stageName} ({leads.length})
      </div>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {leads.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8">
              Sin leads
            </div>
          ) : (
            leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => onLeadClick(lead.id)}
                isDragging={activeLeadId === lead.id}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function LeadsBoardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  const updateLeadStage = useUpdateLeadStage();

  // Get leads for selected pipeline
  const { data: leadsData, isLoading: leadsLoading } = useLeads({
    pipelineId: selectedPipelineId,
    limit: 1000, // Get all leads for the board
    enabled: !!selectedPipelineId,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before dragging starts
      },
    })
  );

  // Auto-select first pipeline if available
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !selectedPipelineId) {
      const defaultPipeline = pipelines.find((p) => p.isDefault) || pipelines[0];
      setSelectedPipelineId(defaultPipeline.id);
    }
  }, [pipelines, selectedPipelineId]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const selectedPipeline = pipelines?.find((p) => p.id === selectedPipelineId);
  const stages = selectedPipeline?.stages || [];

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLeadId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLeadId(null);

    if (!over || !selectedPipelineId) {
      return;
    }

    const leadId = active.id as string;
    const newStageId = over.id as string;

    // Find the lead being moved
    const lead = leadsData?.data.find((l) => l.id === leadId);
    if (!lead) {
      return;
    }

    // Check if dropped on a stage column (not on another lead)
    const isDroppedOnStage = stages.some((s) => s.id === newStageId);
    if (!isDroppedOnStage) {
      // If dropped on another lead, find the stage of that lead
      const targetLead = leadsData?.data.find((l) => l.id === newStageId);
      if (!targetLead) {
        return;
      }
      const actualNewStageId = targetLead.stageId;
      
      // Don't do anything if dropped in the same stage
      if (lead.stageId === actualNewStageId) {
        return;
      }

      // Update to the target lead's stage
      try {
        await updateLeadStage.mutateAsync({
          leadId,
          data: {
            stageId: actualNewStageId,
            pipelineId: selectedPipelineId,
          },
        });
      } catch (error) {
        console.error('Error moving lead:', error);
      }
      return;
    }

    // Don't do anything if dropped in the same stage
    if (lead.stageId === newStageId) {
      return;
    }

    try {
      // Update via API
      await updateLeadStage.mutateAsync({
        leadId,
        data: {
          stageId: newStageId,
          pipelineId: selectedPipelineId, // Ensure pipeline is set
        },
      });
    } catch (error) {
      // Error is handled by the mutation, but we could show a toast here
      console.error('Error moving lead:', error);
    }
  };

  const handleLeadClick = (leadId: string) => {
    router.push(`/leads/${leadId}`);
  };

  const activeLead = activeLeadId
    ? leadsData?.data.find((l) => l.id === activeLeadId)
    : null;

  if (pipelinesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Cargando pipelines...</p>
        </div>
      </div>
    );
  }

  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Kanban de Leads</h1>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">
                No hay pipelines configurados. Crea un pipeline primero.
              </p>
              <Button onClick={() => router.push('/leads')} className="mt-4">
                Volver a Lista
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kanban de Leads</h1>
            <p className="text-gray-600">Arrastra y suelta leads entre stages</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/leads')}>
              Lista
            </Button>
            <Button onClick={() => router.push('/leads/new')}>
              Crear Lead
            </Button>
          </div>
        </div>

        {/* Pipeline Selector */}
        {pipelines.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Pipeline
            </label>
            <select
              className="w-full max-w-xs h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Board */}
        {leadsLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Cargando leads...</p>
          </div>
        ) : !selectedPipelineId || stages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600">
                {!selectedPipelineId
                  ? 'Selecciona un pipeline para ver el board'
                  : 'Este pipeline no tiene stages configurados'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stages
                .sort((a, b) => a.order - b.order)
                .map((stage) => (
                  <StageColumn
                    key={stage.id}
                    stageId={stage.id}
                    stageName={stage.name}
                    leads={leadsByStage[stage.id] || []}
                    onLeadClick={handleLeadClick}
                    activeLeadId={activeLeadId}
                  />
                ))}
            </div>

            <DragOverlay>
              {activeLead ? (
                <Card className="w-[280px]">
                  <CardContent className="p-3">
                    <div className="font-medium text-sm mb-1">
                      {activeLead.name}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                          activeLead.status
                        )}`}
                      >
                        {getStatusLabel(activeLead.status)}
                      </span>
                    </div>
                    {activeLead.assignedTo && (
                      <div className="text-xs text-gray-600 mb-1">
                        👤 {activeLead.assignedTo.name}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {formatDate(activeLead.updatedAt)}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Error message */}
        {updateLeadStage.isError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              Error al mover el lead: {(updateLeadStage.error as Error)?.message || 'Error desconocido'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
