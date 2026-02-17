'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOrgStore } from '@/lib/store/org-store';
import { useOrganizations, AuthError } from '@/lib/api/hooks/use-organizations';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';

const ORG_LOAD_TIMEOUT = 8000; // 8 seconds max for org loading
const AUTH_RETRY_DELAY = 1000; // 1 second before retry on AUTH error

/**
 * Organization Provider
 * 
 * Loads and manages organization context on app mount.
 * Must be rendered inside authenticated layout.
 * 
 * Features:
 * - Timeout protection to prevent infinite loading
 * - Error state with retry
 * - Production logging
 */
export function OrgProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { currentOrganizationId, setMemberships, error: orgError } = useOrgStore();
  const { data: orgs, isLoading, error } = useOrganizations();
  const queryClient = useQueryClient();
  const [configError, setConfigError] = useState<string | null>(null);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [authRetryAttempted, setAuthRetryAttempted] = useState(false);
  const authRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for API configuration error on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedError = sessionStorage.getItem('rm.apiConfigError');
      if (storedError) {
        setConfigError(storedError);
        sessionStorage.removeItem('rm.apiConfigError');
      }
    }
  }, []);

  // Set timeout for org loading
  useEffect(() => {
    if (user && isLoading && !orgs) {
      const timeout = setTimeout(() => {
        if (isLoading && !orgs) {
          console.error('[ORG_PROVIDER] ⚠️ Organization load timeout exceeded');
          setLoadTimeout(true);
        }
      }, ORG_LOAD_TIMEOUT);

      return () => clearTimeout(timeout);
    } else {
      setLoadTimeout(false);
    }
  }, [user, isLoading, orgs]);

  // Handle AUTH_ERROR with intelligent recovery
  useEffect(() => {
    if (error instanceof AuthError || (error as any)?.status === 401 || (error as any)?.status === 403) {
      // Production logging
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
        console.log('[ORG_PROVIDER] 🔐 AUTH_ERROR detected, attempting recovery...');
      }

      // Retry once after delay
      if (!authRetryAttempted) {
        setAuthRetryAttempted(true);
        
        authRetryTimeoutRef.current = setTimeout(() => {
          // Production logging
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
            console.log('[ORG_PROVIDER] 🔄 Retrying organizations fetch after AUTH error...');
          }
          
          // Force refetch
          queryClient.invalidateQueries({ queryKey: ['organizations'] });
        }, AUTH_RETRY_DELAY);
      } else {
        // Retry failed, logout and redirect
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
          console.error('[ORG_PROVIDER] ❌ AUTH retry failed, logging out...');
        }
        
        clearAuth();
        router.push('/login');
      }
    }

    return () => {
      if (authRetryTimeoutRef.current) {
        clearTimeout(authRetryTimeoutRef.current);
      }
    };
  }, [error, authRetryAttempted, queryClient, clearAuth, router]);

  // Production logging
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      if (user && orgs) {
        console.log('[ORG_PROVIDER] ✅ Organizations loaded:', orgs.length);
        console.log('[ORG_PROVIDER] Current org:', currentOrganizationId);
      } else if (user && error) {
        const errorType = error instanceof AuthError ? 'AUTH_ERROR' : 'NETWORK_ERROR';
        console.error(`[ORG_PROVIDER] ❌ Failed to load organizations (${errorType}):`, error);
      }
    }
  }, [user, orgs, error, currentOrganizationId]);

  // Sync orgs when loaded
  useEffect(() => {
    if (orgs && orgs.length > 0) {
      setMemberships(orgs);
    }
  }, [orgs, setMemberships]);

  // Initialize org from user.organizationId if no org selected yet
  useEffect(() => {
    if (user?.organizationId && !currentOrganizationId && orgs && orgs.length > 0) {
      const userOrg = orgs.find((o) => o.id === user.organizationId);
      if (userOrg) {
        useOrgStore.getState().setCurrentOrganization(user.organizationId);
      }
    }
  }, [user?.organizationId, currentOrganizationId, orgs]);

  // Invalidate /me query when org changes to refresh permissions
  useEffect(() => {
    if (currentOrganizationId) {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  }, [currentOrganizationId, queryClient]);

  // Show configuration error if present
  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <div className="text-red-600 font-semibold mb-2">Configuration Error</div>
          <div className="text-sm text-red-700 dark:text-red-300 mb-4">{configError}</div>
          <div className="text-xs text-red-600 dark:text-red-400 mb-4">
            Please configure NEXT_PUBLIC_API_BASE_URL in Vercel environment variables.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show timeout error
  if (loadTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
          <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <div className="text-yellow-600 font-semibold mb-2">Loading Timeout</div>
          <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
            Organizations are taking longer than expected to load. The API may be slow or unavailable.
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm hover:bg-yellow-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show error state - differentiate AUTH_ERROR from NETWORK_ERROR
  if (user && (error || orgError)) {
    const isAuthError = error instanceof AuthError || (error as any)?.status === 401 || (error as any)?.status === 403;
    
    // If AUTH_ERROR and retry is in progress, show retry message
    if (isAuthError && authRetryAttempted && isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center max-w-md p-6">
            <div className="text-sm text-muted-foreground">Sesión inválida. Reintentando...</div>
          </div>
        </div>
      );
    }
    
    // If AUTH_ERROR and retry failed, redirect will happen via useEffect
    if (isAuthError && authRetryAttempted && !isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center max-w-md p-6">
            <div className="text-sm text-muted-foreground">Redirigiendo al login...</div>
          </div>
        </div>
      );
    }
    
    // NETWORK_ERROR - show error with retry
    const errorMessage = (error as Error)?.message || orgError || 'No se pudo conectar con el servidor. Verificá tu conexión y que el API esté disponible.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <div className="text-red-600 font-medium mb-2">Error loading organizations</div>
          <div className="text-sm text-red-700 dark:text-red-300 mb-4">{errorMessage}</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Don't render children until orgs are loaded (if user is authenticated)
  if (user && isLoading && !orgs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Loading organizations...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
