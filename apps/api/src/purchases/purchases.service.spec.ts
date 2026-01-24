import { Test, TestingModule } from '@nestjs/testing';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { createMockAuditLogService } from '../common/testing/mock-audit-log.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PurchaseStatus } from '@remember-me/prisma';

describe('PurchasesService', () => {
  let service: PurchasesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    vendor: {
      findFirst: jest.fn(),
    },
    purchase: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    purchaseLine: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
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
            method: 'POST',
            path: '/test',
            ip: '127.0.0.1',
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = await module.resolve<PurchasesService>(PurchasesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createPurchase', () => {
    it('should calculate totals correctly', async () => {
      const organizationId = 'org-1';
      const userId = 'user-1';
      const vendorId = 'vendor-1';

      const createDto = {
        vendorId,
        notes: 'Test purchase',
        lines: [
          {
            description: 'Item 1',
            quantity: 2,
            unitPriceCents: 1000,
          },
        ],
      };

      const mockVendor = {
        id: vendorId,
        name: 'Test Vendor',
        organizationId,
      };

      const mockPurchase = {
        id: 'purchase-1',
        organizationId,
        vendorId,
        createdById: userId,
        status: PurchaseStatus.DRAFT,
        notes: createDto.notes,
        subtotalCents: 2000,
        taxCents: 0,
        totalCents: 2000,
        approvedAt: null,
        receivedAt: null,
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        vendor: mockVendor,
        lines: [
          {
            id: 'line-1',
            purchaseId: 'purchase-1',
            description: 'Item 1',
            quantity: 2,
            unitPriceCents: 1000,
            lineTotalCents: 2000,
            sku: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockPrismaService.vendor.findFirst.mockResolvedValue(mockVendor);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          purchase: {
            create: jest.fn().mockResolvedValue(mockPurchase),
            findUnique: jest.fn().mockResolvedValue(mockPurchase),
          },
          purchaseLine: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return callback(tx);
      });

      const result = await service.createPurchase(organizationId, userId, createDto);

      expect(result).toBeDefined();
      expect(result.subtotalCents).toBe(2000);
      expect(result.taxCents).toBe(0);
      expect(result.totalCents).toBe(2000);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('updatePurchase', () => {
    it('should reject update if status is not DRAFT', async () => {
      const organizationId = 'org-1';
      const userId = 'user-1';
      const purchaseId = 'purchase-1';

      const existingPurchase = {
        id: purchaseId,
        organizationId,
        vendorId: 'vendor-1',
        status: PurchaseStatus.APPROVED, // Not DRAFT
        notes: 'Test',
        subtotalCents: 1000,
        taxCents: 0,
        totalCents: 1000,
        lines: [],
      };

      const updateDto = {
        notes: 'Updated notes',
      };

      mockPrismaService.purchase.findFirst.mockResolvedValue(existingPurchase);

      await expect(
        service.updatePurchase(organizationId, purchaseId, userId, updateDto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.updatePurchase(organizationId, purchaseId, userId, updateDto),
      ).rejects.toThrow('Only DRAFT purchases can be edited');
    });
  });

  describe('transitionPurchase', () => {
    it('should reject invalid transition from RECEIVED to CANCELLED', async () => {
      const organizationId = 'org-1';
      const userId = 'user-1';
      const purchaseId = 'purchase-1';

      const existingPurchase = {
        id: purchaseId,
        organizationId,
        vendorId: 'vendor-1',
        status: PurchaseStatus.RECEIVED,
        notes: 'Test',
        subtotalCents: 1000,
        taxCents: 0,
        totalCents: 1000,
        approvedAt: new Date(),
        receivedAt: new Date(),
        cancelledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const transitionDto = {
        status: PurchaseStatus.CANCELLED,
      };

      mockPrismaService.purchase.findFirst.mockResolvedValue(existingPurchase);

      await expect(
        service.transitionPurchase(organizationId, purchaseId, userId, transitionDto),
      ).rejects.toThrow(BadRequestException);

      try {
        await service.transitionPurchase(organizationId, purchaseId, userId, transitionDto);
      } catch (error: any) {
        expect(error.response).toBeDefined();
        expect(error.response.code).toBe('INVALID_TRANSITION');
        expect(error.response.from).toBe(PurchaseStatus.RECEIVED);
        expect(error.response.to).toBe(PurchaseStatus.CANCELLED);
      }
    });
  });

  describe('getPurchase', () => {
    it('should return 404 if purchase belongs to another organization', async () => {
      const organizationIdA = 'org-a';
      const organizationIdB = 'org-b';
      const purchaseId = 'purchase-1';

      // Purchase belongs to org-a
      const purchase = {
        id: purchaseId,
        organizationId: organizationIdA,
        vendorId: 'vendor-1',
        status: PurchaseStatus.DRAFT,
        vendor: {
          id: 'vendor-1',
          name: 'Vendor 1',
          email: 'vendor@test.com',
          phone: '123456789',
        },
        lines: [],
        createdBy: null,
      };

      // Try to fetch with org-b
      mockPrismaService.purchase.findFirst.mockResolvedValue(null);

      await expect(service.getPurchase(organizationIdB, purchaseId)).rejects.toThrow(
        NotFoundException,
      );

      await expect(service.getPurchase(organizationIdB, purchaseId)).rejects.toThrow(
        'Purchase not found',
      );
    });
  });
});
