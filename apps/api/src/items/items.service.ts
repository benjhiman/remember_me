import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditAction, AuditEntityType, Role, ItemCondition } from '@remember-me/prisma';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ListItemsDto } from './dto/list-items.dto';
import {
  generateSku,
  generateSortKey,
  conditionLabel,
} from './item-utils';

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
        orderBy: [
          { sortKey: 'asc' }, // Canonical ordering: model DESC, variant, storage DESC, condition, color
          { updatedAt: 'desc' }, // Fallback if sortKey is null
        ],
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
    let brand = dto.brand?.trim() || '';
    if (!brand || brand.length < 2) {
      throw new BadRequestException('Brand is required');
    }
    // Normalize brand to uppercase (especially for Apple)
    brand = brand.toUpperCase();
    
    const model = dto.model.trim();
    const color = dto.color.trim();
    const condition = dto.condition;

    // Map condition to display label
    const conditionDisplayLabel = conditionLabel(condition);

    // Build name if not provided
    const name = dto.name?.trim() || `${brand} ${model} ${dto.storageGb}GB ${color} (${conditionDisplayLabel})`;

    // Generate SKU if not provided
    const sku = dto.sku?.trim() || (model && dto.storageGb && condition && color
      ? generateSku(model, dto.storageGb, condition, color)
      : null);

    // Generate sort key
    const sortKey = model && dto.storageGb && condition && color
      ? generateSortKey(model, dto.storageGb, condition, color)
      : null;

    const item = await this.prisma.item.create({
      data: {
        organizationId,
        name,
        sku,
        category: dto.category?.trim() || null,
        brand,
        model,
        storageGb: dto.storageGb,
        condition,
        color,
        description: dto.description?.trim() || null,
        attributes: dto.attributes || undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        sortKey,
        seedSource: dto.seedSource || null,
        seedVersion: dto.seedVersion || null,
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
    if (dto.sku !== undefined) {
      updateData.sku = dto.sku?.trim() || null;
    }
    if (dto.category !== undefined) updateData.category = dto.category?.trim() || null;
    if (dto.brand !== undefined) {
      // Normalize brand to uppercase
      updateData.brand = dto.brand.trim().toUpperCase();
    }
    if (dto.model !== undefined) updateData.model = dto.model.trim();
    if (dto.storageGb !== undefined) updateData.storageGb = dto.storageGb;
    if (dto.condition !== undefined) updateData.condition = dto.condition;
    if (dto.color !== undefined) updateData.color = dto.color.trim();
    if (dto.description !== undefined) updateData.description = dto.description?.trim() || null;
    if (dto.attributes !== undefined) updateData.attributes = dto.attributes || undefined;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Determine final values for computed fields
    const finalBrand = updateData.brand || existingItem.brand || 'APPLE';
    const finalModel = updateData.model || existingItem.model || '';
    const finalStorageGb = updateData.storageGb ?? existingItem.storageGb ?? 0;
    const finalColor = updateData.color || existingItem.color || '';
    const finalCondition = (updateData.condition || existingItem.condition || 'NEW') as ItemCondition;

    // Auto-update name if model/brand/storage/color/condition changed
    if (dto.model || dto.brand || dto.storageGb !== undefined || dto.color || dto.condition) {
      if (finalModel && finalStorageGb && finalColor) {
        const conditionDisplayLabel = conditionLabel(finalCondition);
        updateData.name = `${finalBrand} ${finalModel} ${finalStorageGb}GB ${finalColor} (${conditionDisplayLabel})`;
      }
    }

    // Auto-regenerate SKU if model/storage/condition/color changed (unless user set custom SKU)
    const shouldRegenerateSku = (dto.model || dto.storageGb !== undefined || dto.condition || dto.color) &&
      !dto.sku && // User didn't set custom SKU
      finalModel && finalStorageGb && finalColor;
    
    if (shouldRegenerateSku) {
      updateData.sku = generateSku(finalModel, finalStorageGb, finalCondition, finalColor);
    }

    // Auto-regenerate sortKey if any ordering field changed
    if (dto.model || dto.storageGb !== undefined || dto.condition || dto.color) {
      if (finalModel && finalStorageGb && finalColor) {
        updateData.sortKey = generateSortKey(finalModel, finalStorageGb, finalCondition, finalColor);
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

  // Extract SKU prefix helper
  private extractSkuPrefix(sku: string | null | undefined): string | null {
    if (!sku) return null;
    const skuUpper = sku.toUpperCase().trim();
    
    // If has separator (_ or -), take part before separator
    const separatorMatch = skuUpper.match(/^([A-Z0-9]+)[_\-]/);
    if (separatorMatch) {
      return separatorMatch[1].substring(0, 4); // Max 4 chars
    }
    
    // If starts with known prefixes (IPH, IPAD, SAM), extract them
    if (skuUpper.startsWith('IPH')) return 'IPH';
    if (skuUpper.startsWith('IPAD')) return 'IPAD';
    if (skuUpper.startsWith('SAM')) return 'SAM';
    
    // Otherwise, take first 3-4 letters
    const lettersOnly = skuUpper.match(/^([A-Z]{3,4})/);
    if (lettersOnly) {
      return lettersOnly[1];
    }
    
    // Fallback: first 3 chars
    return skuUpper.substring(0, 3);
  }

  async listFolders(organizationId: string, userId: string) {
    await this.verifyMembership(organizationId, userId);

    // Get all items with SKU
    const items = await this.prisma.item.findMany({
      where: {
        organizationId,
        deletedAt: null,
        isActive: true,
        sku: { not: null },
      },
      select: { sku: true },
    });

    // Extract prefixes and count
    const prefixCounts = new Map<string, number>();
    items.forEach((item) => {
      const prefix = this.extractSkuPrefix(item.sku);
      if (prefix) {
        prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
      }
    });

    // Get pinned folders
    const pinnedFolders = await this.prisma.folderPrefix.findMany({
      where: { organizationId },
      select: { prefix: true },
    });

    const pinnedPrefixes = new Set(pinnedFolders.map((f: { prefix: string }) => f.prefix));

    // Combine: all prefixes with counts + pinned folders (even if count=0)
    const folders = Array.from(
      new Set([...Array.from(prefixCounts.keys()), ...Array.from(pinnedPrefixes)]),
    ).map((prefix: string) => ({
      prefix,
      count: prefixCounts.get(prefix) || 0,
      pinned: pinnedPrefixes.has(prefix),
    }));

    // Sort by pinned first, then by count desc, then alphabetically
    folders.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.count !== b.count) return b.count - a.count;
      return a.prefix.localeCompare(b.prefix);
    });

    return { data: folders };
  }

  async createFolder(organizationId: string, userId: string, dto: { prefix: string }) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create folders');
    }

    const prefixUpper = dto.prefix.toUpperCase().trim();

    // Check if already exists
    const existing = await this.prisma.folderPrefix.findUnique({
      where: {
        organizationId_prefix: {
          organizationId,
          prefix: prefixUpper,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const folder = await this.prisma.folderPrefix.create({
      data: {
        organizationId,
        prefix: prefixUpper,
      },
    });

    return folder;
  }

  async deleteFolder(organizationId: string, userId: string, prefix: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can delete folders');
    }

    const prefixUpper = prefix.toUpperCase().trim();

    await this.prisma.folderPrefix.deleteMany({
      where: {
        organizationId,
        prefix: prefixUpper,
      },
    });
  }
}
