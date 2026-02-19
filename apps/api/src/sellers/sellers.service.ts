import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Role, InviteStatus, SaleStatus } from '@remember-me/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';
import { InviteSellerDto } from './dto/invite-seller.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';

@Injectable({ scope: Scope.REQUEST })
export class SellersService {
  constructor(
    private prisma: PrismaService,
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

  /**
   * Get all sellers (members with SELLER role) in the organization
   * Admin-only endpoint
   */
  async getSellers(organizationId: string, userId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can view sellers');
    }

    const members = await this.prisma.membership.findMany({
      where: {
        organizationId,
        role: Role.SELLER,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      avatar: m.user.avatar,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Get seller stats (total invoiced, paid, outstanding, invoices count)
   * Admin-only endpoint
   */
  async getSellersStats(organizationId: string, userId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can view seller stats');
    }

    // Get all sellers
    const sellers = await this.prisma.membership.findMany({
      where: {
        organizationId,
        role: Role.SELLER,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Get sales for each seller
    const stats = await Promise.all(
      sellers.map(async (seller) => {
        const sales = await this.prisma.sale.findMany({
          where: {
            organizationId,
            assignedToId: seller.userId,
            deletedAt: null,
          },
          select: {
            id: true,
            total: true,
            status: true,
            paidAt: true,
          },
        });

        const totalInvoiced = sales.reduce(
          (sum, sale) => sum + parseFloat(sale.total.toString()),
          0,
        );

        const paidSales = sales.filter((s) => s.paidAt !== null);
        const totalPaid = paidSales.reduce(
          (sum, sale) => sum + parseFloat(sale.total.toString()),
          0,
        );

        const totalOutstanding = totalInvoiced - totalPaid;
        const invoicesCount = sales.length;

        // Get commission config if exists
        const commissionConfig = await this.prisma.commissionConfig.findUnique({
          where: {
            organizationId_sellerId: {
              organizationId,
              sellerId: seller.userId,
            },
          },
        });

        // Calculate commissions (simplified - would need more logic based on mode)
        let commissionsTotal = 0;
        if (commissionConfig) {
          if (commissionConfig.mode === 'PERCENT_SALE') {
            commissionsTotal = totalInvoiced * (parseFloat(commissionConfig.value.toString()) / 100);
          } else if (commissionConfig.mode === 'PER_UNIT') {
            // Would need to count items sold
            commissionsTotal = 0; // Placeholder
          }
        }

        return {
          sellerId: seller.userId,
          name: seller.user.name,
          email: seller.user.email,
          totalInvoiced,
          totalPaid,
          totalOutstanding,
          invoicesCount,
          commissionsTotal,
        };
      }),
    );

    // Sort by totalInvoiced desc
    return stats.sort((a, b) => b.totalInvoiced - a.totalInvoiced);
  }

  /**
   * Get seller overview (totals + invoices list)
   * Admin-only endpoint
   */
  async getSellerOverview(organizationId: string, userId: string, sellerId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can view seller overview');
    }

    // Verify seller exists and is a SELLER
    const sellerMembership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: sellerId,
        role: Role.SELLER,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!sellerMembership) {
      throw new NotFoundException('Seller not found');
    }

    // Get sales
    const sales = await this.prisma.sale.findMany({
      where: {
        organizationId,
        assignedToId: sellerId,
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
        customerName: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalInvoiced = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.total.toString()),
      0,
    );

    const paidSales = sales.filter((s) => s.paidAt !== null);
    const totalPaid = paidSales.reduce(
      (sum, sale) => sum + parseFloat(sale.total.toString()),
      0,
    );

    const totalOutstanding = totalInvoiced - totalPaid;
    const invoicesCount = sales.length;

    // Get commission config
    const commissionConfig = await this.prisma.commissionConfig.findUnique({
      where: {
        organizationId_sellerId: {
          organizationId,
          sellerId,
        },
      },
    });

    return {
      seller: {
        id: sellerMembership.user.id,
        name: sellerMembership.user.name,
        email: sellerMembership.user.email,
      },
      totals: {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        invoicesCount,
      },
      invoices: sales.map((sale) => ({
        id: sale.id,
        number: sale.saleNumber,
        issuedAt: sale.createdAt,
        amountTotal: parseFloat(sale.total.toString()),
        paymentStatus: sale.paidAt ? 'PAID' : 'UNPAID',
        deliveryStatus: sale.deliveredAt
          ? 'DELIVERED'
          : sale.shippedAt
            ? 'SHIPPED'
            : 'NOT_DELIVERED',
        workflowStatus:
          sale.status === 'CANCELLED'
            ? 'CANCELLED'
            : sale.status === 'DRAFT'
              ? 'STANDBY'
              : 'ACTIVE',
        customerName: sale.customerName,
      })),
      commissionConfig: commissionConfig
        ? {
            mode: commissionConfig.mode,
            value: parseFloat(commissionConfig.value.toString()),
          }
        : null,
    };
  }

  /**
   * Get seller invoices
   * Admin-only endpoint
   */
  async getSellerInvoices(organizationId: string, userId: string, sellerId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can view seller invoices');
    }

    // Verify seller exists
    const sellerMembership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: sellerId,
        role: Role.SELLER,
      },
    });

    if (!sellerMembership) {
      throw new NotFoundException('Seller not found');
    }

    const sales = await this.prisma.sale.findMany({
      where: {
        organizationId,
        assignedToId: sellerId,
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
        customerName: true,
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
      deliveryStatus: sale.deliveredAt
        ? 'DELIVERED'
        : sale.shippedAt
          ? 'SHIPPED'
          : 'NOT_DELIVERED',
      workflowStatus:
        sale.status === 'CANCELLED'
          ? 'CANCELLED'
          : sale.status === 'DRAFT'
            ? 'STANDBY'
            : 'ACTIVE',
      customerName: sale.customerName,
    }));
  }

  /**
   * Invite a seller
   * Admin-only endpoint
   */
  async inviteSeller(organizationId: string, userId: string, dto: InviteSellerDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can invite sellers');
    }

    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const existingMember = await this.prisma.membership.findFirst({
        where: {
          organizationId,
          userId: existingUser.id,
        },
      });

      if (existingMember) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    // Check for pending invitation
    const pendingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: dto.email,
        status: InviteStatus.PENDING,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (pendingInvitation) {
      throw new ConflictException('A pending invitation already exists for this email');
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration date (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email: dto.email,
        role: Role.SELLER,
        token,
        invitedById: userId,
        expiresAt,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // In a real app, you would send an email here with the invitation link
    // For now, we'll return the link in the response (remove in production)
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`;

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organization: invitation.organization,
      inviteLink, // Remove in production, send via email only
    };
  }

  /**
   * Get commission config for a seller
   * Admin-only endpoint
   */
  async getCommissionConfig(organizationId: string, userId: string, sellerId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can view commission configs');
    }

    // Verify seller exists
    const sellerMembership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: sellerId,
        role: Role.SELLER,
      },
    });

    if (!sellerMembership) {
      throw new NotFoundException('Seller not found');
    }

    const config = await this.prisma.commissionConfig.findUnique({
      where: {
        organizationId_sellerId: {
          organizationId,
          sellerId,
        },
      },
    });

    if (!config) {
      return null;
    }

    return {
      mode: config.mode,
      value: parseFloat(config.value.toString()),
    };
  }

  /**
   * Update commission config for a seller
   * Admin-only endpoint
   */
  async updateCommissionConfig(
    organizationId: string,
    userId: string,
    sellerId: string,
    dto: UpdateCommissionDto,
  ) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can update commission configs');
    }

    // Verify seller exists
    const sellerMembership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId: sellerId,
        role: Role.SELLER,
      },
    });

    if (!sellerMembership) {
      throw new NotFoundException('Seller not found');
    }

    // Upsert commission config
    const config = await this.prisma.commissionConfig.upsert({
      where: {
        organizationId_sellerId: {
          organizationId,
          sellerId,
        },
      },
      create: {
        organizationId,
        sellerId,
        mode: dto.mode,
        value: new Decimal(dto.value),
      },
      update: {
        mode: dto.mode,
        value: new Decimal(dto.value),
      },
    });

    return {
      mode: config.mode,
      value: parseFloat(config.value.toString()),
    };
  }
}
