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
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly SLOW_REQUEST_MS = parseInt(process.env.SLOW_REQUEST_MS || '1500', 10);

  constructor(
    private logger: LoggerService,
    private metricsService: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, path } = request;
    const requestId = (request as any).requestId || 'unknown';
    const userId = (request as any).user?.userId || 'anonymous';
    const organizationId = (request as any).organizationId || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Add X-Response-Time header
          response.setHeader('X-Response-Time', `${duration}ms`);

          // Log metrics
          const logData = {
            requestId,
            method,
            path,
            statusCode,
            durationMs: duration,
            userId,
            orgId: organizationId,
          };

          // Record Prometheus metrics
          const isSlow = duration > this.SLOW_REQUEST_MS;
          this.metricsService.recordHttpRequest(method, path, statusCode, duration, isSlow);

          if (duration > this.SLOW_REQUEST_MS) {
            this.logger.warn(`Slow request: ${method} ${path} ${statusCode} ${duration}ms`, 'HTTP Metrics', logData);
          } else {
            this.logger.log(`${method} ${path} ${statusCode} ${duration}ms`, 'HTTP Metrics', logData);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          response.setHeader('X-Response-Time', `${duration}ms`);

          const logData = {
            requestId,
            method,
            path,
            statusCode,
            durationMs: duration,
            userId,
            orgId: organizationId,
          };

          // Record Prometheus metrics for errors
          const isSlow = duration > this.SLOW_REQUEST_MS;
          this.metricsService.recordHttpRequest(method, path, statusCode, duration, isSlow);

          if (duration > this.SLOW_REQUEST_MS) {
            this.logger.warn(`Slow request error: ${method} ${path} ${statusCode} ${duration}ms`, 'HTTP Metrics Error', logData);
          } else {
            this.logger.error(`${method} ${path} ${statusCode} ${duration}ms`, error.stack, 'HTTP Metrics Error', logData);
          }
        },
      }),
    );
  }
}
