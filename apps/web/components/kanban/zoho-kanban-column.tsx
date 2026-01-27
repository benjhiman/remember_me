'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useDroppable } from '@dnd-kit/core';
import type { Lead } from '@/types/api';
import { ZohoKanbanCard } from './zoho-kanban-card';

interface ZohoKanbanColumnProps {
  stageId: string;
  stageName: string;
  leads: Lead[];
  isCompact?: boolean;
  activeLeadId?: string | null;
  onLeadClick?: (leadId: string) => void;
  className?: string;
}

/**
 * ZohoKanbanColumn - Column for a stage in Kanban board
 * 
 * Features:
 * - Header with stage name and count badge
 * - Menu button (placeholder)
 * - Scrollable area for cards
 * - Drop zone for drag & drop
 */
export function ZohoKanbanColumn({
  stageId,
  stageName,
  leads,
  isCompact = false,
  activeLeadId,
  onLeadClick,
  className,
}: ZohoKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageId,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col bg-muted/30 rounded-lg border border-border min-w-[280px] max-w-[320px]',
        isOver && 'bg-primary/5 border-primary/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {stageName}
          </h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {leads.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            // Placeholder: menu action
          }}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Cards Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {leads.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            Sin leads en esta etapa
          </div>
        ) : (
          leads.map((lead) => (
            <ZohoKanbanCard
              key={lead.id}
              lead={lead}
              isCompact={isCompact}
              isDragging={activeLeadId === lead.id}
              onClick={() => onLeadClick?.(lead.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
