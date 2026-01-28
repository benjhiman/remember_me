import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditAction, AuditEntityType, Role } from '@remember-me/prisma';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ListItemsDto } from './dto/list-items.dto';

@Injectable({ scope: Scope.REQUEST })
export class ItemsService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
  ) {}

  private getRequestMetadata(): {
    requestId: string | null;
    method: string;
    path: string;
    ip: string;
    userAgent: string;
  } {
    const requestId = (this.request as any).requestId || null;
    const method = this.request.method || 'UNKNOWN';
    const path = this.request.path || this.request.url || 'UNKNOWN';
    const ip = this.request.ip || (this.request.socket?.remoteAddress) || 'UNKNOWN';
    const userAgent = this.request.get('user-agent') || '';
    return { requestId, method, path, ip, userAgent };
  }

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

  private hasAdminManagerAccess(role: Role): boolean {
    return role === Role.ADMIN || role === Role.MANAGER || role === Role.OWNER;
  }

  async listItems(organizationId: string, userId: string, dto: ListItemsDto) {
    await this.verifyMembership(organizationId, userId);

    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      deletedAt: null, // Soft delete: exclude deleted items
    };

    if (dto.q) {
      where.OR = [
        { name: { contains: dto.q, mode: 'insensitive' } },
        { sku: { contains: dto.q, mode: 'insensitive' } },
        { brand: { contains: dto.q, mode: 'insensitive' } },
        { category: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.item.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getItem(organizationId: string, userId: string, itemId: string) {
    await this.verifyMembership(organizationId, userId);

    const item = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    return item;
  }

  async createItem(organizationId: string, userId: string, dto: CreateItemDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create items');
    }

    const item = await this.prisma.item.create({
      data: {
        organizationId,
        name: dto.name,
        sku: dto.sku || null,
        category: dto.category || null,
        brand: dto.brand || null,
        description: dto.description || null,
        attributes: dto.attributes || undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.Item,
      entityId: item.id,
      metadata: {
        ...metadata,
        changes: { created: dto },
      },
    });

    return item;
  }

  async updateItem(
    organizationId: string,
    userId: string,
    itemId: string,
    dto: UpdateItemDto,
  ) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can update items');
    }

    const existingItem = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existingItem) {
      throw new NotFoundException('Item not found');
    }

    const item = await this.prisma.item.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku || null }),
        ...(dto.category !== undefined && { category: dto.category || null }),
        ...(dto.brand !== undefined && { brand: dto.brand || null }),
        ...(dto.description !== undefined && { description: dto.description || null }),
        ...(dto.attributes !== undefined && { attributes: dto.attributes || undefined }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Item,
      entityId: item.id,
      metadata: {
        ...metadata,
        changes: { before: existingItem, after: dto },
      },
    });

    return item;
  }

  async deleteItem(organizationId: string, userId: string, itemId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can delete items');
    }

    const existingItem = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!existingItem) {
      throw new NotFoundException('Item not found');
    }

    // Soft delete
    const item = await this.prisma.item.update({
      where: { id: itemId },
      data: {
        deletedAt: new Date(),
      },
    });

    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.Item,
      entityId: item.id,
      metadata: {
        ...metadata,
        changes: { deleted: existingItem },
      },
    });

    return { message: 'Item deleted successfully' };
  }
}
