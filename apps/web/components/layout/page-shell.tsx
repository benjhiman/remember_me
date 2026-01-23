'use client';

import { ReactNode } from 'react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface PageShellProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href: string }>;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * PageShell - Zoho-like page container
 * 
 * Provides consistent page structure:
 * - Header with breadcrumbs, title, description, and actions
 * - Content area with proper spacing
 * - Zoho-like styling (compact, professional)
 */
export function PageShell({
  title,
  description,
  breadcrumbs,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <div className="mb-2">
                <Breadcrumb items={breadcrumbs} />
              </div>
            )}
            <h1 className="text-2xl font-semibold text-gray-900 leading-tight">{title}</h1>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex-shrink-0 flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
