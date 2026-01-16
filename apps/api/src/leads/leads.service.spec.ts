import { Test, TestingModule } from '@nestjs/testing';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Role, LeadStatus } from '@remember-me/prisma';
import { AuditLogService } from '../common/audit/audit-log.service';
import { createMockAuditLogService } from '../common/testing/mock-audit-log.service';
import { createMockAuditLogServiceOpenMode, createMockAuditLogServiceClosedMode } from '../common/testing/audit-fail-mode-tests.helper';
import { WhatsAppAutomationsService } from '../integrations/whatsapp/whatsapp-automations.service';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    membership: {
      findFirst: jest.fn(),
    },
    pipeline: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    stage: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    lead: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    note: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: createMockAuditLogService(),
        },
        {
          provide: 'REQUEST',
          useValue: {
            requestId: 'test-request-id',
            method: 'GET',
            path: '/test',
            ip: '127.0.0.1',
            get: jest.fn(),
          },
        },
        {
          provide: WhatsAppAutomationsService,
          useValue: {
            processTrigger: jest.fn(),
          },
        },
      ],
    }).compile();

    service = await module.resolve<LeadsService>(LeadsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getPipelines', () => {
    it('should return pipelines for organization', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pipeline.findMany.mockResolvedValue([
        {
          id: 'pipeline-1',
          organizationId: orgId,
          name: 'Test Pipeline',
          stages: [],
        },
      ]);

      const result = await service.getPipelines(orgId, userId);

      expect(result).toBeDefined();
      expect(mockPrismaService.membership.findFirst).toHaveBeenCalledWith({
        where: { organizationId: orgId, userId },
      });
      expect(mockPrismaService.pipeline.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId, deletedAt: null },
        include: expect.any(Object),
        orderBy: { order: 'asc' },
      });
    });

    it('should throw NotFoundException if user is not member', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue(null);

      await expect(service.getPipelines('org-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPipeline', () => {
    it('should create pipeline for admin', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);
      mockPrismaService.pipeline.create.mockResolvedValue({
        id: 'pipeline-1',
        organizationId: orgId,
        name: 'New Pipeline',
        stages: [],
      });

      const result = await service.createPipeline(orgId, userId, {
        name: 'New Pipeline',
        color: '#ff0000',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.pipeline.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for SELLER role', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      await expect(
        service.createPipeline('org-1', 'user-1', { name: 'Pipeline' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createStage', () => {
    it('should create stage for admin', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const pipelineId = 'pipeline-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pipeline.findFirst.mockResolvedValue({
        id: pipelineId,
        organizationId: orgId,
      });

      mockPrismaService.stage.findFirst
        .mockResolvedValueOnce(null) // No duplicate
        .mockResolvedValueOnce(null); // Max order

      mockPrismaService.stage.create.mockResolvedValue({
        id: 'stage-1',
        pipelineId,
        name: 'New Stage',
      });

      const result = await service.createStage(orgId, userId, {
        pipelineId,
        name: 'New Stage',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.stage.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if stage name duplicates', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pipeline.findFirst.mockResolvedValue({
        id: 'pipeline-1',
        organizationId: 'org-1',
      });

      // Check for duplicate (returns existing stage)
      mockPrismaService.stage.findFirst.mockResolvedValueOnce({
        id: 'stage-existing',
        name: 'Existing Stage',
        pipelineId: 'pipeline-1',
      });

      await expect(
        service.createStage('org-1', 'user-1', {
          pipelineId: 'pipeline-1',
          name: 'Existing Stage',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reorderStages', () => {
    it('should reorder stages successfully', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stage.findMany.mockResolvedValue([
        {
          id: 'stage-1',
          pipelineId: 'pipeline-1',
          pipeline: { organizationId: orgId },
        },
        {
          id: 'stage-2',
          pipelineId: 'pipeline-1',
          pipeline: { organizationId: orgId },
        },
      ]);

      mockPrismaService.stage.update.mockResolvedValue({});
      
      // $transaction with array returns array of results
      mockPrismaService.$transaction.mockResolvedValue([
        { id: 'stage-1', order: 0 },
        { id: 'stage-2', order: 1 },
      ]);

      const result = await service.reorderStages(orgId, userId, {
        stages: [
          { stageId: 'stage-1', order: 0 },
          { stageId: 'stage-2', order: 1 },
        ],
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if duplicate orders in same pipeline', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stage.findMany.mockResolvedValue([
        {
          id: 'stage-1',
          pipelineId: 'pipeline-1',
          pipeline: { organizationId: 'org-1' },
        },
        {
          id: 'stage-2',
          pipelineId: 'pipeline-1',
          pipeline: { organizationId: 'org-1' },
        },
      ]);

      await expect(
        service.reorderStages('org-1', 'user-1', {
          stages: [
            { stageId: 'stage-1', order: 0 },
            { stageId: 'stage-2', order: 0 }, // Duplicate order
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createLead', () => {
    it('should create lead successfully', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const pipelineId = 'pipeline-1';
      const stageId = 'stage-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pipeline.findFirst.mockResolvedValue({
        id: pipelineId,
        organizationId: orgId,
      });

      mockPrismaService.stage.findFirst.mockResolvedValue({
        id: stageId,
        pipelineId,
      });

      mockPrismaService.lead.create.mockResolvedValue({
        id: 'lead-1',
        organizationId: orgId,
        name: 'Test Lead',
      });

      const result = await service.createLead(orgId, userId, {
        pipelineId,
        stageId,
        name: 'Test Lead',
        email: 'test@example.com',
        phone: '+1234567890',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.lead.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if pipeline not found', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);

      await expect(
        service.createLead('org-1', 'user-1', {
          pipelineId: 'invalid',
          stageId: 'stage-1',
          name: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listLeads', () => {
    it('should list leads with pagination', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.findMany.mockResolvedValue([
        {
          id: 'lead-1',
          name: 'Test Lead',
          organizationId: orgId,
        },
      ]);

      mockPrismaService.lead.count.mockResolvedValue(1);

      const result = await service.listLeads(orgId, userId, { page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.total).toBe(1);
    });

    it('should filter leads for SELLER role', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.lead.count.mockResolvedValue(0);

      await service.listLeads(orgId, userId, { page: 1, limit: 10 });

      expect(mockPrismaService.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { assignedToId: userId },
              { createdById: userId },
            ]),
          }),
        }),
      );
    });

    it('should apply date range filters', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.lead.count.mockResolvedValue(0);

      await service.listLeads(orgId, userId, {
        page: 1,
        limit: 10,
        createdFrom: '2024-01-01',
        createdTo: '2024-12-31',
      });

      expect(mockPrismaService.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  describe('getLead', () => {
    it('should return lead by id', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const leadId = 'lead-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.findFirst.mockResolvedValue({
        id: leadId,
        organizationId: orgId,
        assignedToId: null,
        createdById: userId,
      });

      const result = await service.getLead(orgId, userId, leadId);

      expect(result).toBeDefined();
      expect(result.id).toBe(leadId);
    });

    it('should throw ForbiddenException if SELLER tries to access unassigned lead', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.lead.findFirst.mockResolvedValue({
        id: 'lead-1',
        organizationId: 'org-1',
        assignedToId: 'other-user',
        createdById: 'other-user',
      });

      await expect(service.getLead('org-1', 'user-1', 'lead-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('createNote', () => {
    it('should create note for lead', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const leadId = 'lead-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.findFirst.mockResolvedValue({
        id: leadId,
        organizationId: orgId,
        assignedToId: null,
        createdById: userId,
      });

      mockPrismaService.note.create.mockResolvedValue({
        id: 'note-1',
        content: 'Test note',
        leadId,
        userId,
      });

      const result = await service.createNote(orgId, userId, {
        leadId,
        content: 'Test note',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.note.create).toHaveBeenCalled();
    });
  });

  describe('createTask', () => {
    it('should create task for lead', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const leadId = 'lead-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.findFirst.mockResolvedValue({
        id: leadId,
        organizationId: orgId,
        assignedToId: null,
        createdById: userId,
      });

      mockPrismaService.membership.findFirst.mockResolvedValueOnce({
        role: Role.ADMIN,
      }).mockResolvedValueOnce({
        role: Role.ADMIN,
      });

      mockPrismaService.task.create.mockResolvedValue({
        id: 'task-1',
        title: 'Test Task',
        leadId,
      });

      const result = await service.createTask(orgId, userId, {
        leadId,
        title: 'Test Task',
        assignedToId: userId,
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.task.create).toHaveBeenCalled();
    });
  });

  describe('Multi-org isolation', () => {
    it('should not return leads from other organizations', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.lead.count.mockResolvedValue(0);

      await service.listLeads(orgId, userId, { page: 1, limit: 10 });

      expect(mockPrismaService.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
          }),
        }),
      );
    });
  });

  describe('AUDIT_FAIL_MODE behavior', () => {
    it('should continue operation when AUDIT_FAIL_MODE=OPEN and audit log fails', async () => {
      process.env.AUDIT_FAIL_MODE = 'OPEN';
      
      const mockAuditLogService = createMockAuditLogServiceOpenMode();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LeadsService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: AuditLogService,
            useValue: mockAuditLogService,
          },
          {
            provide: 'REQUEST',
            useValue: {
              requestId: 'req-123',
              method: 'POST',
              path: '/api/leads',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
          {
            provide: WhatsAppAutomationsService,
            useValue: {
              processTrigger: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = await module.resolve<LeadsService>(LeadsService);

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1', organizationId: 'org-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1', order: 0 });
      mockPrismaService.lead.create.mockResolvedValue({
        id: 'lead-1',
        organizationId: 'org-1',
        name: 'Test Lead',
      });

      // Operation should succeed despite audit failure
      const result = await testService.createLead('org-1', 'user-1', {
        name: 'Test Lead',
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.lead.create).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should abort operation when AUDIT_FAIL_MODE=CLOSED and audit log fails', async () => {
      process.env.AUDIT_FAIL_MODE = 'CLOSED';
      
      const mockAuditLogService = createMockAuditLogServiceClosedMode();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LeadsService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: AuditLogService,
            useValue: mockAuditLogService,
          },
          {
            provide: 'REQUEST',
            useValue: {
              requestId: 'req-123',
              method: 'POST',
              path: '/api/leads',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
          {
            provide: WhatsAppAutomationsService,
            useValue: {
              processTrigger: jest.fn(),
            },
          },
        ],
      }).compile();

      const testService = await module.resolve<LeadsService>(LeadsService);

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1', organizationId: 'org-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1', order: 0 });
      mockPrismaService.lead.create.mockResolvedValue({
        id: 'lead-1',
        organizationId: 'org-1',
        name: 'Test Lead',
      });

      // Operation should fail when audit fails in CLOSED mode
      await expect(
        testService.createLead('org-1', 'user-1', {
          name: 'Test Lead',
          pipelineId: 'pipeline-1',
          stageId: 'stage-1',
        }),
      ).rejects.toThrow();

      // Note: In real implementation, this would throw InternalServerErrorException with errorCode AUDIT_LOG_FAILED
      // But since we're mocking, we need to verify the service actually calls audit and it throws
    });
  });

});
