import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Scope,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditAction, AuditEntityType } from '@remember-me/prisma';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { ListSalesDto } from './dto/list-sales.dto';
import {
  Role,
  SaleStatus,
  StockStatus,
  StockMovementType,
} from '@remember-me/prisma';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
// import { WhatsAppAutomationsService } from '../integrations/whatsapp/whatsapp-automations.service';
import { AttributionService } from '../dashboard/attribution.service';
import { OrgSettingsService } from '../settings/org-settings.service';

@Injectable({ scope: Scope.REQUEST })
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
    // @Inject(forwardRef(() => WhatsAppAutomationsService))
    // private automationsService?: WhatsAppAutomationsService,
    private attributionService?: AttributionService,
    private orgSettings?: OrgSettingsService,
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

  // Helper: Check if user can access sale (admin/manager or created/assigned)
  private canAccessSale(
    role: Role,
    saleCreatedById: string,
    saleAssignedToId: string,
    userId: string,
  ): boolean {
    if (this.hasAdminManagerAccess(role)) {
      return true;
    }
    // SELLER can only access if created by them or assigned to them
    return saleCreatedById === userId || saleAssignedToId === userId;
  }

  // Helper: Generate unique sale number
  private async generateSaleNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const lastSale = await this.prisma.sale.findFirst({
      where: {
        organizationId,
        saleNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        saleNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastSale) {
      const lastNumber = lastSale.saleNumber.replace(prefix, '');
      sequence = parseInt(lastNumber, 10) + 1;
    }

    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  }

  // Helper: Validate sale number uniqueness
  private async validateSaleNumber(organizationId: string, saleNumber: string, excludeSaleId?: string): Promise<void> {
    const existing = await this.prisma.sale.findFirst({
      where: {
        organizationId,
        saleNumber,
        ...(excludeSaleId ? { id: { not: excludeSaleId } } : {}),
      },
    });

    if (existing) {
      throw new BadRequestException(`Invoice number ${saleNumber} already exists`);
    }
  }

  // Helper: Create stock movement (internal use)
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
        // reservationId, // Not available in current schema
        saleId,
        createdById,
        metadata,
      },
    });
  }


  async createSale(organizationId: string, userId: string, dto: CreateSaleDto) {
    const { role } = await this.verifyMembership(organizationId, userId);
    const settings = this.orgSettings
      ? await this.orgSettings.getSettings(organizationId)
      : null;
    if (role === Role.SELLER && settings && !settings.crm.permissions.sellerCanEditSales) {
      throw new ForbiddenException('Seller cannot create sales (disabled by organization settings)');
    }

    // Validate: must have items
    const hasItems = dto.items && dto.items.length > 0;

    if (!hasItems) {
      throw new BadRequestException('Sale must have at least one item');
    }

    // Verify lead belongs to organization if provided
    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.leadId,
          organizationId,
        },
      });

      if (!lead) {
        throw new NotFoundException('Lead not found');
      }
    }

    let itemsToCreate: any[] = [];
    let subtotal = 0;

    // Process items
    if (hasItems) {
    itemsToCreate = await Promise.all(
      dto.items!.map(async (item) => {
        let stockItemId: string | null = null;
        let unitPrice: Decimal;

        // If stockItemId is provided, verify it exists and get price
        if (item.stockItemId) {
          const stockItem = await this.prisma.stockItem.findFirst({
            where: {
              id: item.stockItemId,
              organizationId,
              deletedAt: null,
            },
          });

          if (!stockItem) {
            throw new NotFoundException(`Stock item ${item.stockItemId} not found`);
          }

          stockItemId = stockItem.id;
          unitPrice = stockItem.basePrice || new Decimal(0);
        } else {
          // Use provided unitPrice directly
          unitPrice = new Decimal(item.unitPrice);
        }

        const totalPrice = new Decimal(parseFloat(unitPrice.toString()) * item.quantity);
        subtotal += parseFloat(totalPrice.toString());

        return {
          stockItemId,
          model: item.model,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        };
      }),
    );
  }

  const discount = dto.discount || 0;
  const total = subtotal - discount;

  // Generate or validate sale number
  let saleNumber: string;
  if (dto.saleNumber) {
    // Validate manual sale number
    await this.validateSaleNumber(organizationId, dto.saleNumber);
    saleNumber = dto.saleNumber;
  } else {
    // Auto-generate sale number
    saleNumber = await this.generateSaleNumber(organizationId);
  }

    return this.prisma.$transaction(async (tx) => {
      // Create sale
      const sale = await tx.sale.create({
        data: {
          organizationId,
          createdById: userId,
          assignedToId: userId,
          leadId: dto.leadId,
          saleNumber,
          status: SaleStatus.DRAFT,
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone,
          customerCity: dto.customerCity,
          subtotal: new Decimal(subtotal),
          discount: new Decimal(discount),
          total: new Decimal(total),
          currency: dto.currency || 'USD',
          notes: dto.notes || dto.subject,
          metadata: {
            ...(dto.metadata || {}),
            location: dto.location,
            orderNumber: dto.orderNumber,
            subject: dto.subject,
            customerAddress: dto.customerAddress,
            customerInstagram: dto.customerInstagram,
            customerWeb: dto.customerWeb,
          },
          items: {
            create: itemsToCreate,
          },
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  model: true,
                  sku: true,
                  imei: true,
                },
              },
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
        entityType: AuditEntityType.Sale,
        entityId: sale.id,
        before: null,
        after: {
          id: sale.id,
          saleNumber: sale.saleNumber,
          status: sale.status,
          customerName: sale.customerName,
          total: sale.total.toString(),
        },
        metadata: {
          ...metadata,
          leadId: dto.leadId || null,
        },
      });

      return sale;
    });
  }

  async listSales(organizationId: string, userId: string, dto: ListSalesDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const page = dto.page || 1;
    const limit = dto.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      deletedAt: null, // Exclude soft-deleted sales by default
    };

    // Include deleted only for ADMIN/MANAGER/OWNER
    if (dto.includeDeleted && this.hasAdminManagerAccess(role)) {
      delete where.deletedAt;
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.createdById) {
      where.createdById = dto.createdById;
    }

    // SELLER can only see sales they created or are assigned to
    if (!this.hasAdminManagerAccess(role)) {
      where.OR = [{ createdById: userId }, { assignedToId: userId }];
    }

    if (dto.q) {
      where.OR = [
        ...(where.OR || []),
        { saleNumber: { contains: dto.q, mode: 'insensitive' } },
        { customerName: { contains: dto.q, mode: 'insensitive' } },
        { customerEmail: { contains: dto.q, mode: 'insensitive' } },
        { customerPhone: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    if (dto.createdFrom || dto.createdTo) {
      where.createdAt = {};
      if (dto.createdFrom) {
        where.createdAt.gte = new Date(dto.createdFrom);
      }
      if (dto.createdTo) {
        where.createdAt.lte = new Date(dto.createdTo);
      }
    }

    const orderBy: any = {};
    const sortField = dto.sort || 'createdAt';
    const sortOrder = dto.order || 'desc';
    orderBy[sortField] = sortOrder;

    const [sales, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lead: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  model: true,
                  sku: true,
                  imei: true,
                },
              },
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data: sales,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSale(organizationId: string, userId: string, saleId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted sales
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                model: true,
                sku: true,
                imei: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (!this.canAccessSale(role, sale.createdById, sale.assignedToId, userId)) {
      throw new ForbiddenException('You do not have access to this sale');
    }

    return sale;
  }

  async updateSale(organizationId: string, userId: string, saleId: string, dto: UpdateSaleDto) {
    const { role } = await this.verifyMembership(organizationId, userId);
    const settings = this.orgSettings
      ? await this.orgSettings.getSettings(organizationId)
      : null;
    if (role === Role.SELLER && settings && !settings.crm.permissions.sellerCanEditSales) {
      throw new ForbiddenException('Seller cannot edit sales (disabled by organization settings)');
    }

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted sales
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.deletedAt) {
      throw new BadRequestException('Cannot update a deleted sale');
    }

    if (!this.canAccessSale(role, sale.createdById, sale.assignedToId, userId)) {
      throw new ForbiddenException('You do not have access to update this sale');
    }

    // Cannot update if SHIPPED or DELIVERED
    if (sale.status === SaleStatus.SHIPPED || sale.status === SaleStatus.DELIVERED) {
      throw new BadRequestException('Cannot update sale that is SHIPPED or DELIVERED');
    }

    const updateData: any = {};

    if (dto.customerName !== undefined) updateData.customerName = dto.customerName;
    if (dto.customerEmail !== undefined) updateData.customerEmail = dto.customerEmail;
    if (dto.customerPhone !== undefined) updateData.customerPhone = dto.customerPhone;

    // Recalculate total if discount changed
    if (dto.discount !== undefined) {
      const subtotal = parseFloat(sale.subtotal.toString());
      const discount = dto.discount;
      const total = subtotal - discount;
      updateData.discount = new Decimal(discount);
      updateData.total = new Decimal(total);
    }

    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

    const before = {
      id: sale.id,
      status: sale.status,
      customerName: sale.customerName,
      customerEmail: sale.customerEmail,
      total: sale.total.toString(),
    };

    const updated = await this.prisma.sale.update({
      where: { id: saleId },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                model: true,
                sku: true,
                imei: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Audit log
    const user = (this.request as any).user;
    const requestId = (this.request as any).requestId || null;
    const ip = this.request.ip || (this.request.socket?.remoteAddress) || this.request.headers['x-forwarded-for'] || null;
    const userAgent = this.request.get('user-agent') || null;
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      actorRole: role,
      actorEmail: user?.email || null,
      requestId,
      action: AuditAction.SALE_UPDATED,
      entityType: AuditEntityType.Sale,
      entityId: saleId,
      before,
      after: {
        id: updated.id,
        status: updated.status,
        customerName: updated.customerName,
        customerEmail: updated.customerEmail,
        total: updated.total.toString(),
      },
      metadata: {
        method: this.request.method,
        path: this.request.path || this.request.url,
        requestId,
        updatedFields: Object.keys(updateData),
      },
      ip,
      userAgent,
      source: 'api',
      severity: 'info',
    });

    return updated;
  }

  async paySale(organizationId: string, userId: string, saleId: string) {
    await this.verifyMembership(organizationId, userId);

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted sales
      },
      include: {
        items: {
          include: {
            stockItem: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.deletedAt) {
      throw new BadRequestException('Cannot pay a deleted sale');
    }

    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException(`Sale must be DRAFT to pay. Current status: ${sale.status}`);
    }

    const before = {
      id: sale.id,
      status: sale.status,
    };

    return this.prisma.$transaction(
      async (tx) => {
        // Process items: reduce stock quantities
        for (const item of sale.items) {
          if (item.stockItemId && item.stockItem) {
            const quantityBefore = item.stockItem.quantity;
            const quantityAfter = quantityBefore - item.quantity;

            if (quantityAfter < 0) {
              throw new BadRequestException(
                `Cannot pay sale. Insufficient stock for ${item.model}. Current: ${quantityBefore}, Required: ${item.quantity}`,
              );
            }

            const updateData: any = {
              quantity: quantityAfter,
            };

            if (item.stockItem.imei && quantityAfter === 0) {
              updateData.status = StockStatus.SOLD;
            }

            await tx.stockItem.update({
              where: { id: item.stockItemId },
              data: updateData,
            });

            await this.createMovement(
              tx,
              organizationId,
              item.stockItemId,
              StockMovementType.SOLD,
              quantityBefore,
              quantityAfter,
              userId,
              'Sale paid',
              undefined,
              saleId,
            );
          }
        }

        // Update sale status
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: SaleStatus.PAID,
            paidAt: new Date(),
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            items: {
              include: {
                stockItem: {
                  select: {
                    id: true,
                    model: true,
                    sku: true,
                    imei: true,
                    status: true,
                  },
                },
              },
            },
          },
        });

        // Create attribution snapshot if lead has Meta Ads data
        if (this.attributionService) {
          try {
            await this.attributionService.createAttributionSnapshot(
              tx,
              organizationId,
              saleId,
              sale.leadId || null,
            );
          } catch (error) {
            // Log error but don't fail the transaction
            this.logger.error(
              `Failed to create attribution snapshot for sale ${saleId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }

        // Audit log
        const metadata = this.getRequestMetadata();
        await this.auditLogService.log({
          organizationId,
          actorUserId: userId,
          requestId: metadata.requestId,
          action: AuditAction.PAY,
          entityType: AuditEntityType.Sale,
          entityId: saleId,
          before,
          after: {
            id: updatedSale.id,
            status: updatedSale.status,
            paidAt: updatedSale.paidAt?.toISOString() || null,
          },
          metadata: {
            ...metadata,
          },
        });

        return updatedSale;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async cancelSale(organizationId: string, userId: string, saleId: string) {
    await this.verifyMembership(organizationId, userId);

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted sales
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.deletedAt) {
      throw new BadRequestException('Cannot cancel a deleted sale');
    }

    // Cannot cancel if SHIPPED or DELIVERED
    if (sale.status === SaleStatus.SHIPPED || sale.status === SaleStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel sale that is SHIPPED or DELIVERED');
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('Sale is already CANCELLED');
    }

    const before = {
      id: sale.id,
      status: sale.status,
    };

    return this.prisma.$transaction(
      async (tx) => {

        // Update sale status
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: SaleStatus.CANCELLED,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            items: {
              include: {
                stockItem: {
                  select: {
                    id: true,
                    model: true,
                    sku: true,
                    imei: true,
                    status: true,
                  },
                },
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
          action: AuditAction.CANCEL,
          entityType: AuditEntityType.Sale,
          entityId: saleId,
          before,
          after: {
            id: updatedSale.id,
            status: updatedSale.status,
          },
          metadata: {
            ...metadata,
          },
        });

        return updatedSale;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async shipSale(organizationId: string, userId: string, saleId: string) {
    await this.verifyMembership(organizationId, userId);

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.status !== SaleStatus.PAID) {
      throw new BadRequestException(`Sale must be PAID to ship. Current status: ${sale.status}`);
    }

    const before = {
      id: sale.id,
      status: sale.status,
    };

    const updated = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.SHIPPED,
        shippedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                model: true,
                sku: true,
                imei: true,
                status: true,
              },
            },
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
      action: AuditAction.SHIP,
      entityType: AuditEntityType.Sale,
      entityId: saleId,
      before,
      after: {
        id: updated.id,
        status: updated.status,
        shippedAt: updated.shippedAt?.toISOString() || null,
      },
      metadata,
    });

    return updated;
  }

  async deliverSale(organizationId: string, userId: string, saleId: string) {
    await this.verifyMembership(organizationId, userId);

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted sales
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    if (sale.deletedAt) {
      throw new BadRequestException('Cannot deliver a deleted sale');
    }

    if (sale.status !== SaleStatus.SHIPPED) {
      throw new BadRequestException(`Sale must be SHIPPED to deliver. Current status: ${sale.status}`);
    }

    const before = {
      id: sale.id,
      status: sale.status,
    };

    const updated = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.DELIVERED,
        deliveredAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                model: true,
                sku: true,
                imei: true,
                status: true,
              },
            },
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
      action: AuditAction.DELIVER,
      entityType: AuditEntityType.Sale,
      entityId: saleId,
      before,
      after: {
        id: updated.id,
        status: updated.status,
        deliveredAt: updated.deliveredAt?.toISOString() || null,
      },
      metadata,
    });

    return updated;
  }

  async deleteSale(organizationId: string, userId: string, saleId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can delete sales');
    }

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
        deletedAt: null, // Only delete if not already deleted
      },
      include: {
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    // Can only delete if DRAFT
    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Can only delete sales with DRAFT status');
    }

    // Cannot delete if has linked reservations

    const before = {
      id: sale.id,
      status: sale.status,
      saleNumber: sale.saleNumber,
      deletedAt: sale.deletedAt,
    };

    // Soft delete: set deletedAt instead of actual delete
    await this.prisma.sale.update({
      where: { id: saleId },
      data: { deletedAt: new Date() },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.Sale,
      entityId: saleId,
      before,
      after: { deletedAt: new Date().toISOString() },
      metadata,
    });

    return { message: 'Sale deleted successfully' };
  }

  async restoreSale(organizationId: string, userId: string, saleId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can restore sales');
    }

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        organizationId,
        deletedAt: { not: null }, // Only restore if deleted
      },
      include: {
      },
    });

    if (!sale) {
      throw new NotFoundException('Deleted sale not found');
    }

    const before = {
      id: sale.id,
      saleNumber: sale.saleNumber,
      deletedAt: sale.deletedAt?.toISOString() || null,
    };

    const restored = await this.prisma.sale.update({
      where: { id: saleId },
      data: { deletedAt: null },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                model: true,
                sku: true,
              },
            },
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
      entityType: AuditEntityType.Sale,
      entityId: saleId,
      before,
      after: {
        id: restored.id,
        deletedAt: null,
      },
      metadata,
    });

    return restored;
  }

  health() {
    return { ok: true, module: 'sales' };
  }
}
