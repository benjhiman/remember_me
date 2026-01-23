'use client';

import { useOrgStore } from '@/lib/store/org-store';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface OrgIndicatorProps {
  className?: string;
  showIcon?: boolean;
  variant?: 'subtle' | 'default';
}

/**
 * Organization Indicator
 * 
 * Displays current organization name in a subtle, Zoho-style pill.
 * Used in page headers to show context.
 */
export function OrgIndicator({ className, showIcon = true, variant = 'subtle' }: OrgIndicatorProps) {
  const { currentOrganization } = useOrgStore();

  if (!currentOrganization) {
    return null;
  }

  if (variant === 'subtle') {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        {showIcon && <Building2 className="h-3 w-3" />}
        <span className="truncate max-w-[200px]">{currentOrganization.name}</span>
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs', className)}>
      {showIcon && <Building2 className="h-3 w-3 text-muted-foreground" />}
      <span className="font-medium text-muted-foreground">{currentOrganization.name}</span>
    </div>
  );
}
