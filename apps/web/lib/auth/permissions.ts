/**
 * Permissions System
 * 
 * Defines actions and role-based permissions for the CRM
 */

export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SELLER = 'SELLER',
}

export enum Permission {
  // Dashboard
  VIEW_DASHBOARD = 'VIEW_DASHBOARD',
  
  // Leads
  VIEW_LEADS = 'VIEW_LEADS',
  EDIT_LEADS = 'EDIT_LEADS',
  
  // Stock
  VIEW_STOCK = 'VIEW_STOCK',
  EDIT_STOCK = 'EDIT_STOCK',
  
  // Sales
  VIEW_SALES = 'VIEW_SALES',
  EDIT_SALES = 'EDIT_SALES',
  
  // Inbox
  VIEW_INBOX = 'VIEW_INBOX',
  
  // Integrations
  VIEW_INTEGRATIONS = 'VIEW_INTEGRATIONS',
  MANAGE_INTEGRATIONS = 'MANAGE_INTEGRATIONS',
  
  // Members
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
}

// Role to Permissions mapping
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.OWNER]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_LEADS,
    Permission.EDIT_LEADS,
    Permission.VIEW_STOCK,
    Permission.EDIT_STOCK,
    Permission.VIEW_SALES,
    Permission.EDIT_SALES,
    Permission.VIEW_INBOX,
    Permission.VIEW_INTEGRATIONS,
    Permission.MANAGE_INTEGRATIONS,
    Permission.MANAGE_MEMBERS,
  ],
  [Role.ADMIN]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_LEADS,
    Permission.EDIT_LEADS,
    Permission.VIEW_STOCK,
    Permission.EDIT_STOCK,
    Permission.VIEW_SALES,
    Permission.EDIT_SALES,
    Permission.VIEW_INBOX,
    Permission.VIEW_INTEGRATIONS,
    Permission.MANAGE_INTEGRATIONS,
    Permission.MANAGE_MEMBERS,
  ],
  [Role.MANAGER]: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_LEADS,
    Permission.EDIT_LEADS,
    Permission.VIEW_STOCK,
    Permission.EDIT_STOCK,
    Permission.VIEW_SALES,
    Permission.EDIT_SALES,
    Permission.VIEW_INBOX,
    Permission.VIEW_INTEGRATIONS,
    Permission.MANAGE_MEMBERS, // Managers can assign conversations
    // No MANAGE_INTEGRATIONS
  ],
  [Role.SELLER]: [
    Permission.VIEW_DASHBOARD, // Read-only
    Permission.VIEW_LEADS,
    Permission.EDIT_LEADS,
    Permission.VIEW_STOCK, // Read-only
    // No EDIT_STOCK
    Permission.VIEW_SALES,
    Permission.EDIT_SALES,
    Permission.VIEW_INBOX,
    // No VIEW_INTEGRATIONS
    // No MANAGE_INTEGRATIONS
    // No MANAGE_MEMBERS
  ],
};

/**
 * Check if a role has a specific permission
 */
export function can(role: string | Role, permission: Permission): boolean {
  const roleEnum = role as Role;
  const permissions = ROLE_PERMISSIONS[roleEnum] || [];
  return permissions.includes(permission);
}

/**
 * Check if user has permission (helper for auth store user)
 */
export function userCan(user: { role: string } | null, permission: Permission): boolean {
  if (!user) return false;
  return can(user.role as Role, permission);
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: string | Role): Permission[] {
  const roleEnum = role as Role;
  return ROLE_PERMISSIONS[roleEnum] || [];
}

/**
 * Check if user has any of the given permissions
 */
export function userCanAny(user: { role: string } | null, permissions: Permission[]): boolean {
  if (!user) return false;
  return permissions.some((perm) => userCan(user, perm));
}

/**
 * Check if user has all of the given permissions
 */
export function userCanAll(user: { role: string } | null, permissions: Permission[]): boolean {
  if (!user) return false;
  return permissions.every((perm) => userCan(user, perm));
}
