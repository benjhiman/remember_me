import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../auth/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * RequirePermissions Decorator
 * 
 * Use this decorator to protect endpoints with permission-based authorization.
 * 
 * @example
 * @RequirePermissions(Permission['leads.write'])
 * @Post()
 * async createLead() { ... }
 * 
 * @example
 * @RequirePermissions(Permission['leads.read'], Permission['leads.write'])
 * @Get()
 * async getLeads() { ... }
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
