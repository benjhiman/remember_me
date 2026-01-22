'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError, ErrorType } from '@/lib/api/auth-client';
import { cn } from '@/lib/utils/cn';

interface ApiErrorBannerProps {
  error: ApiError | null;
  onDismiss?: () => void;
  className?: string;
}

export function ApiErrorBanner({ error, onDismiss, className }: ApiErrorBannerProps) {
  const [visible, setVisible] = useState(!!error);

  useEffect(() => {
    setVisible(!!error);
  }, [error]);

  if (!error || !visible) {
    return null;
  }

  const getMessage = () => {
    switch (error.type) {
      case ErrorType.NETWORK:
      case ErrorType.DNS:
        return 'No se pudo conectar con el servidor. Verificá tu conexión.';
      case ErrorType.CORS:
        return 'Error de configuración. Contactá al administrador.';
      case ErrorType.TIMEOUT:
        return 'La solicitud tardó demasiado. Intentá nuevamente.';
      case ErrorType.AUTH:
        return 'Tu sesión expiró. Por favor, iniciá sesión nuevamente.';
      case ErrorType.SERVER:
        return 'Error del servidor. Intentá más tarde.';
      default:
        return error.message || 'Ocurrió un error.';
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg',
        className
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-destructive">{getMessage()}</p>
          {error.requestId && (
            <p className="text-xs text-muted-foreground mt-1">ID: {error.requestId}</p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
