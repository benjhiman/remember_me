import { useAuthStore } from '../store/auth-store';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new ApiError('Failed to refresh token', response.status);
  }

  const data = await response.json();
  return data.accessToken;
}

function handleApiError(error: ApiError) {
  // Global error handling
  if (error.status === 401) {
    // Unauthorized - logout and redirect
    const { clearAuth } = useAuthStore.getState();
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return;
  }

  if (error.status === 403) {
    // Forbidden - show permission error
    if (typeof window !== 'undefined') {
      alert('No tienes permisos para realizar esta acción.');
    }
    return;
  }

  // Re-throw other errors
  throw error;
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

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 - try to refresh token
  if (response.status === 401 && refreshToken && accessToken) {
    try {
      const newAccessToken = await refreshAccessToken(refreshToken);
      updateAccessToken(newAccessToken);

      // Retry request with new token
      const retryHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
        Authorization: `Bearer ${newAccessToken}`,
      };
      if (user?.organizationId) {
        retryHeaders['X-Organization-Id'] = user.organizationId;
      }
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: retryHeaders,
      });
    } catch (error) {
      // Refresh failed, clear auth and redirect to login
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new ApiError('Session expired', 401);
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const apiError = new ApiError(
      errorData.message || `Request failed: ${response.statusText}`,
      response.status,
      errorData
    );

    // Handle global errors
    handleApiError(apiError);

    throw apiError;
  }

  return response.json();
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
