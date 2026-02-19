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
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { AuditAction, AuditEntityType, Role } from '@remember-me/prisma';

@Injectable({ scope: Scope.REQUEST })
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
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

  async listCustomers(organizationId: string, userId: string, dto: ListCustomersDto) {
    const { role } = await this.verifyMembership(organizationId, userId);
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
    };

    // Search by name, email, or phone
    if (dto.q) {
      where.OR = [
        { name: { contains: dto.q, mode: 'insensitive' } },
        { email: { contains: dto.q, mode: 'insensitive' } },
        { phone: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    // Filter by status
    if (dto.status) {
      where.status = dto.status;
    }

    // Filter by sellerId (admin only)
    if (dto.sellerId) {
      if (!this.hasAdminManagerAccess(role)) {
        throw new ForbiddenException('Only admins and managers can filter by seller');
      }
      where.assignedToId = dto.sellerId;
    }

    // Filter by mine (assigned to current user)
    if (dto.mine === true) {
      where.assignedToId = userId;
    }

    // SELLER: can only see customers assigned to them or created by them (if not assigned)
    if (role === Role.SELLER && !dto.sellerId && dto.mine !== true) {
      where.OR = [
        { assignedToId: userId },
        { AND: [{ assignedToId: null }, { createdById: userId }] },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          taxId: true,
          city: true,
          address: true,
          instagram: true,
          web: true,
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
          assignedToId: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getCustomer(organizationId: string, userId: string, id: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // SELLER: can only access customers assigned to them
    if (role === Role.SELLER && customer.assignedToId !== userId) {
      throw new ForbiddenException('You can only access customers assigned to you');
    }

    return customer;
  }

  async getCustomerInvoices(organizationId: string, userId: string, customerId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    // Verify customer exists and user has access
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // SELLER: can only access customers assigned to them
    if (role === Role.SELLER && customer.assignedToId !== userId) {
      throw new ForbiddenException('You can only access customers assigned to you');
    }

    // Get sales (invoices) for this customer
    // Match by customerName, customerEmail, or customerPhone
    const sales = await this.prisma.sale.findMany({
      where: {
        organizationId,
        OR: [
          { customerName: customer.name },
          customer.email ? { customerEmail: customer.email } : undefined,
          customer.phone ? { customerPhone: customer.phone } : undefined,
        ].filter(Boolean) as any[],
        deletedAt: null,
      },
      select: {
        id: true,
        saleNumber: true,
        createdAt: true,
        total: true,
        status: true,
        paidAt: true,
        shippedAt: true,
        deliveredAt: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sales.map((sale) => ({
      id: sale.id,
      number: sale.saleNumber,
      issuedAt: sale.createdAt,
      amountTotal: parseFloat(sale.total.toString()),
      paymentStatus: sale.paidAt ? 'PAID' : 'UNPAID',
      deliveryStatus: sale.deliveredAt ? 'DELIVERED' : sale.shippedAt ? 'SHIPPED' : 'NOT_DELIVERED',
      workflowStatus: sale.status === 'CANCELLED' ? 'CANCELLED' : sale.status === 'DRAFT' ? 'STANDBY' : 'ACTIVE',
      seller: sale.assignedTo,
    }));
  }

  async createCustomer(organizationId: string, userId: string, dto: CreateCustomerDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    let assignedToId = dto.assignedToId;

    // SELLER: auto-assign to themselves, cannot assign to others
    if (role === Role.SELLER) {
      if (assignedToId && assignedToId !== userId) {
        throw new ForbiddenException('Sellers can only assign customers to themselves');
      }
      // Force assignment to seller
      assignedToId = userId;
    } else if (this.hasAdminManagerAccess(role)) {
      // ADMIN/MANAGER/OWNER: can assign to any user
      // If not assigned, default to the admin/manager creating it
      if (!assignedToId) {
        assignedToId = userId;
      }
      // Verify assigned user belongs to the organization
      if (assignedToId) {
        const assignedUser = await this.prisma.membership.findFirst({
          where: {
            organizationId,
            userId: assignedToId,
          },
        });
        if (!assignedUser) {
          throw new ForbiddenException('Assigned user must belong to the organization');
        }
      }
    }

    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        createdById: userId,
        assignedToId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        taxId: dto.taxId,
        city: dto.city,
        address: dto.address,
        instagram: dto.instagram,
        web: dto.web,
        notes: dto.notes,
        status: dto.status || 'ACTIVE',
      },
    });

    // Audit log
    const requestId = (this.request as any).requestId || null;
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.Customer,
      entityId: customer.id,
      after: customer,
    });

    return customer;
  }

  async updateCustomer(organizationId: string, id: string, userId: string, dto: UpdateCustomerDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    // Get existing customer to log before state
    const existing = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    // SELLER: can only update customers assigned to them
    if (role === Role.SELLER && existing.assignedToId !== userId) {
      throw new ForbiddenException('You can only update customers assigned to you');
    }

    // Only ADMIN/MANAGER can re-assign customers
    const updateData: any = {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      taxId: dto.taxId,
      city: dto.city,
      address: dto.address,
      instagram: dto.instagram,
      web: dto.web,
      notes: dto.notes,
      status: dto.status,
    };

    if (dto.assignedToId !== undefined) {
      if (!this.hasAdminManagerAccess(role)) {
        throw new ForbiddenException('Only admins and managers can reassign customers');
      }
      updateData.assignedToId = dto.assignedToId;
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    const requestId = (this.request as any).requestId || null;
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Customer,
      entityId: customer.id,
      before: existing,
      after: customer,
    });

    return customer;
  }
}
