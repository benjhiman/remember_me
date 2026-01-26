/**
 * Centralized Auth Client with robust error handling, timeouts, and token refresh.
 * 
 * Features:
 * - Automatic token refresh on 401
 * - Timeout handling
 * - Error type differentiation (CORS, DNS, network, etc.)
 * - Request ID tracking
 * - Credentials support
 */

import { useAuthStore } from '../store/auth-store';
import { useOrgStore } from '../store/org-store';
import { getOrCreateRequestId } from '../observability/request-id';
import { getApiBaseUrl } from '../runtime-config';
import { fetchWithDiagnostics, RedirectError, OpaqueResponseError } from './fetch-with-diagnostics';

// Build endpoint URL safely (avoid //api/api)
function buildEndpointUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrlForRequest();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanEndpoint}`;
  
  // Validate URL format
  try {
    new URL(fullUrl);
  } catch (e) {
    console.error('[API_URL_ERROR] Invalid URL constructed:', { baseUrl, endpoint, fullUrl });
    throw new Error(`Invalid API URL: ${fullUrl}`);
  }
  
  return fullUrl;
}

const REQUEST_TIMEOUT = 30000; // 30 seconds

// Get API base URL (single source of truth)
function getApiBaseUrlForRequest(): string {
  return getApiBaseUrl();
}

export enum ErrorType {
  NETWORK = 'NETWORK',
  CORS = 'CORS',
  DNS = 'DNS',
  TIMEOUT = 'TIMEOUT',
  AUTH = 'AUTH',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  UNKNOWN = 'UNKNOWN',
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public type: ErrorType,
    public data?: any,
    public requestId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getErrorType(error: Error | null, status?: number): ErrorType {
  if (!error) {
    if (status === 401 || status === 403) return ErrorType.AUTH;
    if (status && status >= 500) return ErrorType.SERVER;
    if (status && status >= 400) return ErrorType.CLIENT;
    return ErrorType.UNKNOWN;
  }

  const message = error.message.toLowerCase();
  
  if (message.includes('cors') || message.includes('cross-origin')) {
    return ErrorType.CORS;
  }
  if (message.includes('dns') || message.includes('getaddrinfo')) {
    return ErrorType.DNS;
  }
  if (message.includes('timeout') || message.includes('aborted')) {
    return ErrorType.TIMEOUT;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return ErrorType.NETWORK;
  }
  if (status === 401 || status === 403) {
    return ErrorType.AUTH;
  }
  if (status && status >= 500) {
    return ErrorType.SERVER;
  }
  if (status && status >= 400) {
    return ErrorType.CLIENT;
  }
  
  return ErrorType.NETWORK;
}

function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await Promise.race([
      fetch(buildEndpointUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
        signal: controller.signal,
      }),
      createTimeoutPromise(REQUEST_TIMEOUT),
    ]);

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        'Failed to refresh token',
        response.status,
        ErrorType.AUTH,
        errorData,
        response.headers.get('X-Request-Id') || undefined
      );
    }

    const data = await response.json();
    if (!data.accessToken) {
      throw new ApiError('Invalid refresh response', 500, ErrorType.SERVER);
    }

    return data.accessToken;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      'Network error during token refresh',
      0,
      getErrorType(error as Error),
      undefined,
      undefined,
      error as Error
    );
  }
}

export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { accessToken, refreshToken, user, clearAuth, updateAccessToken } =
      useAuthStore.getState();
    const { currentOrganizationId } = useOrgStore.getState();

    // Get client version (commit hash or build id)
    const clientVersion = 
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
      process.env.NEXT_PUBLIC_GIT_COMMIT?.slice(0, 7) ||
      undefined;

    // Get or create request ID for this request
    const requestId = getOrCreateRequestId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      'X-Client': 'web',
      ...(clientVersion && { 'X-Client-Version': clientVersion }),
      ...(options.headers as Record<string, string>),
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Use org store first, fallback to user.organizationId for backward compatibility
    const orgId = currentOrganizationId || user?.organizationId;
    if (orgId) {
      headers['X-Organization-Id'] = orgId;
    }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  let responseRequestId: string | null = null;

  try {
    const url = buildEndpointUrl(endpoint);
    
    // Logging in production (only on error, to avoid noise)
    const isProduction = typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' &&
      !window.location.hostname.includes('127.0.0.1');
    
    // Use fetchWithDiagnostics to detect redirects
    const fetchPromise = fetchWithDiagnostics(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(REQUEST_TIMEOUT),
    ]);

    clearTimeout(timeoutId);
    responseRequestId = response.headers.get('X-Request-Id');
    
    // Log diagnostics in production if response is not OK (for debugging)
    if (isProduction && !response.ok && process.env.NODE_ENV === 'production') {
      const finalUrl = response.url || url;
      const redirected = response.redirected || false;
      const responseType = response.type;
      console.warn('[API_REQUEST]', JSON.stringify({
        endpoint,
        finalUrl,
        status: response.status,
        redirected,
        responseType,
        requestId,
        origin: typeof window !== 'undefined' ? window.location.origin : 'SSR',
      }));
    }

    // Handle 401 - try to refresh token (only once)
    if (response.status === 401 && refreshToken && accessToken) {
      try {
        const newAccessToken = await refreshAccessToken(refreshToken);
        updateAccessToken(newAccessToken);

        // Retry request with new token (only once)
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT);

        try {
          // Reuse same request ID for retry
          const retryRequestId = getOrCreateRequestId();
          const retryClientVersion = 
            process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
            process.env.NEXT_PUBLIC_GIT_COMMIT?.slice(0, 7) ||
            undefined;

          const retryHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Request-Id': retryRequestId,
            'X-Client': 'web',
            ...(retryClientVersion && { 'X-Client-Version': retryClientVersion }),
            ...(options.headers as Record<string, string>),
            Authorization: `Bearer ${newAccessToken}`,
          };
          // Use org store first, fallback to user.organizationId for backward compatibility
          const orgId = useOrgStore.getState().currentOrganizationId || user?.organizationId;
          if (orgId) {
            retryHeaders['X-Organization-Id'] = orgId;
          }

          const retryFetchPromise = fetch(buildEndpointUrl(endpoint), {
            ...options,
            headers: retryHeaders,
            credentials: 'include',
            signal: retryController.signal,
          });

          response = await Promise.race([
            retryFetchPromise,
            createTimeoutPromise(REQUEST_TIMEOUT),
          ]);

          clearTimeout(retryTimeoutId);
          responseRequestId = response.headers.get('X-Request-Id');
        } catch (retryError) {
          clearTimeout(retryTimeoutId);
          throw retryError;
        }
      } catch (refreshError) {
        // Refresh failed, clear auth
        clearAuth();
        // Don't redirect here - let RouteGuard handle it to avoid loops
        throw new ApiError(
          'Session expired. Please login again.',
          401,
          ErrorType.AUTH,
          undefined,
          responseRequestId || undefined
        );
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Always classify 401/403 as AUTH error, not NETWORK
      const errorType = response.status === 401 || response.status === 403 
        ? ErrorType.AUTH 
        : getErrorType(null, response.status);
      
      // Use backend message if available, otherwise use status text
      const errorMessage = errorData.message || errorData.error || `Request failed: ${response.statusText}`;
      
      const apiError = new ApiError(
        errorMessage,
        response.status,
        errorType,
        errorData,
        responseRequestId || undefined
      );

      // Don't auto-redirect on 401 - let RouteGuard handle it to avoid loops
      if (response.status === 401 || response.status === 403) {
        clearAuth();
        // RouteGuard will detect the cleared auth and redirect appropriately
      }

      throw apiError;
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    // Log error details in production for debugging
    const isProduction = typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' &&
      !window.location.hostname.includes('127.0.0.1');
    
    if (isProduction && process.env.NODE_ENV === 'production') {
      const errorDetails = {
        endpoint,
        url: buildEndpointUrl(endpoint),
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        requestId,
        origin: typeof window !== 'undefined' ? window.location.origin : 'SSR',
      };
      console.error('[API_REQUEST_ERROR]', JSON.stringify(errorDetails));
    }

    if (error instanceof ApiError) {
      throw error;
    }

    // Handle redirect errors
    if (error instanceof RedirectError) {
      throw new ApiError(
        `REDIRECT_DETECTED: Request was redirected to ${error.location || 'unknown location'}`,
        0,
        ErrorType.CORS, // Redirects often break CORS
        { redirectLocation: error.location, diagnostics: error.diagnostics },
        requestId || undefined,
        error
      );
    }

    // Handle opaque response errors (CORS issue)
    if (error instanceof OpaqueResponseError) {
      throw new ApiError(
        'CORS bloqueado: El servidor no permite conexiones desde este dominio.',
        0,
        ErrorType.CORS,
        { diagnostics: error.diagnostics },
        requestId || undefined,
        error
      );
    }

    // Handle network errors
    const errorType = getErrorType(error as Error);
    const isAborted = (error as Error)?.name === 'AbortError';
    
    if (isAborted) {
      throw new ApiError(
        'El servidor no responde. Verificá que el API esté disponible.',
        0,
        ErrorType.TIMEOUT,
        undefined,
        requestId || undefined,
        error as Error
      );
    }

    // For TypeError "Failed to fetch", don't assume CORS - classify as NETWORK by default
    // Only mark as CORS if we have explicit evidence (opaque response, redirect, etc.)
    const errorMessage = error instanceof Error ? error.message : 'No se pudo conectar con el servidor. Verificá tu conexión.';
    const isCorsError = errorMessage.toLowerCase().includes('cors') || 
                       errorMessage.toLowerCase().includes('cross-origin');

    // Default to NETWORK for "Failed to fetch" unless we have explicit CORS evidence
    const finalErrorType = isCorsError ? ErrorType.CORS : ErrorType.NETWORK;

    // Provide more helpful error message
    const finalErrorMessage = error instanceof TypeError && errorMessage.includes('Failed to fetch')
      ? 'No se pudo conectar con el servidor. Verificá tu conexión y que el API esté disponible.'
      : errorMessage;

    throw new ApiError(
      finalErrorMessage,
      0,
      finalErrorType,
      { 
        originalError: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : undefined,
      },
      requestId || undefined,
      error as Error
    );
  }
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: options?.method || 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
