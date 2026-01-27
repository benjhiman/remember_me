'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Lead } from '@/types/api';

interface ZohoKanbanCardProps {
  lead: Lead;
  isCompact?: boolean;
  isDragging?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * ZohoKanbanCard - Compact card for Kanban board
 * 
 * Features:
 * - Lead name (bold)
 * - Company/phone or "Sin empresa"
 * - Status badges
 * - Owner avatar with initials
 * - Relative time (e.g., "Hace 2h")
 * - Hover effects (shadow + border accent)
 */
export function ZohoKanbanCard({
  lead,
  isCompact = false,
  isDragging = false,
  onClick,
  className,
}: ZohoKanbanCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'default';
      case 'CONVERTED':
        return 'secondary';
      case 'LOST':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'CONVERTED':
        return 'Convertido';
      case 'LOST':
        return 'Perdido';
      case 'ARCHIVED':
        return 'Archivado';
      default:
        return status;
    }
  };

  const relativeTime = formatDistanceToNow(new Date(lead.updatedAt), {
    addSuffix: true,
    locale: es,
  }).replace('hace ', 'Hace ');

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-sm hover:border-primary/50',
        isDragging && 'opacity-50',
        isCompact && 'p-2',
        className
      )}
      onClick={onClick}
    >
      <CardContent className={cn('p-3', isCompact && 'p-2')}>
        {/* Title */}
        <div className="font-semibold text-sm text-foreground mb-1.5 line-clamp-1">
          {lead.name}
        </div>

        {/* Subtitle: Company or Phone */}
        <div className="text-xs text-muted-foreground mb-2 line-clamp-1">
          {lead.email || lead.phone || 'Sin empresa'}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <Badge variant={getStatusBadgeVariant(lead.status)} className="text-[10px] px-1.5 py-0">
            {getStatusLabel(lead.status)}
          </Badge>
          {lead.tags && lead.tags.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {lead.tags[0]}
            </Badge>
          )}
        </div>

        {/* Footer: Owner + Time */}
        <div className="flex items-center justify-between gap-2 mt-2">
          {lead.assignedTo ? (
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {getInitials(lead.assignedTo.name)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                {lead.assignedTo.name}
              </span>
            </div>
          ) : (
            <div className="h-5" />
          )}
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {relativeTime}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
