/**
 * Error handling utilities
 */

export function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error';

  // Handle API errors with structured response
  if (error?.response?.data) {
    const data = error.response.data;
    
    // Handle 403 Forbidden with permission details
    if (error.response.status === 403 && data.code === 'FORBIDDEN') {
      return data.message || 'No tenés permisos para esta acción';
    }
    
    return data.message || data.error || 'Error desconocido';
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  return 'Error desconocido';
}
