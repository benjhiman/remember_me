'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { LucideIcon } from 'lucide-react';

export interface ZohoEmptyStateProps {
  title: string;
  headline: string;
  description?: string;
  primaryActionLabel: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  icon?: LucideIcon;
  className?: string;
  showDropdown?: boolean;
}

/**
 * ZohoEmptyState - Reusable empty state component matching Zoho Books style
 * 
 * Features:
 * - Title with optional dropdown caret
 * - Centered empty state with headline, description, and CTA
 * - Primary action button (blue, prominent)
 * - Optional secondary action link
 * - Optional icon or placeholder
 * 
 * Usage:
 * ```tsx
 * <ZohoEmptyState
 *   title="All Bills"
 *   headline="Owe money? It's good to pay bills on time!"
 *   description="If you've purchased something for your business..."
 *   primaryActionLabel="CREATE A BILL"
 *   onPrimaryAction={() => toast.info('Coming soon')}
 *   secondaryActionLabel="Import Bills"
 * />
 * ```
 */
export function ZohoEmptyState({
  title,
  headline,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon: Icon,
  className,
  showDropdown = false,
}: ZohoEmptyStateProps) {
  const handlePrimaryAction = () => {
    if (onPrimaryAction) {
      onPrimaryAction();
    } else {
      // Default: show toast
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-alert
        alert(`Coming soon: ${primaryActionLabel}`);
      }
    }
  };

  const handleSecondaryAction = () => {
    if (onSecondaryAction) {
      onSecondaryAction();
    } else {
      // Default: show toast
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-alert
        alert(`Coming soon: ${secondaryActionLabel}`);
      }
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            {showDropdown && (
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Empty State Content */}
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          {/* Icon or Placeholder */}
          {Icon ? (
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                <Icon className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                <svg
                  className="h-12 w-12 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Headline */}
          <h2 className="text-3xl font-bold text-foreground">{headline}</h2>

          {/* Description */}
          {description && (
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              {description}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col items-center gap-3 pt-4">
            <Button
              size="lg"
              onClick={handlePrimaryAction}
              className="min-w-[200px]"
            >
              {primaryActionLabel}
            </Button>
            {secondaryActionLabel && (
              <button
                onClick={handleSecondaryAction}
                className="text-sm text-primary hover:underline"
              >
                {secondaryActionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
