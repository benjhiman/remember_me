import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * CurrentOrganization Decorator
 * 
 * Returns the organization ID from request.user.organizationId.
 * This is set by OrganizationInterceptor if X-Organization-Id header is present,
 * or from JWT token if header is missing.
 */
export const CurrentOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.organizationId;
  }
);
