import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@remember-me/prisma';
import { OWNER_ONLY_KEY } from '../decorators/owner-only.decorator';

@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isOwnerOnly = this.reflector.getAllAndOverride<boolean>(OWNER_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isOwnerOnly) {
      return true; // Not owner-only, allow
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Owner only');
    }

    if (user.role !== Role.OWNER) {
      throw new ForbiddenException('Owner only');
    }

    return true;
  }
}
