import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JobRunnerService } from './job-runner.service';
import { IntegrationQueueService } from './queue/integration-queue.service';
import { WhatsAppJobProcessorService } from './whatsapp-job-processor.service';
import { InstagramJobProcessorService } from './instagram-job-processor.service';
import { MetaSpendJobProcessorService } from './meta-spend-job-processor.service';
import { MetaTokenRefreshJobProcessorService } from './meta-token-refresh-job-processor.service';
import { WhatsAppAutomationsService } from '../whatsapp/whatsapp-automations.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { JobRunnerLockService } from './job-runner-lock.service';
import { JobRunnerStateService } from './job-runner-state.service';
import { IntegrationProvider, IntegrationJobType } from '@remember-me/prisma';

// Mock BullMQ Worker
jest.mock('bullmq', () => ({
  Queue: jest.fn(),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('JobRunnerService - BullMQ Mode', () => {
  let service: JobRunnerService;
  const originalEnv = process.env;

  const mockWhatsAppProcessor = {
    processPendingJobs: jest.fn(),
    processJobFromQueue: jest.fn(),
  };

  const mockInstagramProcessor = {
    processPendingJobs: jest.fn(),
    processJobFromQueue: jest.fn(),
  };

  const mockMetaSpendProcessor = {
    processPendingJobs: jest.fn(),
    processJobFromQueue: jest.fn(),
  };

  const mockMetaTokenRefreshProcessor = {
    processPendingJobs: jest.fn(),
    processJobFromQueue: jest.fn(),
  };

  const mockAutomationsService = {
    processTrigger: jest.fn(),
    prisma: {
      organization: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      messageLog: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      lead: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    },
  };

  const mockIntegrationJobsService = {
    enqueue: jest.fn(),
    markProcessing: jest.fn().mockResolvedValue({}),
    markDone: jest.fn().mockResolvedValue({}),
    markFailed: jest.fn().mockResolvedValue({}),
    fetchNext: jest.fn().mockResolvedValue([]),
  };

  const mockLockService = {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(undefined),
    cleanupExpiredLock: jest.fn().mockResolvedValue(undefined),
    getLockInfo: jest.fn(),
  };

  const mockStateService = {
    updateState: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'QUEUE_MODE') return 'bullmq';
      if (key === 'INTEGRATION_WORKER_CONCURRENCY') return '5';
      return undefined;
    }),
  };

  const mockQueueService = {
    isBullMqEnabled: jest.fn().mockReturnValue(true),
    getBullMqAdapter: jest.fn().mockReturnValue({
      isEnabled: jest.fn().mockReturnValue(true),
      getQueue: jest.fn(),
    }),
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.JOB_RUNNER_ENABLED = 'true';
    process.env.WORKER_MODE = '1';

    jest.clearAllMocks();
    mockLockService.acquireLock.mockResolvedValue(true);
    mockLockService.releaseLock.mockResolvedValue(undefined);
    mockLockService.cleanupExpiredLock.mockResolvedValue(undefined);
    mockStateService.updateState.mockResolvedValue(undefined);
    mockWhatsAppProcessor.processPendingJobs.mockResolvedValue(undefined);
    mockInstagramProcessor.processPendingJobs.mockResolvedValue(undefined);
    mockMetaSpendProcessor.processPendingJobs.mockResolvedValue(undefined);
    mockMetaTokenRefreshProcessor.processPendingJobs.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobRunnerService,
        {
          provide: WhatsAppJobProcessorService,
          useValue: mockWhatsAppProcessor,
        },
        {
          provide: InstagramJobProcessorService,
          useValue: mockInstagramProcessor,
        },
        {
          provide: MetaSpendJobProcessorService,
          useValue: mockMetaSpendProcessor,
        },
        {
          provide: MetaTokenRefreshJobProcessorService,
          useValue: mockMetaTokenRefreshProcessor,
        },
        {
          provide: WhatsAppAutomationsService,
          useValue: mockAutomationsService,
        },
        {
          provide: IntegrationJobsService,
          useValue: mockIntegrationJobsService,
        },
        {
          provide: IntegrationQueueService,
          useValue: mockQueueService,
        },
        {
          provide: JobRunnerLockService,
          useValue: mockLockService,
        },
        {
          provide: JobRunnerStateService,
          useValue: mockStateService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<JobRunnerService>(JobRunnerService);
  });

  afterEach(() => {
    process.env = originalEnv;
    if (service) {
      service.onModuleDestroy();
    }
  });

  describe('BullMQ worker initialization', () => {
    it('should start BullMQ worker when QUEUE_MODE=bullmq', () => {
      service.onModuleInit();
      expect(mockQueueService.isBullMqEnabled).toHaveBeenCalled();
    });

    it('should not start DB loop when QUEUE_MODE=bullmq', () => {
      service.onModuleInit();
      // DB loop should not be started in bullmq mode
      expect(service.isCurrentlyProcessing()).toBe(false);
    });
  });

  describe('processBullJob', () => {
    it('should route WhatsApp jobs correctly', async () => {
      const mockJob = {
        data: {
          jobId: 'db-job-1',
          jobType: IntegrationJobType.SEND_MESSAGE,
          provider: IntegrationProvider.WHATSAPP,
          organizationId: 'org-1',
          payload: { toPhone: '+1234567890', text: 'test' },
        },
      };

      // Access private method via reflection or make it testable
      // For now, test through public interface if available
      await (service as any).processBullJob(mockJob);

      expect(mockIntegrationJobsService.markProcessing).toHaveBeenCalledWith('db-job-1');
      expect(mockWhatsAppProcessor.processJobFromQueue).toHaveBeenCalledWith(
        'db-job-1',
        IntegrationJobType.SEND_MESSAGE,
        { toPhone: '+1234567890', text: 'test' },
        'org-1',
      );
      expect(mockIntegrationJobsService.markDone).toHaveBeenCalledWith('db-job-1');
    });

    it('should route Instagram jobs correctly', async () => {
      const mockJob = {
        data: {
          jobId: 'db-job-1',
          jobType: IntegrationJobType.SEND_MESSAGE,
          provider: IntegrationProvider.INSTAGRAM,
          organizationId: 'org-1',
          payload: { recipientId: 'ig-123', text: 'test' },
        },
      };

      await (service as any).processBullJob(mockJob);

      expect(mockInstagramProcessor.processJobFromQueue).toHaveBeenCalledWith(
        'db-job-1',
        IntegrationJobType.SEND_MESSAGE,
        { recipientId: 'ig-123', text: 'test' },
        'org-1',
      );
    });

    it('should handle job failures and mark as failed', async () => {
      const mockJob = {
        data: {
          jobId: 'db-job-1',
          jobType: IntegrationJobType.SEND_MESSAGE,
          provider: IntegrationProvider.WHATSAPP,
          organizationId: 'org-1',
          payload: { toPhone: '+1234567890', text: 'test' },
        },
      };

      mockWhatsAppProcessor.processJobFromQueue.mockRejectedValueOnce(new Error('Test error'));

      await expect((service as any).processBullJob(mockJob)).rejects.toThrow('Test error');
      expect(mockIntegrationJobsService.markFailed).toHaveBeenCalledWith('db-job-1', 'Test error');
    });
  });
});
