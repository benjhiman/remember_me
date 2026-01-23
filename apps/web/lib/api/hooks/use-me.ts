import { useQuery } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOrgStore } from '@/lib/store/org-store';

export interface MeResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
  role: string;
  permissions: string[];
}

/**
 * Hook to fetch current user profile with permissions
 * 
 * Automatically refetches when organization changes.
 */
export function useMe() {
  const { user } = useAuthStore();
  const { currentOrganizationId } = useOrgStore();

  return useQuery({
    queryKey: ['me', currentOrganizationId],
    queryFn: async () => {
      const data = await api.get<MeResponse>('/users/me');
      return data;
    },
    enabled: !!user && !!currentOrganizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
