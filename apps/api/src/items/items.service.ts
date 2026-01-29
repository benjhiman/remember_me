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
        { model: { contains: dto.q, mode: 'insensitive' } },
        { color: { contains: dto.q, mode: 'insensitive' } },
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

    // Normalize strings
    const brand = dto.brand?.trim() || '';
    if (!brand || brand.length < 2) {
      throw new BadRequestException('Brand is required');
    }
    const model = dto.model.trim();
    const color = dto.color.trim();
    const condition = dto.condition;

    // Map condition to display label
    const conditionLabel = condition === 'NEW' ? 'new' : condition === 'USED' ? 'usado' : condition === 'OEM' ? 'oem' : condition.toLowerCase();

    // Build name if not provided
    const name = dto.name?.trim() || `${brand} ${model} ${dto.storageGb}GB ${color} (${conditionLabel})`;

    const item = await this.prisma.item.create({
      data: {
        organizationId,
        name,
        sku: dto.sku?.trim() || null,
        category: dto.category?.trim() || null,
        brand,
        model,
        storageGb: dto.storageGb,
        condition,
        color,
        description: dto.description?.trim() || null,
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

    // Build update data with normalization
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.sku !== undefined) updateData.sku = dto.sku?.trim() || null;
    if (dto.category !== undefined) updateData.category = dto.category?.trim() || null;
    if (dto.brand !== undefined) updateData.brand = dto.brand.trim();
    if (dto.model !== undefined) updateData.model = dto.model.trim();
    if (dto.storageGb !== undefined) updateData.storageGb = dto.storageGb;
    if (dto.condition !== undefined) updateData.condition = dto.condition;
    if (dto.color !== undefined) updateData.color = dto.color.trim();
    if (dto.description !== undefined) updateData.description = dto.description?.trim() || null;
    if (dto.attributes !== undefined) updateData.attributes = dto.attributes || undefined;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Auto-update name if model/brand/storage/color/condition changed
    if (dto.model || dto.brand || dto.storageGb !== undefined || dto.color || dto.condition) {
      const finalBrand = updateData.brand || existingItem.brand || 'Apple';
      const finalModel = updateData.model || existingItem.model || '';
      const finalStorageGb = updateData.storageGb ?? existingItem.storageGb ?? 0;
      const finalColor = updateData.color || existingItem.color || '';
      const finalCondition = updateData.condition || existingItem.condition || 'NEW';
      if (finalModel && finalStorageGb && finalColor) {
        updateData.name = `${finalBrand} ${finalModel} ${finalStorageGb}GB ${finalColor} (${finalCondition})`;
      }
    }

    const item = await this.prisma.item.update({
      where: { id: itemId },
      data: updateData,
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
