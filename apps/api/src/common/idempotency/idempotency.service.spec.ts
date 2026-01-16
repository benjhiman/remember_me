import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@remember-me/prisma';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('begin', () => {
    const params = {
      organizationId: 'org-1',
      userId: 'user-1',
      method: 'POST',
      path: '/api/sales',
      key: 'key-123',
      requestHash: 'hash-abc',
    };

    it('should return cached response when key exists with same hash', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'id-1',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        requestHash: 'hash-abc',
        statusCode: 200,
        responseBody: { id: 'sale-1', status: 'RESERVED' },
      });

      const result = await service.begin(params);

      expect(result.hit).toBe(true);
      expect(result.cachedResponse).toEqual({
        statusCode: 200,
        body: { id: 'sale-1', status: 'RESERVED' },
      });
      expect(mockPrismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId_method_path_key: {
            organizationId: 'org-1',
            userId: 'user-1',
            method: 'POST',
            path: '/api/sales',
            key: 'key-123',
          },
        },
      });
    });

    it('should throw 409 when key exists with different hash', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'id-1',
        expiresAt: new Date(Date.now() + 3600000),
        requestHash: 'hash-different',
        statusCode: 200,
        responseBody: { id: 'sale-1' },
      });

      await expect(service.begin(params)).rejects.toThrow(ConflictException);
      await expect(service.begin(params)).rejects.toMatchObject({
        response: {
          errorCode: 'IDEMPOTENCY_KEY_REUSE_DIFFERENT_PAYLOAD',
          statusCode: 409,
        },
      });
    });

    it('should create pending record when key does not exist', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.idempotencyKey.create.mockResolvedValue({
        id: 'id-1',
        ...params,
        statusCode: null,
        responseBody: Prisma.JsonNull,
        expiresAt: expect.any(Date),
      });

      const result = await service.begin(params);

      expect(result.hit).toBe(false);
      expect(mockPrismaService.idempotencyKey.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-1',
          method: 'POST',
          path: '/api/sales',
          key: 'key-123',
          requestHash: 'hash-abc',
          statusCode: null,
          responseBody: Prisma.JsonNull,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('should handle race condition: create fails, re-read returns cached', async () => {
      mockPrismaService.idempotencyKey.findUnique
        .mockResolvedValueOnce(null) // First check: not found
        .mockResolvedValueOnce({
          // Re-read after race: found with cached response
          id: 'id-1',
          expiresAt: new Date(Date.now() + 3600000),
          requestHash: 'hash-abc',
          statusCode: 201,
          responseBody: { id: 'sale-2' },
        });
      mockPrismaService.idempotencyKey.create.mockRejectedValue({
        code: 'P2002', // Unique constraint violation
      });

      const result = await service.begin(params);

      expect(result.hit).toBe(true);
      expect(result.cachedResponse).toEqual({
        statusCode: 201,
        body: { id: 'sale-2' },
      });
    });

    it('should delete expired key and create new pending record', async () => {
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'id-1',
        expiresAt: expiredDate,
        requestHash: 'hash-abc',
        statusCode: 200,
        responseBody: { id: 'sale-1' },
      });
      mockPrismaService.idempotencyKey.delete.mockResolvedValue({ id: 'id-1' });
      mockPrismaService.idempotencyKey.create.mockResolvedValue({
        id: 'id-2',
        ...params,
        statusCode: null,
        responseBody: Prisma.JsonNull,
        expiresAt: expect.any(Date),
      });

      const result = await service.begin(params);

      expect(result.hit).toBe(false);
      expect(mockPrismaService.idempotencyKey.delete).toHaveBeenCalledWith({
        where: { id: 'id-1' },
      });
      expect(mockPrismaService.idempotencyKey.create).toHaveBeenCalled();
    });

    it('should return miss when record exists but no cached response (pending)', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'id-1',
        expiresAt: new Date(Date.now() + 3600000),
        requestHash: 'hash-abc',
        statusCode: null,
        responseBody: null,
      });

      const result = await service.begin(params);

      expect(result.hit).toBe(false);
    });
  });

  describe('complete', () => {
    const params = {
      organizationId: 'org-1',
      userId: 'user-1',
      method: 'POST',
      path: '/api/sales',
      key: 'key-123',
      statusCode: 201,
      responseBody: { id: 'sale-1', status: 'RESERVED' },
    };

    it('should update record with statusCode and responseBody', async () => {
      mockPrismaService.idempotencyKey.updateMany.mockResolvedValue({ count: 1 });

      await service.complete(params);

      expect(mockPrismaService.idempotencyKey.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          userId: 'user-1',
          method: 'POST',
          path: '/api/sales',
          key: 'key-123',
        },
        data: {
          statusCode: 201,
          responseBody: { id: 'sale-1', status: 'RESERVED' },
        },
      });
    });
  });

  describe('fail', () => {
    const params = {
      organizationId: 'org-1',
      userId: 'user-1',
      method: 'POST',
      path: '/api/sales',
      key: 'key-123',
    };

    it('should delete record on fail', async () => {
      mockPrismaService.idempotencyKey.deleteMany.mockResolvedValue({ count: 1 });

      await service.fail(params);

      expect(mockPrismaService.idempotencyKey.deleteMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          userId: 'user-1',
          method: 'POST',
          path: '/api/sales',
          key: 'key-123',
        },
      });
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired keys', async () => {
      mockPrismaService.idempotencyKey.deleteMany.mockResolvedValue({ count: 5 });

      const count = await service.cleanupExpired();

      expect(count).toBe(5);
      expect(mockPrismaService.idempotencyKey.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });

  describe('calculateRequestHash', () => {
    it('should generate consistent hash for same object', () => {
      const body = { name: 'John', age: 30 };
      const hash1 = IdempotencyService.calculateRequestHash(body);
      const hash2 = IdempotencyService.calculateRequestHash(body);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex = 64 chars
    });

    it('should generate different hash for different objects', () => {
      const body1 = { name: 'John', age: 30 };
      const body2 = { name: 'Jane', age: 30 };

      const hash1 = IdempotencyService.calculateRequestHash(body1);
      const hash2 = IdempotencyService.calculateRequestHash(body2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty object', () => {
      const hash = IdempotencyService.calculateRequestHash({});

      expect(hash).toBeTruthy();
      expect(hash).toHaveLength(64);
    });
  });

  describe('multi-org isolation', () => {
    it('should not share keys across organizations', async () => {
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue(null);
      mockPrismaService.idempotencyKey.create.mockResolvedValue({
        id: 'id-1',
        organizationId: 'org-1',
        userId: 'user-1',
        method: 'POST',
        path: '/api/sales',
        key: 'key-123',
        requestHash: 'hash-abc',
        statusCode: null,
        responseBody: Prisma.JsonNull,
        expiresAt: expect.any(Date),
      });

      await service.begin({
        organizationId: 'org-1',
        userId: 'user-1',
        method: 'POST',
        path: '/api/sales',
        key: 'key-123',
        requestHash: 'hash-abc',
      });

      expect(mockPrismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId_method_path_key: {
            organizationId: 'org-1',
            userId: 'user-1',
            method: 'POST',
            path: '/api/sales',
            key: 'key-123',
          },
        },
      });
    });
  });
});
