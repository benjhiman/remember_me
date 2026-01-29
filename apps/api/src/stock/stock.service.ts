import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
  Scope,
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
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CreateStockEntryDto, StockEntryMode } from './dto/create-stock-entry.dto';
import {
  Role,
  StockStatus,
  StockMovementType,
  ReservationStatus,
} from '@remember-me/prisma';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable({ scope: Scope.REQUEST })
export class StockService {
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
    reservationId?: string,
    saleId?: string,
    metadata?: any,
  ) {
    return tx.stockMovement.create({
      data: {
        organizationId,
        stockItemId,
        type,
        quantity: quantityAfter - quantityBefore,
        quantityBefore,
        quantityAfter,
        reason,
        reservationId,
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
        stockReservations: {
          where: {
            status: ReservationStatus.ACTIVE,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Stock item not found');
    }

    // Prevent deletion if item has active reservations
    if (item.stockReservations.length > 0) {
      throw new BadRequestException('Cannot delete stock item with active reservations');
    }

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

  async reserveStock(organizationId: string, userId: string, dto: CreateReservationDto) {
    await this.verifyMembership(organizationId, userId);

    // Verify sale belongs to organization if provided
    if (dto.saleId) {
      const sale = await this.prisma.sale.findFirst({
        where: {
          id: dto.saleId,
          organizationId,
        },
      });

      if (!sale) {
        throw new NotFoundException('Sale not found');
      }
    }

    // Use transaction for concurrency control (Prisma handles locking)
    return this.prisma.$transaction(async (tx) => {
      // Lock the stock item row - use findFirst (transaction provides isolation)
      // Note: We check deletedAt after the query to allow proper error handling
      const stockItem = await tx.stockItem.findFirst({
        where: {
          id: dto.stockItemId,
          organizationId,
        },
      });

      if (!stockItem) {
        throw new NotFoundException('Stock item not found');
      }

      if (stockItem.deletedAt) {
        throw new BadRequestException('Cannot reserve a deleted stock item');
      }

        // Verify item is available
        if (stockItem.status !== StockStatus.AVAILABLE) {
          throw new BadRequestException(`Stock item is not available. Status: ${stockItem.status}`);
        }

        // Get active reservations for this item
        const activeReservations = await tx.stockReservation.aggregate({
          where: {
            stockItemId: dto.stockItemId,
            status: ReservationStatus.ACTIVE,
            organizationId,
          },
          _sum: {
            quantity: true,
          },
        });

        const reservedQuantity = activeReservations._sum.quantity || 0;
        const availableQuantity = stockItem.quantity - reservedQuantity;

        // Check if enough quantity is available
        if (availableQuantity < dto.quantity) {
          throw new BadRequestException(
            `Not enough stock available. Available: ${availableQuantity}, Requested: ${dto.quantity}`,
          );
        }

        // Create reservation
        const reservation = await tx.stockReservation.create({
          data: {
            organizationId,
            stockItemId: dto.stockItemId,
            quantity: dto.quantity,
            status: ReservationStatus.ACTIVE,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            saleId: dto.saleId,
            createdById: userId,
            notes: dto.notes,
          },
        });

        // Create movement (RESERVE type, quantity doesn't change)
        await this.createMovement(
          tx,
          organizationId,
          dto.stockItemId,
          StockMovementType.RESERVE,
          stockItem.quantity,
          stockItem.quantity, // quantity doesn't change on reserve
          userId,
          'Stock reserved',
          reservation.id,
          dto.saleId,
        );

      return reservation;
    });
  }

  async releaseReservation(organizationId: string, userId: string, reservationId: string) {
    await this.verifyMembership(organizationId, userId);

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findFirst({
        where: {
          id: reservationId,
          organizationId,
        },
        include: {
          stockItem: true,
        },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot release reservation. Status is ${reservation.status}`,
        );
      }

      // Update reservation status
      const updatedReservation = await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CANCELLED },
      });

      // Create movement (RELEASE type, quantity doesn't change)
      await this.createMovement(
        tx,
        organizationId,
        reservation.stockItemId,
        StockMovementType.RELEASE,
        reservation.stockItem.quantity,
        reservation.stockItem.quantity, // quantity doesn't change on release
        userId,
        'Reservation released',
        reservationId,
        reservation.saleId || undefined,
      );

      // Audit log
      const metadata = this.getRequestMetadata();
      await this.auditLogService.log({
        organizationId,
        actorUserId: userId,
        requestId: metadata.requestId,
        action: AuditAction.RELEASE,
        entityType: AuditEntityType.StockReservation,
        entityId: reservationId,
        before: {
          id: reservation.id,
          status: reservation.status,
          quantity: reservation.quantity.toString(),
        },
        after: {
          id: updatedReservation.id,
          status: updatedReservation.status,
        },
        metadata: {
          ...metadata,
          stockItemId: reservation.stockItemId,
          saleId: reservation.saleId || null,
        },
      });

      return updatedReservation;
    });
  }

  async confirmReservation(organizationId: string, userId: string, reservationId: string) {
    await this.verifyMembership(organizationId, userId);

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.stockReservation.findFirst({
        where: {
          id: reservationId,
          organizationId,
        },
        include: {
          stockItem: true,
        },
      });

      if (!reservation) {
        throw new NotFoundException('Reservation not found');
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot confirm reservation. Status is ${reservation.status}`,
        );
      }

      const quantityBefore = reservation.stockItem.quantity;
      const quantityAfter = quantityBefore - reservation.quantity;

      // Never allow negative stock
      if (quantityAfter < 0) {
        throw new BadRequestException(
          `Cannot confirm reservation. Current quantity: ${quantityBefore}, reservation: ${reservation.quantity}. Result would be negative.`,
        );
      }

      const before = {
        id: reservation.id,
        status: reservation.status,
        quantity: reservation.quantity.toString(),
        stockItemQuantity: quantityBefore.toString(),
      };

      // Update item quantity and status if IMEI (quantity = 1)
      const updateData: any = {
        quantity: quantityAfter,
      };

      if (reservation.stockItem.imei && quantityAfter === 0) {
        updateData.status = StockStatus.SOLD;
      }

      await tx.stockItem.update({
        where: { id: reservation.stockItemId },
        data: updateData,
      });

      // Update reservation status
      const updatedReservation = await tx.stockReservation.update({
        where: { id: reservationId },
        data: { status: ReservationStatus.CONFIRMED },
      });

      // Create movement (SOLD type)
      await this.createMovement(
        tx,
        organizationId,
        reservation.stockItemId,
        StockMovementType.SOLD,
        quantityBefore,
        quantityAfter,
        userId,
        'Reservation confirmed - stock sold',
        reservationId,
        reservation.saleId || undefined,
      );

      // Audit log
      const metadata = this.getRequestMetadata();
      await this.auditLogService.log({
        organizationId,
        actorUserId: userId,
        requestId: metadata.requestId,
        action: AuditAction.CONFIRM,
        entityType: AuditEntityType.StockReservation,
        entityId: reservationId,
        before,
        after: {
          id: updatedReservation.id,
          status: updatedReservation.status,
          stockItemQuantity: quantityAfter.toString(),
        },
        metadata: {
          ...metadata,
          stockItemId: reservation.stockItemId,
          saleId: reservation.saleId || null,
          quantityBefore: quantityBefore.toString(),
          quantityAfter: quantityAfter.toString(),
        },
      });

      return updatedReservation;
    });
  }

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

  async listReservations(
    organizationId: string,
    userId: string,
    itemId?: string,
    status?: ReservationStatus,
    page: number = 1,
    limit: number = 50,
  ) {
    await this.verifyMembership(organizationId, userId);

    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
    };

    if (itemId) {
      where.stockItemId = itemId;
    }

    if (status) {
      where.status = status;
    }

    const [reservations, total] = await Promise.all([
      this.prisma.stockReservation.findMany({
        where,
        include: {
          stockItem: {
            select: {
              id: true,
              model: true,
              sku: true,
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
      this.prisma.stockReservation.count({ where }),
    ]);

    return {
      data: reservations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReservation(organizationId: string, userId: string, reservationId: string) {
    await this.verifyMembership(organizationId, userId);

    const reservation = await this.prisma.stockReservation.findFirst({
      where: {
        id: reservationId,
        organizationId,
      },
      include: {
        stockItem: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return reservation;
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
    const storage = itemAttributes.storage;
    const color = itemAttributes.color;

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
            quantity: dto.quantity!,
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
          dto.quantity!,
          userId,
          'Stock entry created',
          undefined,
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

  health() {
    return { ok: true, module: 'stock' };
  }
}
