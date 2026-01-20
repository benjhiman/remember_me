'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { Permission, userCan } from '@/lib/auth/permissions';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component that guards content based on user permissions
 * If user doesn't have permission, redirects to forbidden page or shows fallback
 */
export function PermissionGuard({
  permission,
  children,
  fallback,
  redirectTo = '/forbidden',
}: PermissionGuardProps) {
  const { user } = useAuthStore();
  const router = useRouter();

  const hasPermission = userCan(user, permission);

  useEffect(() => {
    if (!hasPermission && redirectTo) {
      router.push(redirectTo);
    }
  }, [hasPermission, redirectTo, router]);

  if (!hasPermission) {
    return fallback || null;
  }

  return <>{children}</>;
}
