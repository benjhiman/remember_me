import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OwnerOnly } from '../decorators/owner-only.decorator';
import { OwnerOnlyGuard } from '../guards/owner-only.guard';
import { CurrentOrganization } from '../decorators/current-organization.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@remember-me/prisma';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerOnlyGuard)
export class AuditLogStatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  @OwnerOnly()
  async getStats(@CurrentOrganization() organizationId: string) {
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
    };

    // Total movements
    const totalMovements = await this.prisma.auditLog.count({ where });

    // Movements by role
    const movementsByRole = await this.prisma.auditLog.groupBy({
      by: ['actorRole'],
      where,
      _count: true,
    });

    // Movements by action
    const movementsByAction = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
    });

    // Movements by entity type
    const movementsByEntity = await this.prisma.auditLog.groupBy({
      by: ['entityType'],
      where,
      _count: true,
    });

    // Movements last 7 days
    const movementsLast7Days = await this.prisma.auditLog.count({
      where: {
        ...where,
        createdAt: { gte: last7Days },
      },
    });

    // Movements last 30 days
    const movementsLast30Days = await this.prisma.auditLog.count({
      where: {
        ...where,
        createdAt: { gte: last30Days },
      },
    });

    // Top actors (by count)
    const topActors = await this.prisma.auditLog.groupBy({
      by: ['actorUserId', 'actorEmail'],
      where: {
        ...where,
        actorUserId: { not: null },
      },
      _count: true,
      orderBy: {
        _count: {
          actorUserId: 'desc',
        },
      },
      take: 10,
    });

    return {
      totalMovements,
      movementsByRole: movementsByRole.map((r) => ({
        role: r.actorRole || 'UNKNOWN',
        count: r._count,
      })),
      movementsByAction: movementsByAction.map((a) => ({
        action: a.action,
        count: a._count,
      })),
      movementsByEntity: movementsByEntity.map((e) => ({
        entityType: e.entityType,
        count: e._count,
      })),
      movementsLast7Days,
      movementsLast30Days,
      topActors: topActors.map((a) => ({
        userId: a.actorUserId,
        email: a.actorEmail || 'unknown',
        count: a._count,
      })),
    };
  }
}
