/**
 * Error Handler Utilities
 * 
 * Normalizes API errors into user-friendly messages
 */

export interface ApiError {
  statusCode?: number;
  message?: string;
  error?: string;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    // Check if it's a fetch error
    if (error.message.includes('fetch')) {
      return 'Error de conexión. Verificá tu internet e intentá de nuevo.';
    }
    return error.message;
  }

  // Check if it's an API error response
  if (typeof error === 'object' && error !== null) {
    const apiError = error as ApiError;
    
    if (apiError.statusCode) {
      return getErrorMessageByStatus(apiError.statusCode, apiError.message);
    }
    
    if (apiError.message) {
      return apiError.message;
    }
    
    if (apiError.error) {
      return apiError.error;
    }
  }

  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

export function getErrorMessageByStatus(statusCode: number, defaultMessage?: string): string {
  switch (statusCode) {
    case 401:
      return 'Tu sesión expiró. Volvé a iniciar sesión.';
    case 403:
      return 'No tenés permisos para realizar esta acción.';
    case 404:
      return 'No encontrado.';
    case 409:
      return 'Conflicto: el recurso ya existe o está en uso.';
    case 422:
      return defaultMessage || 'Datos inválidos. Verificá los campos e intentá de nuevo.';
    case 429:
      return 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Error del servidor. Intentá de nuevo en unos momentos.';
    default:
      return defaultMessage || `Error ${statusCode}. Intentá de nuevo.`;
  }
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('fetch') || error.message.includes('network');
  }
  return false;
}

export function isAuthError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const apiError = error as ApiError;
    return apiError.statusCode === 401 || apiError.statusCode === 403;
  }
  return false;
}
