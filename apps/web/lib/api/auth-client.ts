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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
const REQUEST_TIMEOUT = 30000; // 30 seconds

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
      fetch(`${API_BASE_URL}/auth/refresh`, {
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (user?.organizationId) {
    headers['X-Organization-Id'] = user.organizationId;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  let response: Response;
  let requestId: string | null = null;

  try {
    const fetchPromise = fetch(`${API_BASE_URL}${endpoint}`, {
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
    requestId = response.headers.get('X-Request-Id');

    // Handle 401 - try to refresh token (only once)
    if (response.status === 401 && refreshToken && accessToken) {
      try {
        const newAccessToken = await refreshAccessToken(refreshToken);
        updateAccessToken(newAccessToken);

        // Retry request with new token (only once)
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT);

        try {
          const retryHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
            Authorization: `Bearer ${newAccessToken}`,
          };
          if (user?.organizationId) {
            retryHeaders['X-Organization-Id'] = user.organizationId;
          }

          const retryFetchPromise = fetch(`${API_BASE_URL}${endpoint}`, {
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
          requestId = response.headers.get('X-Request-Id');
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
          requestId || undefined
        );
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorType = getErrorType(null, response.status);
      const apiError = new ApiError(
        errorData.message || `Request failed: ${response.statusText}`,
        response.status,
        errorType,
        errorData,
        requestId || undefined
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

    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors
    const errorType = getErrorType(error as Error);
    const isAborted = (error as Error)?.name === 'AbortError';
    
    if (isAborted) {
      throw new ApiError(
        'Request timeout. Please check your connection and try again.',
        0,
        ErrorType.TIMEOUT,
        undefined,
        requestId || undefined,
        error as Error
      );
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      errorType,
      undefined,
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
