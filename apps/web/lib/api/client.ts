// Re-export from auth-client for backwards compatibility
// All API calls should use the new auth-client for better error handling
export { api, ApiError, ErrorType } from './auth-client';
