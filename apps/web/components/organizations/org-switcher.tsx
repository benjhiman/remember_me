'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronDown, Loader2, AlertCircle } from 'lucide-react';
import { useOrgStore } from '@/lib/store/org-store';
import { useOrganizations, useSwitchOrganization } from '@/lib/api/hooks/use-organizations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useQueryClient } from '@tanstack/react-query';

export function OrgSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentOrganization, memberships, isLoading: orgStoreLoading } = useOrgStore();
  const { data: orgs, isLoading: orgsLoading, error } = useOrganizations();
  const switchOrg = useSwitchOrganization();
  const [isOpen, setIsOpen] = useState(false);

  const isLoading = orgStoreLoading || orgsLoading || switchOrg.isPending;
  const displayOrgs = orgs || memberships;
  const hasOrgs = displayOrgs.length > 0;

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }

    try {
      await switchOrg.mutateAsync(orgId);
      setIsOpen(false);
      // Optionally refresh the page to ensure all data is reloaded
      // router.refresh();
    } catch (error: any) {
      console.error('Failed to switch organization:', error);
      // Error is handled by mutation
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-white text-sm">
        <AlertCircle className="h-4 w-4 text-yellow-300" />
        <span className="text-yellow-200">Error loading orgs</span>
      </div>
    );
  }

  const orgName = currentOrganization?.name || 'Organization';

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-white text-sm font-medium hover:bg-white/10 rounded-md transition-colors',
            isLoading && 'opacity-70 cursor-not-allowed'
          )}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Building2 className="h-4 w-4" />
          )}
          <span className="max-w-[200px] truncate">{orgName}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && !hasOrgs ? (
          <div className="px-2 py-4 text-center text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
            Loading organizations...
          </div>
        ) : !hasOrgs ? (
          <div className="px-2 py-4 text-center text-sm text-gray-500">
            <p className="mb-2">No organizations available</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                router.push('/settings');
              }}
            >
              Create Organization
            </Button>
          </div>
        ) : (
          <>
            {displayOrgs.map((org) => {
              const isActive = org.id === currentOrganization?.id;
              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSwitch(org.id)}
                  className={cn(
                    'flex items-center justify-between cursor-pointer',
                    isActive && 'bg-blue-50'
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{org.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {org.role} • {org.slug}
                      </div>
                    </div>
                  </div>
                  {isActive && (
                    <Check className="h-4 w-4 text-blue-600 flex-shrink-0 ml-2" />
                  )}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setIsOpen(false);
                router.push('/settings');
              }}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Manage Organizations
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
