'use client';

import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiError, ErrorType } from '@/lib/api/auth-client';

interface Props {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }

      return <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error }: { error: Error }) {
  const isApiError = error instanceof ApiError;
  const errorType = isApiError ? error.type : ErrorType.UNKNOWN;
  const requestId = isApiError ? error.requestId : undefined;

  const getErrorMessage = () => {
    if (isApiError) {
      switch (errorType) {
        case ErrorType.NETWORK:
        case ErrorType.DNS:
          return 'No se pudo conectar con el servidor. Verificá tu conexión a internet.';
        case ErrorType.CORS:
          return 'Error de configuración CORS. Contactá al administrador.';
        case ErrorType.TIMEOUT:
          return 'La solicitud tardó demasiado. Intentá nuevamente.';
        case ErrorType.AUTH:
          return 'Tu sesión expiró. Por favor, iniciá sesión nuevamente.';
        case ErrorType.SERVER:
          return 'Error del servidor. Intentá más tarde.';
        default:
          return error.message || 'Ocurrió un error inesperado.';
      }
    }
    return error.message || 'Ocurrió un error inesperado.';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="flex justify-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Error</h1>
        <p className="text-muted-foreground">{getErrorMessage()}</p>
        {requestId && (
          <p className="text-xs text-muted-foreground">Request ID: {requestId}</p>
        )}
        <div className="flex gap-2 justify-center">
          <Button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            variant="default"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
          <Button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/login';
              }
            }}
            variant="outline"
          >
            Ir a Login
          </Button>
        </div>
      </div>
    </div>
  );
}
