/**
 * RBAC Permissions System
 * 
 * Centralized permission definitions and role-to-permission mapping.
 * This is the single source of truth for authorization.
 */

import { Role } from '@remember-me/prisma';

/**
 * Permission enum - capabilities/actions
 * Format: <module>.<action>
 */
export enum Permission {
  // Dashboard
  'dashboard.read' = 'dashboard.read',

  // Leads
  'leads.read' = 'leads.read',
  'leads.write' = 'leads.write',

  // Sales
  'sales.read' = 'sales.read',
  'sales.write' = 'sales.write',
  
  // Customers
  'customers.read' = 'customers.read',
  'customers.write' = 'customers.write',
  
  // Vendors
  'vendors.read' = 'vendors.read',
  'vendors.write' = 'vendors.write',
  
  // Purchases
  'purchases.read' = 'purchases.read',
  'purchases.write' = 'purchases.write',

  // Ledger
  'ledger.read' = 'ledger.read',
  'ledger.write' = 'ledger.write',

  // Stock
  'stock.read' = 'stock.read',
  'stock.write' = 'stock.write',

  // Inbox
  'inbox.read' = 'inbox.read',
  'inbox.write' = 'inbox.write',

  // Settings
  'settings.read' = 'settings.read',
  'settings.write' = 'settings.write',

  // Organization
  'org.manage' = 'org.manage',
  'members.manage' = 'members.manage',

  // Integrations
  'integrations.read' = 'integrations.read',
  'integrations.manage' = 'integrations.manage',
}

/**
 * Role to Permissions mapping
 * 
 * This is the authoritative source for what each role can do.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    // Owner has all permissions
    Permission['dashboard.read'],
    Permission['leads.read'],
    Permission['leads.write'],
    Permission['sales.read'],
    Permission['sales.write'],
    Permission['customers.read'],
    Permission['customers.write'],
    Permission['vendors.read'],
    Permission['vendors.write'],
    Permission['purchases.read'],
    Permission['purchases.write'],
    Permission['ledger.read'],
    Permission['ledger.write'],
    Permission['stock.read'],
    Permission['stock.write'],
    Permission['inbox.read'],
    Permission['inbox.write'],
    Permission['settings.read'],
    Permission['settings.write'],
    Permission['org.manage'],
    Permission['members.manage'],
    Permission['integrations.read'],
    Permission['integrations.manage'],
  ],
  [Role.ADMIN]: [
    // Admin has almost everything except org.manage (owner-only)
    Permission['dashboard.read'],
    Permission['leads.read'],
    Permission['leads.write'],
    Permission['sales.read'],
    Permission['sales.write'],
    Permission['customers.read'],
    Permission['customers.write'],
    Permission['vendors.read'],
    Permission['vendors.write'],
    Permission['purchases.read'],
    Permission['purchases.write'],
    Permission['ledger.read'],
    Permission['ledger.write'],
    Permission['stock.read'],
    Permission['stock.write'],
    Permission['inbox.read'],
    Permission['inbox.write'],
    Permission['settings.read'],
    Permission['settings.write'],
    Permission['members.manage'],
    Permission['integrations.read'],
    Permission['integrations.manage'],
  ],
  [Role.MANAGER]: [
    // Manager: read/write in modules, can manage members
    Permission['dashboard.read'],
    Permission['leads.read'],
    Permission['leads.write'],
    Permission['sales.read'],
    Permission['sales.write'],
    Permission['customers.read'],
    Permission['customers.write'],
    Permission['vendors.read'],
    Permission['vendors.write'],
    Permission['purchases.read'],
    Permission['purchases.write'],
    Permission['ledger.read'],
    Permission['ledger.write'],
    Permission['stock.read'],
    Permission['stock.write'],
    Permission['inbox.read'],
    Permission['inbox.write'],
    Permission['settings.read'],
    Permission['members.manage'], // Can assign conversations
    Permission['integrations.read'],
    // No settings.write, no integrations.manage
  ],
  [Role.SELLER]: [
    // Seller: read/write in assigned modules, read-only in others
    Permission['dashboard.read'],
    Permission['leads.read'],
    Permission['leads.write'], // Can edit assigned leads
    Permission['sales.read'],
    Permission['sales.write'],
    Permission['customers.read'],
    Permission['customers.write'],
    Permission['vendors.read'],
    Permission['vendors.write'],
    Permission['purchases.read'],
    Permission['purchases.write'],
    Permission['ledger.read'],
    Permission['ledger.write'],
    Permission['stock.read'], // Read-only
    Permission['inbox.read'],
    Permission['inbox.write'], // Can respond to assigned conversations
    Permission['settings.read'], // Read-only
    // No stock.write, no settings.write, no members.manage, no integrations
  ],
};

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: Role | string): Permission[] {
  const roleEnum = role as Role;
  return ROLE_PERMISSIONS[roleEnum] || [];
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role | string, permission: Permission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

/**
 * Check if a role has all of the given permissions
 */
export function roleHasAllPermissions(role: Role | string, requiredPermissions: Permission[]): boolean {
  const permissions = getPermissionsForRole(role);
  return requiredPermissions.every((perm) => permissions.includes(perm));
}

/**
 * Check if a role has any of the given permissions
 */
export function roleHasAnyPermission(role: Role | string, requiredPermissions: Permission[]): boolean {
  const permissions = getPermissionsForRole(role);
  return requiredPermissions.some((perm) => permissions.includes(perm));
}
