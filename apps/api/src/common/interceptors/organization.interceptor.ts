import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Organization Interceptor
 * 
 * Validates X-Organization-Id header if present:
 * - If header is present, validates user membership
 * - Overrides request.user.organizationId with header value if valid
 * - If header is missing, uses JWT organizationId (existing behavior)
 * 
 * This allows frontend to switch organizations without re-login.
 */
@Injectable()
export class OrganizationInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Skip if no user (public routes)
    if (!user || !user.userId) {
      return next.handle();
    }

    const headerOrgId = request.headers['x-organization-id'] as string | undefined;
    const jwtOrgId = user.organizationId;

    // If no header, use JWT orgId (existing behavior)
    if (!headerOrgId) {
      return next.handle();
    }

    // Validate header orgId: user must be member
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId: headerOrgId,
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        `User is not a member of organization ${headerOrgId}`
      );
    }

    // Override request.user.organizationId with header value
    request.user.organizationId = headerOrgId;
    request.user.role = membership.role; // Update role for this org

    // Log org switch for debugging (optional)
    if (headerOrgId !== jwtOrgId) {
      // Organization switched via header
      // This is expected when user switches org in frontend
    }

    return next.handle();
  }
}
