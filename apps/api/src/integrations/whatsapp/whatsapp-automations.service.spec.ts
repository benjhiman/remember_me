import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppAutomationsService } from './whatsapp-automations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import {
  WhatsAppAutomationTrigger,
  WhatsAppAutomationAction,
  IntegrationProvider,
  IntegrationJobType,
} from '@remember-me/prisma';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WhatsAppAutomationsService', () => {
  let service: WhatsAppAutomationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    whatsAppAutomationRule: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    messageLog: {
      findFirst: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
    },
    sale: {
      findFirst: jest.fn(),
    },
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppAutomationsService,
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

    service = module.get<WhatsAppAutomationsService>(WhatsAppAutomationsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('listRules', () => {
    it('should list automation rules', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'Welcome Follow-up',
          trigger: WhatsAppAutomationTrigger.LEAD_CREATED,
        },
      ]);
      mockPrismaService.whatsAppAutomationRule.count.mockResolvedValue(1);

      const result = await service.listRules('org-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by trigger', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([]);
      mockPrismaService.whatsAppAutomationRule.count.mockResolvedValue(0);

      await service.listRules('org-1', { trigger: WhatsAppAutomationTrigger.LEAD_CREATED });

      expect(mockPrismaService.whatsAppAutomationRule.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          trigger: WhatsAppAutomationTrigger.LEAD_CREATED,
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by enabled status', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([]);
      mockPrismaService.whatsAppAutomationRule.count.mockResolvedValue(0);

      await service.listRules('org-1', { enabled: true });

      expect(mockPrismaService.whatsAppAutomationRule.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          enabled: true,
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('getRule', () => {
    it('should get rule by ID', async () => {
      mockPrismaService.whatsAppAutomationRule.findFirst.mockResolvedValue({
        id: 'rule-1',
        name: 'Welcome Follow-up',
      });

      const result = await service.getRule('org-1', 'rule-1');

      expect(result.id).toBe('rule-1');
    });

    it('should throw NotFoundException if rule not found', async () => {
      mockPrismaService.whatsAppAutomationRule.findFirst.mockResolvedValue(null);

      await expect(service.getRule('org-1', 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRule', () => {
    it('should create automation rule', async () => {
      mockPrismaService.whatsAppAutomationRule.create.mockResolvedValue({
        id: 'rule-1',
        name: 'Welcome Follow-up',
        enabled: true,
        cooldownHours: 24,
      });

      const result = await service.createRule('org-1', {
        name: 'Welcome Follow-up',
        trigger: WhatsAppAutomationTrigger.LEAD_CREATED,
        action: WhatsAppAutomationAction.SEND_TEMPLATE,
        payloadJson: { templateId: 'template-1', variables: {} },
      });

      expect(result.id).toBe('rule-1');
      expect(mockPrismaService.whatsAppAutomationRule.create).toHaveBeenCalled();
    });
  });

  describe('updateRule', () => {
    it('should update rule', async () => {
      mockPrismaService.whatsAppAutomationRule.findFirst.mockResolvedValue({
        id: 'rule-1',
      });
      mockPrismaService.whatsAppAutomationRule.update.mockResolvedValue({
        id: 'rule-1',
        enabled: false,
      });

      const result = await service.updateRule('org-1', 'rule-1', { enabled: false });

      expect(result.enabled).toBe(false);
    });
  });

  describe('deleteRule', () => {
    it('should soft delete rule', async () => {
      mockPrismaService.whatsAppAutomationRule.findFirst.mockResolvedValue({
        id: 'rule-1',
      });
      mockPrismaService.whatsAppAutomationRule.update.mockResolvedValue({
        id: 'rule-1',
        deletedAt: new Date(),
        enabled: false,
      });

      const result = await service.deleteRule('org-1', 'rule-1');

      expect(result.deletedAt).toBeDefined();
      expect(result.enabled).toBe(false);
    });
  });

  describe('processTrigger', () => {
    it('should create job with future runAt when trigger fires', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          trigger: WhatsAppAutomationTrigger.LEAD_CREATED,
          action: WhatsAppAutomationAction.SEND_TEMPLATE,
          payloadJson: { templateId: 'template-1', variables: {} },
          cooldownHours: 24,
        },
      ]);
      mockPrismaService.lead.findFirst.mockResolvedValue({
        id: 'lead-1',
        phone: '+1234567890',
      });
      mockPrismaService.messageLog.findFirst.mockResolvedValue(null); // No cooldown
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.processTrigger('org-1', WhatsAppAutomationTrigger.LEAD_CREATED, {
        leadId: 'lead-1',
      });

      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.AUTOMATION_ACTION,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          ruleId: 'rule-1',
          phone: '+1234567890',
        }),
        runAt: expect.any(Date), // runAt in the future
        organizationId: 'org-1',
        dedupeKey: expect.any(String),
      });
    });

    it('should skip if cooldown active', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          cooldownHours: 24,
        },
      ]);
      mockPrismaService.lead.findFirst.mockResolvedValue({
        phone: '+1234567890',
      });
      mockPrismaService.messageLog.findFirst.mockResolvedValue({
        id: 'recent-msg',
        createdAt: new Date(), // Recent message
      });

      await service.processTrigger('org-1', WhatsAppAutomationTrigger.LEAD_CREATED, {
        leadId: 'lead-1',
      });

      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('should skip if rule disabled', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          enabled: false, // Disabled
        },
      ]);

      await service.processTrigger('org-1', WhatsAppAutomationTrigger.LEAD_CREATED, {
        leadId: 'lead-1',
      });

      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('should skip if no phone available', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
        },
      ]);
      mockPrismaService.lead.findFirst.mockResolvedValue({
        phone: null, // No phone
      });

      await service.processTrigger('org-1', WhatsAppAutomationTrigger.LEAD_CREATED, {
        leadId: 'lead-1',
      });

      expect(mockQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('should handle SALE_RESERVED trigger', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          trigger: WhatsAppAutomationTrigger.SALE_RESERVED,
          cooldownHours: 2,
        },
      ]);
      mockPrismaService.sale.findFirst.mockResolvedValue({
        customerPhone: '+1234567890',
      });
      mockPrismaService.messageLog.findFirst.mockResolvedValue(null);
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.processTrigger('org-1', WhatsAppAutomationTrigger.SALE_RESERVED, {
        saleId: 'sale-1',
      });

      expect(mockQueueService.enqueue).toHaveBeenCalled();
    });

    it('should use custom delayHours if provided', async () => {
      mockPrismaService.whatsAppAutomationRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          cooldownHours: 24,
        },
      ]);
      mockPrismaService.lead.findFirst.mockResolvedValue({
        phone: '+1234567890',
      });
      mockPrismaService.messageLog.findFirst.mockResolvedValue(null);
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      await service.processTrigger('org-1', WhatsAppAutomationTrigger.LEAD_CREATED, {
        leadId: 'lead-1',
        delayHours: 2, // Custom delay
      });

      const enqueueCall = mockQueueService.enqueue.mock.calls[0];
      const enqueueParams = enqueueCall[0];
      const runAt = enqueueParams.runAt as Date;
      const now = new Date();
      const expectedDelay = 2 * 60 * 60 * 1000; // 2 hours in ms
      const actualDelay = runAt.getTime() - now.getTime();

      // Allow 1 second tolerance
      expect(Math.abs(actualDelay - expectedDelay)).toBeLessThan(1000);
    });
  });

  describe('runNow', () => {
    it('should create job to run immediately', async () => {
      mockPrismaService.whatsAppAutomationRule.findFirst.mockResolvedValue({
        id: 'rule-1',
        enabled: true,
        cooldownHours: 24,
      });
      mockPrismaService.messageLog.findFirst.mockResolvedValue(null);
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1' });

      const result = await service.runNow('org-1', 'rule-1', {
        phone: '+1234567890',
      });

      expect(result.jobId).toBe('job-1');
      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.AUTOMATION_ACTION,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.any(Object),
        runAt: expect.any(Date), // runAt = now
        organizationId: 'org-1',
        dedupeKey: expect.any(String),
      });
    });

    it('should throw BadRequestException if rule disabled', async () => {
      mockPrismaService.whatsAppAutomationRule.findFirst.mockResolvedValue({
        id: 'rule-1',
        enabled: false,
      });

      await expect(
        service.runNow('org-1', 'rule-1', { phone: '+1234567890' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cooldown active', async () => {
      mockPrismaService.whatsAppAutomationRule.findFirst.mockResolvedValue({
        id: 'rule-1',
        enabled: true,
        cooldownHours: 24,
      });
      mockPrismaService.messageLog.findFirst.mockResolvedValue({
        id: 'recent-msg',
        createdAt: new Date(),
      });

      await expect(
        service.runNow('org-1', 'rule-1', { phone: '+1234567890' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
