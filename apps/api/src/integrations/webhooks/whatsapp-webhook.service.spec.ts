import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import { InboxService } from '../inbox/inbox.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { IntegrationProvider, WebhookEventStatus, IntegrationJobType } from '@remember-me/prisma';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('WhatsAppWebhookService', () => {
  let service: WhatsAppWebhookService;
  let prisma: PrismaService;

  const originalEnv = process.env;

  const mockPrismaService = {
    webhookEvent: {
      create: jest.fn(),
    },
    messageLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    process.env = { ...originalEnv, WHATSAPP_VERIFY_TOKEN: 'test-verify-token' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppWebhookService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationQueueService,
          useValue: mockQueueService,
        },
        {
          provide: InboxService,
          useValue: {
            syncConversationFromMessage: jest.fn().mockResolvedValue('conv-1'),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordWebhookEvent: jest.fn(),
            recordMessageStatusTransition: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsAppWebhookService>(WhatsAppWebhookService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('verifyWebhook', () => {
    it('should return challenge when token matches', () => {
      const result = service.verifyWebhook('subscribe', 'test-verify-token', 'challenge-123');
      expect(result).toBe('challenge-123');
    });

    it('should throw ForbiddenException when token does not match', () => {
      expect(() => {
        service.verifyWebhook('subscribe', 'wrong-token', 'challenge-123');
      }).toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when mode is not subscribe', () => {
      expect(() => {
        service.verifyWebhook('unsubscribe', 'test-verify-token', 'challenge-123');
      }).toThrow(BadRequestException);
    });
  });

  describe('processWebhook', () => {
    it('should process webhook and create event + job', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: '123' },
                  messages: [
                    {
                      id: 'msg-123',
                      from: '+1234567890',
                      timestamp: '1234567890',
                      text: { body: 'Hello' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findFirst.mockResolvedValue(null); // No duplicate
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-log-1' });
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.processWebhook(payload, 'org-123');

      expect(mockPrismaService.webhookEvent.create).toHaveBeenCalled();
      expect(mockPrismaService.messageLog.create).toHaveBeenCalled();
      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          messageId: 'msg-123',
          from: '+1234567890',
          text: 'Hello',
          organizationId: 'org-123',
        }),
        organizationId: 'org-123',
        dedupeKey: 'msg-123',
      });
    });

    it('should skip duplicate messages (idempotency)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: '123' },
                  messages: [
                    {
                      id: 'msg-123',
                      from: '+1234567890',
                      text: { body: 'Hello' },
                      type: 'text',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findFirst.mockResolvedValue({ id: 'existing-msg' }); // Duplicate

      await service.processWebhook(payload);

      expect(mockPrismaService.webhookEvent.create).not.toHaveBeenCalled();
      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid payload', async () => {
      await expect(service.processWebhook({ object: 'invalid' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip non-text messages', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  metadata: { phone_number_id: '123' },
                  messages: [
                    {
                      id: 'msg-123',
                      from: '+1234567890',
                      type: 'image', // Not text
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findFirst.mockResolvedValue(null);

      await service.processWebhook(payload);

      expect(mockPrismaService.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('should process status events (sent)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'statuses',
                value: {
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'sent',
                      timestamp: '1234567890',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findUnique.mockResolvedValue({
        id: 'msg-log-1',
        status: 'QUEUED',
      });
      mockPrismaService.messageLog.update.mockResolvedValue({ id: 'msg-log-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.messageLog.findUnique).toHaveBeenCalledWith({
        where: { externalMessageId: 'wamid.123' },
      });
      expect(mockPrismaService.messageLog.update).toHaveBeenCalled();
    });

    it('should process status events (delivered)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'statuses',
                value: {
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'delivered',
                      timestamp: '1234567890',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findUnique.mockResolvedValue({
        id: 'msg-log-1',
        status: 'SENT',
      });
      mockPrismaService.messageLog.update.mockResolvedValue({ id: 'msg-log-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.messageLog.update).toHaveBeenCalled();
    });

    it('should process status events (read)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'statuses',
                value: {
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'read',
                      timestamp: '1234567890',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findUnique.mockResolvedValue({
        id: 'msg-log-1',
        status: 'DELIVERED',
      });
      mockPrismaService.messageLog.update.mockResolvedValue({ id: 'msg-log-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.messageLog.update).toHaveBeenCalled();
    });

    it('should process status events (failed) with error details', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'statuses',
                value: {
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'failed',
                      timestamp: '1234567890',
                      errors: [
                        {
                          code: 131047,
                          title: 'Message failed to send',
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findUnique.mockResolvedValue({
        id: 'msg-log-1',
        status: 'SENT',
      });
      mockPrismaService.messageLog.update.mockResolvedValue({ id: 'msg-log-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.messageLog.update).toHaveBeenCalled();
      const updateCall = mockPrismaService.messageLog.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('msg-log-1');
      expect(updateCall.data.status).toBe('FAILED');
      expect(updateCall.data.errorCode).toBe('131047'); // Converted to string
      expect(updateCall.data.errorMessage).toBe('Message failed to send');
    });

    it('should skip status update if status is not newer (idempotency)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'statuses',
                value: {
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'sent',
                      timestamp: '1234567890',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findUnique.mockResolvedValue({
        id: 'msg-log-1',
        status: 'DELIVERED', // Already delivered, sent is older
      });

      await service.processWebhook(payload);

      expect(mockPrismaService.messageLog.update).not.toHaveBeenCalled();
    });

    it('should skip status event if message not found', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'statuses',
                value: {
                  statuses: [
                    {
                      id: 'wamid.unknown',
                      status: 'sent',
                      timestamp: '1234567890',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.messageLog.findUnique.mockResolvedValue(null);

      await service.processWebhook(payload);

      expect(mockPrismaService.messageLog.update).not.toHaveBeenCalled();
    });
  });
});
