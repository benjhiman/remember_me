import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Role, SaleStatus, StockStatus, LeadStatus, StockMovementType } from '@remember-me/prisma';
import { GroupByPeriod } from './dto/dashboard-filters.dto';
import { Decimal } from '@prisma/client/runtime/library';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaService;

  const mockPrismaService = {
    membership: {
      findFirst: jest.fn(),
    },
    lead: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    sale: {
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    saleItem: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    stockItem: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    stage: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should return overview KPIs', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.count.mockResolvedValue(100);
      mockPrismaService.lead.groupBy.mockResolvedValue([
        { stageId: 'stage-1', _count: { id: 50 } },
        { stageId: 'stage-2', _count: { id: 30 } },
      ]);

      mockPrismaService.stage.findMany.mockResolvedValue([
        { id: 'stage-1', name: 'New', color: '#000' },
        { id: 'stage-2', name: 'Contacted', color: '#fff' },
      ]);

      mockPrismaService.sale.count.mockResolvedValue(50);
      mockPrismaService.sale.groupBy.mockResolvedValue([
        { status: SaleStatus.PAID, _count: { id: 30 } },
        { status: SaleStatus.RESERVED, _count: { id: 20 } },
      ]);

      mockPrismaService.saleItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: new Decimal(50000) },
      });

      mockPrismaService.stockItem.groupBy.mockResolvedValue([
        { status: StockStatus.AVAILABLE, _count: { id: 100 }, _sum: { quantity: 100 } },
        { status: StockStatus.RESERVED, _count: { id: 10 }, _sum: { quantity: 10 } },
        { status: StockStatus.SOLD, _count: { id: 20 }, _sum: { quantity: 20 } },
      ]);

      mockPrismaService.saleItem.groupBy.mockResolvedValueOnce([
        { model: 'iPhone 15 Pro', _count: { id: 10 }, _sum: { quantity: 10 } },
      ]);

      const result = await service.getOverview(orgId, userId, {});

      expect(result).toBeDefined();
      expect(result.totalLeads).toBe(100);
      expect(result.totalSales).toBe(50);
      expect(result.revenue).toBeDefined();
    });

    it('should filter by date range', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.count.mockResolvedValue(50);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(25);
      mockPrismaService.sale.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: new Decimal(25000) },
      });
      mockPrismaService.stockItem.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.groupBy.mockResolvedValue([]);

      const result = await service.getOverview(orgId, userId, {
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('getLeadsDashboard', () => {
    it('should return leads dashboard data', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([
        { period: new Date('2024-01-01'), count: 10 },
        { period: new Date('2024-01-02'), count: 15 },
      ]);

      mockPrismaService.lead.groupBy
        .mockResolvedValueOnce([
          { stageId: 'stage-1', _count: { id: 50 } },
        ])
        .mockResolvedValueOnce([
          { assignedToId: 'user-1', _count: { id: 30 } },
        ]);

      mockPrismaService.stage.findMany.mockResolvedValue([
        { id: 'stage-1', name: 'New', color: '#000' },
      ]);

      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-1', name: 'User 1', email: 'user1@example.com' },
      ]);

      const result = await service.getLeadsDashboard(orgId, userId, {});

      expect(result).toBeDefined();
      expect(result.series).toBeDefined();
      expect(Array.isArray(result.series)).toBe(true);
      expect(result.breakdown).toBeDefined();
      expect(Array.isArray(result.breakdown)).toBe(true);
      expect(result.assignedLeadsCount).toBeDefined();
      expect(Array.isArray(result.assignedLeadsCount)).toBe(true);
    });

    it('should group by week when specified', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.getLeadsDashboard(orgId, userId, {
        groupBy: GroupByPeriod.WEEK,
      });

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain("'week'");
    });

    it('should group by month when specified', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.getLeadsDashboard(orgId, userId, {
        groupBy: GroupByPeriod.MONTH,
      });

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      const query = mockPrismaService.$queryRawUnsafe.mock.calls[0][0];
      expect(query).toContain("'month'");
    });
  });

  describe('getSalesDashboard', () => {
    it('should return sales dashboard data', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.$queryRawUnsafe
        .mockResolvedValueOnce([
          { period: new Date('2024-01-01'), count: 5 },
        ])
        .mockResolvedValueOnce([
          { period: new Date('2024-01-01'), revenue: new Decimal(5000) },
        ]);

      mockPrismaService.sale.groupBy
        .mockResolvedValueOnce([
          { status: SaleStatus.PAID, _count: { id: 30 } },
          { status: SaleStatus.RESERVED, _count: { id: 20 } },
        ])
        .mockResolvedValueOnce([
          { customerName: 'John Doe', _count: { id: 5 }, _sum: { total: new Decimal(10000) } },
          { customerName: 'Jane Smith', _count: { id: 3 }, _sum: { total: new Decimal(5000) } },
        ]);

      const result = await service.getSalesDashboard(orgId, userId, {});

      expect(result).toBeDefined();
      expect(result.salesCreated).toBeDefined();
      expect(Array.isArray(result.salesCreated)).toBe(true);
      expect(result.revenue).toBeDefined();
      expect(Array.isArray(result.revenue)).toBe(true);
      expect(result.breakdown).toBeDefined();
      expect(Array.isArray(result.breakdown)).toBe(true);
      expect(result.topCustomers).toBeDefined();
      expect(Array.isArray(result.topCustomers)).toBe(true);
    });

    it('should filter by date range', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);
      mockPrismaService.sale.groupBy.mockResolvedValue([]);

      await service.getSalesDashboard(orgId, userId, {
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('getStockDashboard', () => {
    it('should return stock dashboard data', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.groupBy.mockResolvedValue([
        { status: StockStatus.AVAILABLE, _count: { id: 100 }, _sum: { quantity: 100 } },
        { status: StockStatus.RESERVED, _count: { id: 10 }, _sum: { quantity: 10 } },
      ]);

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([
        { period: new Date('2024-01-01'), type: StockMovementType.IN, count: 10 },
        { period: new Date('2024-01-01'), type: StockMovementType.OUT, count: 5 },
      ]);

      mockPrismaService.stockItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          model: 'iPhone 15 Pro',
          quantity: 2,
          status: StockStatus.AVAILABLE,
          location: 'Warehouse',
        },
      ]);

      const result = await service.getStockDashboard(orgId, userId, {});

      expect(result).toBeDefined();
      expect(result.breakdown).toBeDefined();
      expect(Array.isArray(result.breakdown)).toBe(true);
      expect(result.movements).toBeDefined();
      expect(Array.isArray(result.movements)).toBe(true);
      expect(result.lowStock).toBeDefined();
      expect(Array.isArray(result.lowStock)).toBe(true);
    });

    it('should use custom threshold for low stock', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.groupBy.mockResolvedValue([]);
      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);
      mockPrismaService.stockItem.findMany.mockResolvedValue([]);

      await service.getStockDashboard(orgId, userId, {
        threshold: 10,
      });

      expect(mockPrismaService.stockItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            quantity: {
              lte: 10,
            },
          }),
        }),
      );
    });
  });

  describe('Multi-org isolation', () => {
    it('should filter overview by organization', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.count.mockResolvedValue(0);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);
      mockPrismaService.sale.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: null },
      });
      mockPrismaService.stockItem.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.groupBy.mockResolvedValue([]);

      await service.getOverview(orgId, userId, {});

      expect(mockPrismaService.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
          }),
        }),
      );
    });

    it('should filter leads dashboard by organization', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.$queryRawUnsafe.mockResolvedValue([]);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      await service.getLeadsDashboard(orgId, userId, {});

      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      const params = mockPrismaService.$queryRawUnsafe.mock.calls[0];
      expect(params[1]).toBe(orgId);
    });
  });

  describe('Roles', () => {
    it('should allow SELLER to access dashboard', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.lead.count.mockResolvedValue(0);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);
      mockPrismaService.sale.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: null },
      });
      mockPrismaService.stockItem.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.groupBy.mockResolvedValue([]);

      const result = await service.getOverview(orgId, userId, {});

      expect(result).toBeDefined();
    });

    it('should allow ADMIN to access dashboard', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.count.mockResolvedValue(0);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);
      mockPrismaService.sale.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: null },
      });
      mockPrismaService.stockItem.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.groupBy.mockResolvedValue([]);

      const result = await service.getOverview(orgId, userId, {});

      expect(result).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty data', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.count.mockResolvedValue(0);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);
      mockPrismaService.sale.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: null },
      });
      mockPrismaService.stockItem.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.groupBy.mockResolvedValue([]);

      const result = await service.getOverview(orgId, userId, {});

      expect(result).toBeDefined();
      expect(result.totalLeads).toBe(0);
      expect(result.totalSales).toBe(0);
    });

    it('should handle invalid date range (from > to)', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.count.mockResolvedValue(0);
      mockPrismaService.lead.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.sale.count.mockResolvedValue(0);
      mockPrismaService.sale.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.aggregate.mockResolvedValue({
        _sum: { totalPrice: null },
      });
      mockPrismaService.stockItem.groupBy.mockResolvedValue([]);
      mockPrismaService.saleItem.groupBy.mockResolvedValue([]);

      // Should not throw error, just return empty results
      const result = await service.getOverview(orgId, userId, {
        from: '2024-01-31',
        to: '2024-01-01',
      });

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException if user is not member', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue(null);

      await expect(service.getOverview('org-1', 'user-1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = service.health();
      expect(result).toEqual({ ok: true, module: 'dashboard' });
    });
  });
});
