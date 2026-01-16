import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Scope,
  forwardRef,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { Role, LeadStatus, AuditAction, AuditEntityType, WhatsAppAutomationTrigger } from '@remember-me/prisma';
import { WhatsAppAutomationsService } from '../integrations/whatsapp/whatsapp-automations.service';

@Injectable({ scope: Scope.REQUEST })
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
    @Inject(forwardRef(() => WhatsAppAutomationsService))
    private automationsService?: WhatsAppAutomationsService,
  ) {}

  // Helper: Verify user membership and get role
  private async verifyMembership(
    organizationId: string,
    userId: string,
  ): Promise<{ role: Role }> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    return { role: membership.role };
  }

  // Helper: Check if user has admin/manager access
  private hasAdminManagerAccess(role: Role): boolean {
    return role === Role.ADMIN || role === Role.MANAGER || role === Role.OWNER;
  }

  // Helper: Check if user can access lead (admin/manager or assigned/creator)
  private canAccessLead(role: Role, leadAssignedToId: string | null, leadCreatedById: string, userId: string): boolean {
    if (this.hasAdminManagerAccess(role)) {
      return true;
    }
    // SELLER can only access if assigned to them or created by them
    return leadAssignedToId === userId || leadCreatedById === userId;
  }

  // Helper: Get request metadata for audit log
  private getRequestMetadata(): { requestId: string | null; method: string; path: string; ip: string; userAgent: string } {
    const requestId = (this.request as any).requestId || null;
    const method = this.request.method || 'UNKNOWN';
    const path = this.request.path || this.request.url || 'UNKNOWN';
    const ip = this.request.ip || (this.request.socket?.remoteAddress) || 'UNKNOWN';
    const userAgent = this.request.get('user-agent') || '';
    return { requestId, method, path, ip, userAgent };
  }

  // Pipelines
  async getPipelines(organizationId: string, userId: string) {
    await this.verifyMembership(organizationId, userId);

    return this.prisma.pipeline.findMany({
      where: {
        organizationId,
        deletedAt: null, // Exclude soft-deleted pipelines
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { leads: true },
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async createPipeline(organizationId: string, userId: string, dto: CreatePipelineDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create pipelines');
    }

    // Get max order
    const maxOrderPipeline = await this.prisma.pipeline.findFirst({
      where: { organizationId },
      orderBy: { order: 'desc' },
    });

    const order = maxOrderPipeline ? maxOrderPipeline.order + 1 : 0;

    return this.prisma.pipeline.create({
      data: {
        organizationId,
        name: dto.name,
        color: dto.color || '#6366f1',
        order,
      },
      include: {
        stages: true,
      },
    });
  }

  // Stages
  async createStage(organizationId: string, userId: string, dto: CreateStageDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create stages');
    }

    // Verify pipeline belongs to organization
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id: dto.pipelineId,
        organizationId,
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    // Check for duplicate stage name in the same pipeline
    const existingStage = await this.prisma.stage.findFirst({
      where: {
        pipelineId: dto.pipelineId,
        name: dto.name,
      },
    });

    if (existingStage) {
      throw new BadRequestException(`Stage with name "${dto.name}" already exists in this pipeline`);
    }

    // Get max order for stages in this pipeline
    const maxOrderStage = await this.prisma.stage.findFirst({
      where: { pipelineId: dto.pipelineId },
      orderBy: { order: 'desc' },
    });

    const order = maxOrderStage ? maxOrderStage.order + 1 : 0;

    return this.prisma.stage.create({
      data: {
        pipelineId: dto.pipelineId,
        name: dto.name,
        color: dto.color || '#94a3b8',
        order,
      },
    });
  }

  async reorderStages(organizationId: string, userId: string, dto: ReorderStagesDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can reorder stages');
    }

    if (!dto.stages || dto.stages.length === 0) {
      throw new BadRequestException('Stages array cannot be empty');
    }

    // Verify all stages belong to pipelines in this organization
    const stageIds = dto.stages.map((s) => s.stageId);
    const stages = await this.prisma.stage.findMany({
      where: {
        id: { in: stageIds },
      },
      include: {
        pipeline: true,
      },
    });

    if (stages.length !== stageIds.length) {
      throw new NotFoundException('One or more stages not found');
    }

    for (const stage of stages) {
      if (stage.pipeline.organizationId !== organizationId) {
        throw new ForbiddenException(`Stage ${stage.id} does not belong to this organization`);
      }
    }

    // Validate that orders are unique within each pipeline
    const pipelineGroups = new Map<string, Set<number>>();
    for (const stage of stages) {
      if (!pipelineGroups.has(stage.pipelineId)) {
        pipelineGroups.set(stage.pipelineId, new Set());
      }
      const order = dto.stages.find((s) => s.stageId === stage.id)?.order;
      if (order !== undefined) {
        const orders = pipelineGroups.get(stage.pipelineId)!;
        if (orders.has(order)) {
          throw new BadRequestException(`Duplicate order ${order} in pipeline ${stage.pipelineId}`);
        }
        orders.add(order);
      }
    }

    // Update all stages in transaction
    return this.prisma.$transaction(
      dto.stages.map((s) =>
        this.prisma.stage.update({
          where: { id: s.stageId },
          data: { order: s.order },
        }),
      ),
    );
  }

  // Leads
  async listLeads(organizationId: string, userId: string, dto: ListLeadsDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const page = dto.page || 1;
    const limit = dto.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
    };

    // Soft delete: exclude deletedAt by default, unless includeDeleted is true and user has admin access
    if (!dto.includeDeleted || !this.hasAdminManagerAccess(role)) {
      where.deletedAt = null;
    }

    if (dto.pipelineId) {
      where.pipelineId = dto.pipelineId;
    }

    if (dto.stageId) {
      where.stageId = dto.stageId;
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.assignedToId) {
      where.assignedToId = dto.assignedToId;
    }

    // Date range filters
    if (dto.createdFrom || dto.createdTo) {
      where.createdAt = {};
      if (dto.createdFrom) {
        where.createdAt.gte = new Date(dto.createdFrom);
      }
      if (dto.createdTo) {
        where.createdAt.lte = new Date(dto.createdTo);
      }
    }

    // Search conditions (support both 'q' and 'search')
    const searchTerm = dto.q || dto.search;
    const searchConditions: any[] = [];
    if (searchTerm) {
      searchConditions.push(
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      );
    }

    // SELLER can only see their own assigned leads or leads they created
    const sellerFilter = !this.hasAdminManagerAccess(role)
      ? [
          { assignedToId: userId },
          { createdById: userId },
        ]
      : [];

    // Combine filters with AND/OR logic
    if (sellerFilter.length > 0 && searchConditions.length > 0) {
      where.AND = [
        { OR: sellerFilter },
        { OR: searchConditions },
      ];
    } else if (sellerFilter.length > 0) {
      where.OR = sellerFilter;
    } else if (searchConditions.length > 0) {
      where.OR = searchConditions;
    }

    // Sort logic
    let orderBy: any = { createdAt: 'desc' };
    if (dto.sort) {
      const sortLower = dto.sort.toLowerCase();
      if (sortLower.includes('createdat')) {
        orderBy = { createdAt: sortLower.includes('asc') ? 'asc' : 'desc' };
      } else if (sortLower.includes('updatedat')) {
        orderBy = { updatedAt: sortLower.includes('asc') ? 'asc' : 'desc' };
      }
    }

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          pipeline: true,
          stage: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              notes: true,
              tasks: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLead(organizationId: string, userId: string, leadId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted leads
      },
      include: {
        pipeline: true,
        stage: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!this.canAccessLead(role, lead.assignedToId, lead.createdById, userId)) {
      throw new ForbiddenException('You do not have access to this lead');
    }

    return lead;
  }

  async createLead(organizationId: string, userId: string, dto: CreateLeadDto) {
    await this.verifyMembership(organizationId, userId);

    // Verify pipeline and stage belong to organization
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        id: dto.pipelineId,
        organizationId,
      },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    const stage = await this.prisma.stage.findFirst({
      where: {
        id: dto.stageId,
        pipelineId: dto.pipelineId,
      },
    });

    if (!stage) {
      throw new NotFoundException('Stage not found or does not belong to pipeline');
    }

    // If assignedToId is provided, verify user is member of organization
    if (dto.assignedToId) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: dto.assignedToId,
          organizationId,
        },
      });

      if (!membership) {
        throw new BadRequestException('Assigned user is not a member of this organization');
      }
    }

    const created = await this.prisma.lead.create({
      data: {
        organizationId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        city: dto.city,
        budget: dto.budget,
        model: dto.model,
        customFields: dto.customFields,
        tags: dto.tags || [],
        assignedToId: dto.assignedToId,
        createdById: userId,
      },
      include: {
        pipeline: true,
        stage: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.Lead,
      entityId: created.id,
      before: null,
      after: {
        id: created.id,
        name: created.name,
        email: created.email,
        pipelineId: created.pipelineId,
        stageId: created.stageId,
        assignedToId: created.assignedToId,
        status: created.status,
      },
      metadata: {
        method: metadata.method,
        path: metadata.path,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        userId,
        orgId: organizationId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
      },
    });

    // Trigger automation: LEAD_CREATED
    if (this.automationsService && created.phone) {
      try {
        await this.automationsService.processTrigger(
          organizationId,
          WhatsAppAutomationTrigger.LEAD_CREATED,
          {
            leadId: created.id,
            phone: created.phone,
            delayHours: 2, // Default delay for welcome messages
          },
        );
      } catch (error) {
        // Log error but don't fail lead creation
        console.error('Failed to trigger LEAD_CREATED automation:', error);
      }
    }

    return created;
  }

  async updateLead(organizationId: string, userId: string, leadId: string, dto: UpdateLeadDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted leads
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.deletedAt) {
      throw new BadRequestException('Cannot update a deleted lead');
    }

    if (!this.canAccessLead(role, lead.assignedToId, lead.createdById, userId)) {
      throw new ForbiddenException('You do not have access to update this lead');
    }

    // Verify pipeline and stage if provided
    if (dto.pipelineId) {
      const pipeline = await this.prisma.pipeline.findFirst({
        where: {
          id: dto.pipelineId,
          organizationId,
        },
      });

      if (!pipeline) {
        throw new NotFoundException('Pipeline not found');
      }
    }

    if (dto.stageId) {
      const pipelineId = dto.pipelineId || lead.pipelineId;
      const stage = await this.prisma.stage.findFirst({
        where: {
          id: dto.stageId,
          pipelineId,
        },
      });

      if (!stage) {
        throw new NotFoundException('Stage not found or does not belong to pipeline');
      }
    }

    // Verify assigned user if provided
    if (dto.assignedToId) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: dto.assignedToId,
          organizationId,
        },
      });

      if (!membership) {
        throw new BadRequestException('Assigned user is not a member of this organization');
      }
    }

    const updateData: any = {};

    if (dto.pipelineId !== undefined) updateData.pipelineId = dto.pipelineId;
    if (dto.stageId !== undefined) updateData.stageId = dto.stageId;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.budget !== undefined) updateData.budget = dto.budget;
    if (dto.model !== undefined) updateData.model = dto.model;
    if (dto.customFields !== undefined) updateData.customFields = dto.customFields;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.assignedToId !== undefined) updateData.assignedToId = dto.assignedToId;
    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === LeadStatus.CONVERTED) {
        updateData.convertedAt = new Date();
      }
    }

    // Capture BEFORE
    const before = {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      pipelineId: lead.pipelineId,
      stageId: lead.stageId,
      assignedToId: lead.assignedToId,
      status: lead.status,
    };

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: updateData,
      include: {
        pipeline: true,
        stage: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Lead,
      entityId: updated.id,
      before,
      after: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        pipelineId: updated.pipelineId,
        stageId: updated.stageId,
        assignedToId: updated.assignedToId,
        status: updated.status,
      },
      metadata: {
        method: metadata.method,
        path: metadata.path,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        userId,
        orgId: organizationId,
        updatedFields: Object.keys(updateData),
      },
    });

    return updated;
  }

  async deleteLead(organizationId: string, userId: string, leadId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can delete leads');
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
        deletedAt: null, // Only delete if not already deleted
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Capture BEFORE
    const before = {
      id: lead.id,
      name: lead.name,
      deletedAt: lead.deletedAt,
    };

    // Soft delete: set deletedAt instead of actual delete
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { deletedAt: new Date() },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.Lead,
      entityId: leadId,
      before,
      after: {
        id: lead.id,
        name: lead.name,
        deletedAt: new Date().toISOString(),
      },
      metadata: {
        method: metadata.method,
        path: metadata.path,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        userId,
        orgId: organizationId,
      },
    });

    return { message: 'Lead deleted successfully' };
  }

  async restoreLead(organizationId: string, userId: string, leadId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can restore leads');
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
        deletedAt: { not: null }, // Only restore if deleted
      },
    });

    if (!lead) {
      throw new NotFoundException('Deleted lead not found');
    }

    // Capture BEFORE
    const before = {
      id: lead.id,
      name: lead.name,
      deletedAt: lead.deletedAt,
    };

    const restored = await this.prisma.lead.update({
      where: { id: leadId },
      data: { deletedAt: null },
      include: {
        pipeline: true,
        stage: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.RESTORE,
      entityType: AuditEntityType.Lead,
      entityId: leadId,
      before,
      after: {
        id: restored.id,
        name: restored.name,
        deletedAt: null,
      },
      metadata: {
        method: metadata.method,
        path: metadata.path,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        userId,
        orgId: organizationId,
      },
    });

    return restored;
  }

  async assignLead(organizationId: string, userId: string, leadId: string, dto: AssignLeadDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted leads
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.deletedAt) {
      throw new BadRequestException('Cannot assign a deleted lead');
    }

    // Only admin/manager or current assignee/creator can reassign
    if (!this.hasAdminManagerAccess(role) && lead.assignedToId !== userId && lead.createdById !== userId) {
      throw new ForbiddenException('You do not have permission to assign this lead');
    }

    // Verify assigned user if provided
    if (dto.assignedToId) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: dto.assignedToId,
          organizationId,
        },
      });

      if (!membership) {
        throw new BadRequestException('Assigned user is not a member of this organization');
      }
    }

    // Capture BEFORE
    const before = {
      id: lead.id,
      assignedToId: lead.assignedToId,
    };

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedToId: dto.assignedToId || null,
      },
      include: {
        pipeline: true,
        stage: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.ASSIGN,
      entityType: AuditEntityType.Lead,
      entityId: leadId,
      before,
      after: {
        id: updated.id,
        assignedToId: updated.assignedToId,
      },
      metadata: {
        method: metadata.method,
        path: metadata.path,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        userId,
        orgId: organizationId,
        newAssignedToId: dto.assignedToId || null,
      },
    });

    return updated;
  }

  // Notes
  async getLeadNotes(organizationId: string, userId: string, leadId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!this.canAccessLead(role, lead.assignedToId, lead.createdById, userId)) {
      throw new ForbiddenException('You do not have access to this lead');
    }

    const notes = await this.prisma.note.findMany({
      where: {
        organizationId,
        leadId,
        // Filter private notes: only show if user is the creator or has admin/manager access
        OR: [
          { isPrivate: false },
          { userId },
          ...(this.hasAdminManagerAccess(role) ? [{ isPrivate: true }] : []),
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes;
  }

  async createNote(organizationId: string, userId: string, dto: CreateNoteDto) {
    await this.verifyMembership(organizationId, userId);

    // If leadId is provided, verify lead exists and user has access
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.leadId,
          organizationId,
          deletedAt: null, // Exclude soft-deleted leads
        },
      });

      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      if (lead.deletedAt) {
        throw new BadRequestException('Cannot add note to a deleted lead');
      }

      const { role } = await this.verifyMembership(organizationId, userId);
      if (!this.canAccessLead(role, lead.assignedToId, lead.createdById, userId)) {
        throw new ForbiddenException('You do not have access to this lead');
      }
    }

    const created = await this.prisma.note.create({
      data: {
        organizationId,
        leadId: dto.leadId,
        userId,
        content: dto.content,
        isPrivate: dto.isPrivate || false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: dto.leadId
          ? {
              select: {
                id: true,
                name: true,
              },
            }
          : false,
      },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.Note,
      entityId: created.id,
      before: null,
      after: {
        id: created.id,
        leadId: created.leadId,
        isPrivate: created.isPrivate,
      },
      metadata: {
        method: metadata.method,
        path: metadata.path,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        userId,
        orgId: organizationId,
        leadId: dto.leadId,
      },
    });

    return created;
  }

  // Tasks
  async getLeadTasks(organizationId: string, userId: string, leadId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted leads
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.deletedAt) {
      throw new BadRequestException('Cannot access tasks of a deleted lead');
    }

    if (!this.canAccessLead(role, lead.assignedToId, lead.createdById, userId)) {
      throw new ForbiddenException('You do not have access to this lead');
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        leadId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { completed: 'asc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return tasks;
  }

  async createTask(organizationId: string, userId: string, dto: CreateTaskDto) {
    await this.verifyMembership(organizationId, userId);

    // If leadId is provided, verify lead exists and user has access
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.leadId,
          organizationId,
          deletedAt: null, // Exclude soft-deleted leads
        },
      });

      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      if (lead.deletedAt) {
        throw new BadRequestException('Cannot create task for a deleted lead');
      }

      const { role } = await this.verifyMembership(organizationId, userId);
      if (!this.canAccessLead(role, lead.assignedToId, lead.createdById, userId)) {
        throw new ForbiddenException('You do not have access to this lead');
      }
    }

    // Verify assigned user is member of organization
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: dto.assignedToId,
        organizationId,
      },
    });

    if (!membership) {
      throw new BadRequestException('Assigned user is not a member of this organization');
    }

    const created = await this.prisma.task.create({
      data: {
        organizationId,
        leadId: dto.leadId,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assignedToId: dto.assignedToId,
        createdById: userId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: dto.leadId
          ? {
              select: {
                id: true,
                name: true,
              },
            }
          : false,
      },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.Task,
      entityId: created.id,
      before: null,
      after: {
        id: created.id,
        leadId: created.leadId,
        title: created.title,
        completed: created.completed,
        assignedToId: created.assignedToId,
      },
      metadata: {
        method: metadata.method,
        path: metadata.path,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        userId,
        orgId: organizationId,
        leadId: dto.leadId,
      },
    });

    return created;
  }

  async updateTask(organizationId: string, userId: string, taskId: string, dto: UpdateTaskDto) {
    await this.verifyMembership(organizationId, userId);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Only admin/manager or assigned user or creator can update
    const { role } = await this.verifyMembership(organizationId, userId);
    if (!this.hasAdminManagerAccess(role) && task.assignedToId !== userId && task.createdById !== userId) {
      throw new ForbiddenException('You do not have permission to update this task');
    }

    // Verify assigned user if provided
    if (dto.assignedToId) {
      const membership = await this.prisma.membership.findFirst({
        where: {
          userId: dto.assignedToId,
          organizationId,
        },
      });

      if (!membership) {
        throw new BadRequestException('Assigned user is not a member of this organization');
      }
    }

    // Capture BEFORE
    const before = {
      id: task.id,
      title: task.title,
      completed: task.completed,
      assignedToId: task.assignedToId,
    };

    const updateData: any = {};

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.assignedToId !== undefined) updateData.assignedToId = dto.assignedToId;
    if (dto.completed !== undefined) {
      updateData.completed = dto.completed;
      updateData.completedAt = dto.completed ? new Date() : null;
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: task.leadId
          ? {
              select: {
                id: true,
                name: true,
              },
            }
          : false,
      },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Task,
      entityId: taskId,
      before,
      after: {
        id: updated.id,
        title: updated.title,
        completed: updated.completed,
        assignedToId: updated.assignedToId,
      },
      metadata: {
        method: metadata.method,
        path: metadata.path,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        userId,
        orgId: organizationId,
        updatedFields: Object.keys(updateData),
        leadId: task.leadId,
      },
    });

    return updated;
  }

  health() {
    return { ok: true, module: 'leads' };
  }
}
