import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppAutomationsController } from './whatsapp-automations.controller';
import { WhatsAppAutomationsService } from './whatsapp-automations.service';
import { WhatsAppAutomationTrigger } from '@remember-me/prisma';

describe('WhatsAppAutomationsController', () => {
  let controller: WhatsAppAutomationsController;
  let service: WhatsAppAutomationsService;

  const mockAutomationsService = {
    listRules: jest.fn(),
    getRule: jest.fn(),
    createRule: jest.fn(),
    updateRule: jest.fn(),
    deleteRule: jest.fn(),
    runNow: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppAutomationsController],
      providers: [
        {
          provide: WhatsAppAutomationsService,
          useValue: mockAutomationsService,
        },
      ],
    }).compile();

    controller = module.get<WhatsAppAutomationsController>(WhatsAppAutomationsController);
    service = module.get<WhatsAppAutomationsService>(WhatsAppAutomationsService);
    jest.clearAllMocks();
  });

  describe('listRules', () => {
    it('should list rules', async () => {
      mockAutomationsService.listRules.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const result = await controller.listRules('org-1', undefined, undefined, '1', '20');

      expect(result.data).toEqual([]);
    });
  });

  describe('getRule', () => {
    it('should get rule by ID', async () => {
      mockAutomationsService.getRule.mockResolvedValue({
        id: 'rule-1',
        name: 'Welcome Follow-up',
      });

      const result = await controller.getRule('org-1', 'rule-1');

      expect(result.id).toBe('rule-1');
    });
  });

  describe('createRule', () => {
    it('should create rule', async () => {
      mockAutomationsService.createRule.mockResolvedValue({
        id: 'rule-1',
        name: 'Welcome Follow-up',
      });

      const result = await controller.createRule('org-1', {
        name: 'Welcome Follow-up',
        trigger: WhatsAppAutomationTrigger.LEAD_CREATED,
        action: 'SEND_TEMPLATE',
        payloadJson: {},
      });

      expect(result.id).toBe('rule-1');
    });
  });

  describe('updateRule', () => {
    it('should update rule', async () => {
      mockAutomationsService.updateRule.mockResolvedValue({
        id: 'rule-1',
        enabled: false,
      });

      const result = await controller.updateRule('org-1', 'rule-1', { enabled: false });

      expect(result.enabled).toBe(false);
    });
  });

  describe('deleteRule', () => {
    it('should delete rule', async () => {
      mockAutomationsService.deleteRule.mockResolvedValue({
        id: 'rule-1',
        deletedAt: new Date(),
      });

      const result = await controller.deleteRule('org-1', 'rule-1');

      expect(result.deletedAt).toBeDefined();
    });
  });

  describe('runNow', () => {
    it('should run automation immediately', async () => {
      mockAutomationsService.runNow.mockResolvedValue({
        jobId: 'job-1',
        message: 'Automation job created',
      });

      const result = await controller.runNow('org-1', {
        ruleId: 'rule-1',
        phone: '+1234567890',
      });

      expect(result.jobId).toBe('job-1');
    });
  });
});
