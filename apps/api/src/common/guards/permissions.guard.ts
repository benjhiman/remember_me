import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { Permission, getPermissionsForRole, roleHasAllPermissions } from '../../auth/permissions';
import { Role } from '@remember-me/prisma';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'User role not found',
        required: requiredPermissions,
        role: null,
        organizationId: user?.organizationId || null,
      });
    }

    const userRole = user.role as Role;
    const hasPermissions = roleHasAllPermissions(userRole, requiredPermissions);

    if (!hasPermissions) {
      const userPermissions = getPermissionsForRole(userRole);
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        required: requiredPermissions,
        role: userRole,
        organizationId: user.organizationId,
        userPermissions, // For debugging
      });
    }

    return true;
  }
}
