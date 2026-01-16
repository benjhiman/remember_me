import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { MetricsInterceptor } from './metrics.interceptor';
import { LoggerService } from '../logger/logger.service';
import { MetricsService } from '../metrics/metrics.service';
import { of, throwError, firstValueFrom } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Request, Response } from 'express';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let loggerService: LoggerService;

  const mockLoggerService = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockMetricsService = {
    recordHttpRequest: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsInterceptor,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    interceptor = module.get<MetricsInterceptor>(MetricsInterceptor);
    loggerService = module.get<LoggerService>(LoggerService);

    jest.clearAllMocks();
  });

  const createMockExecutionContext = (options: {
    method?: string;
    path?: string;
    requestId?: string;
    userId?: string;
    organizationId?: string;
  }): ExecutionContext => {
    const request = {
      method: options.method || 'GET',
      path: options.path || '/api/test',
    } as Request;

    (request as any).requestId = options.requestId || 'test-request-id';
    (request as any).user = { userId: options.userId || 'user-1' };
    (request as any).organizationId = options.organizationId || 'org-1';

    const response = {
      statusCode: 200,
      setHeader: jest.fn(),
    } as unknown as Response;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ExecutionContext;
  };

  describe('successful requests', () => {
    it('should add X-Response-Time header', async () => {
      const context = createMockExecutionContext({});
      const response = context.switchToHttp().getResponse<Response>();
      const next = { handle: () => of({ data: 'test' }) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(response.setHeader).toHaveBeenCalledWith('X-Response-Time', expect.stringMatching(/\d+ms/));
    });

    it('should log metrics with correct format', async () => {
      const context = createMockExecutionContext({
        method: 'POST',
        path: '/api/test',
        requestId: 'req-123',
        userId: 'user-1',
        organizationId: 'org-1',
      });
      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('POST /api/test'),
        'HTTP Metrics',
        expect.objectContaining({
          requestId: 'req-123',
          method: 'POST',
          path: '/api/test',
          statusCode: 200,
          durationMs: expect.any(Number),
          userId: 'user-1',
          orgId: 'org-1',
        }),
      );
    });

    it('should log warn for slow requests (fake clock)', async () => {
      const originalEnv = process.env.SLOW_REQUEST_MS;
      process.env.SLOW_REQUEST_MS = '10'; // Very low threshold for testing
      jest.useFakeTimers();

      const interceptorWithLowThreshold = new MetricsInterceptor(mockLoggerService as any, mockMetricsService as any);

      const context = createMockExecutionContext({});

      // Use delay to simulate slow request
      const next = {
        handle: () => of({}).pipe(delay(50)),
      };

      const observable = await interceptorWithLowThreshold.intercept(context, next as any);
      const promise = firstValueFrom(observable);
      jest.advanceTimersByTime(50);
      await promise;

      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Slow request'),
        'HTTP Metrics',
        expect.objectContaining({
          durationMs: expect.any(Number),
        }),
      );
      expect(mockLoggerService.log).not.toHaveBeenCalled();

      jest.useRealTimers();
      if (originalEnv) {
        process.env.SLOW_REQUEST_MS = originalEnv;
      } else {
        delete process.env.SLOW_REQUEST_MS;
      }
    });

    it('should not warn for normal requests (fake clock)', async () => {
      const originalEnv = process.env.SLOW_REQUEST_MS;
      process.env.SLOW_REQUEST_MS = '1500';
      jest.useFakeTimers();

      const interceptorNormal = new MetricsInterceptor(mockLoggerService as any, mockMetricsService as any);
      const context = createMockExecutionContext({});
      const next = {
        handle: () => of({}).pipe(delay(20)),
      };

      const observable = await interceptorNormal.intercept(context, next as any);
      const promise = firstValueFrom(observable);
      jest.advanceTimersByTime(20);
      await promise;

      expect(mockLoggerService.warn).not.toHaveBeenCalled();
      expect(mockLoggerService.log).toHaveBeenCalled();

      jest.useRealTimers();
      if (originalEnv) {
        process.env.SLOW_REQUEST_MS = originalEnv;
      } else {
        delete process.env.SLOW_REQUEST_MS;
      }
    });
  });

  describe('error requests', () => {
    it('should add X-Response-Time header on error', async () => {
      const context = createMockExecutionContext({});
      const response = context.switchToHttp().getResponse<Response>();
      const error = new Error('Test error');
      (error as any).status = 500;
      const next = { handle: () => throwError(() => error) };

      try {
        const observable = await interceptor.intercept(context, next as any);
        await firstValueFrom(observable);
      } catch (e) {
        // Expected
      }

      expect(response.setHeader).toHaveBeenCalledWith('X-Response-Time', expect.stringMatching(/\d+ms/));
    });

    it('should log error metrics', async () => {
      const context = createMockExecutionContext({
        method: 'GET',
        path: '/api/error',
        requestId: 'error-req-1',
      });
      const error = new Error('Test error');
      (error as any).status = 404;
      const next = { handle: () => throwError(() => error) };

      try {
        const observable = await interceptor.intercept(context, next as any);
        await firstValueFrom(observable);
      } catch (e) {
        // Expected
      }

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/error'),
        error.stack,
        'HTTP Metrics Error',
        expect.objectContaining({
          requestId: 'error-req-1',
          statusCode: 404,
          durationMs: expect.any(Number),
        }),
      );
    });
  });

  describe('requestId handling', () => {
    it('should include requestId in metrics', async () => {
      const context = createMockExecutionContext({
        requestId: 'custom-request-id-123',
      });
      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.any(String),
        'HTTP Metrics',
        expect.objectContaining({
          requestId: 'custom-request-id-123',
        }),
      );
    });

    it('should use "unknown" if requestId is missing', async () => {
      const context = createMockExecutionContext({});
      delete (context.switchToHttp().getRequest() as any).requestId;
      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.any(String),
        'HTTP Metrics',
        expect.objectContaining({
          requestId: 'unknown',
        }),
      );
    });
  });

  describe('user and organization context', () => {
    it('should include userId and orgId in metrics', async () => {
      const context = createMockExecutionContext({
        userId: 'user-999',
        organizationId: 'org-999',
      });
      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.any(String),
        'HTTP Metrics',
        expect.objectContaining({
          userId: 'user-999',
          orgId: 'org-999',
        }),
      );
    });

    it('should use "anonymous" and "unknown" if user/org missing', async () => {
      const context = createMockExecutionContext({});
      delete (context.switchToHttp().getRequest() as any).user;
      delete (context.switchToHttp().getRequest() as any).organizationId;
      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.any(String),
        'HTTP Metrics',
        expect.objectContaining({
          userId: 'anonymous',
          orgId: 'unknown',
        }),
      );
    });
  });
});
