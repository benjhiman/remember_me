import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { CurrentOrganization } from '../decorators/current-organization.decorator';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
    private readonly metricsService?: MetricsService, // Optional to avoid circular dependency
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler());
    
    if (!options) {
      // No rate limit configured, allow
      return true;
    }

    if (options.skipIfDisabled && !this.rateLimitService.isEnabled) {
      // Rate limiting disabled, allow
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Get organization ID from request
    // Priority: 1) request.user.organizationId (from JWT), 2) headers, 3) body
    let organizationId: string | undefined;
    
    // Try to get from request.user (set by JWT guard - this is the main source)
    if (request.user?.organizationId) {
      organizationId = request.user.organizationId;
    }
    
    // For webhooks, organization might be in headers (x-organization-id)
    if (!organizationId && request.headers?.['x-organization-id']) {
      organizationId = request.headers['x-organization-id'] as string;
    }

    // For webhooks, organization might be in body
    if (!organizationId && request.body?.organizationId) {
      organizationId = request.body.organizationId;
    }

    // Check rate limit
    const result = await this.rateLimitService.checkLimit({
      action: options.action,
      limit: options.limit,
      windowSec: options.windowSec,
      organizationId,
    });

    // Record metrics
    if (this.metricsService) {
      this.metricsService.recordRateLimitHit(options.action);
      if (!result.allowed) {
        this.metricsService.recordRateLimitRejection(options.action);
      }
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));

    if (!result.allowed) {
      // Rate limit exceeded
      if (result.retryAfterSec) {
        response.setHeader('Retry-After', result.retryAfterSec);
      }

      throw new HttpException(
        {
          errorCode: 'RATE_LIMITED',
          message: `Rate limit exceeded for action: ${options.action}`,
          retryAfterSec: result.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
