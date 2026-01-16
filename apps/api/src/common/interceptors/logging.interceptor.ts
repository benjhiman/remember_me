import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, ip } = request;
    const requestId = (request as any).requestId || 'unknown';
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // Extract user info if available
    const userId = (request as any).user?.userId || 'anonymous';
    const organizationId = (request as any).organizationId || 'unknown';

    this.logger.log(`${method} ${url}`, 'HTTP Request', {
      requestId,
      method,
      url,
      ip,
      userAgent,
      userId,
      organizationId,
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log(`${method} ${url} ${statusCode} ${duration}ms`, 'HTTP Response', {
            requestId,
            method,
            url,
            statusCode,
            duration,
            userId,
            organizationId,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.error(`${method} ${url} ${statusCode} ${duration}ms`, error.stack, 'HTTP Error', {
            requestId,
            method,
            url,
            statusCode,
            duration,
            error: error.message,
            userId,
            organizationId,
          });
        },
      }),
    );
  }
}
