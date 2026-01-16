import { Test, TestingModule } from '@nestjs/testing';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { Reflector } from '@nestjs/core';
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  IntegrationProvider,
  ConversationStatus,
  Role,
} from '@remember-me/prisma';
import { MediaType } from './dto/send-text.dto';

describe('InboxController', () => {
  let controller: InboxController;
  let service: InboxService;

  const mockInboxService = {
    listConversations: jest.fn(),
    getConversation: jest.fn(),
    getConversationMessages: jest.fn(),
    assignConversation: jest.fn(),
    markConversationRead: jest.fn(),
    updateConversationStatus: jest.fn(),
    addTagToConversation: jest.fn(),
    removeTagFromConversation: jest.fn(),
    listTags: jest.fn(),
    getTag: jest.fn(),
    createTag: jest.fn(),
    updateTag: jest.fn(),
    deleteTag: jest.fn(),
    getMetrics: jest.fn(),
    retryFailedMessage: jest.fn(),
    sendTextMessage: jest.fn(),
    sendTemplateMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InboxController],
      providers: [
        {
          provide: InboxService,
          useValue: mockInboxService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InboxController>(InboxController);
    service = module.get<InboxService>(InboxService);

    jest.clearAllMocks();
  });

  describe('listConversations', () => {
    it('should call service with correct filters', async () => {
      mockInboxService.listConversations.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      await controller.listConversations(
        'org-1',
        IntegrationProvider.WHATSAPP,
        ConversationStatus.OPEN,
        undefined,
        undefined,
        undefined,
        '1',
        '20',
      );

      expect(mockInboxService.listConversations).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          provider: IntegrationProvider.WHATSAPP,
          status: ConversationStatus.OPEN,
          page: 1,
          limit: 20,
        }),
      );
    });
  });

  describe('assignConversation', () => {
    it('should call service with correct params', async () => {
      mockInboxService.assignConversation.mockResolvedValue({
        id: 'conv-1',
        assignedToId: 'user-2',
      });

      await controller.assignConversation(
        'org-1',
        { id: 'user-1', role: Role.ADMIN },
        'conv-1',
        { assignedToId: 'user-2' },
      );

      expect(mockInboxService.assignConversation).toHaveBeenCalledWith(
        'org-1',
        'conv-1',
        'user-2',
        'user-1',
        Role.ADMIN,
      );
    });
  });

  describe('markConversationRead', () => {
    it('should call service with correct params', async () => {
      mockInboxService.markConversationRead.mockResolvedValue({
        id: 'conv-1',
        unreadCount: 0,
      });

      await controller.markConversationRead(
        'org-1',
        { id: 'user-1' },
        'conv-1',
      );

      expect(mockInboxService.markConversationRead).toHaveBeenCalledWith(
        'org-1',
        'conv-1',
        'user-1',
      );
    });
  });

  describe('retryFailedMessage', () => {
    it('should call service.retryFailedMessage', async () => {
      const result = { messageLogId: 'msg-2', jobId: 'job-1', status: 'queued' };
      mockInboxService.retryFailedMessage.mockResolvedValue(result);

      const response = await controller.retryFailedMessage('org-1', { id: 'user-1' }, 'msg-1');

      expect(response).toEqual(result);
      expect(mockInboxService.retryFailedMessage).toHaveBeenCalledWith('org-1', 'msg-1', 'user-1');
    });
  });

  describe('sendTextMessage', () => {
    it('should call service.sendTextMessage with text only', async () => {
      const result = { jobId: 'job-1', status: 'queued', message: 'Message queued for sending' };
      mockInboxService.sendTextMessage.mockResolvedValue(result);

      const response = await controller.sendTextMessage(
        'org-1',
        { id: 'user-1' },
        'conv-1',
        { text: 'Hello' },
      );

      expect(response).toEqual(result);
      expect(mockInboxService.sendTextMessage).toHaveBeenCalledWith(
        'org-1',
        'conv-1',
        'Hello',
        'user-1',
        undefined,
        undefined,
        undefined,
      );
    });

    it('should call service.sendTextMessage with media', async () => {
      const result = { jobId: 'job-1', status: 'queued', message: 'Message queued for sending' };
      mockInboxService.sendTextMessage.mockResolvedValue(result);

      const response = await controller.sendTextMessage(
        'org-1',
        { id: 'user-1' },
        'conv-1',
        {
          text: 'Check this out',
          mediaUrl: 'https://example.com/image.jpg',
          mediaType: MediaType.IMAGE,
          caption: 'My image',
        },
      );

      expect(response).toEqual(result);
      expect(mockInboxService.sendTextMessage).toHaveBeenCalledWith(
        'org-1',
        'conv-1',
        'Check this out',
        'user-1',
        'https://example.com/image.jpg',
        'image',
        'My image',
      );
    });

    // Note: Rate limiting is tested in rate-limit.guard.spec.ts
    // The @RateLimit decorator is applied to sendTextMessage endpoint
    // In production, the guard will check Redis and throw 429 when limit exceeded
  });
});
