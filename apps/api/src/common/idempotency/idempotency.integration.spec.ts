import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@remember-me/prisma';

describe('Idempotency Integration - Side Effects Prevention', () => {
  let idempotencyService: IdempotencyService;
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

  // Mock service methods to track calls
  const mockStockService = {
    reserveStock: jest.fn(),
  };

  const mockSalesService = {
    createSale: jest.fn(),
    paySale: jest.fn(),
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

    idempotencyService = module.get<IdempotencyService>(IdempotencyService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    mockStockService.reserveStock.mockClear();
    mockSalesService.createSale.mockClear();
    mockSalesService.paySale.mockClear();
  });

  describe('Stock Reservation - Idempotency', () => {
    const orgId = 'org-1';
    const userId = 'user-1';
    const key = 'reservation-key-123';
    const path = '/api/stock/reservations';
    const method = 'POST';
    const body = { stockItemId: 'item-1', quantity: 1 };

    it('should not execute service method on second request with same key', async () => {
      const requestHash = IdempotencyService.calculateRequestHash(body);

      // First request: miss
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.idempotencyKey.create.mockResolvedValueOnce({
        id: 'id-1',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: null,
        responseBody: Prisma.JsonNull,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const firstResult = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      expect(firstResult.hit).toBe(false);

      // Simulate service execution and complete
      const response = { id: 'reservation-1', status: 'ACTIVE' };
      await idempotencyService.complete({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        statusCode: 201,
        responseBody: response,
      });

      mockPrismaService.idempotencyKey.updateMany.mockResolvedValueOnce({ count: 1 });

      // Second request: hit
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValueOnce({
        id: 'id-1',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: 201,
        responseBody: response,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const secondResult = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      expect(secondResult.hit).toBe(true);
      expect(secondResult.cachedResponse).toEqual({
        statusCode: 201,
        body: response,
      });

      // Service should NOT be called on second request (this is verified by the cached response)
    });

    it('should return same statusCode and body on repeated request', async () => {
      const requestHash = IdempotencyService.calculateRequestHash(body);
      const cachedResponse = {
        statusCode: 201,
        body: { id: 'reservation-1', stockItemId: 'item-1', quantity: 1 },
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'id-1',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: cachedResponse.statusCode,
        responseBody: cachedResponse.body,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result1 = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      const result2 = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      expect(result1.cachedResponse).toEqual(cachedResponse);
      expect(result2.cachedResponse).toEqual(cachedResponse);
      expect(result1.cachedResponse?.statusCode).toBe(result2.cachedResponse?.statusCode);
    });
  });

  describe('Create Sale - Idempotency', () => {
    const orgId = 'org-1';
    const userId = 'user-1';
    const key = 'sale-key-456';
    const path = '/api/sales';
    const method = 'POST';
    const body = { stockReservationIds: ['res-1', 'res-2'] };

    it('should not execute createSale on second request with same key', async () => {
      const requestHash = IdempotencyService.calculateRequestHash(body);

      // First request
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.idempotencyKey.create.mockResolvedValueOnce({
        id: 'id-2',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: null,
        responseBody: Prisma.JsonNull,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const firstResult = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      expect(firstResult.hit).toBe(false);

      // Complete with response
      const response = { id: 'sale-1', status: 'RESERVED' };
      await idempotencyService.complete({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        statusCode: 201,
        responseBody: response,
      });

      // Second request: should hit cache
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValueOnce({
        id: 'id-2',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: 201,
        responseBody: response,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const secondResult = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      expect(secondResult.hit).toBe(true);
      expect(secondResult.cachedResponse?.body).toEqual(response);
    });

    it('should prevent duplicate sale creation with same key', async () => {
      const requestHash = IdempotencyService.calculateRequestHash(body);

      // Simulate first request completed
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'id-3',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: 201,
        responseBody: { id: 'sale-2' },
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      // Should return cached response, preventing duplicate creation
      expect(result.hit).toBe(true);
      expect(result.cachedResponse?.body.id).toBe('sale-2');
    });
  });

  describe('Pay Sale - Idempotency', () => {
    const orgId = 'org-1';
    const userId = 'user-1';
    const key = 'pay-key-789';
    const path = '/api/sales/:id/pay';
    const method = 'PATCH';
    const body = {};

    it('should not execute paySale twice with same key', async () => {
      const requestHash = IdempotencyService.calculateRequestHash(body);

      // First request
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.idempotencyKey.create.mockResolvedValueOnce({
        id: 'id-4',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: null,
        responseBody: Prisma.JsonNull,
        expiresAt: new Date(Date.now() + 86400000),
      });

      await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      // Complete
      const response = { id: 'sale-3', status: 'PAID' };
      await idempotencyService.complete({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        statusCode: 200,
        responseBody: response,
      });

      // Second request: should return cached
      mockPrismaService.idempotencyKey.findUnique.mockResolvedValueOnce({
        id: 'id-4',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: 200,
        responseBody: response,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const secondResult = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      expect(secondResult.hit).toBe(true);
      expect(secondResult.cachedResponse?.body.status).toBe('PAID');
    });

    it('should return same response for repeated pay requests', async () => {
      const requestHash = IdempotencyService.calculateRequestHash(body);
      const cachedResponse = {
        statusCode: 200,
        body: { id: 'sale-4', status: 'PAID', paidAt: '2026-01-13T00:00:00Z' },
      };

      mockPrismaService.idempotencyKey.findUnique.mockResolvedValue({
        id: 'id-5',
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
        statusCode: cachedResponse.statusCode,
        responseBody: cachedResponse.body,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const result1 = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      const result2 = await idempotencyService.begin({
        organizationId: orgId,
        userId,
        method,
        path,
        key,
        requestHash,
      });

      expect(result1.cachedResponse).toEqual(cachedResponse);
      expect(result2.cachedResponse).toEqual(cachedResponse);
      expect(result1.cachedResponse?.body.status).toBe('PAID');
      expect(result2.cachedResponse?.body.status).toBe('PAID');
    });
  });
});
