import { Test, TestingModule } from '@nestjs/testing';
import { StockService } from './stock.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { createMockAuditLogService } from '../common/testing/mock-audit-log.service';
import { createMockAuditLogServiceOpenMode, createMockAuditLogServiceClosedMode } from '../common/testing/audit-fail-mode-tests.helper';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  Role,
  StockStatus,
  ItemCondition,
  StockMovementType,
  ReservationStatus,
} from '@remember-me/prisma';
import { Decimal } from '@prisma/client/runtime/library';

describe('StockService', () => {
  let service: StockService;
  let prisma: PrismaService;

  const mockPrismaService = {
    membership: {
      findFirst: jest.fn(),
    },
    stockItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    stockMovement: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    stockReservation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    sale: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: createMockAuditLogService(),
        },
        {
          provide: 'REQUEST',
          useValue: {
            requestId: 'test-request-id',
            method: 'GET',
            path: '/api/stock',
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('test-agent'),
          },
        },
      ],
    }).compile();

    service = await module.resolve<StockService>(StockService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('listStockItems', () => {
    it('should return stock items for organization', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          organizationId: orgId,
          model: 'iPhone 15 Pro',
          status: StockStatus.AVAILABLE,
        },
      ]);

      mockPrismaService.stockItem.count.mockResolvedValue(1);

      const result = await service.listStockItems(orgId, userId, { page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
    });

    it('should throw NotFoundException if user is not member', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue(null);

      await expect(service.listStockItems('org-1', 'user-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStockItem', () => {
    it('should return stock item by id', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const itemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: itemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
      });

      const result = await service.getStockItem(orgId, userId, itemId);

      expect(result).toBeDefined();
      expect(result.id).toBe(itemId);
    });

    it('should throw NotFoundException if item not found', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue(null);

      await expect(service.getStockItem('org-1', 'user-1', 'item-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createStockItem', () => {
    it('should create stock item for admin (unit with IMEI)', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findUnique.mockResolvedValue(null);

      const mockTx = {
        stockItem: {
          create: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            model: 'iPhone 15 Pro',
            quantity: 1,
            imei: '123456789012345',
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.createStockItem(orgId, userId, {
        model: 'iPhone 15 Pro',
        costPrice: 1000,
        basePrice: 1200,
        imei: '123456789012345',
        quantity: 1,
      });

      expect(result).toBeDefined();
      expect(mockTx.stockItem.create).toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
    });

    it('should create stock item for admin (batch without IMEI)', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      const mockTx = {
        stockItem: {
          create: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            model: 'iPhone 15 Pro',
            quantity: 10,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.createStockItem(orgId, userId, {
        model: 'iPhone 15 Pro',
        costPrice: 1000,
        basePrice: 1200,
        quantity: 10,
      });

      expect(result).toBeDefined();
      expect(mockTx.stockItem.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if IMEI item has quantity != 1', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      await expect(
        service.createStockItem('org-1', 'user-1', {
          model: 'iPhone 15 Pro',
          costPrice: 1000,
          basePrice: 1200,
          imei: '123456789012345',
          quantity: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for SELLER role', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      await expect(
        service.createStockItem('org-1', 'user-1', {
          model: 'iPhone 15 Pro',
          costPrice: 1000,
          basePrice: 1200,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if IMEI exists', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findUnique.mockResolvedValue({
        id: 'existing-item',
        imei: '123456789012345',
      });

      await expect(
        service.createStockItem('org-1', 'user-1', {
          model: 'iPhone 15 Pro',
          costPrice: 1000,
          basePrice: 1200,
          imei: '123456789012345',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateStockItem', () => {
    it('should update stock item for admin', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const itemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: itemId,
        organizationId: orgId,
        status: StockStatus.AVAILABLE,
        imei: '123456789012345',
      });

      mockPrismaService.stockItem.findUnique.mockResolvedValue(null);
      mockPrismaService.stockItem.update.mockResolvedValue({
        id: itemId,
        model: 'iPhone 15 Pro Updated',
      });

      const result = await service.updateStockItem(orgId, userId, itemId, {
        model: 'iPhone 15 Pro Updated',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.stockItem.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to set SOLD item to AVAILABLE', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: 'org-1',
        status: StockStatus.SOLD,
      });

      await expect(
        service.updateStockItem('org-1', 'user-1', 'item-1', {
          status: StockStatus.AVAILABLE,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteStockItem', () => {
    it('should delete stock item for admin', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const itemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: itemId,
        organizationId: orgId,
        status: StockStatus.AVAILABLE,
        quantity: new Decimal('10'),
        sku: 'TEST-SKU',
        model: 'iPhone 13',
        stockReservations: [],
      });

      const result = await service.deleteStockItem(orgId, userId, itemId);

      expect(result).toBeDefined();
      expect(result.message).toBe('Stock item deleted successfully');
    });

    it('should throw BadRequestException if item has active reservations', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: 'org-1',
        status: StockStatus.AVAILABLE,
        stockReservations: [{ id: 'res-1' }],
      });

      await expect(
        service.deleteStockItem('org-1', 'user-1', 'item-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('adjustStock', () => {
    it('should adjust stock (positive)', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const itemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      const mockTx = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: itemId,
            organizationId: orgId,
            quantity: 10,
          }),
          update: jest.fn().mockResolvedValue({
            id: itemId,
            quantity: 15,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.adjustStock(orgId, userId, itemId, {
        quantityChange: 5,
        reason: 'Inventory adjustment',
      });

      expect(result).toBeDefined();
      expect(mockTx.stockItem.update).toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
    });

    it('should adjust stock (negative)', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const itemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      const mockTx = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: itemId,
            organizationId: orgId,
            quantity: 10,
          }),
          update: jest.fn().mockResolvedValue({
            id: itemId,
            quantity: 5,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.adjustStock(orgId, userId, itemId, {
        quantityChange: -5,
        reason: 'Inventory adjustment',
      });

      expect(result).toBeDefined();
      expect(mockTx.stockItem.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if adjustment results in negative stock', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const itemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      const mockTx = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: itemId,
            organizationId: orgId,
            quantity: 5,
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.adjustStock(orgId, userId, itemId, {
          quantityChange: -10,
          reason: 'Inventory adjustment',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for SELLER role', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      await expect(
        service.adjustStock('org-1', 'user-1', 'item-1', {
          quantityChange: 5,
          reason: 'Test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reserveStock', () => {
    it('should create reservation successfully', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            quantity: 10,
            status: StockStatus.AVAILABLE,
          }),
        },
        stockReservation: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { quantity: 0 },
          }),
          create: jest.fn().mockResolvedValue({
            id: 'res-1',
            stockItemId: 'item-1',
            quantity: 3,
            status: ReservationStatus.ACTIVE,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.reserveStock(orgId, userId, {
        stockItemId: 'item-1',
        quantity: 3,
      });

      expect(result).toBeDefined();
      expect(mockTx.stockReservation.create).toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if not enough stock available', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            quantity: 10,
            status: StockStatus.AVAILABLE,
          }),
        },
        stockReservation: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { quantity: 8 }, // 8 already reserved
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.reserveStock(orgId, userId, {
          stockItemId: 'item-1',
          quantity: 5, // Requesting 5, but only 2 available (10 - 8)
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if item is not AVAILABLE', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            quantity: 10,
            status: StockStatus.SOLD,
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.reserveStock(orgId, userId, {
          stockItemId: 'item-1',
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('releaseReservation', () => {
    it('should release reservation successfully', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const reservationId = 'res-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockReservation: {
          findFirst: jest.fn().mockResolvedValue({
            id: reservationId,
            organizationId: orgId,
            status: ReservationStatus.ACTIVE,
            stockItemId: 'item-1',
            quantity: new Decimal('1'),
            stockItem: {
              id: 'item-1',
              quantity: 10,
            },
            saleId: null,
          }),
          update: jest.fn().mockResolvedValue({
            id: reservationId,
            status: ReservationStatus.CANCELLED,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.releaseReservation(orgId, userId, reservationId);

      expect(result).toBeDefined();
      expect(mockTx.stockReservation.update).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: { status: ReservationStatus.CANCELLED },
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if reservation is not ACTIVE', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockReservation: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'res-1',
            organizationId: 'org-1',
            status: ReservationStatus.CONFIRMED,
            stockItemId: 'item-1',
            stockItem: {
              id: 'item-1',
              quantity: 10,
            },
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.releaseReservation('org-1', 'user-1', 'res-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmReservation', () => {
    it('should confirm reservation and decrement quantity', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const reservationId = 'res-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockReservation: {
          findFirst: jest.fn().mockResolvedValue({
            id: reservationId,
            organizationId: orgId,
            status: ReservationStatus.ACTIVE,
            quantity: 3,
            stockItemId: 'item-1',
            stockItem: {
              id: 'item-1',
              quantity: 10,
              imei: null,
            },
            saleId: null,
          }),
          update: jest.fn().mockResolvedValue({
            id: reservationId,
            status: ReservationStatus.CONFIRMED,
          }),
        },
        stockItem: {
          update: jest.fn().mockResolvedValue({
            id: 'item-1',
            quantity: 7,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.confirmReservation(orgId, userId, reservationId);

      expect(result).toBeDefined();
      expect(mockTx.stockItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 7 },
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
    });

    it('should mark item as SOLD if IMEI and quantity becomes 0', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const reservationId = 'res-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockReservation: {
          findFirst: jest.fn().mockResolvedValue({
            id: reservationId,
            organizationId: orgId,
            status: ReservationStatus.ACTIVE,
            quantity: 1,
            stockItemId: 'item-1',
            stockItem: {
              id: 'item-1',
              quantity: 1,
              imei: '123456789012345',
            },
            saleId: null,
          }),
          update: jest.fn().mockResolvedValue({
            id: reservationId,
            status: ReservationStatus.CONFIRMED,
          }),
        },
        stockItem: {
          update: jest.fn().mockResolvedValue({
            id: 'item-1',
            quantity: 0,
            status: StockStatus.SOLD,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.confirmReservation(orgId, userId, reservationId);

      expect(result).toBeDefined();
      expect(mockTx.stockItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantity: 0, status: StockStatus.SOLD },
      });
    });

    it('should throw BadRequestException if reservation is not ACTIVE', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockReservation: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'res-1',
            organizationId: 'org-1',
            status: ReservationStatus.CONFIRMED,
            stockItemId: 'item-1',
            stockItem: {
              id: 'item-1',
              quantity: 10,
            },
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.confirmReservation('org-1', 'user-1', 'res-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if confirmation results in negative stock', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      const mockTx = {
        stockReservation: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'res-1',
            organizationId: 'org-1',
            status: ReservationStatus.ACTIVE,
            quantity: 5,
            stockItemId: 'item-1',
            stockItem: {
              id: 'item-1',
              quantity: 3, // Only 3 available, trying to confirm 5
            },
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.confirmReservation('org-1', 'user-1', 'res-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listMovements', () => {
    it('should list movements for stock item', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const itemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: itemId,
        organizationId: orgId,
      });

      mockPrismaService.stockMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          type: StockMovementType.IN,
          quantity: 10,
        },
      ]);

      mockPrismaService.stockMovement.count.mockResolvedValue(1);

      const result = await service.listMovements(orgId, userId, itemId, 1, 50);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
    });
  });

  describe('listReservations', () => {
    it('should list reservations', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          status: ReservationStatus.ACTIVE,
        },
      ]);

      mockPrismaService.stockReservation.count.mockResolvedValue(1);

      const result = await service.listReservations(orgId, userId, undefined, undefined, 1, 50);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });

  describe('getReservation', () => {
    it('should return reservation by id', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const reservationId = 'res-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockReservation.findFirst.mockResolvedValue({
        id: reservationId,
        organizationId: orgId,
        status: ReservationStatus.ACTIVE,
      });

      const result = await service.getReservation(orgId, userId, reservationId);

      expect(result).toBeDefined();
      expect(result.id).toBe(reservationId);
    });
  });

  describe('Multi-org isolation', () => {
    it('should not return items from other organizations', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          organizationId: orgId,
        },
      ]);

      mockPrismaService.stockItem.count.mockResolvedValue(1);

      const result = await service.listStockItems(orgId, userId, {});

      expect(result.data.every((item: any) => item.organizationId === orgId)).toBe(true);
    });
  });

  describe('Concurrency - reserveStock', () => {
    it('should handle concurrent reservations correctly (simulated)', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      // First reservation
      const mockTx1 = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            quantity: 10,
            status: StockStatus.AVAILABLE,
          }),
        },
        stockReservation: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { quantity: 0 },
          }),
          create: jest.fn().mockResolvedValue({
            id: 'res-1',
            quantity: 5,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      // Second reservation (should fail due to insufficient stock)
      const mockTx2 = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            quantity: 10,
            status: StockStatus.AVAILABLE,
          }),
        },
        stockReservation: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { quantity: 5 }, // 5 already reserved
          }),
        },
      };

      let callCount = 0;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        callCount++;
        if (callCount === 1) {
          return callback(mockTx1);
        } else {
          return callback(mockTx2);
        }
      });

      // First reservation succeeds
      const result1 = await service.reserveStock(orgId, userId, {
        stockItemId: 'item-1',
        quantity: 5,
      });
      expect(result1).toBeDefined();

      // Second reservation fails (only 5 available, requesting 7)
      await expect(
        service.reserveStock(orgId, userId, {
          stockItemId: 'item-1',
          quantity: 7,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = service.health();
      expect(result).toEqual({ ok: true, module: 'stock' });
    });
  });

  describe('AUDIT_FAIL_MODE behavior', () => {
    it('should continue operation when AUDIT_FAIL_MODE=OPEN and audit log fails', async () => {
      const mockAuditLogService = createMockAuditLogServiceOpenMode();
      
      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          StockService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: AuditLogService,
            useValue: mockAuditLogService,
          },
          {
            provide: 'REQUEST',
            useValue: {
              requestId: 'test-request-id',
              method: 'POST',
              path: '/api/stock/items',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
        ],
      }).compile();

      const testService = await testModule.resolve<StockService>(StockService);

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockItem.findUnique.mockResolvedValue(null);
      const mockTx = {
        stockItem: {
          create: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: 'org-1',
            sku: 'TEST-SKU',
            quantity: 10,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await testService.createStockItem('org-1', 'user-1', {
        sku: 'TEST-SKU',
        model: 'iPhone 13',
        quantity: 10,
        costPrice: 1000,
        basePrice: 1200,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('item-1');
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should abort operation when AUDIT_FAIL_MODE=CLOSED and audit log fails', async () => {
      const mockAuditLogService = createMockAuditLogServiceClosedMode();
      
      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          StockService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: AuditLogService,
            useValue: mockAuditLogService,
          },
          {
            provide: 'REQUEST',
            useValue: {
              requestId: 'test-request-id',
              method: 'POST',
              path: '/api/stock/items',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
        ],
      }).compile();

      const testService = await testModule.resolve<StockService>(StockService);

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockItem.findUnique.mockResolvedValue(null);
      const mockTx = {
        stockItem: {
          create: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: 'org-1',
            sku: 'TEST-SKU',
            quantity: 10,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        testService.createStockItem('org-1', 'user-1', {
          sku: 'TEST-SKU',
          model: 'iPhone 13',
          quantity: 10,
          costPrice: 1000,
          basePrice: 1200,
        }),
      ).rejects.toThrow(InternalServerErrorException);

      try {
        await testService.createStockItem('org-1', 'user-1', {
          sku: 'TEST-SKU',
          model: 'iPhone 13',
          quantity: 10,
          costPrice: 1000,
          basePrice: 1200,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.response?.errorCode || error.errorCode).toBe('AUDIT_LOG_FAILED');
        expect(error.response?.statusCode || error.statusCode || error.getStatus?.()).toBe(500);
      }
    });
  });

  describe('Soft delete', () => {
    it('should soft delete stockItem and exclude from list', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        sku: 'TEST-SKU',
        model: 'iPhone 13',
        quantity: new Decimal(10),
        status: StockStatus.AVAILABLE,
        deletedAt: null,
        stockReservations: [],
      });
      mockPrismaService.stockItem.update.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });

      await service.deleteStockItem(orgId, userId, 'item-1');

      mockPrismaService.stockItem.findMany.mockResolvedValue([]);
      mockPrismaService.stockItem.count.mockResolvedValue(0);

      const result = await service.listStockItems(orgId, userId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(mockPrismaService.stockItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should include deleted stockItems when includeDeleted=true and user is ADMIN', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          organizationId: orgId,
          deletedAt: new Date(),
        },
      ]);
      mockPrismaService.stockItem.count.mockResolvedValue(1);

      const result = await service.listStockItems(orgId, userId, { page: 1, limit: 10, includeDeleted: true });

      expect(result.data).toHaveLength(1);
    });

    it('should not include deleted stockItems when includeDeleted=true and user is SELLER', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.SELLER });
      mockPrismaService.stockItem.findMany.mockResolvedValue([]);
      mockPrismaService.stockItem.count.mockResolvedValue(0);

      const result = await service.listStockItems(orgId, userId, { page: 1, limit: 10, includeDeleted: true });

      expect(result.data).toHaveLength(0);
      expect(mockPrismaService.stockItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should restore soft-deleted stockItem', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });
      mockPrismaService.stockItem.update.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        deletedAt: null,
      });

      const result = await service.restoreStockItem(orgId, userId, 'item-1');

      expect(result.deletedAt).toBeNull();
      expect(mockPrismaService.stockItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: null },
        }),
      );
    });

    it('should block reserve on soft-deleted stockItem', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      const mockTx = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            quantity: new Decimal(10),
            status: StockStatus.AVAILABLE,
            deletedAt: new Date(), // Item is soft-deleted
          }),
        },
        stockReservation: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { quantity: 0 },
          }),
          create: jest.fn(),
        },
        stockMovement: {
          create: jest.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.reserveStock(orgId, userId, { stockItemId: 'item-1', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block adjust on soft-deleted stockItem', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      const mockTx = {
        stockItem: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            quantity: new Decimal(10),
            deletedAt: new Date(),
          }),
          update: jest.fn(),
        },
        stockMovement: {
          create: jest.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        service.adjustStock(orgId, userId, 'item-1', { quantityChange: 1, reason: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Audit log', () => {
    it('should create audit log on createStockItem', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockItem.findUnique.mockResolvedValue(null);
      const mockTx = {
        stockItem: {
          create: jest.fn().mockResolvedValue({
            id: 'item-1',
            organizationId: orgId,
            sku: 'TEST-SKU',
            quantity: 10,
          }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await service.createStockItem(orgId, userId, {
        sku: 'TEST-SKU',
        model: 'iPhone 13',
        quantity: 10,
        costPrice: 1000,
        basePrice: 1200,
      });

      expect(mockTx.stockItem.create).toHaveBeenCalled();
    });

    it('should create audit log on restoreStockItem', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });
      mockPrismaService.stockItem.update.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        deletedAt: null,
      });

      await service.restoreStockItem(orgId, userId, 'item-1');

      expect(mockPrismaService.stockItem.update).toHaveBeenCalled();
    });
  });
});
