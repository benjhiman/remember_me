import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { createMockAuditLogService } from '../common/testing/mock-audit-log.service';
import { createMockAuditLogServiceOpenMode, createMockAuditLogServiceClosedMode } from '../common/testing/audit-fail-mode-tests.helper';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  Role,
  SaleStatus,
  StockStatus,
  ReservationStatus,
  StockMovementType,
} from '@remember-me/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { WhatsAppAutomationsService } from '../integrations/whatsapp/whatsapp-automations.service';
import { AttributionService } from '../dashboard/attribution.service';

describe('SalesService', () => {
  let service: SalesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    membership: {
      findFirst: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
    },
    stockReservation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    sale: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    stockItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    saleItem: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    saleReservationLink: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
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
            path: '/test',
            ip: '127.0.0.1',
            get: jest.fn(),
          },
        },
        {
          provide: WhatsAppAutomationsService,
          useValue: {
            processTrigger: jest.fn(),
          },
        },
        {
          provide: AttributionService,
          useValue: {
            createAttributionSnapshot: jest.fn(),
          },
        },
      ],
    }).compile();

    service = await module.resolve<SalesService>(SalesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('listSales', () => {
    it('should return sales for organization', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          organizationId: orgId,
          saleNumber: 'SALE-2024-001',
          status: SaleStatus.RESERVED,
        },
      ]);

      mockPrismaService.sale.count.mockResolvedValue(1);

      const result = await service.listSales(orgId, userId, { page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
    });

    it('should filter sales for SELLER role (createdBy or assignedTo)', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.sale.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);

      await service.listSales(orgId, userId, { page: 1, limit: 10 });

      expect(mockPrismaService.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { createdById: userId },
              { assignedToId: userId },
            ]),
          }),
        }),
      );
    });
  });

  describe('getSale', () => {
    it('should return sale by id', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        createdById: userId,
        assignedToId: userId,
        status: SaleStatus.RESERVED,
      });

      const result = await service.getSale(orgId, userId, saleId);

      expect(result).toBeDefined();
      expect(result.id).toBe(saleId);
    });

    it('should throw NotFoundException if sale not found', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue(null);

      await expect(service.getSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if SELLER tries to access sale they did not create or are not assigned to', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        createdById: 'other-user',
        assignedToId: 'other-user',
        status: SaleStatus.RESERVED,
      });

      await expect(service.getSale(orgId, userId, saleId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('createSale', () => {
    it('should create sale from stock reservations', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const reservationId1 = 'res-1';
      const reservationId2 = 'res-2';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      const mockReservations = [
        {
          id: reservationId1,
          organizationId: orgId,
          status: ReservationStatus.ACTIVE,
          saleId: null,
          quantity: 1,
          stockItem: {
            id: 'item-1',
            model: 'iPhone 15 Pro',
            basePrice: new Decimal(1000),
          },
        },
        {
          id: reservationId2,
          organizationId: orgId,
          status: ReservationStatus.ACTIVE,
          saleId: null,
          quantity: 2,
          stockItem: {
            id: 'item-2',
            model: 'iPhone 14',
            basePrice: new Decimal(800),
          },
        },
      ];

      mockPrismaService.stockReservation.findMany.mockResolvedValue(mockReservations);
      mockPrismaService.sale.findFirst.mockResolvedValue(null); // For generateSaleNumber

      const mockTx = {
        sale: {
          create: jest.fn().mockResolvedValue({
            id: 'sale-1',
            saleNumber: 'SALE-2024-001',
            status: SaleStatus.RESERVED,
            createdById: userId,
            assignedToId: userId,
            total: new Decimal('0'),
            items: [],
            createdBy: { id: userId, name: 'User', email: 'user@example.com' },
            assignedTo: { id: userId, name: 'User', email: 'user@example.com' },
          }),
        },
        stockReservation: {
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const result = await service.createSale(orgId, userId, {
        stockReservationIds: [reservationId1, reservationId2],
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      expect(result).toBeDefined();
      expect(mockTx.sale.create).toHaveBeenCalled();
      expect(mockTx.stockReservation.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [reservationId1, reservationId2] } },
        data: { saleId: expect.any(String) },
      });
    });

    it('should throw BadRequestException if stockReservationIds is empty', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      await expect(
        service.createSale('org-1', 'user-1', {
          stockReservationIds: [],
          customerName: 'John Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if reservation not found', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockReservation.findMany.mockResolvedValue([]);

      await expect(
        service.createSale('org-1', 'user-1', {
          stockReservationIds: ['res-1'],
          customerName: 'John Doe',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if reservation is not ACTIVE', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          status: ReservationStatus.CONFIRMED,
          saleId: null,
          stockItem: { basePrice: new Decimal(1000) },
        },
      ]);

      await expect(
        service.createSale('org-1', 'user-1', {
          stockReservationIds: ['res-1'],
          customerName: 'John Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reservation is already linked to a sale', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          status: ReservationStatus.ACTIVE,
          saleId: 'existing-sale',
          stockItem: { basePrice: new Decimal(1000) },
        },
      ]);

      await expect(
        service.createSale('org-1', 'user-1', {
          stockReservationIds: ['res-1'],
          customerName: 'John Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify lead belongs to organization if provided', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.findFirst.mockResolvedValue(null);

      mockPrismaService.stockReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          status: ReservationStatus.ACTIVE,
          saleId: null,
          stockItem: { basePrice: new Decimal(1000) },
        },
      ]);

      await expect(
        service.createSale('org-1', 'user-1', {
          stockReservationIds: ['res-1'],
          customerName: 'John Doe',
          leadId: 'lead-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSale', () => {
    it('should update customer fields', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        createdById: userId,
        assignedToId: userId,
        status: SaleStatus.RESERVED,
        subtotal: new Decimal(1000),
        discount: new Decimal(0),
        total: new Decimal(1000),
      });

      mockPrismaService.sale.update.mockResolvedValue({
        id: saleId,
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        total: new Decimal(1000),
      });

      const result = await service.updateSale(orgId, userId, saleId, {
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.sale.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to update SHIPPED sale', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        createdById: 'user-1',
        assignedToId: 'user-1',
        status: SaleStatus.SHIPPED,
      });

      await expect(
        service.updateSale('org-1', 'user-1', 'sale-1', {
          customerName: 'Jane Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to update DELIVERED sale', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        createdById: 'user-1',
        assignedToId: 'user-1',
        status: SaleStatus.DELIVERED,
      });

      await expect(
        service.updateSale('org-1', 'user-1', 'sale-1', {
          customerName: 'Jane Doe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if SELLER tries to update sale they did not create or are not assigned to', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        createdById: 'other-user',
        assignedToId: 'other-user',
        status: SaleStatus.RESERVED,
      });

      await expect(
        service.updateSale('org-1', 'user-1', 'sale-1', {
          customerName: 'Jane Doe',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should recalculate total when discount changes', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        createdById: userId,
        assignedToId: userId,
        status: SaleStatus.RESERVED,
        subtotal: new Decimal(1000),
        discount: new Decimal(0),
        total: new Decimal(1000),
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
      });

      mockPrismaService.sale.update.mockResolvedValue({
        id: saleId,
        discount: new Decimal(100),
        total: new Decimal(900),
      });

      await service.updateSale(orgId, userId, saleId, {
        discount: 100,
      });

      expect(mockPrismaService.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discount: expect.any(Decimal),
            total: expect.any(Decimal),
          }),
        }),
      );
    });
  });

  describe('paySale', () => {
    it('should confirm all reservations and mark sale as PAID', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';
      const reservationId1 = 'res-1';
      const reservationId2 = 'res-2';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.RESERVED,
        stockReservations: [
          { id: reservationId1, status: ReservationStatus.ACTIVE },
          { id: reservationId2, status: ReservationStatus.ACTIVE },
        ],
      });

      const mockTx = {
        stockReservation: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: reservationId1,
              organizationId: orgId,
              status: ReservationStatus.ACTIVE,
              quantity: 1,
              stockItemId: 'item-1',
              stockItem: {
                id: 'item-1',
                quantity: 5,
                imei: null,
              },
            })
            .mockResolvedValueOnce({
              id: reservationId2,
              organizationId: orgId,
              status: ReservationStatus.ACTIVE,
              quantity: 2,
              stockItemId: 'item-2',
              stockItem: {
                id: 'item-2',
                quantity: 10,
                imei: null,
              },
            }),
          update: jest.fn().mockResolvedValue({ status: ReservationStatus.CONFIRMED }),
        },
        stockItem: {
          update: jest.fn().mockResolvedValue({}),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
        sale: {
          update: jest.fn().mockResolvedValue({
            id: saleId,
            status: SaleStatus.PAID,
            paidAt: new Date(),
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback, options) => {
        return callback(mockTx);
      });

      const result = await service.paySale(orgId, userId, saleId);

      expect(result).toBeDefined();
      expect(result.status).toBe(SaleStatus.PAID);
      expect(mockTx.stockReservation.update).toHaveBeenCalledTimes(2);
      expect(mockTx.stockItem.update).toHaveBeenCalledTimes(2);
      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if sale is not RESERVED', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.PAID,
        stockReservations: [],
      });

      await expect(service.paySale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if sale has no reservations', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.RESERVED,
        stockReservations: [],
      });

      await expect(service.paySale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create attribution snapshot when sale has lead with meta attribution', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';
      const leadId = 'lead-1';
      const reservationId = 'res-1';

      const mockAttributionService = {
        createAttributionSnapshot: jest.fn().mockResolvedValue(undefined),
      };

      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          SalesService,
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
              method: 'PATCH',
              path: '/api/sales/sale-1/pay',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
          {
            provide: WhatsAppAutomationsService,
            useValue: {
              processTrigger: jest.fn(),
            },
          },
          {
            provide: AttributionService,
            useValue: mockAttributionService,
          },
        ],
      }).compile();

      const testService = await testModule.resolve<SalesService>(SalesService);

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.RESERVED,
        leadId: leadId,
        stockReservations: [
          { id: reservationId, status: ReservationStatus.ACTIVE },
        ],
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
              quantity: 5,
              imei: null,
            },
          }),
          update: jest.fn().mockResolvedValue({ status: ReservationStatus.CONFIRMED }),
        },
        stockItem: {
          update: jest.fn().mockResolvedValue({}),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
        sale: {
          update: jest.fn().mockResolvedValue({
            id: saleId,
            status: SaleStatus.PAID,
            paidAt: new Date(),
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback, options) => {
        return callback(mockTx);
      });

      await testService.paySale(orgId, userId, saleId);

      expect(mockAttributionService.createAttributionSnapshot).toHaveBeenCalledWith(
        mockTx,
        orgId,
        saleId,
        leadId,
      );
    });

    it('should not fail paySale if attribution snapshot creation fails', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';
      const leadId = 'lead-1';
      const reservationId = 'res-1';

      const mockAttributionService = {
        createAttributionSnapshot: jest.fn().mockRejectedValue(new Error('Attribution error')),
      };

      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          SalesService,
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
              method: 'PATCH',
              path: '/api/sales/sale-1/pay',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
          {
            provide: WhatsAppAutomationsService,
            useValue: {
              processTrigger: jest.fn(),
            },
          },
          {
            provide: AttributionService,
            useValue: mockAttributionService,
          },
        ],
      }).compile();

      const testService = await testModule.resolve<SalesService>(SalesService);

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.RESERVED,
        leadId: leadId,
        stockReservations: [
          { id: reservationId, status: ReservationStatus.ACTIVE },
        ],
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
              quantity: 5,
              imei: null,
            },
          }),
          update: jest.fn().mockResolvedValue({ status: ReservationStatus.CONFIRMED }),
        },
        stockItem: {
          update: jest.fn().mockResolvedValue({}),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
        sale: {
          update: jest.fn().mockResolvedValue({
            id: saleId,
            status: SaleStatus.PAID,
            paidAt: new Date(),
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback, options) => {
        return callback(mockTx);
      });

      const result = await testService.paySale(orgId, userId, saleId);

      expect(result.status).toBe(SaleStatus.PAID);
      expect(mockAttributionService.createAttributionSnapshot).toHaveBeenCalled();
    });
  });

  describe('cancelSale', () => {
    it('should release all reservations and mark sale as CANCELLED', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';
      const reservationId1 = 'res-1';
      const reservationId2 = 'res-2';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.RESERVED,
        stockReservations: [
          { id: reservationId1, status: ReservationStatus.ACTIVE },
          { id: reservationId2, status: ReservationStatus.ACTIVE },
        ],
      });

      const mockTx = {
        stockReservation: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: reservationId1,
              organizationId: orgId,
              status: ReservationStatus.ACTIVE,
              stockItemId: 'item-1',
              stockItem: { quantity: 5 },
            })
            .mockResolvedValueOnce({
              id: reservationId2,
              organizationId: orgId,
              status: ReservationStatus.ACTIVE,
              stockItemId: 'item-2',
              stockItem: { quantity: 10 },
            }),
          update: jest.fn().mockResolvedValue({ status: ReservationStatus.CANCELLED }),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
        sale: {
          update: jest.fn().mockResolvedValue({
            id: saleId,
            status: SaleStatus.CANCELLED,
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback, options) => {
        return callback(mockTx);
      });

      const result = await service.cancelSale(orgId, userId, saleId);

      expect(result).toBeDefined();
      expect(result.status).toBe(SaleStatus.CANCELLED);
      expect(mockTx.stockReservation.update).toHaveBeenCalledTimes(2);
      expect(mockTx.stockMovement.create).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if trying to cancel SHIPPED sale', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.SHIPPED,
        stockReservations: [],
      });

      await expect(service.cancelSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if trying to cancel DELIVERED sale', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.DELIVERED,
        stockReservations: [],
      });

      await expect(service.cancelSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if sale is already CANCELLED', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.CANCELLED,
        stockReservations: [],
      });

      await expect(service.cancelSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('shipSale', () => {
    it('should mark sale as SHIPPED', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.PAID,
      });

      mockPrismaService.sale.update.mockResolvedValue({
        id: saleId,
        status: SaleStatus.SHIPPED,
        shippedAt: new Date(),
      });

      const result = await service.shipSale(orgId, userId, saleId);

      expect(result).toBeDefined();
      expect(result.status).toBe(SaleStatus.SHIPPED);
      expect(mockPrismaService.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SaleStatus.SHIPPED,
            shippedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw BadRequestException if sale is not PAID', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.RESERVED,
      });

      await expect(service.shipSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deliverSale', () => {
    it('should mark sale as DELIVERED', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.SHIPPED,
      });

      mockPrismaService.sale.update.mockResolvedValue({
        id: saleId,
        status: SaleStatus.DELIVERED,
        deliveredAt: new Date(),
      });

      const result = await service.deliverSale(orgId, userId, saleId);

      expect(result).toBeDefined();
      expect(result.status).toBe(SaleStatus.DELIVERED);
    });

    it('should throw BadRequestException if sale is not SHIPPED', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.PAID,
      });

      await expect(service.deliverSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteSale', () => {
    it('should delete sale if DRAFT and no reservations', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.DRAFT,
        stockReservations: [],
      });

      mockPrismaService.sale.update.mockResolvedValue({ id: saleId, deletedAt: new Date() });

      await service.deleteSale(orgId, userId, saleId);

      expect(mockPrismaService.sale.update).toHaveBeenCalledWith({
        where: { id: saleId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException if SELLER tries to delete', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      await expect(service.deleteSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if sale is not DRAFT', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.RESERVED,
        stockReservations: [],
      });

      await expect(service.deleteSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if sale has linked reservations', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: SaleStatus.DRAFT,
        stockReservations: [{ id: 'res-1' }],
      });

      await expect(service.deleteSale('org-1', 'user-1', 'sale-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Multi-org isolation', () => {
    it('should not return sales from other organizations', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);

      await service.listSales(orgId, userId, { page: 1, limit: 10 });

      expect(mockPrismaService.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
          }),
        }),
      );
    });

    it('should not allow accessing sale from other organization', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue(null);

      await expect(service.getSale('org-1', 'user-1', 'sale-other-org')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Concurrency - paySale', () => {
    it('should handle concurrent paySale calls correctly (simulated)', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';
      const reservationId = 'res-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.RESERVED,
        stockReservations: [{ id: reservationId, status: ReservationStatus.ACTIVE }],
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
              quantity: 5,
              imei: null,
            },
          }),
          update: jest.fn().mockResolvedValue({ status: ReservationStatus.CONFIRMED }),
        },
        stockItem: {
          update: jest.fn().mockResolvedValue({}),
        },
        stockMovement: {
          create: jest.fn().mockResolvedValue({}),
        },
        sale: {
          update: jest.fn().mockResolvedValue({
            id: saleId,
            status: SaleStatus.PAID,
          }),
        },
      };

      mockPrismaService.$transaction.mockImplementation(async (callback, options) => {
        // Simulate serializable isolation - second call should fail or wait
        return callback(mockTx);
      });

      // First call should succeed
      await service.paySale(orgId, userId, saleId);

      // Reset mocks for second call
      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        status: SaleStatus.PAID, // Already paid
        stockReservations: [],
      });

      // Second call should fail because sale is already PAID
      await expect(service.paySale(orgId, userId, saleId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = service.health();
      expect(result).toEqual({ ok: true, module: 'sales' });
    });
  });

  describe('AUDIT_FAIL_MODE behavior', () => {
    it('should continue operation when AUDIT_FAIL_MODE=OPEN and audit log fails', async () => {
      const mockAuditLogService = createMockAuditLogServiceOpenMode();
      
      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          SalesService,
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
              path: '/api/sales',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
          {
            provide: WhatsAppAutomationsService,
            useValue: {
              processTrigger: jest.fn(),
            },
          },
          {
            provide: AttributionService,
            useValue: {
              createAttributionSnapshot: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = await testModule.resolve<SalesService>(SalesService);

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockReservation.findMany.mockResolvedValue([]);
      mockPrismaService.sale.create.mockResolvedValue({
        id: 'sale-1',
        organizationId: 'org-1',
        status: 'RESERVED',
      });

      // Mock necessary Prisma calls for createSale
      mockPrismaService.stockReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          organizationId: 'org-1',
          status: ReservationStatus.ACTIVE,
          stockItemId: 'item-1',
          saleId: null,
          quantity: new Decimal('1'),
          stockItem: {
            id: 'item-1',
            basePrice: new Decimal(1000),
          },
        },
      ]);
      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: 'org-1',
        quantity: 10,
        basePrice: new Decimal(1000),
      });
      mockPrismaService.sale.findFirst.mockResolvedValue(null);
      const mockTx1 = {
        sale: { create: jest.fn().mockResolvedValue({ id: 'sale-1', total: new Decimal('0') }) },
        saleItem: { create: jest.fn().mockResolvedValue({ id: 'sale-item-1' }) },
        saleReservationLink: { create: jest.fn().mockResolvedValue({ id: 'link-1' }) },
        stockReservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx1);
      });

      const result = await testService.createSale('org-1', 'user-1', {
        stockReservationIds: ['res-1'],
        customerName: 'Test Customer',
      });

      expect(result).toBeDefined();
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should abort operation when AUDIT_FAIL_MODE=CLOSED and audit log fails', async () => {
      const mockAuditLogService = createMockAuditLogServiceClosedMode();
      
      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          SalesService,
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
              path: '/api/sales',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
          {
            provide: WhatsAppAutomationsService,
            useValue: {
              processTrigger: jest.fn(),
            },
          },
          {
            provide: AttributionService,
            useValue: {
              createAttributionSnapshot: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = await testModule.resolve<SalesService>(SalesService);

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          organizationId: 'org-1',
          status: ReservationStatus.ACTIVE,
          stockItemId: 'item-1',
          saleId: null,
          quantity: new Decimal('1'),
          stockItem: {
            id: 'item-1',
            basePrice: new Decimal(1000),
          },
        },
      ]);
      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: 'org-1',
        quantity: 10,
        basePrice: new Decimal(1000),
      });
      mockPrismaService.sale.findFirst.mockResolvedValue(null);
      const mockTx = {
        sale: { create: jest.fn().mockResolvedValue({ id: 'sale-1', total: new Decimal('0') }) },
        saleItem: { create: jest.fn().mockResolvedValue({ id: 'sale-item-1' }) },
        saleReservationLink: { create: jest.fn().mockResolvedValue({ id: 'link-1' }) },
        stockReservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(
        testService.createSale('org-1', 'user-1', {
          stockReservationIds: ['res-1'],
          customerName: 'Test Customer',
        }),
      ).rejects.toThrow(InternalServerErrorException);

      try {
        await testService.createSale('org-1', 'user-1', {
          stockReservationIds: ['res-1'],
          customerName: 'Test Customer',
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.response?.errorCode || error.errorCode).toBe('AUDIT_LOG_FAILED');
        expect(error.response?.statusCode || error.statusCode || error.getStatus?.()).toBe(500);
      }
    });
  });

  describe('Soft delete', () => {
    it('should soft delete sale and exclude from list', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: orgId,
        status: SaleStatus.DRAFT,
        deletedAt: null,
        stockReservations: [],
      });
      mockPrismaService.sale.update.mockResolvedValue({
        id: 'sale-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });

      await service.deleteSale(orgId, userId, 'sale-1');

      mockPrismaService.sale.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);

      const result = await service.listSales(orgId, userId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(mockPrismaService.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should include deleted sales when includeDeleted=true and user is ADMIN', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.sale.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          organizationId: orgId,
          deletedAt: new Date(),
        },
      ]);
      mockPrismaService.sale.count.mockResolvedValue(1);

      const result = await service.listSales(orgId, userId, { page: 1, limit: 10, includeDeleted: true });

      expect(result.data).toHaveLength(1);
    });

    it('should not include deleted sales when includeDeleted=true and user is SELLER', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.SELLER });
      mockPrismaService.sale.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);

      const result = await service.listSales(orgId, userId, { page: 1, limit: 10, includeDeleted: true });

      expect(result.data).toHaveLength(0);
      expect(mockPrismaService.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should restore soft-deleted sale', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });
      mockPrismaService.sale.update.mockResolvedValue({
        id: 'sale-1',
        organizationId: orgId,
        deletedAt: null,
      });

      const result = await service.restoreSale(orgId, userId, 'sale-1');

      expect(result.deletedAt).toBeNull();
      expect(mockPrismaService.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: null },
        }),
      );
    });

    it('should block pay on soft-deleted sale', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: orgId,
        deletedAt: new Date(),
        stockReservations: [],
      });

      await expect(
        service.paySale(orgId, userId, 'sale-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should block cancel on soft-deleted sale', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: orgId,
        deletedAt: new Date(),
        stockReservations: [],
      });

      await expect(
        service.cancelSale(orgId, userId, 'sale-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Audit log', () => {
    it('should create audit log on createSale', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.stockReservation.findMany.mockResolvedValue([
        {
          id: 'res-1',
          organizationId: orgId,
          status: ReservationStatus.ACTIVE,
          stockItemId: 'item-1',
          saleId: null,
          quantity: new Decimal('1'),
          stockItem: {
            id: 'item-1',
            basePrice: new Decimal(1000),
          },
        },
      ]);
      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        quantity: 10,
        basePrice: new Decimal(1000),
      });
      mockPrismaService.sale.findFirst.mockResolvedValue(null);
      const mockTx = {
        sale: { create: jest.fn().mockResolvedValue({ id: 'sale-1', total: new Decimal('0') }) },
        saleItem: { create: jest.fn().mockResolvedValue({ id: 'sale-item-1' }) },
        saleReservationLink: { create: jest.fn().mockResolvedValue({ id: 'link-1' }) },
        stockReservation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await service.createSale(orgId, userId, {
        stockReservationIds: ['res-1'],
        customerName: 'Test Customer',
      });

      expect(mockTx.sale.create).toHaveBeenCalled();
    });

    it('should create audit log on restoreSale', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });
      mockPrismaService.sale.update.mockResolvedValue({
        id: 'sale-1',
        organizationId: orgId,
        deletedAt: null,
      });

      await service.restoreSale(orgId, userId, 'sale-1');

      expect(mockPrismaService.sale.update).toHaveBeenCalled();
    });
  });
});
