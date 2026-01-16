import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import { IntegrationProvider, WebhookEventStatus, IntegrationJobType } from '@remember-me/prisma';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;

  const mockPrismaService = {
    webhookEvent: {
      create: jest.fn(),
    },
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationQueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    it('should save webhook event and create integration job', async () => {
      const payload = { event: 'message', data: { text: 'hello' } };
      const webhookEvent = {
        id: 'event-1',
        provider: IntegrationProvider.WHATSAPP,
        eventType: 'message',
        status: WebhookEventStatus.PENDING,
        payloadJson: payload,
      };

      mockPrismaService.webhookEvent.create.mockResolvedValue(webhookEvent);
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      const result = await service.processWebhook(
        IntegrationProvider.WHATSAPP,
        'message',
        payload,
      );

      expect(result).toEqual(webhookEvent);
      expect(mockPrismaService.webhookEvent.create).toHaveBeenCalledWith({
        data: {
          provider: IntegrationProvider.WHATSAPP,
          eventType: 'message',
          payloadJson: payload,
          status: WebhookEventStatus.PENDING,
        },
      });
      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          webhookEventId: 'event-1',
          eventType: 'message',
          payload,
        }),
      });
    });

    it('should pass organizationId to enqueue when provided', async () => {
      const payload = { event: 'message' };
      mockPrismaService.webhookEvent.create.mockResolvedValue({
        id: 'event-1',
        provider: IntegrationProvider.INSTAGRAM,
        eventType: 'message',
        status: WebhookEventStatus.PENDING,
      });
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.processWebhook(
        IntegrationProvider.INSTAGRAM,
        'message',
        payload,
        'org-123',
      );

      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        provider: IntegrationProvider.INSTAGRAM,
        payload: expect.any(Object),
        organizationId: 'org-123', // organizationId passed
      });
    });

    it('should throw error for invalid provider', async () => {
      await expect(
        service.processWebhook('INVALID_PROVIDER' as any, 'event', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create webhook event with PENDING status', async () => {
      const payload = { event: 'test' };
      mockPrismaService.webhookEvent.create.mockResolvedValue({
        id: 'event-1',
        status: WebhookEventStatus.PENDING,
      });
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      const result = await service.processWebhook(
        IntegrationProvider.FACEBOOK,
        'test-event',
        payload,
      );

      expect(result.status).toBe(WebhookEventStatus.PENDING);
      expect(mockPrismaService.webhookEvent.create).toHaveBeenCalledWith({
        data: {
          provider: IntegrationProvider.FACEBOOK,
          eventType: 'test-event',
          payloadJson: payload,
          status: WebhookEventStatus.PENDING,
        },
      });
    });

    it('should create job with webhookEventId in payload', async () => {
      const payload = { event: 'test' };
      mockPrismaService.webhookEvent.create.mockResolvedValue({
        id: 'webhook-event-123',
        provider: IntegrationProvider.WHATSAPP,
        eventType: 'test',
        status: WebhookEventStatus.PENDING,
      });
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.processWebhook(
        IntegrationProvider.WHATSAPP,
        'test',
        payload,
        'org-1',
      );

      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          webhookEventId: 'webhook-event-123',
          organizationId: 'org-1',
        }),
        organizationId: 'org-1',
      });
    });
  });
});
