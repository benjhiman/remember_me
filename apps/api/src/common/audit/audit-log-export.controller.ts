import { Controller, Get, Query, UseGuards, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OwnerOnly } from '../decorators/owner-only.decorator';
import { OwnerOnlyGuard } from '../guards/owner-only.guard';
import { CurrentOrganization } from '../decorators/current-organization.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@remember-me/prisma';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, OwnerOnlyGuard)
export class AuditLogExportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('export')
  @OwnerOnly()
  async exportCsv(
    @CurrentOrganization() organizationId: string,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('actorRole') actorRole?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
  ) {
    const exportFormat = format || 'csv';
    if (exportFormat !== 'csv') {
      throw new BadRequestException('Only CSV format is supported');
    }

    // Build where clause (same as list endpoint)
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
        const dateToDate = new Date(dateTo);
        dateToDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = dateToDate;
      }
    }

    if (actorUserId) {
      where.actorUserId = actorUserId;
    }

    if (actorRole) {
      where.actorRole = actorRole;
    }

    if (action) {
      where.action = action as any;
    }

    if (entityType) {
      where.entityType = entityType as any;
    }

    // Limit to 10k records
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: {
        id: true,
        createdAt: true,
        actorUserId: true,
        actorRole: true,
        actorEmail: true,
        action: true,
        entityType: true,
        entityId: true,
        severity: true,
        source: true,
        ip: true,
        userAgent: true,
      },
    });

    // Fetch users for actor names
    const userIds = [...new Set(logs.filter((l) => l.actorUserId).map((l) => l.actorUserId!))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // Generate CSV
    const headers = [
      'ID',
      'Fecha',
      'Usuario',
      'Email',
      'Rol',
      'Acción',
      'Tipo Entidad',
      'ID Entidad',
      'Severidad',
      'Origen',
      'IP',
      'User Agent',
    ];

    const rows = logs.map((log) => {
      const user = log.actorUserId ? userMap.get(log.actorUserId) : null;
      return [
        log.id,
        log.createdAt.toISOString(),
        user?.name || 'Sistema',
        log.actorEmail || user?.email || '',
        log.actorRole || '',
        log.action,
        log.entityType,
        log.entityId,
        log.severity,
        log.source,
        log.ip || '',
        log.userAgent || '',
      ];
    });

    // Escape CSV values
    const escapeCsv = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    // Set response headers
    const filename = `audit-logs-${organizationId}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

    res.send(csvContent);
  }
}
