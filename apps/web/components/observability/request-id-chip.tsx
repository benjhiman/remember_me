'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface RequestIdChipProps {
  requestId: string;
  className?: string;
  variant?: 'default' | 'compact';
}

/**
 * Component to display request ID with copy functionality
 * Can be used in toasts, error boundaries, or any error display
 */
export function RequestIdChip({ requestId, className, variant = 'default' }: RequestIdChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy request ID:', error);
    }
  };

  if (variant === 'compact') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <span className="text-xs text-muted-foreground">ID:</span>
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{requestId}</code>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={handleCopy}
          title="Copiar ID de error"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 mt-2 pt-2 border-t border-border', className)}>
      <span className="text-xs text-muted-foreground">ID de error:</span>
      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{requestId}</code>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={handleCopy}
        title="Copiar ID de error"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-600 mr-1" />
        ) : (
          <Copy className="h-3 w-3 mr-1" />
        )}
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}
