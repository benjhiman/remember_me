import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OwnerOnly } from '../decorators/owner-only.decorator';
import { OwnerOnlyGuard } from '../guards/owner-only.guard';
import { CurrentOrganization } from '../decorators/current-organization.decorator';
import { Role, Prisma } from '@remember-me/prisma';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerOnlyGuard)
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @OwnerOnly()
  async listAuditLogs(
    @CurrentOrganization() organizationId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '50',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('actorRole') actorRole?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(pageSize, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Validate pageSize (max 200)
    if (limitNum > 200) {
      throw new BadRequestException('pageSize cannot exceed 200');
    }

    // Validate search (min 3 chars)
    if (search && search.length < 3) {
      throw new BadRequestException('search must be at least 3 characters');
    }

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
    };

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Actor filters
    if (actorUserId) {
      where.actorUserId = actorUserId;
    }

    if (actorRole) {
      where.actorRole = actorRole;
    }

    // Action filter
    if (action) {
      where.action = action as any;
    }

    // Entity filters
    if (entityType) {
      where.entityType = entityType as any;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    // Search filter (safe search - only if >= 3 chars)
    if (search && search.length >= 3) {
      where.OR = [
        { actorEmail: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        // Note: Full JSONB text search would require raw SQL query
        // For now, we search in actorEmail, action, and entityId only
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Fetch users separately to avoid relation issues
    const userIds = [...new Set(data.filter((d) => d.actorUserId).map((d) => d.actorUserId!))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      data: data.map((log) => {
        const actorUser = log.actorUserId ? userMap.get(log.actorUserId) : null;
        return {
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          actorUser: actorUser
            ? {
                id: actorUser.id,
                name: actorUser.name,
                email: actorUser.email,
              }
            : null,
          actorRole: log.actorRole,
          actorEmail: log.actorEmail,
          before: log.beforeJson,
          after: log.afterJson,
          metadata: log.metadataJson,
          requestId: log.requestId,
          severity: log.severity,
          source: log.source,
          ip: log.ip,
          userAgent: log.userAgent,
          createdAt: log.createdAt,
        };
      }),
      total,
      page: pageNum,
      pageSize: limitNum,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limitNum,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
      },
    };
  }
}
