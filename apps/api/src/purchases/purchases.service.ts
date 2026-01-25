import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { TransitionPurchaseDto } from './dto/transition-purchase.dto';
import { ListPurchasesDto } from './dto/list-purchases.dto';
import { AuditAction, AuditEntityType, PurchaseStatus } from '@remember-me/prisma';

@Injectable({ scope: Scope.REQUEST })
export class PurchasesService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
  ) {}

  /**
   * Calculate totals from lines
   */
  private calculateTotals(lines: Array<{ quantity: number; unitPriceCents: number }>) {
    const subtotalCents = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPriceCents,
      0,
    );
    const taxCents = 0; // Placeholder for future tax calculation
    const totalCents = subtotalCents + taxCents;
    return { subtotalCents, taxCents, totalCents };
  }

  /**
   * Validate transition rules
   */
  private validateTransition(from: PurchaseStatus, to: PurchaseStatus): void {
    if (from === to) {
      return; // No-op transition
    }

    // RECEIVED cannot be cancelled
    if (from === PurchaseStatus.RECEIVED && to === PurchaseStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'INVALID_TRANSITION',
        message: 'Cannot cancel a received purchase',
        from,
        to,
      });
    }

    // Valid transitions:
    // DRAFT -> APPROVED, CANCELLED
    // APPROVED -> RECEIVED, CANCELLED
    // RECEIVED -> (none, already received)
    // CANCELLED -> (none, already cancelled)

    const validTransitions: Record<PurchaseStatus, PurchaseStatus[]> = {
      [PurchaseStatus.DRAFT]: [PurchaseStatus.APPROVED, PurchaseStatus.CANCELLED],
      [PurchaseStatus.APPROVED]: [PurchaseStatus.RECEIVED, PurchaseStatus.CANCELLED],
      [PurchaseStatus.RECEIVED]: [], // No transitions allowed
      [PurchaseStatus.CANCELLED]: [], // No transitions allowed
    };

    const allowed = validTransitions[from] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_TRANSITION',
        message: `Cannot transition from ${from} to ${to}`,
        from,
        to,
      });
    }
  }

  async listPurchases(organizationId: string, userId: string, dto: ListPurchasesDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
    };

    // Filter by status
    if (dto.status) {
      where.status = dto.status;
    }

    // Filter by vendor
    if (dto.vendorId) {
      where.vendorId = dto.vendorId;
    }

    // Search by vendor name or purchase ID
    if (dto.q) {
      where.OR = [
        { id: { contains: dto.q, mode: 'insensitive' } },
        { vendor: { name: { contains: dto.q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          notes: true,
          subtotalCents: true,
          taxCents: true,
          totalCents: true,
          approvedAt: true,
          receivedAt: true,
          cancelledAt: true,
          createdAt: true,
          updatedAt: true,
          vendor: {
            select: {
              id: true,
              name: true,
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
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getPurchase(organizationId: string, id: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        lines: {
          orderBy: { createdAt: 'asc' },
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

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    return purchase;
  }

  async createPurchase(organizationId: string, userId: string, dto: CreatePurchaseDto) {
    // Verify vendor belongs to organization
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        id: dto.vendorId,
        organizationId,
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    // Validate lines
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Purchase must have at least one line');
    }

    // Calculate totals
    const { subtotalCents, taxCents, totalCents } = this.calculateTotals(dto.lines);

    // Create purchase with lines in transaction
    const purchase = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          organizationId,
          vendorId: dto.vendorId,
          createdById: userId,
          status: PurchaseStatus.DRAFT,
          notes: dto.notes,
          subtotalCents,
          taxCents,
          totalCents,
        },
      });

      // Create lines
      await tx.purchaseLine.createMany({
        data: dto.lines.map((line) => ({
          purchaseId: purchase.id,
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          lineTotalCents: line.quantity * line.unitPriceCents,
          sku: line.sku,
        })),
      });

      // Reload with relations
      const created = await tx.purchase.findUnique({
        where: { id: purchase.id },
        include: {
          vendor: true,
          lines: true,
        },
      });
      
      if (!created) {
        throw new NotFoundException('Purchase not found after creation');
      }
      
      return created;
    });

    // Audit log
    const requestId = (this.request as any).requestId || null;
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.Purchase,
      entityId: purchase.id,
      after: purchase,
    });

    return purchase;
  }

  async updatePurchase(
    organizationId: string,
    id: string,
    userId: string,
    dto: UpdatePurchaseDto,
  ) {
    // Get existing purchase
    const existing = await this.prisma.purchase.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        lines: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Purchase not found');
    }

    // Only DRAFT purchases can be edited
    if (existing.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException({
        code: 'INVALID_STATUS',
        message: 'Only DRAFT purchases can be edited',
        currentStatus: existing.status,
      });
    }

    // Update vendor if provided
    if (dto.vendorId && dto.vendorId !== existing.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          id: dto.vendorId,
          organizationId,
        },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }
    }

    // Update purchase and lines in transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update purchase fields
      const updateData: any = {};
      if (dto.vendorId) updateData.vendorId = dto.vendorId;
      if (dto.notes !== undefined) updateData.notes = dto.notes;

      // Update lines if provided
      if (dto.lines) {
        if (dto.lines.length === 0) {
          throw new BadRequestException('Purchase must have at least one line');
        }

        // Delete existing lines
        await tx.purchaseLine.deleteMany({
          where: { purchaseId: id },
        });

        // Create new lines
        await tx.purchaseLine.createMany({
          data: dto.lines.map((line) => ({
            purchaseId: id,
            description: line.description,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            lineTotalCents: line.quantity * line.unitPriceCents,
            sku: line.sku,
          })),
        });

        // Recalculate totals
        const { subtotalCents, taxCents, totalCents } = this.calculateTotals(dto.lines);
        updateData.subtotalCents = subtotalCents;
        updateData.taxCents = taxCents;
        updateData.totalCents = totalCents;
      }

      // Update purchase
      await tx.purchase.update({
        where: { id },
        data: updateData,
      });

      // Reload with relations
      const reloaded = await tx.purchase.findUnique({
        where: { id },
        include: {
          vendor: true,
          lines: true,
        },
      });
      
      if (!reloaded) {
        throw new NotFoundException('Purchase not found after update');
      }
      
      return reloaded;
    });

    // Audit log
    const requestId = (this.request as any).requestId || null;
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Purchase,
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  }

  async transitionPurchase(
    organizationId: string,
    id: string,
    userId: string,
    dto: TransitionPurchaseDto,
  ) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!purchase) {
      throw new NotFoundException('Purchase not found');
    }

    // Validate transition
    this.validateTransition(purchase.status, dto.status);

    // Prepare update data with timestamps
    const updateData: any = {
      status: dto.status,
    };

    if (dto.status === PurchaseStatus.APPROVED && !purchase.approvedAt) {
      updateData.approvedAt = new Date();
    } else if (dto.status === PurchaseStatus.RECEIVED && !purchase.receivedAt) {
      updateData.receivedAt = new Date();
    } else if (dto.status === PurchaseStatus.CANCELLED && !purchase.cancelledAt) {
      updateData.cancelledAt = new Date();
    }

    // Apply stock impact if transitioning to RECEIVED
    if (dto.status === PurchaseStatus.RECEIVED) {
      await this.applyPurchaseToStock(organizationId, id, userId);
    }

    const updated = await this.prisma.purchase.update({
      where: { id },
      data: updateData,
      include: {
        vendor: true,
        lines: true,
      },
    });

    // Audit log
    const requestId = (this.request as any).requestId || null;
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Purchase,
      entityId: updated.id,
      before: purchase,
      after: updated,
      metadata: {
        transition: {
          from: purchase.status,
          to: dto.status,
        },
      },
    });

    return updated;
  }
}
