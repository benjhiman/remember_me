'use client';

import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils/cn';
import { ZohoKanbanColumn } from './zoho-kanban-column';
import { ZohoKanbanCard } from './zoho-kanban-card';
import type { Lead } from '@/types/api';

interface Stage {
  id: string;
  name: string;
  order: number;
}

interface ZohoKanbanBoardProps {
  stages: Stage[];
  leadsByStage: Record<string, Lead[]>;
  isCompact?: boolean;
  activeLeadId?: string | null;
  onLeadClick?: (leadId: string) => void;
  onDragEnd?: (leadId: string, newStageId: string) => void;
  onDragStart?: (leadId: string) => void;
  className?: string;
}

/**
 * ZohoKanbanBoard - Main Kanban board component
 * 
 * Features:
 * - Horizontal scroll with snap
 * - Drag & drop support
 * - Columns for each stage
 * - Drag overlay
 */
export function ZohoKanbanBoard({
  stages,
  leadsByStage,
  isCompact = false,
  activeLeadId,
  onLeadClick,
  onDragEnd,
  onDragStart,
  className,
}: ZohoKanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const leadId = event.active.id as string;
    onDragStart?.(leadId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      onDragStart?.(null as any);
      return;
    }

    const leadId = active.id as string;
    const newStageId = over.id as string;

    // Check if dropped on a stage column
    const isDroppedOnStage = stages.some((s) => s.id === newStageId);
    
    if (isDroppedOnStage) {
      onDragEnd?.(leadId, newStageId);
    } else {
      // If dropped on another lead, find its stage
      const allLeads = Object.values(leadsByStage).flat();
      const targetLead = allLeads.find((l) => l.id === newStageId);
      if (targetLead) {
        onDragEnd?.(leadId, targetLead.stageId);
      }
    }

    onDragStart?.(null as any);
  };

  const activeLead = activeLeadId
    ? Object.values(leadsByStage)
        .flat()
        .find((l) => l.id === activeLeadId)
    : null;

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          'flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory',
          'scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent',
          className
        )}
        style={{
          scrollbarWidth: 'thin',
        }}
      >
        {sortedStages.map((stage) => (
          <div key={stage.id} className="snap-start flex-shrink-0">
            <ZohoKanbanColumn
              stageId={stage.id}
              stageName={stage.name}
              leads={leadsByStage[stage.id] || []}
              isCompact={isCompact}
              activeLeadId={activeLeadId}
              onLeadClick={onLeadClick}
            />
          </div>
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeLead ? (
          <div className="w-[280px]">
            <ZohoKanbanCard
              lead={activeLead}
              isCompact={isCompact}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
