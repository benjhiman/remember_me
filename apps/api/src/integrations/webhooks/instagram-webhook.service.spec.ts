import { Test, TestingModule } from '@nestjs/testing';
import { InstagramWebhookService } from './instagram-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import { InboxService } from '../inbox/inbox.service';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, MessageDirection } from '@remember-me/prisma';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('InstagramWebhookService', () => {
  let service: InstagramWebhookService;
  let prisma: PrismaService;

  const mockPrismaService = {
    webhookEvent: {
      create: jest.fn(),
    },
    messageLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    connectedAccount: {
      findFirst: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
  };

  const mockIntegrationQueueService = {
    enqueue: jest.fn(),
  };

  const mockInboxService = {
    syncConversationFromMessage: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string): any => {
      if (key === 'QUEUE_MODE') return 'db';
      return 'development';
    }),
  };

  beforeEach(async () => {
    // Set verify token before creating service
    process.env.INSTAGRAM_VERIFY_TOKEN = 'test_token';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramWebhookService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationQueueService,
          useValue: mockIntegrationQueueService,
        },
        {
          provide: InboxService,
          useValue: mockInboxService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<InstagramWebhookService>(InstagramWebhookService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.INSTAGRAM_VERIFY_TOKEN;
  });

  describe('verifyWebhook', () => {
    it('should return challenge when mode is subscribe and token matches', () => {
      const result = service.verifyWebhook('subscribe', 'test_token', 'challenge123');
      expect(result).toBe('challenge123');
    });

    it('should throw BadRequestException when mode is not subscribe', () => {
      expect(() => {
        service.verifyWebhook('unsubscribe', 'test_token', 'challenge123');
      }).toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when token does not match', () => {
      expect(() => {
        service.verifyWebhook('subscribe', 'wrong_token', 'challenge123');
      }).toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when verify token is not configured', () => {
      delete process.env.INSTAGRAM_VERIFY_TOKEN;
      expect(() => {
        service.verifyWebhook('subscribe', 'any_token', 'challenge123');
      }).toThrow(ForbiddenException);
    });
  });

  describe('processWebhook', () => {
    it('should throw BadRequestException when object is not instagram', async () => {
      const payload = {
        object: 'whatsapp',
        entry: [],
      };

      await expect(service.processWebhook(payload)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when entry array is empty', async () => {
      const payload = {
        object: 'instagram',
        entry: [],
      };

      await expect(service.processWebhook(payload)).rejects.toThrow(BadRequestException);
    });

    it('should process messaging event and create message log', async () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'page-123',
            messaging: [
              {
                sender: { id: 'user-456' },
                recipient: { id: 'page-123' },
                timestamp: '1234567890',
                message: {
                  mid: 'msg-789',
                  text: 'Hello',
                  type: 'text',
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.messageLog.findFirst.mockResolvedValue(null);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockInboxService.syncConversationFromMessage.mockResolvedValue('conv-1');
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-1' });
      mockIntegrationQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.webhookEvent.create).toHaveBeenCalled();
      expect(mockInboxService.syncConversationFromMessage).toHaveBeenCalledWith(
        'org-1',
        IntegrationProvider.INSTAGRAM,
        MessageDirection.INBOUND,
        null,
        'user-456',
        null,
        expect.any(Date),
      );
      expect(mockPrismaService.messageLog.create).toHaveBeenCalled();
      expect(mockIntegrationQueueService.enqueue).toHaveBeenCalled();
    });

    it('should resolve organizationId from ConnectedAccount', async () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'page-123',
            messaging: [
              {
                sender: { id: 'user-456' },
                recipient: { id: 'page-123' },
                timestamp: '1234567890',
                message: {
                  mid: 'msg-789',
                  text: 'Hello',
                  type: 'text',
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        organizationId: 'org-2',
      });
      mockPrismaService.messageLog.findFirst.mockResolvedValue(null);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockInboxService.syncConversationFromMessage.mockResolvedValue('conv-1');
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-1' });
      mockIntegrationQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.processWebhook(payload);

      expect(mockInboxService.syncConversationFromMessage).toHaveBeenCalledWith(
        'org-2',
        IntegrationProvider.INSTAGRAM,
        MessageDirection.INBOUND,
        null,
        'user-456',
        null,
        expect.any(Date),
      );
    });

    it('should skip duplicate messages', async () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'page-123',
            messaging: [
              {
                sender: { id: 'user-456' },
                recipient: { id: 'page-123' },
                timestamp: '1234567890',
                message: {
                  mid: 'msg-789',
                  text: 'Hello',
                  type: 'text',
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.messageLog.findFirst.mockResolvedValue({ id: 'existing-msg' });

      await service.processWebhook(payload);

      expect(mockPrismaService.webhookEvent.create).not.toHaveBeenCalled();
      expect(mockPrismaService.messageLog.create).not.toHaveBeenCalled();
    });

    it('should skip non-text messages', async () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'page-123',
            messaging: [
              {
                sender: { id: 'user-456' },
                recipient: { id: 'page-123' },
                timestamp: '1234567890',
                message: {
                  mid: 'msg-789',
                  type: 'image',
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.webhookEvent.create).not.toHaveBeenCalled();
    });

    it('should handle missing sender gracefully', async () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'page-123',
            messaging: [
              {
                recipient: { id: 'page-123' },
                timestamp: '1234567890',
                message: {
                  mid: 'msg-789',
                  text: 'Hello',
                  type: 'text',
                },
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.webhookEvent.create).not.toHaveBeenCalled();
    });
  });
});
