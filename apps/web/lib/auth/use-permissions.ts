import { useMe } from '../api/hooks/use-me';

export type Permission = string;

/**
 * usePermissions Hook
 * 
 * Provides current user's role and permissions for UI gating.
 * 
 * @example
 * const { role, permissions, can } = usePermissions();
 * if (can('leads.write')) {
 *   // Show create button
 * }
 */
export function usePermissions() {
  const { data: me, isLoading } = useMe();

  const role = me?.role || null;
  const permissions = me?.permissions || [];

  /**
   * Check if user has a specific permission
   */
  const can = (permission: Permission): boolean => {
    if (!permissions.length) return false;
    return permissions.includes(permission);
  };

  /**
   * Check if user has any of the given permissions
   */
  const canAny = (requiredPermissions: Permission[]): boolean => {
    if (!permissions.length) return false;
    return requiredPermissions.some((perm) => permissions.includes(perm));
  };

  /**
   * Check if user has all of the given permissions
   */
  const canAll = (requiredPermissions: Permission[]): boolean => {
    if (!permissions.length) return false;
    return requiredPermissions.every((perm) => permissions.includes(perm));
  };

  return {
    role,
    permissions,
    can,
    canAny,
    canAll,
    isLoading,
  };
}
