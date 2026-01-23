import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrgState {
  currentOrganizationId: string | null;
  currentOrganization: Organization | null;
  memberships: Organization[];
  isLoading: boolean;
  error: string | null;
  setCurrentOrganization: (orgId: string) => void;
  setMemberships: (memberships: Organization[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

const STORAGE_KEY = 'rm.currentOrgId';

export const useOrgStore = create<OrgState>()(
  persist(
    (set, get) => ({
      currentOrganizationId: null,
      currentOrganization: null,
      memberships: [],
      isLoading: false,
      error: null,
      setCurrentOrganization: (orgId: string) => {
        const org = get().memberships.find((m) => m.id === orgId);
        set({
          currentOrganizationId: orgId,
          currentOrganization: org || null,
        });
      },
      setMemberships: (memberships: Organization[]) => {
        const state = get();
        let orgId = state.currentOrganizationId;

        // If no current org selected, try to restore from localStorage or use first
        if (!orgId && memberships.length > 0) {
          // Try to restore from persisted storage
          if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              const storedOrg = memberships.find((m) => m.id === stored);
              if (storedOrg) {
                orgId = stored;
              }
            }
          }
          // If still no org, use first one
          if (!orgId) {
            orgId = memberships[0].id;
          }
        }

        const currentOrg = memberships.find((m) => m.id === orgId) || null;

        set({
          memberships,
          currentOrganizationId: orgId,
          currentOrganization: currentOrg,
        });

        // Persist selection
        if (typeof window !== 'undefined' && orgId) {
          localStorage.setItem(STORAGE_KEY, orgId);
        }
      },
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
      clear: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
        set({
          currentOrganizationId: null,
          currentOrganization: null,
          memberships: [],
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'org-storage',
      partialize: (state) => ({
        currentOrganizationId: state.currentOrganizationId,
      }),
    }
  )
);
