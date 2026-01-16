import { Test, TestingModule } from '@nestjs/testing';
import { InboxService } from './inbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  IntegrationProvider,
  ConversationStatus,
  MessageDirection,
  MessageStatus,
  IntegrationJobType,
} from '@remember-me/prisma';

// This file contains tests for retryFailedMessage
// Main inbox.service.spec.ts should import these tests or they should be merged

describe('InboxService - retryFailedMessage', () => {
  let service: InboxService;
  let prisma: PrismaService;

  const mockPrismaService = {
    messageLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockIntegrationQueueService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationQueueService,
          useValue: mockIntegrationQueueService,
        },
      ],
    }).compile();

    service = module.get<InboxService>(InboxService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('retryFailedMessage', () => {
    const orgId = 'org-1';
    const userId = 'user-1';
    const messageId = 'msg-1';
    const conversationId = 'conv-1';

    const mockFailedMessage = {
      id: messageId,
      provider: IntegrationProvider.WHATSAPP,
      direction: MessageDirection.OUTBOUND,
      status: MessageStatus.FAILED,
      to: '+1234567890',
      from: '+0987654321',
      text: 'Hello',
      metaJson: {
        templateId: 'template-1',
        variables: { '1': 'John' },
      },
      conversation: {
        id: conversationId,
        organizationId: orgId,
        status: ConversationStatus.OPEN,
        leadId: 'lead-1',
        phone: '+1234567890',
      },
    };

    it('should retry failed message and create new job + messageLog', async () => {
      // Mock: first call finds failed message, second call finds no existing retry
      mockPrismaService.messageLog.findFirst
        .mockResolvedValueOnce(mockFailedMessage)
        .mockResolvedValueOnce(null); // No existing retry

      mockIntegrationQueueService.enqueue.mockResolvedValue({ id: 'job-1' });
      mockPrismaService.messageLog.create.mockResolvedValue({
        id: 'msg-2',
        status: MessageStatus.QUEUED,
      });
      mockPrismaService.conversation.update.mockResolvedValue({});

      const result = await service.retryFailedMessage(orgId, messageId, userId);

      expect(result).toMatchObject({
        messageLogId: 'msg-2',
        jobId: 'job-1',
        status: 'queued',
      });

      expect(mockIntegrationQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.SEND_MESSAGE_TEMPLATE,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          templateId: 'template-1',
          variables: { '1': 'John' },
          toPhone: '+1234567890',
        }),
        organizationId: orgId,
      });

      expect(mockPrismaService.messageLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: IntegrationProvider.WHATSAPP,
          direction: MessageDirection.OUTBOUND,
          status: MessageStatus.QUEUED,
          metaJson: expect.objectContaining({
            retryOf: messageId,
          }),
        }),
      });
    });

    it('should retry text message (not template)', async () => {
      const textMessage = {
        ...mockFailedMessage,
        metaJson: null, // No template
      };

      // Mock: first call finds failed message, second call finds no existing retry
      mockPrismaService.messageLog.findFirst
        .mockResolvedValueOnce(textMessage)
        .mockResolvedValueOnce(null); // No existing retry

      mockIntegrationQueueService.enqueue.mockResolvedValue({ id: 'job-2' });
      mockPrismaService.messageLog.create.mockResolvedValue({
        id: 'msg-3',
        status: MessageStatus.QUEUED,
      });
      mockPrismaService.conversation.update.mockResolvedValue({});

      await service.retryFailedMessage(orgId, messageId, userId);

      expect(mockIntegrationQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          text: 'Hello',
          toPhone: '+1234567890',
        }),
        organizationId: orgId,
      });
    });

    it('should throw NotFoundException if message not found', async () => {
      mockPrismaService.messageLog.findFirst.mockResolvedValue(null);

      await expect(service.retryFailedMessage(orgId, messageId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if status is not FAILED', async () => {
      // findFirst returns null because status != FAILED in where clause
      mockPrismaService.messageLog.findFirst.mockResolvedValue(null);

      await expect(service.retryFailedMessage(orgId, messageId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should enforce multi-org isolation', async () => {
      const otherOrgMessage = {
        ...mockFailedMessage,
        conversation: {
          ...mockFailedMessage.conversation,
          organizationId: 'org-2',
        },
      };

      mockPrismaService.messageLog.findFirst.mockResolvedValue(otherOrgMessage);

      await expect(service.retryFailedMessage(orgId, messageId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if conversation is CLOSED', async () => {
      const closedConversationMessage = {
        ...mockFailedMessage,
        conversation: {
          ...mockFailedMessage.conversation,
          status: ConversationStatus.CLOSED,
        },
      };

      mockPrismaService.messageLog.findFirst.mockResolvedValue(closedConversationMessage);

      await expect(service.retryFailedMessage(orgId, messageId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle error gracefully and not crash', async () => {
      mockPrismaService.messageLog.findFirst.mockRejectedValue(new Error('DB error'));

      await expect(service.retryFailedMessage(orgId, messageId, userId)).rejects.toThrow(
        Error,
      );
    });

    it('should prevent duplicate retries (idempotency)', async () => {
      // First call: no existing retry
      mockPrismaService.messageLog.findFirst
        .mockResolvedValueOnce(mockFailedMessage) // First call: find failed message
        .mockResolvedValueOnce(null); // No existing retry

      mockIntegrationQueueService.enqueue.mockResolvedValue({ id: 'job-1' });
      mockPrismaService.messageLog.create.mockResolvedValue({
        id: 'msg-2',
        status: MessageStatus.QUEUED,
      });
      mockPrismaService.conversation.update.mockResolvedValue({});

      await service.retryFailedMessage(orgId, messageId, userId);

      // Second call: existing retry found
      mockPrismaService.messageLog.findFirst
        .mockResolvedValueOnce(mockFailedMessage) // Find failed message
        .mockResolvedValueOnce({
          // Existing retry found
          id: 'msg-2',
          status: MessageStatus.QUEUED,
          metaJson: { retryOf: messageId },
        });

      await expect(service.retryFailedMessage(orgId, messageId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should include media in retry payload if present', async () => {
      const messageWithMedia = {
        ...mockFailedMessage,
        metaJson: {
          mediaUrl: 'https://example.com/image.jpg',
          mediaType: 'image',
          caption: 'Check this out',
        },
      };

      mockPrismaService.messageLog.findFirst
        .mockResolvedValueOnce(messageWithMedia)
        .mockResolvedValueOnce(null); // No existing retry

      mockIntegrationQueueService.enqueue.mockResolvedValue({ id: 'job-1' });
      mockPrismaService.messageLog.create.mockResolvedValue({
        id: 'msg-2',
        status: MessageStatus.QUEUED,
      });
      mockPrismaService.conversation.update.mockResolvedValue({});

      await service.retryFailedMessage(orgId, messageId, userId);

      expect(mockIntegrationQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          mediaUrl: 'https://example.com/image.jpg',
          mediaType: 'image',
          caption: 'Check this out',
        }),
        organizationId: orgId,
      });
    });
  });
});
