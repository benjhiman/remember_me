'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOrgStore } from '@/lib/store/org-store';
import { useOrganizations } from '@/lib/api/hooks/use-organizations';

/**
 * Organization Provider
 * 
 * Loads and manages organization context on app mount.
 * Must be rendered inside authenticated layout.
 */
export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { currentOrganizationId, setMemberships } = useOrgStore();
  const { data: orgs, isLoading } = useOrganizations();

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
