/**
 * Error handling utilities
 */

export function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error';

  // Handle API errors with structured response
  if (error?.response?.data) {
    const data = error.response.data;
    const status = error.response.status;
    
    // Handle 403 Forbidden with permission details
    if (status === 403 && data.code === 'FORBIDDEN') {
      return data.message || 'No tenés permisos para esta acción';
    }
    
    // Handle 400 Bad Request with validation errors
    if (status === 400) {
      // NestJS ValidationPipe returns errors in different formats:
      // 1. Array of validation errors: { message: ['field must be...', ...] }
      // 2. Single message: { message: 'error message' }
      // 3. Error object: { message: { field: ['error'], ... } }
      
      if (Array.isArray(data.message)) {
        // Multiple validation errors - show the first one
        return data.message[0] || 'Error de validación. Revisá los campos obligatorios.';
      }
      
      if (typeof data.message === 'object' && data.message !== null) {
        // Nested validation errors: { message: { field: ['error'], ... } }
        const firstField = Object.keys(data.message)[0];
        const firstError = Array.isArray(data.message[firstField]) 
          ? data.message[firstField][0]
          : data.message[firstField];
        if (firstError) {
          return `${firstField}: ${firstError}`;
        }
      }
      
      // Single message string
      if (typeof data.message === 'string' && data.message.trim() !== '') {
        return data.message;
      }
      
      // Fallback for 400 without clear message
      return data.error || 'Error de validación. Revisá los campos obligatorios.';
    }
    
    // Other status codes
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
