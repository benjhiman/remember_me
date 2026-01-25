import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useOrgStore } from '@/lib/store/org-store';
import { useAuthStore } from '@/lib/store/auth-store';

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/**
 * Custom error type for AUTH errors (401/403)
 * This allows us to differentiate from network errors
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
    public type: 'AUTH_ERROR' = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function useOrganizations() {
  const { user, accessToken, authReady } = useAuthStore();
  const { setMemberships, setLoading, setError } = useOrgStore();

  // REGLA DE ORO: Never fetch if auth is not ready or token is missing
  const canFetch = authReady === true && !!accessToken && !!user;

  // Production logging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    if (user && !canFetch) {
      console.log('[USE_ORGANIZATIONS] ⏸️  Fetch gated:', {
        authReady,
        hasAccessToken: !!accessToken,
        hasUser: !!user,
      });
    }
  }

  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      setLoading(true);
      setError(null);
      
      // Double-check gate (defensive)
      if (!authReady || !accessToken) {
        throw new AuthError('Auth not ready or token missing', 401);
      }
      
      // Production logging
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
        console.log('[USE_ORGANIZATIONS] Starting organizations fetch...');
      }
      
      const startTime = Date.now();
      
      try {
        const data = await api.get<OrganizationResponse[]>('/organizations');
        
        // Production logging
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
          const duration = Date.now() - startTime;
          console.log(`[USE_ORGANIZATIONS] ✅ Organizations loaded in ${duration}ms:`, data.length);
        }
        
        // Transform to match Organization interface
        const memberships = data.map((org: any) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: org.role || 'SELLER', // Default role if not provided
        }));
        setMemberships(memberships);
        return memberships;
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        // Differentiate AUTH_ERROR from NETWORK_ERROR
        let errorToThrow = error;
        
        // Check if it's an AUTH error (401/403)
        if (error?.status === 401 || error?.status === 403) {
          errorToThrow = new AuthError(
            error.message || 'Authentication failed',
            error.status
          );
        }
        
        const errorMessage = errorToThrow.message || 'Failed to load organizations';
        
        // Production logging
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
          const errorType = errorToThrow instanceof AuthError ? 'AUTH_ERROR' : 'NETWORK_ERROR';
          console.error(`[USE_ORGANIZATIONS] ❌ Failed after ${duration}ms (${errorType}):`, errorMessage);
        }
        
        setError(errorMessage);
        throw errorToThrow;
      } finally {
        setLoading(false);
      }
    },
    // CRITICAL: Only enable when auth is ready AND token exists
    enabled: canFetch,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Retry configuration
    retry: (failureCount, error: any) => {
      // NEVER retry on AUTH errors (401/403)
      if (error instanceof AuthError || error?.status === 401 || error?.status === 403) {
        return false;
      }
      // Retry up to 1 time for network errors
      return failureCount < 1;
    },
    retryDelay: 1000, // 1 second between retries
  });
}

export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  const { setCurrentOrganization } = useOrgStore();

  return useMutation({
    mutationFn: async (orgId: string) => {
      // Validate orgId exists in memberships
      const state = useOrgStore.getState();
      const org = state.memberships.find((m) => m.id === orgId);
      if (!org) {
        throw new Error('Organization not found in memberships');
      }

      // Update current org
      setCurrentOrganization(orgId);

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('rm.currentOrgId', orgId);
      }

      // Invalidate all queries to force refetch with new org context
      await queryClient.invalidateQueries();

      return org;
    },
  });
}
