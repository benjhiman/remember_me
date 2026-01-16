import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IntegrationQueueService } from './integration-queue.service';
import { DbQueueAdapter } from './db-queue.adapter';
import { BullMqQueueAdapter } from './bullmq-queue.adapter';
import { IntegrationJobType, IntegrationProvider } from '@remember-me/prisma';

describe('IntegrationQueueService', () => {
  let service: IntegrationQueueService;
  let dbAdapter: DbQueueAdapter;
  let bullMqAdapter: BullMqQueueAdapter;

  const mockDbAdapter = {
    enqueue: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
  };

  const mockBullMqAdapter = {
    enqueue: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(true),
    getQueue: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'QUEUE_MODE') return 'db';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationQueueService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DbQueueAdapter,
          useValue: mockDbAdapter,
        },
        {
          provide: BullMqQueueAdapter,
          useValue: mockBullMqAdapter,
        },
      ],
    }).compile();

    service = module.get<IntegrationQueueService>(IntegrationQueueService);
    dbAdapter = module.get<DbQueueAdapter>(DbQueueAdapter);
    bullMqAdapter = module.get<BullMqQueueAdapter>(BullMqQueueAdapter);
  });

  describe('adapter selection', () => {
    it('should use DB adapter when QUEUE_MODE=db', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'QUEUE_MODE') return 'db';
        return undefined;
      });

      const newService = new IntegrationQueueService(
        mockConfigService as any,
        mockDbAdapter as any,
        mockBullMqAdapter as any,
      );

      await newService.onModuleInit();

      const job = await newService.enqueue({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: { test: 'data' },
        organizationId: 'org-1',
      });

      expect(mockDbAdapter.enqueue).toHaveBeenCalled();
      expect(mockBullMqAdapter.enqueue).not.toHaveBeenCalled();
    });

    it('should use BullMQ adapter when QUEUE_MODE=bullmq', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'QUEUE_MODE') return 'bullmq';
        return undefined;
      });

      const newService = new IntegrationQueueService(
        mockConfigService as any,
        mockDbAdapter as any,
        mockBullMqAdapter as any,
      );

      await newService.onModuleInit();

      const job = await newService.enqueue({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: { test: 'data' },
        organizationId: 'org-1',
      });

      expect(mockBullMqAdapter.enqueue).toHaveBeenCalled();
    });

    it('should fallback to DB if BullMQ not available', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'QUEUE_MODE') return 'bullmq';
        return undefined;
      });

      mockBullMqAdapter.isEnabled.mockReturnValue(false);

      const newService = new IntegrationQueueService(
        mockConfigService as any,
        mockDbAdapter as any,
        mockBullMqAdapter as any,
      );

      await newService.onModuleInit();

      const job = await newService.enqueue({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: { test: 'data' },
        organizationId: 'org-1',
      });

      expect(mockDbAdapter.enqueue).toHaveBeenCalled();
    });

    it('should fallback to DB if BullMQ enqueue fails', async () => {
      // Create fresh mocks for this test
      const testConfigService = {
        get: jest.fn((key: string): any => {
          if (key === 'QUEUE_MODE') return 'bullmq';
          return undefined;
        }),
      };

      const testBullMqAdapter = {
        enqueue: jest.fn().mockRejectedValueOnce(new Error('Redis down')),
        isEnabled: jest.fn().mockReturnValue(true),
        getQueue: jest.fn(),
      };

      const testDbAdapter = {
        enqueue: jest.fn().mockResolvedValue({ id: 'job-1' }),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const newService = new IntegrationQueueService(
        testConfigService as any,
        testDbAdapter as any,
        testBullMqAdapter as any,
      );

      await newService.onModuleInit();

      const job = await newService.enqueue({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: { test: 'data' },
        organizationId: 'org-1',
      });

      expect(testBullMqAdapter.enqueue).toHaveBeenCalled();
      expect(testDbAdapter.enqueue).toHaveBeenCalled(); // Fallback
    });
  });

  describe('enqueue with delay', () => {
    it('should pass runAt to adapter for delayed execution', async () => {
      const runAt = new Date();
      runAt.setHours(runAt.getHours() + 2);

      await service.enqueue({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: { test: 'data' },
        runAt,
        organizationId: 'org-1',
      });

      expect(mockDbAdapter.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          runAt,
        }),
      );
    });
  });

  describe('isBullMqEnabled', () => {
    it('should return true when BullMQ adapter is active', async () => {
      // Create fresh mocks for this test
      const testConfigService = {
        get: jest.fn((key: string): any => {
          if (key === 'QUEUE_MODE') return 'bullmq';
          return undefined;
        }),
      };

      const testBullMqAdapter = {
        enqueue: jest.fn(),
        isEnabled: jest.fn().mockReturnValue(true),
        getQueue: jest.fn(),
      };

      const testDbAdapter = {
        enqueue: jest.fn(),
        isEnabled: jest.fn().mockReturnValue(true),
      };

      const newService = new IntegrationQueueService(
        testConfigService as any,
        testDbAdapter as any,
        testBullMqAdapter as any,
      );

      await newService.onModuleInit();

      // After onModuleInit, adapter should be set to BullMQ
      expect(newService.isBullMqEnabled()).toBe(true);
    });

    it('should return false when DB adapter is active', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string): any => {
        if (key === 'QUEUE_MODE') return 'db';
        return undefined;
      });

      const newService = new IntegrationQueueService(
        mockConfigService as any,
        mockDbAdapter as any,
        mockBullMqAdapter as any,
      );

      await newService.onModuleInit();

      expect(newService.isBullMqEnabled()).toBe(false);
    });
  });
});
