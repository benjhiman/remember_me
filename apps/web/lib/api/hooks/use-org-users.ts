import { useQuery } from '@tanstack/react-query';
import { api } from '../client';

export interface OrgUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export function useOrgUsers(enabled: boolean = true) {
  return useQuery<OrgUser[]>({
    queryKey: ['orgUsers'],
    queryFn: () => api.get<OrgUser[]>('/users'),
    enabled,
    staleTime: 30000, // Cache for 30 seconds
  });
}
