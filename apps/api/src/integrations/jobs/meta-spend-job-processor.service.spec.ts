import { Test, TestingModule } from '@nestjs/testing';
import { MetaSpendJobProcessorService } from './meta-spend-job-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { MetaMarketingService } from '../meta/meta-marketing.service';
import { MetaTokenService } from '../meta/meta-token.service';
import { IntegrationJobType, IntegrationProvider, IntegrationJobStatus, MetaSpendLevel } from '@remember-me/prisma';
import { Decimal } from '@prisma/client/runtime/library';

describe('MetaSpendJobProcessorService', () => {
  let service: MetaSpendJobProcessorService;
  let prisma: PrismaService;

  const mockPrismaService = {
    integrationJob: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    metaSpendDaily: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockIntegrationJobsService = {
    enqueue: jest.fn(),
  };

  const mockMetaMarketingService = {
    getInsights: jest.fn(),
  };

  const mockMetaTokenService = {
    getValidAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaSpendJobProcessorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationJobsService,
          useValue: mockIntegrationJobsService,
        },
        {
          provide: MetaMarketingService,
          useValue: mockMetaMarketingService,
        },
        {
          provide: MetaTokenService,
          useValue: mockMetaTokenService,
        },
      ],
    }).compile();

    service = module.get<MetaSpendJobProcessorService>(MetaSpendJobProcessorService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('processPendingJobs', () => {
    it('should process pending FETCH_META_SPEND jobs', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          date: '2024-01-15',
          level: 'CAMPAIGN',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockMetaMarketingService.getInsights.mockResolvedValue([
        {
          campaign_id: 'campaign-1',
          spend: '100.50',
          impressions: '1000',
          clicks: '50',
        },
      ]);
      mockPrismaService.metaSpendDaily.findFirst.mockResolvedValue(null);
      mockPrismaService.metaSpendDaily.create.mockResolvedValue({ id: 'spend-1' });
      mockPrismaService.integrationJob.update.mockResolvedValue({ id: 'job-1' });

      const processed = await service.processPendingJobs(10);

      expect(processed).toBe(1);
      expect(mockMetaMarketingService.getInsights).toHaveBeenCalled();
      expect(mockPrismaService.metaSpendDaily.create).toHaveBeenCalled();
    });

    it('should update existing spend record', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          date: '2024-01-15',
          level: 'CAMPAIGN',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockMetaMarketingService.getInsights.mockResolvedValue([
        {
          campaign_id: 'campaign-1',
          spend: '150.75',
          impressions: '1500',
          clicks: '75',
        },
      ]);
      mockPrismaService.metaSpendDaily.findFirst.mockResolvedValue({
        id: 'existing-spend-1',
        organizationId: 'org-1',
        date: new Date('2024-01-15'),
        level: MetaSpendLevel.CAMPAIGN,
        campaignId: 'campaign-1',
      });
      mockPrismaService.metaSpendDaily.update.mockResolvedValue({ id: 'existing-spend-1' });
      mockPrismaService.integrationJob.update.mockResolvedValue({ id: 'job-1' });

      const processed = await service.processPendingJobs(10);

      expect(processed).toBe(1);
      expect(mockPrismaService.metaSpendDaily.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-spend-1' },
          data: expect.objectContaining({
            spend: expect.any(Decimal),
          }),
        }),
      );
    });

    it('should handle multiple insights', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          date: '2024-01-15',
          level: 'CAMPAIGN',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockMetaMarketingService.getInsights.mockResolvedValue([
        {
          campaign_id: 'campaign-1',
          spend: '100',
        },
        {
          campaign_id: 'campaign-2',
          spend: '200',
        },
      ]);
      mockPrismaService.metaSpendDaily.findFirst.mockResolvedValue(null);
      mockPrismaService.metaSpendDaily.create.mockResolvedValue({ id: 'spend-1' });
      mockPrismaService.integrationJob.update.mockResolvedValue({ id: 'job-1' });

      await service.processPendingJobs(10);

      expect(mockPrismaService.metaSpendDaily.create).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          date: '2024-01-15',
          level: 'CAMPAIGN',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockMetaMarketingService.getInsights.mockRejectedValue(new Error('API error'));

      const processed = await service.processPendingJobs(10);

      expect(processed).toBe(0);
    });

    it('should handle adset level', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          date: '2024-01-15',
          level: 'ADSET',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockMetaMarketingService.getInsights.mockResolvedValue([
        {
          campaign_id: 'campaign-1',
          adset_id: 'adset-1',
          spend: '100',
        },
      ]);
      mockPrismaService.metaSpendDaily.findFirst.mockResolvedValue(null);
      mockPrismaService.metaSpendDaily.create.mockResolvedValue({ id: 'spend-1' });
      mockPrismaService.integrationJob.update.mockResolvedValue({ id: 'job-1' });

      await service.processPendingJobs(10);

      expect(mockPrismaService.metaSpendDaily.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            level: MetaSpendLevel.ADSET,
            campaignId: 'campaign-1',
            adsetId: 'adset-1',
          }),
        }),
      );
    });

    it('should handle ad level', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          date: '2024-01-15',
          level: 'AD',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockMetaMarketingService.getInsights.mockResolvedValue([
        {
          campaign_id: 'campaign-1',
          adset_id: 'adset-1',
          ad_id: 'ad-1',
          spend: '100',
        },
      ]);
      mockPrismaService.metaSpendDaily.findFirst.mockResolvedValue(null);
      mockPrismaService.metaSpendDaily.create.mockResolvedValue({ id: 'spend-1' });
      mockPrismaService.integrationJob.update.mockResolvedValue({ id: 'job-1' });

      await service.processPendingJobs(10);

      expect(mockPrismaService.metaSpendDaily.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            level: MetaSpendLevel.AD,
            campaignId: 'campaign-1',
            adsetId: 'adset-1',
            adId: 'ad-1',
          }),
        }),
      );
    });
  });
});
