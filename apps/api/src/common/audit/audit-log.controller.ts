import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OwnerOnly } from '../decorators/owner-only.decorator';
import { OwnerOnlyGuard } from '../guards/owner-only.guard';
import { CurrentOrganization } from '../decorators/current-organization.decorator';
import { Role, Prisma, AuditAction } from '@remember-me/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { redactSensitiveData } from './utils/redact-sensitive-data';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerOnlyGuard)
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {
    console.log('[AuditLogController] mounted');
  }

  @Get()
  @OwnerOnly()
  async listAuditLogs(
    @CurrentOrganization() organizationId: string,
    @Query() query: ListAuditLogsDto,
  ) {
    const pageNum = query.page || 1;
    const limitNum = query.pageSize || 50;
    const skip = (pageNum - 1) * limitNum;

    // Validate pageSize (max 100 - hardened)
    if (limitNum > 100) {
      throw new BadRequestException('pageSize cannot exceed 100');
    }

    // Validate search (min 3 chars)
    if (query.search && query.search.length < 3) {
      throw new BadRequestException('search must be at least 3 characters');
    }

    // Build where clause - ALWAYS scoped to organizationId
    const where: Prisma.AuditLogWhereInput = {
      organizationId, // CRITICAL: Always enforce multi-tenant isolation
    };

    // Date range filter with fallback to last 90 days if no dates provided
    const now = new Date();
    const defaultDateFrom = new Date(now);
    defaultDateFrom.setDate(defaultDateFrom.getDate() - 90);

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      } else {
        // If only dateTo is provided, default dateFrom to 90 days ago
        where.createdAt.gte = defaultDateFrom;
      }
      if (query.dateTo) {
        const dateTo = new Date(query.dateTo);
        dateTo.setHours(23, 59, 59, 999); // End of day
        where.createdAt.lte = dateTo;
      } else {
        // If only dateFrom is provided, default dateTo to now
        where.createdAt.lte = now;
      }
    } else {
      // No dates provided - default to last 90 days
      where.createdAt = {
        gte: defaultDateFrom,
        lte: now,
      };
    }

    // Actor filters
    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }

    if (query.actorRole) {
      where.actorRole = query.actorRole;
    }

    // Action filter
    if (query.action) {
      where.action = query.action as any;
    }

    // Entity filters
    if (query.entityType) {
      where.entityType = query.entityType as any;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    // Search filter (safe search - only if >= 3 chars)
    if (query.search && query.search.length >= 3) {
      const searchLower = query.search.toLowerCase();
      
      // For enum fields (action), we need to match against enum values using 'in'
      // Get all AuditAction enum values and filter those that match the search
      const allActions = Object.values(AuditAction) as string[];
      const matchedActions = allActions.filter((a) =>
        a.toLowerCase().includes(searchLower)
      );
      
      // Build OR conditions
      const orConditions: Prisma.AuditLogWhereInput[] = [
        { actorEmail: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
      ];
      
      // Only add action filter if we have matches
      if (matchedActions.length > 0) {
        orConditions.push({ action: { in: matchedActions as any } });
      }
      
      where.OR = orConditions;
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
        
        // Redact sensitive data from before/after/metadata
        const beforeRedacted = log.beforeJson ? redactSensitiveData(log.beforeJson) : null;
        const afterRedacted = log.afterJson ? redactSensitiveData(log.afterJson) : null;
        const metadataRedacted = log.metadataJson ? redactSensitiveData(log.metadataJson) : null;
        
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
          before: beforeRedacted,
          after: afterRedacted,
          metadata: metadataRedacted,
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
