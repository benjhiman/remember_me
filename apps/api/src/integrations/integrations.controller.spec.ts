import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationJobsService } from './jobs/integration-jobs.service';
import { IntegrationQueueService } from './jobs/queue/integration-queue.service';
import { MetaSpendJobProcessorService } from './jobs/meta-spend-job-processor.service';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { RateLimitService } from '../common/rate-limit/rate-limit.service';
import { MetricsService } from '../common/metrics/metrics.service';
import { Reflector } from '@nestjs/core';
import { IntegrationProvider, ConnectedAccountStatus } from '@remember-me/prisma';

describe('IntegrationsController', () => {
  let controller: IntegrationsController;
  const mockIntegrationsService = {
    listConnectedAccounts: jest.fn(),
    connectAccount: jest.fn(),
    disconnectAccount: jest.fn(),
  };

  const mockIntegrationJobsService = {
    enqueue: jest.fn(),
    getMetrics: jest.fn(),
  };

  const mockIntegrationQueueService = {
    enqueue: jest.fn(),
  };

  const mockMetaSpendJobProcessor = {
    processPendingJobs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        {
          provide: IntegrationsService,
          useValue: mockIntegrationsService,
        },
        {
          provide: IntegrationJobsService,
          useValue: mockIntegrationJobsService,
        },
        {
          provide: IntegrationQueueService,
          useValue: mockIntegrationQueueService,
        },
        {
          provide: MetaSpendJobProcessorService,
          useValue: mockMetaSpendJobProcessor,
        },
        {
          provide: RateLimitGuard,
          useValue: { canActivate: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: RateLimitService,
          useValue: {},
        },
        {
          provide: Reflector,
          useValue: {},
        },
        {
          provide: MetricsService,
          useValue: {
            recordRateLimitHit: jest.fn(),
            recordRateLimitRejection: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listIntegrations', () => {
    it('should list connected accounts by organization', async () => {
      const accounts = [
        {
          id: 'acc-1',
          organizationId: 'org-1',
          provider: IntegrationProvider.WHATSAPP,
          status: ConnectedAccountStatus.CONNECTED,
        },
      ];
      mockIntegrationsService.listConnectedAccounts.mockResolvedValue(accounts);

      const result = await controller.listIntegrations('org-1');

      expect(result).toEqual(accounts);
      expect(mockIntegrationsService.listConnectedAccounts).toHaveBeenCalledWith('org-1');
    });
  });

  describe('connectProvider', () => {
    it('should create connected account (stub)', async () => {
      const account = {
        id: 'acc-1',
        organizationId: 'org-1',
        provider: IntegrationProvider.INSTAGRAM,
        externalAccountId: 'dummy-123',
        displayName: 'Instagram Account',
        status: ConnectedAccountStatus.CONNECTED,
      };
      mockIntegrationsService.connectAccount.mockResolvedValue(account);

      const result = await controller.connectProvider(
        'org-1',
        IntegrationProvider.INSTAGRAM,
        {
          externalAccountId: 'dummy-123',
          displayName: 'Instagram Account',
        },
      );

      expect(result).toEqual(account);
      expect(mockIntegrationsService.connectAccount).toHaveBeenCalledWith(
        'org-1',
        IntegrationProvider.INSTAGRAM,
        'dummy-123',
        'Instagram Account',
      );
    });

    it('should use default displayName if not provided', async () => {
      const account = {
        id: 'acc-1',
        displayName: 'WHATSAPP Account',
      };
      mockIntegrationsService.connectAccount.mockResolvedValue(account);

      await controller.connectProvider('org-1', IntegrationProvider.WHATSAPP, {
        externalAccountId: 'dummy-456',
      });

      expect(mockIntegrationsService.connectAccount).toHaveBeenCalledWith(
        'org-1',
        IntegrationProvider.WHATSAPP,
        'dummy-456',
        undefined,
      );
    });
  });

  describe('disconnectAccount', () => {
    it('should disconnect account by organization', async () => {
      const account = {
        id: 'acc-1',
        status: ConnectedAccountStatus.DISCONNECTED,
      };
      mockIntegrationsService.disconnectAccount.mockResolvedValue(account);

      const result = await controller.disconnectAccount('org-1', 'acc-1');

      expect(result).toEqual(account);
      expect(mockIntegrationsService.disconnectAccount).toHaveBeenCalledWith('org-1', 'acc-1');
    });
  });
});
