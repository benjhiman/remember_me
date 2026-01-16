import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENT_KEY } from './idempotent.decorator';
import { of, throwError, firstValueFrom } from 'rxjs';
import { Request, Response } from 'express';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let idempotencyService: IdempotencyService;
  let reflector: Reflector;

  const mockIdempotencyService = {
    begin: jest.fn(),
    complete: jest.fn(),
    fail: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createMockExecutionContext = (options: {
    isIdempotent?: boolean;
    hasKey?: boolean;
    key?: string;
    body?: any;
    organizationId?: string;
    userId?: string;
    path?: string;
    method?: string;
  }): ExecutionContext => {
    const request = {
      headers: {
        'idempotency-key': options.hasKey ? (options.key || 'test-key-123') : undefined,
      },
      body: options.body || {},
      path: options.path || '/api/sales',
      method: options.method || 'POST',
    } as unknown as Request;

    (request as any).organizationId = options.organizationId || 'org-1';
    (request as any).user = { userId: options.userId || 'user-1' };

    const response = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    mockReflector.getAllAndOverride.mockReturnValue(options.isIdempotent !== false);

    return context;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyInterceptor,
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    interceptor = module.get<IdempotencyInterceptor>(IdempotencyInterceptor);
    idempotencyService = module.get<IdempotencyService>(IdempotencyService);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  describe('non-idempotent routes', () => {
    it('should pass through for routes without @Idempotent() decorator', async () => {
      const context = createMockExecutionContext({ isIdempotent: false });
      const next = { handle: () => of({ data: 'test' }) };

      const observable = await interceptor.intercept(context, next as any);
      const result = await firstValueFrom(observable);

      expect(mockIdempotencyService.begin).not.toHaveBeenCalled();
      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('missing idempotency key', () => {
    it('should throw 400 when Idempotency-Key header is missing', async () => {
      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: false,
      });
      const next = { handle: () => of({}) };

      await expect(interceptor.intercept(context, next as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(interceptor.intercept(context, next as any)).rejects.toMatchObject({
        response: {
          errorCode: 'IDEMPOTENCY_KEY_REQUIRED',
          statusCode: 400,
        },
      });
    });
  });

  describe('cached response (hit)', () => {
    it('should return cached response when key matches', async () => {
      mockIdempotencyService.begin.mockResolvedValue({
        hit: true,
        cachedResponse: {
          statusCode: 201,
          body: { id: 'sale-1', status: 'RESERVED' },
        },
      });

      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
        key: 'test-key-123',
      });
      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      const result = await firstValueFrom(observable);

      expect(result).toEqual({ id: 'sale-1', status: 'RESERVED' });
      expect(mockIdempotencyService.begin).toHaveBeenCalled();
      expect(mockIdempotencyService.complete).not.toHaveBeenCalled();
    });

    it('should not call service method when returning cached response', async () => {
      mockIdempotencyService.begin.mockResolvedValue({
        hit: true,
        cachedResponse: {
          statusCode: 200,
          body: { id: 'sale-1' },
        },
      });

      const serviceMethod = jest.fn().mockResolvedValue({ id: 'sale-2' });
      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
      });
      const next = { handle: () => of(serviceMethod()) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(serviceMethod).not.toHaveBeenCalled();
    });
  });

  describe('different payload', () => {
    it('should throw 409 when key exists with different payload', async () => {
      mockIdempotencyService.begin.mockRejectedValue(
        new ConflictException({
          statusCode: 409,
          message: 'Idempotency key reused with different payload',
          errorCode: 'IDEMPOTENCY_KEY_REUSE_DIFFERENT_PAYLOAD',
          error: 'Conflict',
        }),
      );

      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
        body: { customerName: 'John' },
      });
      const next = { handle: () => of({}) };

      await expect(interceptor.intercept(context, next as any)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('miss (new request)', () => {
    it('should continue and call complete with response', async () => {
      mockIdempotencyService.begin.mockResolvedValue({ hit: false });
      mockIdempotencyService.complete.mockResolvedValue(undefined);

      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
        body: { stockReservationIds: ['res-1'] },
      });

      const responseData = { id: 'sale-1', status: 'RESERVED' };
      const next = {
        handle: () => of(responseData),
      };

      const observable = await interceptor.intercept(context, next as any);
      const result = await firstValueFrom(observable);

      expect(result).toEqual(responseData);

      // Wait for tap to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockIdempotencyService.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
          method: 'POST',
          key: 'test-key-123',
          statusCode: 200,
          responseBody: responseData,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should not cache errors', async () => {
      mockIdempotencyService.begin.mockResolvedValue({ hit: false });
      mockIdempotencyService.fail.mockResolvedValue(undefined);

      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
      });
      const error = new Error('Something went wrong');
      const next = {
        handle: () => throwError(() => error),
      };

      try {
        const observable = await interceptor.intercept(context, next as any);
        await firstValueFrom(observable);
      } catch (e) {
        expect(e).toBe(error);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockIdempotencyService.fail).toHaveBeenCalled();
      expect(mockIdempotencyService.complete).not.toHaveBeenCalled();
    });
  });

  describe('path normalization', () => {
    it('should normalize path with UUID parameter', async () => {
      mockIdempotencyService.begin.mockResolvedValue({ hit: false });
      mockIdempotencyService.complete.mockResolvedValue(undefined);

      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
        path: '/api/sales/12345678901234567890/pay',
        method: 'PATCH',
      });

      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockIdempotencyService.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringMatching(/\/api\/sales\/:id\/pay/),
        }),
      );
    });
  });

  describe('request hash calculation', () => {
    it('should calculate hash for request body', async () => {
      mockIdempotencyService.begin.mockResolvedValue({ hit: false });

      const body = { stockReservationIds: ['res-1', 'res-2'], customerName: 'John' };
      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
        body,
      });

      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(mockIdempotencyService.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          requestHash: expect.any(String),
        }),
      );
    });
  });

  describe('concurrency handling', () => {
    it('should handle concurrent requests with same key (second returns cached)', async () => {
      let callCount = 0;
      mockIdempotencyService.begin.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First call: miss
          return { hit: false };
        } else {
          // Second call: hit (race condition resolved)
          return {
            hit: true,
            cachedResponse: {
              statusCode: 201,
              body: { id: 'sale-1' },
            },
          };
        }
      });

      const context1 = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
        key: 'same-key',
      });
      const context2 = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
        key: 'same-key',
      });

      const next = { handle: () => of({ id: 'sale-1' }) };

      // First request
      const observable1 = await interceptor.intercept(context1, next as any);
      const result1 = await firstValueFrom(observable1);
      expect(result1).toEqual({ id: 'sale-1' });

      // Second request (simulated race)
      const observable2 = await interceptor.intercept(context2, next as any);
      const result2 = await firstValueFrom(observable2);
      expect(result2).toEqual({ id: 'sale-1' });
    });
  });

  describe('multi-org isolation', () => {
    it('should use organizationId and userId in idempotency key', async () => {
      mockIdempotencyService.begin.mockResolvedValue({ hit: false });

      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
        organizationId: 'org-2',
        userId: 'user-2',
      });

      const next = { handle: () => of({}) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);

      expect(mockIdempotencyService.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-2',
          userId: 'user-2',
        }),
      );
    });
  });

  describe('status code handling', () => {
    it('should capture status code from response', async () => {
      mockIdempotencyService.begin.mockResolvedValue({ hit: false });
      mockIdempotencyService.complete.mockResolvedValue(undefined);

      const context = createMockExecutionContext({
        isIdempotent: true,
        hasKey: true,
      });

      const next = { handle: () => of({ id: 'sale-1' }) };

      const observable = await interceptor.intercept(context, next as any);
      await firstValueFrom(observable);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify complete was called with a statusCode (default 200 if not set)
      expect(mockIdempotencyService.complete).toHaveBeenCalled();
      const completeCall = mockIdempotencyService.complete.mock.calls[0][0];
      expect(completeCall).toHaveProperty('statusCode');
      expect(typeof completeCall.statusCode).toBe('number');
    });
  });
});
