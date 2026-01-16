import { Test, TestingModule } from '@nestjs/testing';
import { MetaTokenRefreshJobProcessorService } from './meta-token-refresh-job-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { MetaTokenService } from '../meta/meta-token.service';
import { IntegrationJobType, IntegrationProvider, IntegrationJobStatus, ConnectedAccountStatus } from '@remember-me/prisma';

describe('MetaTokenRefreshJobProcessorService', () => {
  let service: MetaTokenRefreshJobProcessorService;
  let prisma: PrismaService;

  const mockPrismaService = {
    integrationJob: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    oAuthToken: {
      findFirst: jest.fn(),
    },
  };

  const mockIntegrationJobsService = {
    enqueue: jest.fn(),
  };

  const mockMetaTokenService = {
    extendToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaTokenRefreshJobProcessorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationJobsService,
          useValue: mockIntegrationJobsService,
        },
        {
          provide: MetaTokenService,
          useValue: mockMetaTokenService,
        },
      ],
    }).compile();

    service = module.get<MetaTokenRefreshJobProcessorService>(MetaTokenRefreshJobProcessorService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('processPendingJobs', () => {
    it('should process pending REFRESH_META_TOKEN jobs', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          connectedAccountId: 'account-1',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockPrismaService.oAuthToken.findFirst.mockResolvedValue({
        id: 'token-1',
        connectedAccountId: 'account-1',
        connectedAccount: {
          id: 'account-1',
          organizationId: 'org-1',
          status: ConnectedAccountStatus.CONNECTED,
        },
      });
      mockMetaTokenService.extendToken.mockResolvedValue(undefined);
      mockPrismaService.integrationJob.update.mockResolvedValue({ id: 'job-1' });

      const processed = await service.processPendingJobs(10);

      expect(processed).toBe(1);
      expect(mockMetaTokenService.extendToken).toHaveBeenCalledWith('account-1', 'token-1');
      expect(mockPrismaService.integrationJob.update).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          connectedAccountId: 'account-1',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockPrismaService.oAuthToken.findFirst.mockResolvedValue(null);

      const processed = await service.processPendingJobs(10);

      expect(processed).toBe(0);
    });

    it('should skip if token not found', async () => {
      const job = {
        id: 'job-1',
        organizationId: 'org-1',
        payloadJson: {
          organizationId: 'org-1',
          connectedAccountId: 'account-1',
        },
      };

      mockPrismaService.integrationJob.findMany.mockResolvedValue([job]);
      mockPrismaService.oAuthToken.findFirst.mockResolvedValue(null);

      const processed = await service.processPendingJobs(10);

      expect(processed).toBe(0);
    });
  });
});
