import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationQueueService } from './jobs/queue/integration-queue.service';
import { IntegrationProvider, IntegrationJobType, MessageDirection } from '@remember-me/prisma';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    connectedAccount: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
    },
    messageLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockQueueService = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
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

    service = module.get<IntegrationsService>(IntegrationsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('sendWhatsAppMessage', () => {
    it('should enqueue SEND_MESSAGE job', async () => {
      mockQueueService.enqueue.mockResolvedValue({
        id: 'job-1',
        status: 'PENDING',
      });

      const result = await service.sendWhatsAppMessage('org-1', '+1234567890', 'Hello');

      expect(result).toEqual({
        jobId: 'job-1',
        status: 'PENDING',
        message: 'Message queued for sending',
      });
      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: {
          toPhone: '+1234567890',
          text: 'Hello',
          leadId: undefined,
          organizationId: 'org-1',
        },
        organizationId: 'org-1',
      });
    });

    it('should include leadId in payload if provided', async () => {
      mockQueueService.enqueue.mockResolvedValue({ id: 'job-1', status: 'PENDING' });

      await service.sendWhatsAppMessage('org-1', '+1234567890', 'Hello', 'lead-123');

      expect(mockQueueService.enqueue).toHaveBeenCalledWith({
        jobType: IntegrationJobType.SEND_MESSAGE,
        provider: IntegrationProvider.WHATSAPP,
        payload: expect.objectContaining({
          leadId: 'lead-123',
          organizationId: 'org-1',
        }),
        organizationId: 'org-1',
      });
    });
  });

  describe('listMessages', () => {
    it('should list messages without leadId filter', async () => {
      mockPrismaService.messageLog.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          provider: IntegrationProvider.WHATSAPP,
          direction: MessageDirection.INBOUND,
          text: 'Hello',
        },
      ]);
      mockPrismaService.messageLog.count.mockResolvedValue(1);

      const result = await service.listMessages('org-1', undefined, 1, 20);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.messageLog.findMany).toHaveBeenCalledWith({
        where: { provider: IntegrationProvider.WHATSAPP },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter messages by lead phone when leadId provided', async () => {
      mockPrismaService.lead.findFirst.mockResolvedValue({
        id: 'lead-1',
        phone: '+1234567890',
      });
      mockPrismaService.messageLog.findMany.mockResolvedValue([]);
      mockPrismaService.messageLog.count.mockResolvedValue(0);

      await service.listMessages('org-1', 'lead-1', 1, 20);

      expect(mockPrismaService.messageLog.findMany).toHaveBeenCalledWith({
        where: {
          provider: IntegrationProvider.WHATSAPP,
          OR: [{ from: '+1234567890' }, { to: '+1234567890' }],
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should return empty if lead not found', async () => {
      mockPrismaService.lead.findFirst.mockResolvedValue(null);

      const result = await service.listMessages('org-1', 'lead-999', 1, 20);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle pagination', async () => {
      mockPrismaService.messageLog.findMany.mockResolvedValue([]);
      mockPrismaService.messageLog.count.mockResolvedValue(50);

      const result = await service.listMessages('org-1', undefined, 2, 20);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(mockPrismaService.messageLog.findMany).toHaveBeenCalledWith({
        where: { provider: IntegrationProvider.WHATSAPP },
        orderBy: { createdAt: 'desc' },
        skip: 20, // (2-1) * 20
        take: 20,
      });
    });
  });
});
