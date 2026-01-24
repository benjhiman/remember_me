'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils/cn';

interface ErrorToastWithRequestIdProps {
  requestId?: string | null;
  className?: string;
}

/**
 * Component to display request ID in error toasts with copy functionality
 */
export function ErrorToastWithRequestId({ requestId, className }: ErrorToastWithRequestIdProps) {
  const [copied, setCopied] = useState(false);

  if (!requestId) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy request ID:', error);
    }
  };

  return (
    <div className={cn('flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700', className)}>
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
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
