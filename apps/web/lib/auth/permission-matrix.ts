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
 * Check if user can change conversation status
 */
export function canChangeConversationStatus(ctx: PermissionContext): boolean {
  const role = ctx.role as Role;
  if (role === Role.OWNER || role === Role.ADMIN || role === Role.MANAGER) {
    return true;
  }
  if (role === Role.SELLER) {
    const canSellerChange = ctx.settings?.crm?.permissions?.sellerCanChangeConversationStatus;
    const isAssigned = ctx.entityAssignedToId === ctx.userId;
    return !!(canSellerChange && isAssigned);
  }
  return false;
}

/**
 * Check if user can reassign conversation
 */
export function canReassignConversation(ctx: PermissionContext): boolean {
  const role = ctx.role as Role;
  if (role === Role.OWNER || role === Role.ADMIN || role === Role.MANAGER) {
    return true;
  }
  if (role === Role.SELLER) {
    const canSellerReassign = ctx.settings?.crm?.permissions?.sellerCanReassignConversation;
    const isAssigned = ctx.entityAssignedToId === ctx.userId;
    return !!(canSellerReassign && isAssigned);
  }
  return false;
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

/**
 * Check if user can move kanban
 */
export function canMoveKanban(ctx: PermissionContext): boolean {
  const role = ctx.role as Role;
  if (role === Role.OWNER || role === Role.ADMIN || role === Role.MANAGER) {
    return true;
  }
  if (role === Role.SELLER) {
    return !!ctx.settings?.crm?.permissions?.sellerCanMoveKanban;
  }
  return false;
}

/**
 * Check if seller sees only assigned conversations
 */
export function sellerSeesOnlyAssigned(ctx: PermissionContext): boolean {
  if (ctx.role !== Role.SELLER) return false;
  return !!ctx.settings?.crm?.inbox?.sellerSeesOnlyAssigned;
}
