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

export function useOrganizations() {
  const { user } = useAuthStore();
  const { setMemberships, setLoading, setError } = useOrgStore();

  return useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      setLoading(true);
      setError(null);
      
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
        const errorMessage = error.message || 'Failed to load organizations';
        
        // Production logging
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
          console.error(`[USE_ORGANIZATIONS] ❌ Failed after ${duration}ms:`, errorMessage);
        }
        
        setError(errorMessage);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Add retry configuration to prevent infinite retries
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403 (auth errors)
      if (error?.status === 401 || error?.status === 403) {
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
