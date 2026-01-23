'use client';

import { ReactNode } from 'react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils/cn';

interface PageShellProps {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href: string }>;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
}

/**
 * PageShell - Zoho-like page container
 * 
 * Provides consistent page structure:
 * - Header with breadcrumbs, title, description, and actions
 * - Optional toolbar (for search, filters, etc.)
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
  toolbar,
}: PageShellProps) {
  return (
    <div className={cn('flex flex-col h-full bg-gray-50', className)}>
      {/* Header - Zoho style */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <div className="mb-1.5">
                  <Breadcrumb items={breadcrumbs} />
                </div>
              )}
              <h1 className="text-xl font-semibold text-gray-900 leading-tight">{title}</h1>
              {description && (
                <p className="text-sm text-gray-600 mt-0.5">{description}</p>
              )}
            </div>
            {actions && (
              <div className="flex-shrink-0 flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
        {toolbar && (
          <div className="px-6 py-2.5 border-t border-gray-100 bg-gray-50">
            {toolbar}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
