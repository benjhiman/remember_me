import {
  Injectable,
  NotFoundException,
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
import { AuditAction, AuditEntityType } from '@remember-me/prisma';

@Injectable({ scope: Scope.REQUEST })
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
  ) {}

  async listCustomers(organizationId: string, userId: string, dto: ListCustomersDto) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
    };

    // Search by name or email
    if (dto.q) {
      where.OR = [
        { name: { contains: dto.q, mode: 'insensitive' } },
        { email: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    // Filter by status
    if (dto.status) {
      where.status = dto.status;
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
          status: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          createdById: true,
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

  async getCustomer(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async createCustomer(organizationId: string, userId: string, dto: CreateCustomerDto) {
    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        createdById: userId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
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

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        city: dto.city,
        address: dto.address,
        instagram: dto.instagram,
        web: dto.web,
        notes: dto.notes,
        status: dto.status,
      },
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
