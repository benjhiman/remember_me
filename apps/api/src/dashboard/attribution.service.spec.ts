import { Test, TestingModule } from '@nestjs/testing';
import { AttributionService } from './attribution.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttributionSource, SaleStatus } from '@remember-me/prisma';
import { Decimal } from '@prisma/client/runtime/library';

describe('AttributionService', () => {
  let service: AttributionService;
  let prisma: PrismaService;

  const mockPrismaService = {
    metaAttributionSnapshot: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    metaSpendDaily: {
      findMany: jest.fn(),
    },
    sale: {
      findUnique: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AttributionService>(AttributionService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createAttributionSnapshot', () => {
    it('should create snapshot when lead has meta attribution data', async () => {
      const mockTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue({
            customerPhone: '+1234567890',
            customerEmail: null,
          }),
        },
        lead: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'lead-1',
            tags: ['META_ADS'],
            customFields: {
              metaCampaignId: 'campaign-1',
              metaAdId: 'ad-1',
              metaAdsetId: 'adset-1',
              metaFormId: 'form-1',
              metaPageId: 'page-1',
              metaLeadgenId: 'leadgen-1',
            },
          }),
        },
        metaAttributionSnapshot: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
        },
      };

      await service.createAttributionSnapshot(mockTx as any, 'org-1', 'sale-1', 'lead-1');

      expect(mockTx.metaAttributionSnapshot.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          saleId: 'sale-1',
          leadId: 'lead-1',
          source: AttributionSource.META_LEAD_ADS,
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          formId: 'form-1',
          pageId: 'page-1',
          leadgenId: 'leadgen-1',
        },
      });
    });

    it('should not create snapshot if lead does not have meta attribution', async () => {
      const mockTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue({
            customerPhone: '+1234567890',
            customerEmail: null,
          }),
        },
        lead: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'lead-1',
            tags: [],
            customFields: {},
          }),
        },
        metaAttributionSnapshot: {
          findUnique: jest.fn(),
          create: jest.fn(),
        },
      };

      await service.createAttributionSnapshot(mockTx as any, 'org-1', 'sale-1', 'lead-1');

      expect(mockTx.metaAttributionSnapshot.create).not.toHaveBeenCalled();
    });

    it('should not duplicate snapshot (idempotency)', async () => {
      const mockTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue({
            customerPhone: '+1234567890',
            customerEmail: null,
          }),
        },
        lead: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'lead-1',
            tags: ['META_ADS'],
            customFields: {
              metaCampaignId: 'campaign-1',
            },
          }),
        },
        metaAttributionSnapshot: {
          findUnique: jest.fn().mockResolvedValue({ id: 'existing-snapshot' }),
          create: jest.fn(),
        },
      };

      await service.createAttributionSnapshot(mockTx as any, 'org-1', 'sale-1', 'lead-1');

      expect(mockTx.metaAttributionSnapshot.create).not.toHaveBeenCalled();
    });

    it('should resolve leadId from customerPhone if not provided', async () => {
      const mockTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue({
            customerPhone: '+1234567890',
            customerEmail: null,
          }),
        },
        lead: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'lead-2',
            tags: ['META_ADS'],
            customFields: {
              metaCampaignId: 'campaign-1',
            },
          }),
          findUnique: jest.fn().mockResolvedValue({
            id: 'lead-2',
            tags: ['META_ADS'],
            customFields: {
              metaCampaignId: 'campaign-1',
            },
          }),
        },
        metaAttributionSnapshot: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
        },
      };

      await service.createAttributionSnapshot(mockTx as any, 'org-1', 'sale-1', null);

      expect(mockTx.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phone: '+1234567890',
          }),
        }),
      );
      expect(mockTx.metaAttributionSnapshot.create).toHaveBeenCalled();
    });

    it('should resolve leadId from customerEmail if phone not available', async () => {
      const mockTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue({
            customerPhone: null,
            customerEmail: 'john@example.com',
          }),
        },
        lead: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'lead-2',
            tags: ['META_ADS'],
            customFields: {
              metaCampaignId: 'campaign-1',
            },
          }),
          findUnique: jest.fn().mockResolvedValue({
            id: 'lead-2',
            tags: ['META_ADS'],
            customFields: {
              metaCampaignId: 'campaign-1',
            },
          }),
        },
        metaAttributionSnapshot: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
        },
      };

      await service.createAttributionSnapshot(mockTx as any, 'org-1', 'sale-1', null);

      expect(mockTx.lead.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: 'john@example.com',
          }),
        }),
      );
    });

    it('should skip if no lead found', async () => {
      const mockTx = {
        sale: {
          findUnique: jest.fn().mockResolvedValue({
            customerPhone: null,
            customerEmail: null,
          }),
        },
        lead: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        metaAttributionSnapshot: {
          create: jest.fn(),
        },
      };

      await service.createAttributionSnapshot(mockTx as any, 'org-1', 'sale-1', null);

      expect(mockTx.metaAttributionSnapshot.create).not.toHaveBeenCalled();
    });
  });

  describe('getMetaAttributionMetrics', () => {
    it('should group metrics by campaign', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
        {
          id: 'snapshot-2',
          campaignId: 'campaign-1',
          adsetId: 'adset-2',
          adId: 'ad-2',
          leadId: 'lead-2',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('500'),
            items: [],
          },
        },
        {
          id: 'snapshot-3',
          campaignId: 'campaign-2',
          adsetId: 'adset-3',
          adId: 'ad-3',
          leadId: 'lead-3',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('750'),
            items: [],
          },
        },
      ]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
      });

      expect(result).toHaveLength(2);
      const campaign1 = result.find((r) => r.campaignId === 'campaign-1');
      expect(campaign1).toBeDefined();
      expect(campaign1?.leadsCount).toBe(2);
      expect(campaign1?.salesCount).toBe(2);
      expect(campaign1?.revenue).toBe(1500);
      expect(campaign1?.avgTicket).toBe(750);
      expect(campaign1?.conversionRate).toBe(1); // 2 sales / 2 leads
    });

    it('should group metrics by ad', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
        {
          id: 'snapshot-2',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-2',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('500'),
            items: [],
          },
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'ad',
      });

      expect(result).toHaveLength(1);
      expect(result[0].adId).toBe('ad-1');
      expect(result[0].leadsCount).toBe(2);
      expect(result[0].salesCount).toBe(2);
      expect(result[0].revenue).toBe(1500);
    });

    it('should filter by date range', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([]);

      await service.getMetaAttributionMetrics('org-1', {
        from,
        to,
        groupBy: 'campaign',
      });

      expect(mockPrismaService.metaAttributionSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: from,
              lte: to,
            }),
          }),
        }),
      );
    });

    it('should exclude zero revenue if includeZeroRevenue is false', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
        {
          id: 'snapshot-2',
          campaignId: 'campaign-2',
          adsetId: 'adset-2',
          adId: 'ad-2',
          leadId: 'lead-2',
          sale: null, // No sale (lead not converted)
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
        includeZeroRevenue: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].campaignId).toBe('campaign-1');
    });

    it('should include zero revenue if includeZeroRevenue is true', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
        {
          id: 'snapshot-2',
          campaignId: 'campaign-2',
          adsetId: 'adset-2',
          adId: 'ad-2',
          leadId: 'lead-2',
          sale: null,
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
        includeZeroRevenue: true,
      });

      expect(result).toHaveLength(2);
    });

    it('should only count PAID sales', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
        {
          id: 'snapshot-2',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-2',
          leadId: 'lead-2',
          sale: {
            status: SaleStatus.RESERVED, // Not PAID
            total: new Decimal('500'),
            items: [],
          },
        },
      ]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
      });

      expect(result[0].salesCount).toBe(1);
      expect(result[0].revenue).toBe(1000);
    });

    it('should calculate conversion rate correctly', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
        {
          id: 'snapshot-2',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-2',
          leadId: 'lead-2',
          sale: null, // Lead not converted
        },
        {
          id: 'snapshot-3',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-3',
          leadId: 'lead-3',
          sale: null, // Lead not converted
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
      });

      expect(result[0].leadsCount).toBe(3);
      expect(result[0].salesCount).toBe(1);
      expect(result[0].conversionRate).toBeCloseTo(0.333, 2); // 1/3
    });

    it('should handle multi-org isolation', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([]);

      await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
      });

      expect(mockPrismaService.metaAttributionSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        }),
      );
    });

    it('should handle snapshots without sale (lead not converted)', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: null,
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
        includeZeroRevenue: true,
      });

      expect(result[0].leadsCount).toBe(1);
      expect(result[0].salesCount).toBe(0);
      expect(result[0].revenue).toBe(0);
      expect(result[0].conversionRate).toBe(0);
    });

    it('should include spend in metrics', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([
        {
          id: 'spend-1',
          organizationId: 'org-1',
          campaignId: 'campaign-1',
          spend: new Decimal('500'),
        },
      ]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
      });

      expect(result[0].spend).toBe(500);
      expect(result[0].roas).toBe(2); // 1000 / 500
    });

    it('should calculate ROAS correctly', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1500'),
            items: [],
          },
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([
        {
          id: 'spend-1',
          organizationId: 'org-1',
          campaignId: 'campaign-1',
          spend: new Decimal('300'),
        },
      ]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
      });

      expect(result[0].revenue).toBe(1500);
      expect(result[0].spend).toBe(300);
      expect(result[0].roas).toBe(5); // 1500 / 300
    });

    it('should return null ROAS if spend is 0', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([
        {
          id: 'spend-1',
          organizationId: 'org-1',
          campaignId: 'campaign-1',
          spend: new Decimal('0'),
        },
      ]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
      });

      expect(result[0].spend).toBe(0);
      expect(result[0].roas).toBeNull();
    });

    it('should include spend-only records if includeZeroRevenue is true', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([
        {
          id: 'spend-1',
          organizationId: 'org-1',
          campaignId: 'campaign-1',
          spend: new Decimal('500'),
        },
      ]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
        includeZeroRevenue: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].campaignId).toBe('campaign-1');
      expect(result[0].spend).toBe(500);
      expect(result[0].revenue).toBe(0);
      // ROAS is null when spend > 0 but revenue = 0 (division by zero protection)
      expect(result[0].roas).toBeNull();
    });

    it('should aggregate spend from multiple records', async () => {
      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([
        {
          id: 'snapshot-1',
          campaignId: 'campaign-1',
          adsetId: 'adset-1',
          adId: 'ad-1',
          leadId: 'lead-1',
          sale: {
            status: SaleStatus.PAID,
            total: new Decimal('1000'),
            items: [],
          },
        },
      ]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([
        {
          id: 'spend-1',
          organizationId: 'org-1',
          campaignId: 'campaign-1',
          spend: new Decimal('200'),
        },
        {
          id: 'spend-2',
          organizationId: 'org-1',
          campaignId: 'campaign-1',
          spend: new Decimal('300'),
        },
      ]);

      const result = await service.getMetaAttributionMetrics('org-1', {
        groupBy: 'campaign',
      });

      expect(result[0].spend).toBe(500); // 200 + 300
      expect(result[0].roas).toBe(2); // 1000 / 500
    });

    it('should filter spend by date range', async () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      mockPrismaService.metaAttributionSnapshot.findMany.mockResolvedValue([]);
      mockPrismaService.metaSpendDaily.findMany.mockResolvedValue([]);

      await service.getMetaAttributionMetrics('org-1', {
        from,
        to,
        groupBy: 'campaign',
      });

      expect(mockPrismaService.metaSpendDaily.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: from,
              lte: to,
            }),
          }),
        }),
      );
    });
  });
});
