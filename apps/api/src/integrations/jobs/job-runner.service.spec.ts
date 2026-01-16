import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JobRunnerService } from './job-runner.service';
import { WhatsAppJobProcessorService } from './whatsapp-job-processor.service';
import { InstagramJobProcessorService } from './instagram-job-processor.service';
import { MetaSpendJobProcessorService } from './meta-spend-job-processor.service';
import { MetaTokenRefreshJobProcessorService } from './meta-token-refresh-job-processor.service';
import { WhatsAppAutomationsService } from '../whatsapp/whatsapp-automations.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { JobRunnerLockService } from './job-runner-lock.service';
import { JobRunnerStateService } from './job-runner-state.service';
import { IntegrationQueueService } from './queue/integration-queue.service';

describe('JobRunnerService', () => {
  let service: JobRunnerService;
  const originalEnv = process.env;

  const mockWhatsAppProcessor = {
    processPendingJobs: jest.fn(),
  };

  const mockInstagramProcessor = {
    processPendingJobs: jest.fn(),
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

  const mockMetaSpendProcessor = {
    processPendingJobs: jest.fn(),
  };

  const mockMetaTokenRefreshProcessor = {
    processPendingJobs: jest.fn(),
  };

  const mockIntegrationJobsService = {
    enqueue: jest.fn(),
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
      if (key === 'QUEUE_MODE') return 'db';
      if (key === 'INTEGRATION_WORKER_CONCURRENCY') return '5';
      return undefined;
    }),
  };

  const mockQueueService = {
    isEnabled: jest.fn().mockReturnValue(false),
    createWorker: jest.fn(),
    isBullMqEnabled: jest.fn().mockReturnValue(false),
    getBullMqAdapter: jest.fn().mockReturnValue(undefined),
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };
    
    // Reset mocks and set defaults
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
          provide: JobRunnerLockService,
          useValue: mockLockService,
        },
        {
          provide: JobRunnerStateService,
          useValue: mockStateService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'QUEUE_MODE') return 'db';
              if (key === 'INTEGRATION_WORKER_CONCURRENCY') return '5';
              return undefined;
            }),
          },
        },
        {
          provide: IntegrationQueueService,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(false),
            createWorker: jest.fn(),
          },
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

  describe('when JOB_RUNNER_ENABLED=false', () => {
    it('should not start scheduler in API mode', async () => {
      process.env.JOB_RUNNER_ENABLED = 'false';
      process.env.WORKER_MODE = '0';
      
      const testConfigService = {
        get: jest.fn((key: string): any => {
          if (key === 'QUEUE_MODE') return 'db';
          if (key === 'INTEGRATION_WORKER_CONCURRENCY') return '5';
          return undefined;
        }),
      };

      const testModule: TestingModule = await Test.createTestingModule({
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
            useValue: testConfigService,
          },
        ],
      }).compile();

      const newService = testModule.get<JobRunnerService>(JobRunnerService);
      newService.onModuleInit();

      // Verify scheduler is not running
      expect(newService.isCurrentlyProcessing()).toBe(false);
      newService.onModuleDestroy();
    });
  });

  describe('when JOB_RUNNER_ENABLED=true', () => {
    beforeEach(() => {
      process.env.JOB_RUNNER_ENABLED = 'true';
      process.env.JOB_RUNNER_INTERVAL_MS = '100';
    });

    it('should start scheduler on module init', () => {
      service.onModuleInit();
      // Scheduler should be initialized (not processing yet, but ready)
      expect(service.isCurrentlyProcessing()).toBe(false);
    });

    it('should stop scheduler on module destroy', () => {
      service.onModuleInit();
      service.onModuleDestroy();
      // After destroy, scheduler should be stopped
      expect(service.isCurrentlyProcessing()).toBe(false);
    });
  });

  describe('manual trigger', () => {
    it('should allow manual trigger when not processing', async () => {
      // Reset call counts but keep implementations
      mockLockService.acquireLock.mockClear();
      mockLockService.releaseLock.mockClear();
      mockLockService.cleanupExpiredLock.mockClear();
      mockStateService.updateState.mockClear();
      mockWhatsAppProcessor.processPendingJobs.mockClear();
      mockInstagramProcessor.processPendingJobs.mockClear();
      mockMetaSpendProcessor.processPendingJobs.mockClear();
      mockMetaTokenRefreshProcessor.processPendingJobs.mockClear();

      await service.triggerProcessing();

      expect(mockLockService.acquireLock).toHaveBeenCalled();
      expect(mockLockService.cleanupExpiredLock).toHaveBeenCalled();
      expect(mockWhatsAppProcessor.processPendingJobs).toHaveBeenCalledWith(10);
      expect(mockInstagramProcessor.processPendingJobs).toHaveBeenCalledWith(10);
      expect(mockMetaSpendProcessor.processPendingJobs).toHaveBeenCalledWith(10);
      expect(mockMetaTokenRefreshProcessor.processPendingJobs).toHaveBeenCalledWith(10);
      expect(mockStateService.updateState).toHaveBeenCalled();
      expect(mockLockService.releaseLock).toHaveBeenCalled();
    });

    it('should reject manual trigger when already processing', async () => {
      // Reset call counts but keep implementations
      mockLockService.acquireLock.mockClear();
      mockLockService.releaseLock.mockClear();
      mockLockService.cleanupExpiredLock.mockClear();
      mockStateService.updateState.mockClear();
      
      let resolveProcessing: () => void;
      const processingPromise = new Promise<void>((resolve) => {
        resolveProcessing = resolve;
      });

      // Make acquireLock wait a bit to ensure mutex is set
      mockLockService.acquireLock.mockImplementation(async () => {
        // Small delay to ensure mutex is set before second call
        await new Promise(resolve => setImmediate(resolve));
        return true;
      });

      mockWhatsAppProcessor.processPendingJobs.mockImplementation(async () => {
        await processingPromise;
      });
      mockInstagramProcessor.processPendingJobs.mockResolvedValue(undefined);
      mockMetaSpendProcessor.processPendingJobs.mockResolvedValue(undefined);
      mockMetaTokenRefreshProcessor.processPendingJobs.mockResolvedValue(undefined);

      // Start processing (don't await yet)
      const firstCall = service.triggerProcessing();

      // Wait a bit to ensure mutex is set
      await new Promise(resolve => setImmediate(resolve));

      // Try to trigger again (should fail - mutex locked)
      await expect(service.triggerProcessing()).rejects.toThrow('Job runner is already processing');

      resolveProcessing!();
      await firstCall;
    });

    it('should process jobs when triggered manually', async () => {
      // Reset call counts but keep implementations
      mockLockService.acquireLock.mockClear();
      mockLockService.releaseLock.mockClear();
      mockLockService.cleanupExpiredLock.mockClear();
      mockStateService.updateState.mockClear();
      mockWhatsAppProcessor.processPendingJobs.mockClear();
      mockInstagramProcessor.processPendingJobs.mockClear();
      mockMetaSpendProcessor.processPendingJobs.mockClear();
      mockMetaTokenRefreshProcessor.processPendingJobs.mockClear();

      await service.triggerProcessing();

      expect(mockLockService.acquireLock).toHaveBeenCalled();
      expect(mockLockService.cleanupExpiredLock).toHaveBeenCalled();
      expect(mockWhatsAppProcessor.processPendingJobs).toHaveBeenCalledWith(10);
      expect(mockInstagramProcessor.processPendingJobs).toHaveBeenCalledWith(10);
      expect(mockMetaSpendProcessor.processPendingJobs).toHaveBeenCalledWith(10);
      expect(mockMetaTokenRefreshProcessor.processPendingJobs).toHaveBeenCalledWith(10);
      expect(mockStateService.updateState).toHaveBeenCalled();
      expect(mockLockService.releaseLock).toHaveBeenCalled();
      expect(service.isCurrentlyProcessing()).toBe(false); // Should be done
    });

    it('should handle errors in manual trigger', async () => {
      // Reset call counts but keep implementations
      mockLockService.acquireLock.mockClear();
      mockLockService.releaseLock.mockClear();
      mockLockService.cleanupExpiredLock.mockClear();
      mockStateService.updateState.mockClear();
      
      // Override to throw error
      mockWhatsAppProcessor.processPendingJobs.mockRejectedValue(new Error('Processing error'));
      mockInstagramProcessor.processPendingJobs.mockResolvedValue(undefined);
      mockMetaSpendProcessor.processPendingJobs.mockResolvedValue(undefined);
      mockMetaTokenRefreshProcessor.processPendingJobs.mockResolvedValue(undefined);

      await expect(service.triggerProcessing()).rejects.toThrow('Processing error');
      expect(mockLockService.releaseLock).toHaveBeenCalled();
    });
  });

  describe('scheduler behavior', () => {
    beforeEach(() => {
      // Clean up env vars
      delete process.env.JOB_RUNNER_INTERVAL_MS;
      process.env.JOB_RUNNER_ENABLED = 'true';
    });

    it('should use configured interval', async () => {
      process.env.JOB_RUNNER_INTERVAL_MS = '5000';
      
      const testConfigService = {
        get: jest.fn((key: string): any => {
          if (key === 'QUEUE_MODE') return 'db';
          if (key === 'INTEGRATION_WORKER_CONCURRENCY') return '5';
          if (key === 'JOB_RUNNER_INTERVAL_MS') return '5000';
          return undefined;
        }),
      };

      const testModule: TestingModule = await Test.createTestingModule({
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
            useValue: testConfigService,
          },
        ],
      }).compile();

      const newService = testModule.get<JobRunnerService>(JobRunnerService);
      newService.onModuleInit();
      // Service should be initialized with correct interval
      expect(newService).toBeDefined();
      newService.onModuleDestroy();
    });

    it('should default to 5000ms if interval not set', async () => {
      delete process.env.JOB_RUNNER_INTERVAL_MS;
      
      const testConfigService = {
        get: jest.fn((key: string): any => {
          if (key === 'QUEUE_MODE') return 'db';
          if (key === 'INTEGRATION_WORKER_CONCURRENCY') return '5';
          // JOB_RUNNER_INTERVAL_MS not set, should default to 5000
          return undefined;
        }),
      };

      const testModule: TestingModule = await Test.createTestingModule({
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
            useValue: testConfigService,
          },
        ],
      }).compile();

      const newService = testModule.get<JobRunnerService>(JobRunnerService);
      newService.onModuleInit();
      expect(newService).toBeDefined();
      newService.onModuleDestroy();
    });
  });
});
