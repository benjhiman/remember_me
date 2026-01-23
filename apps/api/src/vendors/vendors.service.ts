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
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ListVendorsDto } from './dto/list-vendors.dto';
import { AuditAction, AuditEntityType } from '@remember-me/prisma';

@Injectable({ scope: Scope.REQUEST })
export class VendorsService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
  ) {}

  async listVendors(organizationId: string, userId: string, dto: ListVendorsDto) {
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
      this.prisma.vendor.findMany({
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
      this.prisma.vendor.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async getVendor(organizationId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async createVendor(organizationId: string, userId: string, dto: CreateVendorDto) {
    const vendor = await this.prisma.vendor.create({
      data: {
        organizationId,
        createdById: userId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
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
      entityType: AuditEntityType.Vendor,
      entityId: vendor.id,
      after: vendor,
    });

    return vendor;
  }

  async updateVendor(organizationId: string, id: string, userId: string, dto: UpdateVendorDto) {
    // Get existing vendor to log before state
    const existing = await this.prisma.vendor.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    const vendor = await this.prisma.vendor.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
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
      entityType: AuditEntityType.Vendor,
      entityId: vendor.id,
      before: existing,
      after: vendor,
    });

    return vendor;
  }
}
