import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppTemplatesService } from './whatsapp-templates.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import {
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  IntegrationProvider,
  IntegrationJobType,
  MessageDirection,
  MessageStatus,
} from '@remember-me/prisma';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WhatsAppTemplatesService', () => {
  let service: WhatsAppTemplatesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    whatsAppTemplate: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    messageLog: {
      create: jest.fn(),
    },
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppTemplatesService,
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

    service = module.get<WhatsAppTemplatesService>(WhatsAppTemplatesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('listTemplates', () => {
    it('should list templates for organization', async () => {
      mockPrismaService.whatsAppTemplate.findMany.mockResolvedValue([
        {
          id: 'template-1',
          name: 'welcome',
          status: WhatsAppTemplateStatus.APPROVED,
        },
      ]);
      mockPrismaService.whatsAppTemplate.count.mockResolvedValue(1);

      const result = await service.listTemplates('org-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrismaService.whatsAppTemplate.findMany.mockResolvedValue([]);
      mockPrismaService.whatsAppTemplate.count.mockResolvedValue(0);

      await service.listTemplates('org-1', { status: WhatsAppTemplateStatus.APPROVED });

      expect(mockPrismaService.whatsAppTemplate.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: WhatsAppTemplateStatus.APPROVED,
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by category', async () => {
      mockPrismaService.whatsAppTemplate.findMany.mockResolvedValue([]);
      mockPrismaService.whatsAppTemplate.count.mockResolvedValue(0);

      await service.listTemplates('org-1', { category: WhatsAppTemplateCategory.MARKETING });

      expect(mockPrismaService.whatsAppTemplate.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          category: WhatsAppTemplateCategory.MARKETING,
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle pagination', async () => {
      mockPrismaService.whatsAppTemplate.findMany.mockResolvedValue([]);
      mockPrismaService.whatsAppTemplate.count.mockResolvedValue(50);

      const result = await service.listTemplates('org-1', { page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(mockPrismaService.whatsAppTemplate.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('getTemplate', () => {
    it('should get template by ID', async () => {
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        name: 'welcome',
      });

      const result = await service.getTemplate('org-1', 'template-1');

      expect(result.id).toBe('template-1');
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue(null);

      await expect(service.getTemplate('org-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createTemplate', () => {
    it('should create template', async () => {
      mockPrismaService.whatsAppTemplate.findUnique.mockResolvedValue(null);
      mockPrismaService.whatsAppTemplate.create.mockResolvedValue({
        id: 'template-1',
        name: 'welcome',
        status: WhatsAppTemplateStatus.PENDING,
      });

      const result = await service.createTemplate('org-1', {
        name: 'welcome',
        category: WhatsAppTemplateCategory.MARKETING,
        componentsJson: { body: [{ type: 'text', text: 'Hello {{1}}' }] },
      });

      expect(result.id).toBe('template-1');
      expect(mockPrismaService.whatsAppTemplate.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if duplicate name+language', async () => {
      mockPrismaService.whatsAppTemplate.findUnique.mockResolvedValue({
        id: 'existing',
        deletedAt: null,
      });

      await expect(
        service.createTemplate('org-1', {
          name: 'welcome',
          language: 'es_AR',
          category: WhatsAppTemplateCategory.MARKETING,
          componentsJson: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTemplate', () => {
    it('should update template', async () => {
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        name: 'welcome',
        language: 'es_AR',
      });
      // When checking for duplicates, return null (no duplicate found)
      mockPrismaService.whatsAppTemplate.findUnique.mockResolvedValue(null);
      mockPrismaService.whatsAppTemplate.update.mockResolvedValue({
        id: 'template-1',
        name: 'welcome_updated',
      });

      const result = await service.updateTemplate('org-1', 'template-1', {
        name: 'welcome_updated',
      });

      expect(result.name).toBe('welcome_updated');
    });

    it('should throw NotFoundException if template not found', async () => {
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue(null);

      await expect(
        service.updateTemplate('org-1', 'non-existent', { name: 'new' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTemplate', () => {
    it('should soft delete template', async () => {
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
      });
      mockPrismaService.whatsAppTemplate.update.mockResolvedValue({
        id: 'template-1',
        deletedAt: new Date(),
        status: WhatsAppTemplateStatus.DISABLED,
      });

      const result = await service.deleteTemplate('org-1', 'template-1');

      expect(result.deletedAt).toBeDefined();
      expect(result.status).toBe(WhatsAppTemplateStatus.DISABLED);
    });
  });

  describe('sendTemplate', () => {
    it('should send template and create job', async () => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-123';

      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        name: 'welcome',
        status: WhatsAppTemplateStatus.APPROVED,
      });
      mockPrismaService.messageLog.create.mockResolvedValue({
        id: 'msg-log-1',
      });
      mockQueueService.enqueue.mockResolvedValue({
        id: 'job-1',
        status: 'PENDING',
      });

      const result = await service.sendTemplate(
        'org-1',
        '+1234567890',
        'template-1',
        { '1': 'John' },
      );

      expect(result.jobId).toBe('job-1');
      expect(mockPrismaService.messageLog.create).toHaveBeenCalled();
      const createCall = mockPrismaService.messageLog.create.mock.calls[0][0];
      expect(createCall.data.provider).toBe(IntegrationProvider.WHATSAPP);
      expect(createCall.data.direction).toBe(MessageDirection.OUTBOUND);
      expect(createCall.data.status).toBe(MessageStatus.QUEUED);
      expect(createCall.data.metaJson.templateId).toBe('template-1');
      expect(createCall.data.metaJson.variables).toEqual({ '1': 'John' });
      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.SEND_MESSAGE_TEMPLATE,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          templateId: 'template-1',
          toPhone: '+1234567890',
          variables: { '1': 'John' },
          organizationId: 'org-1',
        }),
        organizationId: 'org-1',
      });
    });

    it('should throw BadRequestException if template not approved', async () => {
      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        status: WhatsAppTemplateStatus.PENDING,
      });

      await expect(
        service.sendTemplate('org-1', '+1234567890', 'template-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include leadId in job payload if provided', async () => {
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-123';

      mockPrismaService.whatsAppTemplate.findFirst.mockResolvedValue({
        id: 'template-1',
        status: WhatsAppTemplateStatus.APPROVED,
      });
      mockPrismaService.messageLog.create.mockResolvedValue({ id: 'msg-log-1' });
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.sendTemplate('org-1', '+1234567890', 'template-1', {}, 'lead-123');

      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.SEND_MESSAGE_TEMPLATE,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          leadId: 'lead-123',
          organizationId: 'org-1',
        }),
        organizationId: 'org-1',
      });
    });
  });
});
