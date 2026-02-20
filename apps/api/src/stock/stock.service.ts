import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
  Scope,
  Logger,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditAction, AuditEntityType } from '@remember-me/prisma';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { ListStockItemsDto } from './dto/list-stock-items.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateStockEntryDto, StockEntryMode } from './dto/create-stock-entry.dto';
import { BulkStockAddDto } from './dto/bulk-stock-add.dto';
import {
  Role,
  StockStatus,
  StockMovementType,
} from '@remember-me/prisma';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable({ scope: Scope.REQUEST })
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
  ) {}

  // Helper: Get request metadata for audit log
  private getRequestMetadata(): { requestId: string | null; method: string; path: string; ip: string; userAgent: string } {
    const requestId = (this.request as any).requestId || null;
    const method = this.request.method || 'UNKNOWN';
    const path = this.request.path || this.request.url || 'UNKNOWN';
    const ip = this.request.ip || (this.request.socket?.remoteAddress) || 'UNKNOWN';
    const userAgent = this.request.get('user-agent') || '';
    return { requestId, method, path, ip, userAgent };
  }

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

  // Helper: Create stock movement
  private async createMovement(
    tx: Prisma.TransactionClient,
    organizationId: string,
    stockItemId: string,
    type: StockMovementType,
    quantityBefore: number,
    quantityAfter: number,
    createdById: string,
    reason?: string,
    saleId?: string,
    metadata?: any,
  ) {
    // For movements, quantity is the difference (quantityAfter - quantityBefore)
    const movementQuantity = quantityAfter - quantityBefore;

    return tx.stockMovement.create({
      data: {
        organizationId,
        stockItemId,
        type,
        quantity: movementQuantity,
        quantityBefore,
        quantityAfter,
        reason,
        saleId,
        createdById,
        metadata,
      },
    });
  }

  async listStockItems(organizationId: string, userId: string, dto: ListStockItemsDto) {
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

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.condition) {
      where.condition = dto.condition;
    }

    if (dto.model) {
      where.model = { contains: dto.model, mode: 'insensitive' };
    }

    if (dto.location) {
      where.location = { contains: dto.location, mode: 'insensitive' };
    }

    if (dto.search) {
      where.OR = [
        { model: { contains: dto.search, mode: 'insensitive' } },
        { sku: { contains: dto.search, mode: 'insensitive' } },
        { imei: { contains: dto.search, mode: 'insensitive' } },
        { serialNumber: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.stockItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockItem.count({ where }),
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

  async getStockItem(organizationId: string, userId: string, itemId: string) {
    await this.verifyMembership(organizationId, userId);

    const item = await this.prisma.stockItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted items
      },
    });

    if (!item) {
      throw new NotFoundException('Stock item not found');
    }

    return item;
  }

  async createStockItem(organizationId: string, userId: string, dto: CreateStockItemDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create stock items');
    }

    // Validate quantity for items with IMEI
    if (dto.imei && dto.quantity && dto.quantity !== 1) {
      throw new BadRequestException('Items with IMEI must have quantity = 1');
    }

    // Set quantity default
    const quantity = dto.imei ? 1 : dto.quantity || 1;

    // Check if IMEI is unique (if provided)
    if (dto.imei) {
      const existingItem = await this.prisma.stockItem.findUnique({
        where: { organizationId_imei: { organizationId, imei: dto.imei } },
      });

      if (existingItem) {
        throw new ConflictException('IMEI already exists');
      }
    }

    // Note: createStockItem is a legacy method that doesn't require itemId
    // For new stock entries, use createStockEntry which requires itemId
    // This method creates a "dummy" itemId to satisfy Prisma schema
    // TODO: Migrate all callers to use createStockEntry with proper itemId
    const dummyItemId = 'legacy-no-item'; // Placeholder for legacy items without catalog entry

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.create({
        data: {
          organizationId,
          itemId: dummyItemId, // Legacy: items created without catalog reference
          sku: dto.sku,
          model: dto.model,
          storage: dto.storage,
          color: dto.color,
          condition: dto.condition || 'NEW',
          imei: dto.imei,
          serialNumber: dto.serialNumber,
          quantity,
          costPrice: new Decimal(dto.costPrice),
          basePrice: new Decimal(dto.basePrice),
          status: dto.status || StockStatus.AVAILABLE,
          location: dto.location,
          notes: dto.notes,
          metadata: dto.metadata || {},
        } as any, // Type assertion needed for legacy compatibility
      });

      // Create initial IN movement
      await this.createMovement(
        tx,
        organizationId,
        item.id,
        StockMovementType.IN,
        0,
        quantity,
        userId,
        'Initial stock entry',
        undefined,
        dto.metadata,
      );

      // Audit log
      const metadata = this.getRequestMetadata();
      await this.auditLogService.log({
        organizationId,
        actorUserId: userId,
        requestId: metadata.requestId,
        action: AuditAction.CREATE,
        entityType: AuditEntityType.StockItem,
        entityId: item.id,
        before: null,
        after: {
          id: item.id,
          sku: item.sku,
          model: item.model,
          quantity: item.quantity.toString(),
          status: item.status,
        },
        metadata: {
          ...metadata,
          quantity,
          costPrice: dto.costPrice,
          basePrice: dto.basePrice,
        },
      });

      return item;
    });
  }

  async updateStockItem(
    organizationId: string,
    userId: string,
    itemId: string,
    dto: UpdateStockItemDto,
  ) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can update stock items');
    }

    const item = await this.prisma.stockItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted items
      },
    });

    if (!item) {
      throw new NotFoundException('Stock item not found');
    }

    if (item.deletedAt) {
      throw new BadRequestException('Cannot update a deleted stock item');
    }

    // Check if IMEI is unique (if being updated)
    if (dto.imei && dto.imei !== item.imei) {
      const existingItem = await this.prisma.stockItem.findUnique({
        where: { organizationId_imei: { organizationId, imei: dto.imei } },
      });

      if (existingItem) {
        throw new ConflictException('IMEI already exists');
      }
    }

    // Prevent updating status to AVAILABLE if item is SOLD
    if (dto.status === StockStatus.AVAILABLE && item.status === StockStatus.SOLD) {
      throw new BadRequestException('Cannot set status to AVAILABLE for sold items');
    }

    // Note: quantity should only be updated via adjustStock, not here

    const before = {
      id: item.id,
      sku: item.sku,
      model: item.model,
      status: item.status,
      condition: item.condition,
    };

    const updateData: any = {};

    if (dto.sku !== undefined) updateData.sku = dto.sku;
    if (dto.model !== undefined) updateData.model = dto.model;
    if (dto.storage !== undefined) updateData.storage = dto.storage;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.condition !== undefined) updateData.condition = dto.condition;
    if (dto.imei !== undefined) updateData.imei = dto.imei;
    if (dto.serialNumber !== undefined) updateData.serialNumber = dto.serialNumber;
    if (dto.costPrice !== undefined) updateData.costPrice = new Decimal(dto.costPrice);
    if (dto.basePrice !== undefined) updateData.basePrice = new Decimal(dto.basePrice);
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;
    // Note: quantity should only be updated via adjustStock, not here

    const updated = await this.prisma.stockItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.StockItem,
      entityId: itemId,
      before,
      after: {
        id: updated.id,
        sku: updated.sku,
        model: updated.model,
        status: updated.status,
        condition: updated.condition,
      },
      metadata: {
        ...metadata,
        updatedFields: Object.keys(updateData),
      },
    });

    return updated;
  }

  async deleteStockItem(organizationId: string, userId: string, itemId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can delete stock items');
    }

    const item = await this.prisma.stockItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null, // Only delete if not already deleted
      },
      include: {
      },
    });

    if (!item) {
      throw new NotFoundException('Stock item not found');
    }

    // Prevent deletion if item has active reservations

    // Soft delete: set deletedAt instead of actual delete
    const before = {
      id: item.id,
      sku: item.sku,
      model: item.model,
      quantity: item.quantity.toString(),
      status: item.status,
      deletedAt: item.deletedAt,
    };

    await this.prisma.stockItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.StockItem,
      entityId: itemId,
      before,
      after: { deletedAt: new Date().toISOString() },
      metadata,
    });

    return { message: 'Stock item deleted successfully' };
  }

  async restoreStockItem(organizationId: string, userId: string, itemId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can restore stock items');
    }

    const item = await this.prisma.stockItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: { not: null }, // Only restore if deleted
      },
    });

    if (!item) {
      throw new NotFoundException('Deleted stock item not found');
    }

    const restored = await this.prisma.stockItem.update({
      where: { id: itemId },
      data: { deletedAt: null },
    });

    return restored;
  }

  async adjustStock(
    organizationId: string,
    userId: string,
    itemId: string,
    dto: AdjustStockDto,
  ) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can adjust stock');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.findFirst({
        where: {
          id: itemId,
          organizationId,
          deletedAt: null, // Exclude soft-deleted items
        },
      });

      if (!item) {
        throw new NotFoundException('Stock item not found');
      }

      if (item.deletedAt) {
        throw new BadRequestException('Cannot adjust stock for a deleted item');
      }

      const quantityBefore = item.quantity;
      const quantityAfter = quantityBefore + dto.quantityChange;

      // Never allow negative stock
      if (quantityAfter < 0) {
        throw new BadRequestException(
          `Cannot adjust stock. Current quantity: ${quantityBefore}, change: ${dto.quantityChange}. Result would be negative.`,
        );
      }

      // Update item quantity
      const updatedItem = await tx.stockItem.update({
        where: { id: itemId },
        data: { quantity: quantityAfter },
      });

      // Create movement
      await this.createMovement(
        tx,
        organizationId,
        itemId,
        StockMovementType.ADJUST,
        quantityBefore,
        quantityAfter,
        userId,
        dto.reason,
        undefined,
        dto.metadata,
      );

      // Audit log
      const metadata = this.getRequestMetadata();
      await this.auditLogService.log({
        organizationId,
        actorUserId: userId,
        requestId: metadata.requestId,
        action: AuditAction.ADJUST,
        entityType: AuditEntityType.StockItem,
        entityId: itemId,
        before: {
          quantity: quantityBefore.toString(),
        },
        after: {
          quantity: quantityAfter.toString(),
        },
        metadata: {
          ...metadata,
          quantityChange: dto.quantityChange,
          reason: dto.reason,
        },
      });

      return updatedItem;
    });
  }

  // Reservation methods removed - feature eliminated
  // async reserveStock removed
  // async releaseReservation removed
  // async confirmReservation removed
  // async listReservations removed
  // async extendReservation removed
  // async getReservation removed

  async listMovements(
    organizationId: string,
    userId: string,
    itemId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    await this.verifyMembership(organizationId, userId);

    // Verify item belongs to organization
    const item = await this.prisma.stockItem.findFirst({
      where: {
        id: itemId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted items
      },
    });

    if (!item) {
      throw new NotFoundException('Stock item not found');
    }

    const skip = (page - 1) * limit;

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: {
          stockItemId: itemId,
          organizationId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockMovement.count({
        where: {
          stockItemId: itemId,
          organizationId,
        },
      }),
    ]);

    return {
      data: movements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createStockEntry(organizationId: string, userId: string, dto: CreateStockEntryDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create stock entries');
    }

    // Validate item exists and belongs to organization
    const item = await this.prisma.item.findFirst({
      where: {
        id: dto.itemId,
        organizationId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found or inactive');
    }

    // Get item details for stock item creation
    const itemName = item.name;
    const itemAttributes = (item.attributes as any) || {};
    const model = itemAttributes.model || itemName;
    // Normalize storage to string (Prisma expects String | Null, not Int)
    const storage = itemAttributes.storage != null ? String(itemAttributes.storage) : (item.storageGb != null ? String(item.storageGb) : null);
    const color = itemAttributes.color || item.color || null;

    // Validate mode-specific fields
    if (dto.mode === StockEntryMode.IMEI) {
      if (!dto.imeis || dto.imeis.length === 0) {
        throw new BadRequestException('IMEIs array is required for IMEI mode');
      }

      // Normalize IMEIs: trim, remove spaces, filter empty
      const normalizedImeis = dto.imeis
        .map((imei) => imei.trim().replace(/\s+/g, ''))
        .filter((imei) => imei.length > 0);

      if (normalizedImeis.length === 0) {
        throw new BadRequestException('At least one valid IMEI is required');
      }

      // Check for duplicates within the request
      const uniqueImeis = new Set(normalizedImeis);
      if (uniqueImeis.size !== normalizedImeis.length) {
        throw new BadRequestException('Duplicate IMEIs found in the request');
      }

      // Check for existing IMEIs in database (using findMany with OR)
      const existingItems = await this.prisma.stockItem.findMany({
        where: {
          organizationId,
          OR: normalizedImeis.map((imei) => ({ imei })),
          deletedAt: null,
        },
        select: { imei: true },
      });

      if (existingItems.length > 0) {
        const existingImeis = existingItems.map((item) => item.imei).filter(Boolean);
        throw new ConflictException({
          message: 'Some IMEIs already exist',
          duplicateImeis: existingImeis,
        });
      }

      // Create stock items (one per IMEI)
      return this.prisma.$transaction(async (tx) => {
        const createdItems = [];
        const costPrice = dto.cost ? new Decimal(dto.cost) : new Decimal(0);
        const basePrice = dto.cost ? new Decimal(dto.cost) : new Decimal(0);

        for (const imei of normalizedImeis) {
          const stockItem = await tx.stockItem.create({
            data: {
              organizationId,
              itemId: dto.itemId,
              model,
              storage,
              color,
              condition: dto.condition || 'NEW',
              imei,
              quantity: 1, // IMEI items always have quantity 1
              costPrice,
              basePrice,
              status: dto.status || 'AVAILABLE',
              location: dto.location,
              notes: dto.notes,
              metadata: dto.metadata,
            } as any, // Type assertion needed due to Prisma type inference
          });

          // Create movement (IN type)
          await this.createMovement(
            tx,
            organizationId,
            stockItem.id,
            StockMovementType.IN,
            0,
            1,
            userId,
            'Stock entry created',
            undefined,
            dto.metadata,
          );

          createdItems.push(stockItem);
        }

        // Audit log
        const metadata = this.getRequestMetadata();
        await this.auditLogService.log({
          organizationId,
          actorUserId: userId,
          requestId: metadata.requestId,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.StockItem,
          entityId: createdItems[0]?.id || '',
          after: {
            count: createdItems.length.toString(),
            mode: 'IMEI',
            itemId: dto.itemId,
          },
          metadata: {
            ...metadata,
            itemId: dto.itemId,
            mode: 'IMEI',
            imeiCount: normalizedImeis.length,
          },
        });

        return {
          created: createdItems.length,
          items: createdItems,
        };
      });
    } else if (dto.mode === StockEntryMode.QUANTITY) {
      if (!dto.quantity || dto.quantity < 1) {
        throw new BadRequestException('Quantity must be at least 1 for QUANTITY mode');
      }

      // Log for debugging
      this.logger.log(
        `Creating stock entry QUANTITY mode: orgId=${organizationId}, itemId=${dto.itemId}, quantity=${dto.quantity}`,
      );

      const costPrice = dto.cost ? new Decimal(dto.cost) : new Decimal(0);
      const basePrice = dto.cost ? new Decimal(dto.cost) : new Decimal(0);

      return this.prisma.$transaction(async (tx) => {
        const stockItem = await tx.stockItem.create({
          data: {
            organizationId,
            itemId: dto.itemId,
            model,
            storage,
            color,
            condition: dto.condition || 'NEW',
            imei: null, // No IMEI for quantity mode
            quantity: dto.quantity!, // Use the exact quantity provided
            costPrice,
            basePrice,
            status: dto.status || 'AVAILABLE',
            location: dto.location,
            notes: dto.notes,
            metadata: dto.metadata,
          } as any, // Type assertion needed due to Prisma type inference
        });

        this.logger.log(
          `Created stock item: id=${stockItem.id}, itemId=${stockItem.itemId}, quantity=${stockItem.quantity}`,
        );

        // Create movement (IN type) with the exact quantity
        await this.createMovement(
          tx,
          organizationId,
          stockItem.id,
          StockMovementType.IN,
          0,
          dto.quantity!, // Use the exact quantity, not stockItem.quantity (should be same but explicit)
          userId,
          'Stock entry created',
          undefined,
          dto.metadata,
        );

        this.logger.log(`Created stock movement IN: stockItemId=${stockItem.id}, quantity=${dto.quantity}`);

        // Audit log
        const metadata = this.getRequestMetadata();
        await this.auditLogService.log({
          organizationId,
          actorUserId: userId,
          requestId: metadata.requestId,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.StockItem,
          entityId: stockItem.id,
          after: {
            id: stockItem.id,
            quantity: stockItem.quantity.toString(),
            mode: 'QUANTITY',
            itemId: dto.itemId,
          },
          metadata: {
            ...metadata,
            itemId: dto.itemId,
            mode: 'QUANTITY',
            quantity: dto.quantity,
          },
        });

        return {
          created: 1,
          items: [stockItem],
        };
      });
    } else {
      throw new BadRequestException(`Invalid mode: ${dto.mode}`);
    }
  }

  async bulkAddStock(organizationId: string, userId: string, dto: BulkStockAddDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can bulk add stock');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Items array cannot be empty');
    }

    // Consolidate duplicates: sum quantities for same itemId
    const consolidated = new Map<string, number>();
    for (const item of dto.items) {
      const current = consolidated.get(item.itemId) || 0;
      consolidated.set(item.itemId, current + item.quantity);
    }

    // Validate all items exist and belong to organization
    const itemIds = Array.from(consolidated.keys());
    const items = await this.prisma.item.findMany({
      where: {
        id: { in: itemIds },
        organizationId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (items.length !== itemIds.length) {
      const foundIds = new Set(items.map((i) => i.id));
      const missingIds = itemIds.filter((id) => !foundIds.has(id));
      
      // Check if missing items exist but don't belong to this org
      const missingItemsCheck = await this.prisma.item.findMany({
        where: {
          id: { in: missingIds },
        },
        select: {
          id: true,
          organizationId: true,
          deletedAt: true,
          isActive: true,
        },
      });

      const notInOrg = missingItemsCheck
        .filter((item) => item.organizationId !== organizationId)
        .map((item) => item.id);
      const notExists = missingIds.filter((id) => !missingItemsCheck.some((item) => item.id === id));
      const deleted = missingItemsCheck
        .filter((item) => item.deletedAt !== null)
        .map((item) => item.id);
      const inactive = missingItemsCheck
        .filter((item) => !item.isActive)
        .map((item) => item.id);

      throw new BadRequestException({
        code: 'ITEMS_NOT_FOUND',
        message: 'Some items were not found in this organization',
        missingItemIds: missingIds,
        details: {
          notFound: notExists,
          notInOrganization: notInOrg,
          deleted: deleted,
          inactive: inactive,
        },
      });
    }

    // Create a map for quick lookup
    const itemsMap = new Map(items.map((i) => [i.id, i]));

    // Execute all operations in a single transaction
    return this.prisma.$transaction(async (tx) => {
      const applied: Array<{ itemId: string; quantityApplied: number }> = [];
      const errors: Array<{ itemId: string; error: string }> = [];

      for (const [itemId, totalQuantity] of consolidated.entries()) {
        try {
          const item = itemsMap.get(itemId);
          if (!item) {
            errors.push({ itemId, error: 'Item not found' });
            continue;
          }

          // Find or create stock item for this item
          let stockItem = await tx.stockItem.findFirst({
            where: {
              organizationId,
              itemId,
              deletedAt: null,
              // For quantity-based stock, we can have multiple StockItems or consolidate
              // Strategy: find first non-serialized (imei is null) or create new
              imei: null,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (stockItem) {
            // Update existing stock item
            const quantityBefore = stockItem.quantity;
            const quantityAfter = quantityBefore + totalQuantity;

            stockItem = await tx.stockItem.update({
              where: { id: stockItem.id },
              data: { quantity: quantityAfter },
            });

            // Create movement
            await this.createMovement(
              tx,
              organizationId,
              stockItem.id,
              StockMovementType.IN,
              quantityBefore,
              quantityAfter,
              userId,
              dto.note || 'Bulk stock add',
              undefined,
              {
                bulkAdd: true,
                source: dto.source || 'manual',
                itemId,
              },
            );
          } else {
            // Create new stock item
            const model = item.model || item.name;
            // Normalize storage to string (Prisma expects String | Null, not Int)
            const storage = item.storageGb != null ? String(item.storageGb) : null;
            const color = item.color || null;

            stockItem = await tx.stockItem.create({
              data: {
                organizationId,
                itemId,
                model,
                storage,
                color,
                condition: item.condition || 'NEW',
                imei: null,
                quantity: totalQuantity,
                costPrice: new Decimal(0),
                basePrice: new Decimal(0),
                status: StockStatus.AVAILABLE,
                notes: dto.note,
                metadata: {
                  bulkAdd: true,
                  source: dto.source || 'manual',
                },
              } as any,
            });

            // Create movement
            await this.createMovement(
              tx,
              organizationId,
              stockItem.id,
              StockMovementType.IN,
              0,
              totalQuantity,
              userId,
              dto.note || 'Bulk stock add',
              undefined,
              {
                bulkAdd: true,
                source: dto.source || 'manual',
                itemId,
              },
            );
          }

          applied.push({ itemId, quantityApplied: totalQuantity });

          // Audit log
          const metadata = this.getRequestMetadata();
          await this.auditLogService.log({
            organizationId,
            actorUserId: userId,
            requestId: metadata.requestId,
            action: AuditAction.CREATE,
            entityType: AuditEntityType.StockItem,
            entityId: stockItem.id,
            after: {
              id: stockItem.id,
              quantity: stockItem.quantity.toString(),
              itemId,
              bulkAdd: true,
            },
            metadata: {
              ...metadata,
              itemId,
              quantity: totalQuantity,
              bulkAdd: true,
              source: dto.source || 'manual',
            },
          });
        } catch (error) {
          this.logger.error(`Error processing item ${itemId} in bulk add: ${error}`);
          errors.push({
            itemId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // If any errors occurred, rollback the entire transaction
      if (errors.length > 0) {
        throw new BadRequestException(
          `Failed to process some items: ${errors.map((e) => `${e.itemId}: ${e.error}`).join(', ')}`,
        );
      }

      this.logger.log(
        `Bulk stock add completed: ${applied.length} items, ${applied.reduce((sum, a) => sum + a.quantityApplied, 0)} total units`,
      );

      return {
        success: true,
        applied,
        totalItems: applied.length,
        totalQuantity: applied.reduce((sum, a) => sum + a.quantityApplied, 0),
      };
    });
  }

  async getStockSummary(organizationId: string, userId: string, dto: any) {
    await this.verifyMembership(organizationId, userId);

    const page = dto.page || 1;
    const limit = dto.limit || 20;

    // Determine if we should include zero-stock items
    // Rules:
    // - q empty => excludeZero = true (only show items with stock/reserved)
    // - q with value:
    //   - if SKU-like search (alphanumeric, 6+ chars, starts with letter) => includeZero = true
    //   - if NOT SKU-like => excludeZero = true
    const hasSearchQuery = !!dto.q && dto.q.trim().length > 0;
    let includeZero = false;
    
    if (hasSearchQuery) {
      const qTrimUpper = dto.q.trim().toUpperCase();
      // Detect SKU-like search: starts with letter, alphanumeric, 6+ chars
      const isSkuLikeSearch = /^[A-Z][A-Z0-9]{5,}$/.test(qTrimUpper);
      includeZero = isSkuLikeSearch;
    } else {
      // No search query: exclude zeros
      includeZero = false;
    }
    
    // Override if explicitly set
    if (dto.includeZero === true) {
      includeZero = true;
    }

    // Build where clause for items
    const itemWhere: any = {
      organizationId,
      deletedAt: null,
      isActive: true,
    };

    if (hasSearchQuery) {
      // For SKU prefix searches (alphanumeric starting with letters), prefer startsWith
      const isSkuPrefix = /^[A-Za-z][A-Za-z0-9]*$/.test(dto.q.trim());
      if (isSkuPrefix) {
        itemWhere.OR = [
          { sku: { startsWith: dto.q.trim(), mode: 'insensitive' } },
          { name: { contains: dto.q.trim(), mode: 'insensitive' } },
          { brand: { contains: dto.q.trim(), mode: 'insensitive' } },
          { model: { contains: dto.q.trim(), mode: 'insensitive' } },
          { color: { contains: dto.q.trim(), mode: 'insensitive' } },
        ];
      } else {
        itemWhere.OR = [
          { name: { contains: dto.q.trim(), mode: 'insensitive' } },
          { sku: { contains: dto.q.trim(), mode: 'insensitive' } },
          { brand: { contains: dto.q.trim(), mode: 'insensitive' } },
          { model: { contains: dto.q.trim(), mode: 'insensitive' } },
          { color: { contains: dto.q.trim(), mode: 'insensitive' } },
        ];
      }
    }

    if (dto.condition) {
      itemWhere.condition = dto.condition;
    }

    if (dto.itemId) {
      itemWhere.id = dto.itemId;
    }

    // Get ALL items that match the search/filter criteria (no pagination yet)
    const allItems = await this.prisma.item.findMany({
      where: itemWhere,
      orderBy: { name: 'asc' },
    });

    // Calculate stock summary for each item
    const itemsWithStock = await Promise.all(
      allItems.map(async (item) => {
        // Get all stock items for this item (including both serialized and quantity-based)
        const stockItems = await this.prisma.stockItem.findMany({
          where: {
            organizationId,
            itemId: item.id,
            deletedAt: null,
          },
        });

        // Calculate total quantity: sum of all stockItems.quantity
        const totalQty = stockItems.reduce((sum, si) => sum + si.quantity, 0);
        
        // Available quantity is the same as total quantity (no reservations)
        const availableQty = totalQty;

        // Get last IN movement date
        const lastInMovement = await this.prisma.stockMovement.findFirst({
          where: {
            organizationId,
            stockItem: {
              itemId: item.id,
            },
            type: 'IN',
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          brand: item.brand,
          model: item.model,
          storageGb: item.storageGb,
          color: item.color,
          condition: item.condition,
          availableQty,
          totalQty,
          lastInAt: lastInMovement?.createdAt || null,
        };
      }),
    );

    // Filter out zero-stock items if not including zeros
    let filteredRows = itemsWithStock;
    if (!includeZero) {
      filteredRows = itemsWithStock.filter((row) => row.totalQty > 0);
    }

    // Now apply pagination
    const total = filteredRows.length;
    const skip = (page - 1) * limit;
    const paginatedRows = filteredRows.slice(skip, skip + limit);

    return {
      data: paginatedRows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSellerStockView(organizationId: string, userId: string, dto: { search?: string }) {
    if (!organizationId) {
      throw new ForbiddenException('Organization ID is required');
    }
    if (!userId) {
      throw new ForbiddenException('User ID is required');
    }

    await this.verifyMembership(organizationId, userId);

    // Get all stock items with quantity > 0
    const where: any = {
      organizationId,
      deletedAt: null,
      quantity: { gt: 0 },
    };

    if (dto.search) {
      where.OR = [
        { model: { contains: dto.search, mode: 'insensitive' } },
        { storage: { contains: dto.search, mode: 'insensitive' } },
        { color: { contains: dto.search, mode: 'insensitive' } },
        { sku: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const stockItems = await this.prisma.stockItem.findMany({
      where,
      include: {
        item: {
          select: {
            name: true,
            model: true,
            storageGb: true,
            color: true,
            condition: true,
          },
        },
      },
      orderBy: { model: 'asc' },
    });

    // Helper function to parse and format display text
    const parseItem = (item: any) => {
      const model = item.model || item.item?.model || item.item?.name || '';
      const storage = item.storage || item.item?.storageGb ? `${item.item.storageGb}GB` : '';
      const color = item.color || item.item?.color || '';
      const condition = item.condition || item.item?.condition || 'USED';
      const quantity = item.quantity;

      // Detect category
      const modelUpper = model.toUpperCase();
      let category = 'OTROS';
      let subCategory = '';

      if (modelUpper.includes('IPHONE')) {
        category = 'IPHONE';
        // Detect condition flags from model name or condition field
        const modelNameUpper = (item.model || '').toUpperCase();
        const conditionUpper = condition.toUpperCase();
        
        if (modelNameUpper.includes('OEM') || conditionUpper === 'OEM') {
          subCategory = 'OEM';
        } else if (modelNameUpper.includes('SIN CAJA') || modelNameUpper.includes('NO BOX') || modelNameUpper.includes('OPEN BOX')) {
          subCategory = 'SIN CAJA';
        } else if (modelNameUpper.includes('ACTIVADO')) {
          subCategory = 'ACTIVADO';
        } else if (modelNameUpper.includes('SELLADO') || modelNameUpper.includes('SEALED') || conditionUpper === 'NEW') {
          subCategory = 'NUEVOS';
        } else {
          subCategory = 'USADOS';
        }
      } else if (modelUpper.includes('IPAD')) {
        category = 'IPAD';
      } else if (modelUpper.includes('WATCH') || modelUpper.includes('APPLE WATCH')) {
        category = 'APPLE WATCH';
      } else if (modelUpper.includes('MACBOOK') || modelUpper.includes('MAC')) {
        category = 'MACBOOK';
      } else if (modelUpper.includes('AIRPOD')) {
        category = 'AIRPODS';
      } else if (modelUpper.includes('PLAYSTATION') || modelUpper.includes('PS5') || modelUpper.includes('PS4')) {
        category = 'PLAYSTATION';
      } else if (modelUpper.includes('JOYSTICK') || modelUpper.includes('CONTROL')) {
        category = 'JOYSTICKS';
      } else if (modelUpper.includes('NINTENDO') || modelUpper.includes('SWITCH')) {
        category = 'NINTENDO';
      } else if (modelUpper.includes('CABLE') || modelUpper.includes('CARGADOR') || modelUpper.includes('CASE') || modelUpper.includes('VAPE')) {
        category = 'ACCESORIOS';
      }

      // Extract model number (e.g., "12", "12 PRO", "12 PRO MAX", "13", "14", etc.)
      const modelMatch = modelUpper.match(/IPHONE\s+(\d+)(?:\s+(PRO|MAX|PLUS|MINI))?(?:\s+(PRO\s+MAX|MAX))?/i);
      let modelBase = '';
      let modelSuffix = '';
      if (modelMatch) {
        modelBase = `IPHONE ${modelMatch[1]}`;
        if (modelMatch[2]) {
          modelSuffix = modelMatch[2];
          if (modelMatch[3]) {
            modelSuffix = modelMatch[3].replace(/\s+/g, ' ');
          }
        }
      } else {
        modelBase = modelUpper;
      }

      // Format display text
      let displayText = '';
      if (subCategory && subCategory !== 'USADOS') {
        displayText = `${subCategory} ${modelBase}`.trim();
      } else {
        displayText = modelBase;
      }
      if (modelSuffix) {
        displayText += ` ${modelSuffix}`;
      }
      if (storage) {
        displayText += ` ${storage}`;
      }
      if (color) {
        displayText += ` ${color.toUpperCase()}`;
      }

      // Sort key: category, subCategory, modelBase, storage (numeric), color
      const storageNum = storage ? parseInt(storage.replace(/GB|TB/gi, '')) || 0 : 0;
      const sortKey = `${category}_${subCategory}_${modelBase}_${String(storageNum).padStart(6, '0')}_${color.toUpperCase()}`;

      return {
        label: displayText,
        qty: quantity,
        category,
        subCategory,
        sortKey,
      };
    };

    // Parse all items
    const parsedItems = stockItems.map(parseItem);

    // Group by section
    const sections: Record<string, Array<{ label: string; qty: number; sortKey: string }>> = {};

    parsedItems.forEach((item) => {
      const sectionKey = item.subCategory ? `${item.category} ${item.subCategory}` : item.category;
      if (!sections[sectionKey]) {
        sections[sectionKey] = [];
      }
      sections[sectionKey].push({
        label: item.label,
        qty: item.qty,
        sortKey: item.sortKey,
      });
    });

    // Aggregate quantities for same label
    Object.keys(sections).forEach((sectionKey) => {
      const grouped: Record<string, { label: string; qty: number; sortKey: string }> = {};
      sections[sectionKey].forEach((item) => {
        if (!grouped[item.label]) {
          grouped[item.label] = { ...item, qty: 0 };
        }
        grouped[item.label].qty += item.qty;
      });
      sections[sectionKey] = Object.values(grouped);
    });

    // Sort within each section
    Object.keys(sections).forEach((sectionKey) => {
      sections[sectionKey].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    });

    // Define section order
    const sectionOrder = [
      'IPHONE USADOS',
      'IPHONE OEM',
      'IPHONE SIN CAJA',
      'IPHONE ACTIVADO',
      'IPHONE ACTIVADOS',
      'IPHONE NUEVOS',
      'IPAD',
      'APPLE WATCH',
      'MACBOOK',
      'AIRPODS',
      'PLAYSTATION',
      'JOYSTICKS',
      'NINTENDO',
      'ACCESORIOS',
      'OTROS',
    ];

    // Build final response - always return an array, even if empty
    const result = sectionOrder
      .filter((sectionName) => sections[sectionName] && sections[sectionName].length > 0)
      .map((sectionName) => ({
        section: sectionName,
        rows: sections[sectionName],
      }));

    // Always return an array (never null or undefined)
    return result || [];
  }

  async getStockMovements(organizationId: string, userId: string, dto: any) {
    await this.verifyMembership(organizationId, userId);

    const page = dto.page || 1;
    const limit = dto.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
    };

    if (dto.itemId) {
      where.stockItem = {
        itemId: dto.itemId,
      };
    }

    if (dto.type) {
      where.type = dto.type;
    }

    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) {
        where.createdAt.gte = new Date(dto.from);
      }
      if (dto.to) {
        where.createdAt.lte = new Date(dto.to);
      }
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          stockItem: {
            select: {
              id: true,
              itemId: true,
              model: true,
              sku: true,
              item: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  brand: true,
                  model: true,
                  storageGb: true,
                  color: true,
                  condition: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data: movements.map((m) => ({
        id: m.id,
        type: m.type,
        qty: m.quantity,
        itemId: m.stockItem?.itemId || null,
        stockItemId: m.stockItemId,
        item: m.stockItem?.item || null,
        stockItem: m.stockItem || null,
        createdAt: m.createdAt,
        ref: m.saleId || null,
        reason: m.reason,
        createdBy: m.createdBy,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStockMovementDetail(organizationId: string, userId: string, movementId: string) {
    await this.verifyMembership(organizationId, userId);

    const movement = await this.prisma.stockMovement.findFirst({
      where: {
        id: movementId,
        organizationId,
      },
      include: {
        stockItem: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                sku: true,
                brand: true,
                model: true,
                storageGb: true,
                color: true,
                condition: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!movement) {
      throw new NotFoundException('Movement not found');
    }

    // Get all movements created at the same time for the same item (grouped operation)
    const relatedMovements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        stockItem: {
          itemId: movement.stockItem.itemId,
        },
        createdAt: {
          gte: new Date(movement.createdAt.getTime() - 1000), // Within 1 second
          lte: new Date(movement.createdAt.getTime() + 1000),
        },
        type: movement.type,
        createdById: movement.createdById,
      },
      include: {
        stockItem: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                sku: true,
                brand: true,
                model: true,
                storageGb: true,
                color: true,
                condition: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by itemId and aggregate quantities
    const itemsMap = new Map<string, {
      itemId: string;
      itemName: string;
      sku: string | null;
      quantity: number;
      imeis: string[];
    }>();

    for (const m of relatedMovements) {
      const itemId = m.stockItem.itemId;
      const item = m.stockItem.item;
      const itemName = item?.name || m.stockItem.model || 'Unknown';
      const sku = item?.sku || m.stockItem.sku || null;

      if (!itemsMap.has(itemId)) {
        itemsMap.set(itemId, {
          itemId,
          itemName,
          sku,
          quantity: 0,
          imeis: [],
        });
      }

      const entry = itemsMap.get(itemId)!;
      entry.quantity += m.quantity;
      if (m.stockItem.imei) {
        entry.imeis.push(m.stockItem.imei);
      }
    }

    return {
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      quantityBefore: movement.quantityBefore,
      quantityAfter: movement.quantityAfter,
      reason: movement.reason,
      createdAt: movement.createdAt,
      createdBy: movement.createdBy,
      metadata: movement.metadata,
      items: Array.from(itemsMap.values()),
      totalItems: itemsMap.size,
      totalQuantity: Array.from(itemsMap.values()).reduce((sum, item) => sum + item.quantity, 0),
      totalImeis: Array.from(itemsMap.values()).reduce((sum, item) => sum + item.imeis.length, 0),
    };
  }

  health() {
    return { ok: true, module: 'stock' };
  }
}
