import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppJobProcessorService } from './whatsapp-job-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { InboxService } from '../inbox/inbox.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import {
  IntegrationJobType,
  IntegrationProvider,
  IntegrationJobStatus,
  MessageDirection,
  LeadStatus,
  MessageStatus,
  WhatsAppTemplateStatus,
  WhatsAppAutomationAction,
} from '@remember-me/prisma';

describe('WhatsAppJobProcessorService', () => {
  let service: WhatsAppJobProcessorService;
  let prisma: PrismaService;
  let jobsService: IntegrationJobsService;

  const originalEnv = process.env;
  const originalFetch = global.fetch;

  const mockPrismaService = {
    lead: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    note: {
      create: jest.fn(),
    },
    pipeline: {
      findFirst: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
    },
    messageLog: {
      create: jest.fn(),
      update: jest.fn(),
    },
    whatsAppTemplate: {
      findFirst: jest.fn(),
    },
  };

  const mockJobsService = {
    fetchNext: jest.fn(),
    markProcessing: jest.fn(),
    markDone: jest.fn(),
    markFailed: jest.fn(),
  };

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      WHATSAPP_ACCESS_TOKEN: 'test-token',
      WHATSAPP_PHONE_NUMBER_ID: 'phone-123',
    };

    global.fetch = jest.fn() as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppJobProcessorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: IntegrationJobsService,
          useValue: mockJobsService,
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
            recordJobLatency: jest.fn(),
            recordJobDuration: jest.fn(),
            recordOutboundMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WhatsAppJobProcessorService>(WhatsAppJobProcessorService);
    prisma = module.get<PrismaService>(PrismaService);
    jobsService = module.get<IntegrationJobsService>(IntegrationJobsService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('processPendingJobs', () => {
    it('should process PROCESS_WEBHOOK job and create Lead', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        runAt: new Date(),
        payloadJson: {
          messageId: 'msg-123',
          from: '+1234567890',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      mockPrismaService.lead.findFirst.mockResolvedValue(null); // No existing lead
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({
        id: 'pipeline-1',
        isDefault: true,
        stages: [{ id: 'stage-1', order: 0 }],
      });
      mockPrismaService.lead.create.mockResolvedValue({
        id: 'lead-1',
        organizationId: 'org-1',
      });
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockJobsService.markDone.mockResolvedValue({ ...job, status: IntegrationJobStatus.DONE });

      await service.processPendingJobs(10);

      expect(mockPrismaService.lead.create).toHaveBeenCalled();
      expect(mockPrismaService.note.create).toHaveBeenCalled();
      expect(mockJobsService.markDone).toHaveBeenCalledWith('job-1');
    });

    it('should process PROCESS_WEBHOOK job and update existing Lead', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        runAt: new Date(),
        payloadJson: {
          messageId: 'msg-123',
          from: '+1234567890',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      const existingLead = {
        id: 'lead-1',
        organizationId: 'org-1',
        phone: '+1234567890',
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      mockPrismaService.lead.findFirst.mockResolvedValue(existingLead);
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockJobsService.markDone.mockResolvedValue({ ...job, status: IntegrationJobStatus.DONE });

      await service.processPendingJobs(10);

      expect(mockPrismaService.lead.create).not.toHaveBeenCalled();
      expect(mockPrismaService.note.create).toHaveBeenCalled();
      expect(mockJobsService.markDone).toHaveBeenCalledWith('job-1');
    });

    it('should process SEND_MESSAGE job and call WhatsApp API', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.SEND_MESSAGE,
        runAt: new Date(),
        payloadJson: {
          toPhone: '+1234567890',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ id: 'whatsapp-msg-123' }],
        }),
      });
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-log-1' });
      mockJobsService.markDone.mockResolvedValue({ ...job, status: IntegrationJobStatus.DONE });

      await service.processPendingJobs(10);

      expect(global.fetch).toHaveBeenCalled();
      expect(mockPrismaService.messageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalMessageId: 'whatsapp-msg-123',
            status: MessageStatus.SENT,
            statusUpdatedAt: expect.any(Date),
          }),
        }),
      );
      expect(mockJobsService.markDone).toHaveBeenCalledWith('job-1');
    });

    it('should save externalMessageId when sending message', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.SEND_MESSAGE,
        runAt: new Date(),
        payloadJson: {
          toPhone: '+1234567890',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ id: 'wamid.test123' }],
        }),
      });
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-log-1' });
      mockJobsService.markDone.mockResolvedValue({ ...job, status: IntegrationJobStatus.DONE });

      await service.processPendingJobs(10);

      expect(mockPrismaService.messageLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          externalMessageId: 'wamid.test123',
          status: MessageStatus.SENT,
        }),
      });
    });

    it('should handle failed message send and set status to FAILED', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.SEND_MESSAGE,
        runAt: new Date(),
        payloadJson: {
          toPhone: '+1234567890',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: { message: 'Invalid phone number' } }),
      });
      mockJobsService.markFailed.mockResolvedValue({ ...job, status: IntegrationJobStatus.FAILED });

      await service.processPendingJobs(10);

      expect(mockJobsService.markFailed).toHaveBeenCalled();
    });

    it('should mark job as failed on error', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        runAt: new Date(),
        payloadJson: {
          messageId: 'msg-123',
          from: '+1234567890',
          text: 'Hello',
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      mockPrismaService.lead.findFirst.mockRejectedValue(new Error('DB error'));
      mockJobsService.markFailed.mockResolvedValue({ ...job, status: IntegrationJobStatus.FAILED });

      await service.processPendingJobs(10);

      expect(mockJobsService.markFailed).toHaveBeenCalledWith('job-1', 'DB error');
    });

    it('should skip jobs from other providers', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.INSTAGRAM, // Not WhatsApp
        jobType: IntegrationJobType.PROCESS_WEBHOOK,
        runAt: new Date(),
        payloadJson: {},
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);

      await service.processPendingJobs(10);

      expect(mockJobsService.markProcessing).not.toHaveBeenCalled();
    });

    it('should process SEND_MESSAGE_TEMPLATE job and call WhatsApp API', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.SEND_MESSAGE_TEMPLATE,
        runAt: new Date(),
        payloadJson: {
          messageLogId: 'msg-log-1',
          templateId: 'template-1',
          toPhone: '+1234567890',
          variables: { '1': 'John' },
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        name: 'welcome',
        language: 'es_AR',
        status: WhatsAppTemplateStatus.APPROVED,
        componentsJson: {
          body: [{ type: 'text', text: 'Hello {{1}}' }],
        },
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ id: 'wamid.template123' }],
        }),
      });
      mockPrismaService.messageLog.update.mockResolvedValue({ id: 'msg-log-1' });
      mockJobsService.markDone.mockResolvedValue({ ...job, status: IntegrationJobStatus.DONE });

      await service.processPendingJobs(10);

      expect(global.fetch).toHaveBeenCalled();
      expect(mockPrismaService.messageLog.update).toHaveBeenCalledWith({
        where: { id: 'msg-log-1' },
        data: expect.objectContaining({
          externalMessageId: 'wamid.template123',
          status: MessageStatus.SENT,
        }),
      });
      expect(mockJobsService.markDone).toHaveBeenCalledWith('job-1');
    });

    it('should handle template not found error', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.SEND_MESSAGE_TEMPLATE,
        runAt: new Date(),
        payloadJson: {
          messageLogId: 'msg-log-1',
          templateId: 'non-existent',
          toPhone: '+1234567890',
          variables: {},
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue(null);
      mockJobsService.markFailed.mockResolvedValue({ ...job, status: IntegrationJobStatus.FAILED });

      await service.processPendingJobs(10);

      expect(mockJobsService.markFailed).toHaveBeenCalled();
    });

    it('should handle template not approved error', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.SEND_MESSAGE_TEMPLATE,
        runAt: new Date(),
        payloadJson: {
          messageLogId: 'msg-log-1',
          templateId: 'template-1',
          toPhone: '+1234567890',
          variables: {},
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        status: WhatsAppTemplateStatus.PENDING, // Not approved
      });
      mockJobsService.markFailed.mockResolvedValue({ ...job, status: IntegrationJobStatus.FAILED });

      await service.processPendingJobs(10);

      expect(mockJobsService.markFailed).toHaveBeenCalled();
    });

    it('should process AUTOMATION_ACTION job with SEND_TEMPLATE', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.AUTOMATION_ACTION,
        runAt: new Date(),
        payloadJson: {
          ruleId: 'rule-1',
          action: WhatsAppAutomationAction.SEND_TEMPLATE,
          payloadJson: {
            templateId: 'template-1',
            variables: { '1': 'John' },
          },
          phone: '+1234567890',
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        name: 'welcome',
        language: 'es_AR',
        status: WhatsAppTemplateStatus.APPROVED,
        componentsJson: {
          body: [{ type: 'text', text: 'Hello {{1}}' }],
        },
      });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ id: 'wamid.auto123' }],
        }),
      });
      mockPrismaService.messageLog.create = jest.fn();
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.findFirst.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockJobsService.markDone.mockResolvedValue({ ...job, status: IntegrationJobStatus.DONE });

      await service.processPendingJobs(10);

      expect(global.fetch).toHaveBeenCalled();
      expect(mockPrismaService.messageLog.create).toHaveBeenCalled();
      expect(mockJobsService.markDone).toHaveBeenCalledWith('job-1');
    });

    it('should process AUTOMATION_ACTION job with SEND_TEXT', async () => {
      const job = {
        id: 'job-1',
        provider: IntegrationProvider.WHATSAPP,
        jobType: IntegrationJobType.AUTOMATION_ACTION,
        runAt: new Date(),
        payloadJson: {
          ruleId: 'rule-1',
          action: WhatsAppAutomationAction.SEND_TEXT,
          payloadJson: {
            text: 'Hello, this is an automated message',
          },
          phone: '+1234567890',
          organizationId: 'org-1',
        },
      };

      mockJobsService.fetchNext.mockResolvedValue([job]);
      mockJobsService.markProcessing.mockResolvedValue(job);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [{ id: 'wamid.text123' }],
        }),
      });
      mockPrismaService.messageLog.create = jest.fn();
      mockJobsService.markDone.mockResolvedValue({ ...job, status: IntegrationJobStatus.DONE });

      await service.processPendingJobs(10);

      expect(global.fetch).toHaveBeenCalled();
      expect(mockPrismaService.messageLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          text: 'Hello, this is an automated message',
          metaJson: expect.objectContaining({
            automationRuleId: 'rule-1',
          }),
        }),
      });
      expect(mockJobsService.markDone).toHaveBeenCalledWith('job-1');
    });
  });
});
