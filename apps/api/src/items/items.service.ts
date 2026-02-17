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

    // Filter by folderId if provided
    if (dto.folderId) {
      where.folderId = dto.folderId;
    }

    if (dto.q) {
      const qTrimUpper = dto.q.trim().toUpperCase();
      // Detect if query looks like a SKU prefix (alphanumeric, 2-10 chars, starts with letter)
      const isSkuPrefix = /^[A-Z][A-Z0-9]{1,9}$/.test(qTrimUpper);
      
      if (isSkuPrefix) {
        // For SKU prefix searches, use startsWith for SKU (more precise)
        where.OR = [
          { sku: { startsWith: qTrimUpper, mode: 'insensitive' } },
          { name: { contains: dto.q.trim(), mode: 'insensitive' } },
          { brand: { contains: dto.q.trim(), mode: 'insensitive' } },
          { category: { contains: dto.q.trim(), mode: 'insensitive' } },
          { model: { contains: dto.q.trim(), mode: 'insensitive' } },
          { color: { contains: dto.q.trim(), mode: 'insensitive' } },
        ];
      } else {
        // For regular text searches, use contains for all fields
        where.OR = [
          { name: { contains: dto.q.trim(), mode: 'insensitive' } },
          { sku: { contains: dto.q.trim(), mode: 'insensitive' } },
          { brand: { contains: dto.q.trim(), mode: 'insensitive' } },
          { category: { contains: dto.q.trim(), mode: 'insensitive' } },
          { model: { contains: dto.q.trim(), mode: 'insensitive' } },
          { color: { contains: dto.q.trim(), mode: 'insensitive' } },
        ];
      }
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

    // Validate folderId if provided
    if (dto.folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: {
          id: dto.folderId,
          organizationId,
        },
      });

      if (!folder) {
        throw new NotFoundException('Folder not found or does not belong to this organization');
      }
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
        folderId: dto.folderId || null,
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

    try {
      // Get all folders for this organization
      const folders = await this.prisma.folder.findMany({
        where: { organizationId },
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Log for debugging (only in non-production or when folders count is interesting)
      if (process.env.NODE_ENV !== 'production' || folders.length > 0) {
        console.log(`[ItemsService.listFolders] Found ${folders.length} folders for orgId: ${organizationId}`);
      }

      // Return folders with item count - ALWAYS return 200 with array (never 404)
      return {
        data: folders.map((folder) => ({
          id: folder.id,
          name: folder.name,
          description: folder.description,
          count: folder._count.items,
          createdAt: folder.createdAt,
          updatedAt: folder.updatedAt,
        })),
      };
    } catch (error: any) {
      // Handle Prisma errors (e.g., table doesn't exist = migration not applied)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.error(`[ItemsService.listFolders] CRITICAL: Folder table does not exist. Migration not applied.`, {
          organizationId,
          error: error.message,
        });
        throw new Error('Folders table missing. Migration not applied in production. Please contact support.');
      }

      // Log other errors
      console.error(`[ItemsService.listFolders] Error fetching folders for orgId: ${organizationId}`, {
        error: error.message,
        code: error.code,
      });
      throw error;
    }
  }

  async createFolder(organizationId: string, userId: string, dto: { name: string; description?: string }) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create folders');
    }

    const nameTrimmed = dto.name.trim();

    if (!nameTrimmed || nameTrimmed.length < 1) {
      throw new BadRequestException('Folder name is required');
    }

    // Check if already exists
    const existing = await this.prisma.folder.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: nameTrimmed,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Folder with this name already exists');
    }

    const folder = await this.prisma.folder.create({
      data: {
        organizationId,
        name: nameTrimmed,
        description: dto.description?.trim() || null,
      },
    });

    return folder;
  }

  async deleteFolder(organizationId: string, userId: string, folderId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can delete folders');
    }

    // Check if folder exists and belongs to organization
    const folder = await this.prisma.folder.findFirst({
      where: {
        id: folderId,
        organizationId,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    // Check if folder has items
    if (folder._count.items > 0) {
      throw new BadRequestException('Cannot delete folder with items. Move or delete items first.');
    }

    await this.prisma.folder.delete({
      where: { id: folderId },
    });
  }
}
