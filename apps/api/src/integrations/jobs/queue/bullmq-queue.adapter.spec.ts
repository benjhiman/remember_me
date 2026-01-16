import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { BullMqQueueAdapter } from './bullmq-queue.adapter';
import { IntegrationJobsService } from '../integration-jobs.service';
import { IntegrationJobType, IntegrationProvider } from '@remember-me/prisma';
import { Queue } from 'bullmq';

// Mock BullMQ
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Worker: jest.fn(),
}));

describe('BullMqQueueAdapter', () => {
  let adapter: BullMqQueueAdapter;
  let integrationJobsService: IntegrationJobsService;
  let prisma: PrismaService;

  const mockIntegrationJobsService = {
    enqueue: jest.fn().mockResolvedValue({ id: 'db-job-1' }),
  };

  const mockPrismaService = {} as any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'RATE_LIMIT_REDIS_URL') return 'redis://localhost:6379';
      if (key === 'BULLMQ_QUEUE_NAME') return 'integration-jobs';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullMqQueueAdapter,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationJobsService,
          useValue: mockIntegrationJobsService,
        },
      ],
    }).compile();

    adapter = module.get<BullMqQueueAdapter>(BullMqQueueAdapter);
    integrationJobsService = module.get<IntegrationJobsService>(IntegrationJobsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create DB job and enqueue to BullMQ', async () => {
    await adapter.onModuleInit();

    const result = await adapter.enqueue({
      jobType: IntegrationJobType.SEND_MESSAGE,
      provider: IntegrationProvider.WHATSAPP,
      payload: { test: 'data' },
      organizationId: 'org-1',
    });

    // Should create DB job first
    expect(mockIntegrationJobsService.enqueue).toHaveBeenCalled();

    // Should enqueue to BullMQ (mocked)
    const QueueMock = Queue as jest.MockedClass<typeof Queue>;
    expect(QueueMock).toHaveBeenCalled();
  });

  it('should calculate delay for future runAt', async () => {
    await adapter.onModuleInit();

    const runAt = new Date();
    runAt.setHours(runAt.getHours() + 2);

    await adapter.enqueue({
      jobType: IntegrationJobType.SEND_MESSAGE,
      provider: IntegrationProvider.WHATSAPP,
      payload: { test: 'data' },
      runAt,
      organizationId: 'org-1',
    });

    const queueInstance = (adapter as any).queue;
    expect(queueInstance.add).toHaveBeenCalledWith(
      IntegrationJobType.SEND_MESSAGE,
      expect.any(Object),
      expect.objectContaining({
        delay: expect.any(Number),
      }),
    );
  });

  it('should use dedupeKey for jobId if provided', async () => {
    await adapter.onModuleInit();

    await adapter.enqueue({
      jobType: IntegrationJobType.SEND_MESSAGE,
      provider: IntegrationProvider.WHATSAPP,
      payload: { test: 'data' },
      organizationId: 'org-1',
      dedupeKey: 'msg-123',
    });

    const queueInstance = (adapter as any).queue;
    expect(queueInstance.add).toHaveBeenCalledWith(
      IntegrationJobType.SEND_MESSAGE,
      expect.any(Object),
      expect.objectContaining({
        jobId: `${IntegrationJobType.SEND_MESSAGE}:org-1:msg-123`,
      }),
    );
  });

  it('should be enabled after initialization', async () => {
    await adapter.onModuleInit();
    expect(adapter.isEnabled()).toBe(true);
  });
});
