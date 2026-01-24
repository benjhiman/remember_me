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

/**
 * Extract request ID from error object
 * 
 * Checks multiple possible locations:
 * - error.requestId (ApiError)
 * - error.response?.data?.requestId (API response)
 * - error.response?.headers?.['x-request-id'] (response header)
 */
export function getRequestIdFromError(error: any): string | null {
  if (!error) return null;

  // ApiError has requestId property
  if (error.requestId) {
    return error.requestId;
  }

  // Check response data
  if (error?.response?.data?.requestId) {
    return error.response.data.requestId;
  }

  // Check response headers (if available)
  if (error?.response?.headers) {
    const headers = error.response.headers;
    if (typeof headers.get === 'function') {
      return headers.get('X-Request-Id') || headers.get('x-request-id') || null;
    }
    return headers['X-Request-Id'] || headers['x-request-id'] || null;
  }

  return null;
}
