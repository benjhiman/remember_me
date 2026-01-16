import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppTemplatesController } from './whatsapp-templates.controller';
import { WhatsAppTemplatesService } from './whatsapp-templates.service';
import { WhatsAppTemplateStatus, WhatsAppTemplateCategory } from '@remember-me/prisma';

describe('WhatsAppTemplatesController', () => {
  let controller: WhatsAppTemplatesController;
  let service: WhatsAppTemplatesService;

  const mockTemplatesService = {
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    sendTemplate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppTemplatesController],
      providers: [
        {
          provide: WhatsAppTemplatesService,
          useValue: mockTemplatesService,
        },
      ],
    }).compile();

    controller = module.get<WhatsAppTemplatesController>(WhatsAppTemplatesController);
    service = module.get<WhatsAppTemplatesService>(WhatsAppTemplatesService);
    jest.clearAllMocks();
  });

  describe('listTemplates', () => {
    it('should list templates', async () => {
      mockTemplatesService.listTemplates.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const result = await controller.listTemplates('org-1', undefined, undefined, '1', '20');

      expect(result.data).toEqual([]);
      expect(mockTemplatesService.listTemplates).toHaveBeenCalledWith('org-1', {
        status: undefined,
        category: undefined,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('getTemplate', () => {
    it('should get template by ID', async () => {
      mockTemplatesService.getTemplate.mockResolvedValue({
        id: 'template-1',
        name: 'welcome',
      });

      const result = await controller.getTemplate('org-1', 'template-1');

      expect(result.id).toBe('template-1');
    });
  });

  describe('createTemplate', () => {
    it('should create template', async () => {
      mockTemplatesService.createTemplate.mockResolvedValue({
        id: 'template-1',
        name: 'welcome',
      });

      const result = await controller.createTemplate('org-1', {
        name: 'welcome',
        category: WhatsAppTemplateCategory.MARKETING,
        componentsJson: {},
      });

      expect(result.id).toBe('template-1');
    });
  });

  describe('updateTemplate', () => {
    it('should update template', async () => {
      mockTemplatesService.updateTemplate.mockResolvedValue({
        id: 'template-1',
        name: 'welcome_updated',
      });

      const result = await controller.updateTemplate('org-1', 'template-1', {
        name: 'welcome_updated',
      });

      expect(result.name).toBe('welcome_updated');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      mockTemplatesService.deleteTemplate.mockResolvedValue({
        id: 'template-1',
        deletedAt: new Date(),
      });

      const result = await controller.deleteTemplate('org-1', 'template-1');

      expect(result.deletedAt).toBeDefined();
    });
  });

  describe('sendTemplate', () => {
    it('should send template', async () => {
      mockTemplatesService.sendTemplate.mockResolvedValue({
        jobId: 'job-1',
        messageLogId: 'msg-log-1',
        status: 'QUEUED',
      });

      const result = await controller.sendTemplate('org-1', {
        toPhone: '+1234567890',
        templateId: 'template-1',
        variables: { '1': 'John' },
      });

      expect(result.jobId).toBe('job-1');
      expect(mockTemplatesService.sendTemplate).toHaveBeenCalledWith(
        'org-1',
        '+1234567890',
        'template-1',
        { '1': 'John' },
        undefined,
      );
    });
  });
});
