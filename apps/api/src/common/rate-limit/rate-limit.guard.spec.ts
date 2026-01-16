import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { MetricsService } from '../metrics/metrics.service';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let rateLimitService: RateLimitService;
  let reflector: Reflector;

  const mockRateLimitService = {
    checkLimit: jest.fn(),
    enabled: true,
  };

  const mockReflector = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: MetricsService,
          useValue: {
            recordRateLimitHit: jest.fn(),
            recordRateLimitRejection: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    rateLimitService = module.get<RateLimitService>(RateLimitService);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  const createMockContext = (requestData: any = {}, handler?: any) => {
    const request = {
      user: requestData.user || null,
      headers: requestData.headers || {},
      body: requestData.body || {},
      ...requestData,
    };

    const response = {
      setHeader: jest.fn(),
    };

    const mockHandler = handler || (() => {});

    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
      getHandler: () => mockHandler,
      getClass: () => ({}),
    } as ExecutionContext;
  };

  it('should allow request when no rate limit configured', async () => {
    mockReflector.get.mockReturnValue(null);

    const handler = () => {};
    const context = createMockContext({}, handler);
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRateLimitService.checkLimit).not.toHaveBeenCalled();
  });

  it('should allow request when rate limit disabled and skipIfDisabled=true', async () => {
    mockReflector.get.mockReturnValue({
      action: 'test.action',
      limit: 10,
      windowSec: 60,
      skipIfDisabled: true,
    });
    mockRateLimitService.enabled = false;

    const handler = () => {};
    const context = createMockContext({}, handler);
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRateLimitService.checkLimit).not.toHaveBeenCalled();
  });

  it('should check rate limit and allow when under limit', async () => {
    mockReflector.get.mockReturnValue({
      action: 'test.action',
      limit: 10,
      windowSec: 60,
    });

    mockRateLimitService.checkLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 5,
      resetAt: new Date(Date.now() + 60000),
    });

    const handler = () => {};
    const context = createMockContext(
      {
        user: { organizationId: 'org-1' },
      },
      handler,
    );

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith({
      action: 'test.action',
      limit: 10,
      windowSec: 60,
      organizationId: 'org-1',
    });

    const response = context.switchToHttp().getResponse();
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 5);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('should throw 429 when rate limit exceeded', async () => {
    mockReflector.get.mockReturnValue({
      action: 'test.action',
      limit: 10,
      windowSec: 60,
    });

    mockRateLimitService.checkLimit.mockResolvedValue({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: new Date(Date.now() + 45000),
      retryAfterSec: 45,
    });

    const handler = () => {};
    const context = createMockContext(
      {
        user: { organizationId: 'org-1' },
      },
      handler,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    const response = context.switchToHttp().getResponse();
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', 45);
  });

  it('should get organizationId from request.user', async () => {
    mockReflector.get.mockReturnValue({
      action: 'test.action',
      limit: 10,
      windowSec: 60,
    });

    mockRateLimitService.checkLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 5,
      resetAt: new Date(),
    });

    const handler = () => {};
    const context = createMockContext(
      {
        user: { organizationId: 'org-from-user' },
      },
      handler,
    );

    await guard.canActivate(context);

    expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-from-user',
      }),
    );
  });

  it('should get organizationId from headers for webhooks', async () => {
    mockReflector.get.mockReturnValue({
      action: 'webhook.test',
      limit: 100,
      windowSec: 60,
    });

    mockRateLimitService.checkLimit.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 50,
      resetAt: new Date(),
    });

    const handler = () => {};
    const context = createMockContext(
      {
        headers: { 'x-organization-id': 'org-from-header' },
      },
      handler,
    );

    await guard.canActivate(context);

    expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-from-header',
      }),
    );
  });

  it('should use global when no organizationId found', async () => {
    mockReflector.get.mockReturnValue({
      action: 'test.action',
      limit: 10,
      windowSec: 60,
    });

    mockRateLimitService.checkLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 5,
      resetAt: new Date(),
    });

    const handler = () => {};
    const context = createMockContext({}, handler); // No user, no headers, no body

    await guard.canActivate(context);

    expect(mockRateLimitService.checkLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: undefined, // Will use 'global' in service
      }),
    );
  });
});
