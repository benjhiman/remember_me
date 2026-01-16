import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockRedis: any;
  let mockPipeline: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'RATE_LIMIT_ENABLED') return 'true';
      if (key === 'RATE_LIMIT_REDIS_URL') return 'redis://localhost:6379';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock Redis pipeline
    mockPipeline = {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      get: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    // Mock Redis instance
    mockRedis = {
      pipeline: jest.fn().mockReturnValue(mockPipeline),
      get: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };

    (Redis as any).mockImplementation(() => mockRedis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('checkLimit', () => {
    it('should allow request when under limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1], // incr result
        [null, 1], // expire result
        [null, '5'], // get result (current count = 5, limit = 10)
      ]);

      const result = await service.checkLimit({
        action: 'test.action',
        limit: 10,
        windowSec: 60,
        organizationId: 'org-1',
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.limit).toBe(10);
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('should deny request when over limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, '11'], // current count = 11, limit = 10
      ]);

      const result = await service.checkLimit({
        action: 'test.action',
        limit: 10,
        windowSec: 60,
        organizationId: 'org-1',
      });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSec).toBeDefined();
    });

    it('should use different keys for different organizations', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, '1'],
      ]);

      await service.checkLimit({
        action: 'test.action',
        limit: 10,
        windowSec: 60,
        organizationId: 'org-1',
      });

      await service.checkLimit({
        action: 'test.action',
        limit: 10,
        windowSec: 60,
        organizationId: 'org-2',
      });

      expect(mockRedis.pipeline).toHaveBeenCalledTimes(2);
    });

    it('should use different keys for different actions', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, '1'],
      ]);

      await service.checkLimit({
        action: 'action1',
        limit: 10,
        windowSec: 60,
        organizationId: 'org-1',
      });

      await service.checkLimit({
        action: 'action2',
        limit: 10,
        windowSec: 60,
        organizationId: 'org-1',
      });

      expect(mockRedis.pipeline).toHaveBeenCalledTimes(2);
    });

    it('should allow all requests when disabled', async () => {
      const disabledConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'RATE_LIMIT_ENABLED') return 'false';
          if (key === 'RATE_LIMIT_REDIS_URL') return 'redis://localhost:6379';
          return undefined;
        }),
      };

      const disabledService = new RateLimitService(disabledConfigService as any);
      await disabledService.onModuleInit();

      const result = await disabledService.checkLimit({
        action: 'test.action',
        limit: 10,
        windowSec: 60,
      });

      expect(result.allowed).toBe(true);
      expect(mockRedis.pipeline).not.toHaveBeenCalled();

      await disabledService.onModuleDestroy();
    });

    it('should allow all requests when Redis unavailable', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.checkLimit({
        action: 'test.action',
        limit: 10,
        windowSec: 60,
      });

      expect(result.allowed).toBe(true); // Fail open
    });

    it('should calculate resetAt correctly', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, '5'],
      ]);

      const result = await service.checkLimit({
        action: 'test.action',
        limit: 10,
        windowSec: 60,
      });

      const expectedWindowStart = Math.floor(now / 60000) * 60000;
      const expectedWindowEnd = expectedWindowStart + 60000;
      expect(result.resetAt.getTime()).toBe(expectedWindowEnd);

      jest.restoreAllMocks();
    });
  });

  describe('getLimitInfo', () => {
    it('should return limit info without incrementing', async () => {
      mockRedis.get.mockResolvedValue('3');

      const result = await service.getLimitInfo({
        action: 'test.action',
        limit: 10,
        windowSec: 60,
        organizationId: 'org-1',
      });

      expect(result.remaining).toBe(7);
      expect(result.limit).toBe(10);
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });

  describe('resetLimit', () => {
    it('should reset limit for organization and action', async () => {
      mockRedis.keys.mockResolvedValue([
        'rate_limit:org-1:test.action:1705276800000',
        'rate_limit:org-1:test.action:1705276860000',
      ]);
      mockRedis.del.mockResolvedValue(2);

      await service.resetLimit('org-1', 'test.action');

      expect(mockRedis.keys).toHaveBeenCalledWith('rate_limit:org-1:test.action:*');
      expect(mockRedis.del).toHaveBeenCalledWith(
        'rate_limit:org-1:test.action:1705276800000',
        'rate_limit:org-1:test.action:1705276860000',
      );
    });
  });
});
