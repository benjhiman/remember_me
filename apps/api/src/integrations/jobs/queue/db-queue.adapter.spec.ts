import { Test, TestingModule } from '@nestjs/testing';
import { DbQueueAdapter } from './db-queue.adapter';
import { IntegrationJobsService } from '../integration-jobs.service';
import { IntegrationJobType, IntegrationProvider } from '@remember-me/prisma';

describe('DbQueueAdapter', () => {
  let adapter: DbQueueAdapter;
  let integrationJobsService: IntegrationJobsService;

  const mockIntegrationJobsService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbQueueAdapter,
        {
          provide: IntegrationJobsService,
          useValue: mockIntegrationJobsService,
        },
      ],
    }).compile();

    adapter = module.get<DbQueueAdapter>(DbQueueAdapter);
    integrationJobsService = module.get<IntegrationJobsService>(IntegrationJobsService);
  });

  it('should wrap IntegrationJobsService.enqueue', async () => {
    mockIntegrationJobsService.enqueue.mockResolvedValue({ id: 'job-1' });

    const result = await adapter.enqueue({
      jobType: IntegrationJobType.SEND_MESSAGE,
      provider: IntegrationProvider.WHATSAPP,
      payload: { test: 'data' },
      organizationId: 'org-1',
    });

    expect(mockIntegrationJobsService.enqueue).toHaveBeenCalledWith(
      IntegrationJobType.SEND_MESSAGE,
      IntegrationProvider.WHATSAPP,
      { test: 'data' },
      undefined,
      'org-1',
      undefined,
      undefined,
    );
  });

  it('should always be enabled', () => {
    expect(adapter.isEnabled()).toBe(true);
  });
});
