/**
 * Permission Matrix Helper
 * Centralized evaluation of role + settings for permissions
 */

import { Role, Permission } from './permissions';
import type { OrgSettingsResponse } from '@/lib/api/hooks/use-org-settings';

export interface PermissionContext {
  role: Role | string;
  settings?: OrgSettingsResponse;
  entityOwnerId?: string;
  entityAssignedToId?: string;
  userId?: string;
}

/**
 * Check if user can edit leads
 */
export function canEditLeads(ctx: PermissionContext): boolean {
  const role = ctx.role as Role;
  if (role === Role.OWNER || role === Role.ADMIN || role === Role.MANAGER) {
    return true;
  }
  if (role === Role.SELLER) {
    return !!ctx.settings?.crm?.permissions?.sellerCanEditLeads;
  }
  return false;
}

/**
 * Check if user can edit sales
 */
export function canEditSales(ctx: PermissionContext): boolean {
  const role = ctx.role as Role;
  if (role === Role.OWNER || role === Role.ADMIN || role === Role.MANAGER) {
    return true;
  }
  if (role === Role.SELLER) {
    return !!ctx.settings?.crm?.permissions?.sellerCanEditSales;
  }
  return false;
}

