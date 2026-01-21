import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentOrganization } from '../decorators/current-organization.decorator';
import { Role } from '@remember-me/prisma';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  async listAuditLogs(
    @CurrentOrganization() organizationId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      organizationId,
    };

    if (entityType) {
      where.entityType = entityType;
    }

    if (action) {
      where.action = action;
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
          before: log.beforeJson,
          after: log.afterJson,
          metadata: log.metadataJson,
          requestId: log.requestId,
          createdAt: log.createdAt,
        };
      }),
      total,
      page: pageNum,
      limit: limitNum,
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
