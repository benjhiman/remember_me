import { Test, TestingModule } from '@nestjs/testing';
import { InstagramJobProcessorService } from './instagram-job-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { InboxService } from '../inbox/inbox.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { IntegrationProvider, IntegrationJobType, MessageDirection, MessageStatus, LeadStatus } from '@remember-me/prisma';
import { BadRequestException } from '@nestjs/common';

// Mock fetch globally
global.fetch = jest.fn();

describe('InstagramJobProcessorService', () => {
  let service: InstagramJobProcessorService;
  let prisma: PrismaService;

  const mockPrismaService = {
    lead: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
    },
    pipeline: {
      findFirst: jest.fn(),
    },
    stage: {
      findFirst: jest.fn(),
    },
    note: {
      create: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
    },
    messageLog: {
      create: jest.fn(),
    },
  };

  const mockIntegrationJobsService = {
    fetchNext: jest.fn(),
    markProcessing: jest.fn(),
    markDone: jest.fn(),
    markFailed: jest.fn(),
  };

  const mockInboxService = {
    syncConversationFromMessage: jest.fn(),
  };

  beforeEach(async () => {
    // Set environment variables BEFORE creating service (they're read in constructor)
    process.env.META_PAGE_ACCESS_TOKEN = 'test_token';
    process.env.INSTAGRAM_PAGE_ID = 'page-123';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramJobProcessorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationJobsService,
          useValue: mockIntegrationJobsService,
        },
        {
          provide: InboxService,
          useValue: mockInboxService,
        },
        {
          provide: MetricsService,
          useValue: {
            recordOutboundMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InstagramJobProcessorService>(InstagramJobProcessorService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockClear();
  });

  afterEach(() => {
    delete process.env.META_PAGE_ACCESS_TOKEN;
    delete process.env.INSTAGRAM_PAGE_ID;
  });

  describe('processPendingJobs', () => {
    it('should skip jobs that are not Instagram', async () => {
      mockIntegrationJobsService.fetchNext.mockResolvedValue([
        {
          id: 'job-1',
          provider: IntegrationProvider.WHATSAPP,
          jobType: IntegrationJobType.SEND_MESSAGE,
        },
      ]);

      await service.processPendingJobs(10);

      expect(mockIntegrationJobsService.markProcessing).not.toHaveBeenCalled();
    });

    it('should process Instagram SEND_MESSAGE job', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM,
        jobType: IntegrationJobType.SEND_MESSAGE,
        payloadJson: {
          recipientId: 'user-456',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockIntegrationJobsService.fetchNext.mockResolvedValue([job]);
      
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'msg-789' }),
        text: async () => JSON.stringify({ message_id: 'msg-789' }),
      } as Response);
      
      mockInboxService.syncConversationFromMessage.mockResolvedValue('conv-1');
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-1' });

      await service.processPendingJobs(10);

      expect(mockIntegrationJobsService.markProcessing).toHaveBeenCalledWith('job-1');
      expect(fetchSpy).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('page-123/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test_token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('user-456'),
        }),
      );
      expect(mockIntegrationJobsService.markDone).toHaveBeenCalledWith('job-1');
      
      fetchSpy.mockRestore();
    });

    it('should handle API error when sending message', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM,
        jobType: IntegrationJobType.SEND_MESSAGE,
        payloadJson: {
          recipientId: 'user-456',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockIntegrationJobsService.fetchNext.mockResolvedValue([job]);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await service.processPendingJobs(10);

      expect(mockIntegrationJobsService.markFailed).toHaveBeenCalled();
    });

    it('should handle messaging not supported error', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM,
        jobType: IntegrationJobType.SEND_MESSAGE,
        payloadJson: {
          recipientId: 'user-456',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockIntegrationJobsService.fetchNext.mockResolvedValue([job]);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: { message: 'messaging not allowed' } }),
        json: async () => ({ error: { message: 'messaging not allowed' } }),
      });

      await service.processPendingJobs(10);

      expect(mockIntegrationJobsService.markFailed).toHaveBeenCalled();
    });

    it('should process PROCESS_WEBHOOK job and create lead', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM,
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        payloadJson: {
          messageId: 'msg-1',
          from: 'user-456',
          senderId: 'user-456',
          text: 'Hello',
          timestamp: '1234567890',
          organizationId: 'org-1',
        },
      };

      mockIntegrationJobsService.fetchNext.mockResolvedValue([job]);
      mockPrismaService.lead.findFirst.mockResolvedValue(null);
      mockPrismaService.membership.findFirst.mockResolvedValue({
        userId: 'user-1',
        organizationId: 'org-1',
      });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.lead.create.mockResolvedValue({
        id: 'lead-1',
        status: LeadStatus.ACTIVE,
        createdById: 'user-1',
      });
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });

      await service.processPendingJobs(10);

      expect(mockPrismaService.lead.create).toHaveBeenCalled();
      expect(mockPrismaService.note.create).toHaveBeenCalled();
      expect(mockIntegrationJobsService.markDone).toHaveBeenCalledWith('job-1');
    });

    it('should update existing lead when processing webhook', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM,
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        payloadJson: {
          messageId: 'msg-1',
          from: 'user-456',
          senderId: 'user-456',
          text: 'Hello',
          timestamp: '1234567890',
          organizationId: 'org-1',
        },
      };

      mockIntegrationJobsService.fetchNext.mockResolvedValue([job]);
      mockPrismaService.lead.findFirst.mockResolvedValue({
        id: 'lead-1',
        status: LeadStatus.ACTIVE,
        createdById: 'user-1',
      });
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });

      await service.processPendingJobs(10);

      expect(mockPrismaService.lead.create).not.toHaveBeenCalled();
      expect(mockPrismaService.note.create).toHaveBeenCalled();
    });
  });

  describe('processSendMessageJob', () => {
    it('should throw error when access token is not configured', async () => {
      delete process.env.META_PAGE_ACCESS_TOKEN;

      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM,
        jobType: IntegrationJobType.SEND_MESSAGE,
        payloadJson: {
          recipientId: 'user-456',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockIntegrationJobsService.fetchNext.mockResolvedValue([job]);

      await service.processPendingJobs(10);

      expect(mockIntegrationJobsService.markFailed).toHaveBeenCalled();
    });

    it('should use conversation handle when recipientId is not provided', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM,
        jobType: IntegrationJobType.SEND_MESSAGE,
        payloadJson: {
          conversationId: 'conv-1',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockIntegrationJobsService.fetchNext.mockResolvedValue([job]);
      mockPrismaService.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        handle: 'user-456',
        organizationId: 'org-1',
        deletedAt: null,
      });
      
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'msg-789' }),
        text: async () => JSON.stringify({ message_id: 'msg-789' }),
      } as Response);
      
      mockInboxService.syncConversationFromMessage.mockResolvedValue('conv-1');
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-1' });

      await service.processPendingJobs(10);

      expect(fetchSpy).toHaveBeenCalled();
      const fetchCall = fetchSpy.mock.calls[0];
      expect(fetchCall[0]).toContain('page-123/messages');
      const requestInit = fetchCall[1] as RequestInit;
      const body = JSON.parse(requestInit.body as string);
      expect(body.recipient.id).toBe('user-456');
      expect(body.message.text).toBe('Hello');
      
      fetchSpy.mockRestore();
    });

    it('should create note on lead when leadId is provided', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM,
        jobType: IntegrationJobType.SEND_MESSAGE,
        payloadJson: {
          recipientId: 'user-456',
          text: 'Hello',
          leadId: 'lead-1',
          organizationId: 'org-1',
        },
      };

      mockIntegrationJobsService.fetchNext.mockResolvedValue([job]);
      mockPrismaService.lead.findFirst.mockResolvedValue({
        id: 'lead-1',
        organizationId: 'org-1',
        deletedAt: null,
      });
      mockPrismaService.membership.findFirst.mockResolvedValue({
        userId: 'user-1',
      });
      
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'msg-789' }),
        text: async () => JSON.stringify({ message_id: 'msg-789' }),
      } as Response);
      
      mockInboxService.syncConversationFromMessage.mockResolvedValue('conv-1');
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-1' });
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });

      await service.processPendingJobs(10);

      expect(fetchSpy).toHaveBeenCalled();
      expect(mockPrismaService.note.create).toHaveBeenCalled();
      const noteCall = mockPrismaService.note.create.mock.calls[0][0];
      expect(noteCall.data.leadId).toBe('lead-1');
      expect(noteCall.data.content).toContain('Outbound Instagram message');
      
      fetchSpy.mockRestore();
    });
  });
});
