import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Observable, tap, of } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENT_KEY } from './idempotent.decorator';
import { Request, Response } from 'express';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check if route is marked as idempotent
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isIdempotent) {
      return next.handle();
    }

    // Get idempotency key from header
    const key = request.headers['idempotency-key'] as string;
    if (!key) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Idempotency-Key header is required',
        errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
        error: 'Bad Request',
      });
    }

    // Get organization and user from request
    // organizationId is set by CurrentOrganization decorator (via param decorator)
    // userId is from user object set by JWT guard
    const organizationId = (request as any).organizationId;
    const userId = (request as any).user?.userId;

    if (!organizationId || !userId) {
      // If not available, allow request to proceed (guards should handle auth)
      // This interceptor runs after guards, so we should have these values
      // But fail open if missing
      this.logger.warn(`Idempotency interceptor: missing organizationId or userId for path ${request.path}`);
      return next.handle();
    }

    // Normalize path (replace params with :param for pattern matching)
    const path = this.normalizePath(request.path);
    const method = request.method;

    // Calculate request hash
    const requestBody = request.body || {};
    const requestHash = IdempotencyService.calculateRequestHash(requestBody);

    // Check idempotency
    const result = await this.idempotencyService.begin({
      organizationId,
      userId,
      method,
      path,
      key,
      requestHash,
    });

    // If cached response exists, return it
    if (result.hit && result.cachedResponse) {
      response.status(result.cachedResponse.statusCode);
      return of(result.cachedResponse.body);
    }

    // Store original response methods
    const originalJson = response.json.bind(response);
    const originalStatus = response.status.bind(response);

    let statusCode = 200;
    let responseBody: any = null;

    // Override response.json to capture response
    response.json = function (body: any) {
      responseBody = body;
      return originalJson(body);
    };

    response.status = function (code: number) {
      statusCode = code;
      return originalStatus(code);
    };

    // Process request and capture response
    return next.handle().pipe(
      tap({
        next: async (data) => {
          // Only cache successful responses (2xx, 3xx)
          if (statusCode >= 200 && statusCode < 400) {
            await this.idempotencyService.complete({
              organizationId,
              userId,
              method,
              path,
              key,
              statusCode: statusCode || 200,
              responseBody: responseBody || data,
            });
          } else {
            // For errors, don't cache (or optionally fail to allow retry)
            await this.idempotencyService.fail({
              organizationId,
              userId,
              method,
              path,
              key,
            });
          }
        },
        error: async () => {
          // On error, don't cache
          await this.idempotencyService.fail({
            organizationId,
            userId,
            method,
            path,
            key,
          });
        },
      }),
    );
  }

  /**
   * Normalize path by replacing params with :param
   * e.g., /api/sales/123/pay -> /api/sales/:id/pay
   */
  private normalizePath(path: string): string {
    // Simple normalization: replace UUIDs and CUIDs with :id
    // This is a basic implementation; can be enhanced
    return path.replace(/\/[a-zA-Z0-9_-]{20,}\//g, '/:id/').replace(/\/[a-zA-Z0-9_-]{20,}$/, '/:id');
  }
}
