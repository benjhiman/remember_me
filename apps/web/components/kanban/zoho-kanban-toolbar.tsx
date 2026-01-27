'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ZohoKanbanToolbarProps {
  // Pipeline filter
  pipelines?: Array<{ id: string; name: string }>;
  selectedPipelineId?: string;
  onPipelineChange?: (pipelineId: string) => void;

  // Owner filter
  owners?: Array<{ id: string; name: string }>;
  selectedOwnerId?: string;
  onOwnerChange?: (ownerId: string) => void;

  // Stage filter
  stages?: Array<{ id: string; name: string }>;
  selectedStageId?: string;
  onStageChange?: (stageId: string) => void;

  // Search
  searchQuery?: string;
  onSearchChange?: (query: string) => void;

  // Compact mode
  isCompact?: boolean;
  onCompactChange?: (compact: boolean) => void;

  className?: string;
}

/**
 * ZohoKanbanToolbar - Toolbar for Kanban board with filters and search
 * 
 * Zoho-style toolbar with:
 * - Pipeline selector
 * - Owner selector
 * - Stage selector
 * - Search input
 * - Compact mode toggle
 */
export function ZohoKanbanToolbar({
  pipelines = [],
  selectedPipelineId,
  onPipelineChange,
  owners = [],
  selectedOwnerId,
  onOwnerChange,
  stages = [],
  selectedStageId,
  onStageChange,
  searchQuery = '',
  onSearchChange,
  isCompact = false,
  onCompactChange,
  className,
}: ZohoKanbanToolbarProps) {
  return (
    <div className={cn('flex items-center gap-3 flex-wrap', className)}>
      {/* Pipeline Select */}
      <Select
        value={selectedPipelineId || 'all'}
        onValueChange={(value) => {
          if (value === 'all') {
            onPipelineChange?.('');
          } else {
            onPipelineChange?.(value);
          }
        }}
      >
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Pipeline" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {pipelines.map((pipeline) => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Owner Select */}
      <Select
        value={selectedOwnerId || 'all'}
        onValueChange={(value) => {
          if (value === 'all') {
            onOwnerChange?.('');
          } else {
            onOwnerChange?.(value);
          }
        }}
      >
        <SelectTrigger className="w-[120px] h-9 text-sm">
          <SelectValue placeholder="Owner" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {owners.map((owner) => (
            <SelectItem key={owner.id} value={owner.id}>
              {owner.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Stage Select */}
      <Select
        value={selectedStageId || 'all'}
        onValueChange={(value) => {
          if (value === 'all') {
            onStageChange?.('');
          } else {
            onStageChange?.(value);
          }
        }}
      >
        <SelectTrigger className="w-[120px] h-9 text-sm">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              {stage.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar leads…"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Compact Toggle */}
      <div className="flex items-center gap-2">
        <label htmlFor="compact-toggle" className="text-sm text-muted-foreground whitespace-nowrap">
          Compacto
        </label>
        <Switch
          id="compact-toggle"
          checked={isCompact}
          onCheckedChange={onCompactChange}
        />
      </div>
    </div>
  );
}
