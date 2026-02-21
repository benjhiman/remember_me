import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardFiltersDto, GroupByPeriod } from './dto/dashboard-filters.dto';
import { Role, SaleStatus, StockStatus, LeadStatus } from '@remember-me/prisma';
import { Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

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

  // Helper: Build date filter
  private buildDateFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;

    const filter: Prisma.DateTimeFilter = {};
    if (from) {
      filter.gte = new Date(from);
    }
    if (to) {
      filter.lte = new Date(to);
    }
    return filter;
  }

  // Helper: Group date by period
  private groupDateByPeriod(period: GroupByPeriod): string {
    switch (period) {
      case GroupByPeriod.DAY:
        return "DATE_TRUNC('day', \"createdAt\")";
      case GroupByPeriod.WEEK:
        return "DATE_TRUNC('week', \"createdAt\")";
      case GroupByPeriod.MONTH:
        return "DATE_TRUNC('month', \"createdAt\")";
      default:
        return "DATE_TRUNC('day', \"createdAt\")";
    }
  }

  async getOverview(organizationId: string, userId: string, filters: DashboardFiltersDto) {
    await this.verifyMembership(organizationId, userId);

    const dateFilter = this.buildDateFilter(filters.from, filters.to);

    // Total Leads
    const totalLeads = await this.prisma.lead.count({
      where: {
        organizationId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
    });

    // Leads by Stage (top 10)
    // TODO: Stage model not implemented in schema yet - returning empty array
    const leadsByStageWithNames: Array<{ stageId: string; stageName: string; stageColor: string | null; count: number }> = [];
    // Note: Stage functionality not yet implemented in schema
    // const leadsByStageRaw = await this.prisma.$queryRaw<Array<{ stageId: string; _count: number }>>`
    //   SELECT "stageId", COUNT(*)::int as "_count"
    //   FROM "Lead"
    //   WHERE "organizationId" = ${organizationId}
    //   ${dateFilter ? Prisma.sql`AND "createdAt" >= ${dateFilter.gte} AND "createdAt" <= ${dateFilter.lte}` : Prisma.empty}
    //   GROUP BY "stageId"
    //   ORDER BY "_count" DESC
    //   LIMIT 10
    // `;

    // Total Sales
    const totalSales = await this.prisma.sale.count({
      where: {
        organizationId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
    });

    // Sales by Status
    const salesByStatus = await this.prisma.sale.groupBy({
      by: ['status'],
      where: {
        organizationId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _count: {
        id: true,
      },
    });

    // Revenue (sum of SaleItem.totalPrice)
    const revenueResult = await this.prisma.saleItem.aggregate({
      where: {
        sale: {
          organizationId,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      },
      _sum: {
        totalPrice: true,
      },
    });

    const revenue = revenueResult._sum.totalPrice || 0;

    // Stock counts by status
    const stockByStatus = await this.prisma.stockItem.groupBy({
      by: ['status'],
      where: {
        organizationId,
      },
      _count: {
        id: true,
      },
    });

    const stockAvailableCount = stockByStatus.find((s) => s.status === StockStatus.AVAILABLE)?._count.id || 0;
    const stockSoldCount = stockByStatus.find((s) => s.status === StockStatus.SOLD)?._count.id || 0;

    // Top products by volume (count of sales)
    const topProducts = await this.prisma.saleItem.groupBy({
      by: ['model'],
      where: {
        sale: {
          organizationId,
          ...(dateFilter && { createdAt: dateFilter }),
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 10,
    });

    const topProductsByVolume = topProducts.map((p) => ({
      model: p.model,
      quantitySold: p._sum.quantity || 0,
      salesCount: p._count.id,
    }));

    return {
      totalLeads,
      leadsByStage: leadsByStageWithNames,
      totalSales,
      salesByStatus: salesByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      revenue: revenue.toString(),
      stockAvailableCount,
      stockSoldCount,
      topProductsByVolume,
    };
  }

  async getLeadsDashboard(organizationId: string, userId: string, filters: DashboardFiltersDto) {
    await this.verifyMembership(organizationId, userId);

    const dateFilter = this.buildDateFilter(filters.from, filters.to);
    const groupBy = filters.groupBy || GroupByPeriod.DAY;

    // Series: leads created by period
    // Using raw query for date truncation
    const groupBySql = groupBy === 'week' ? "'week'" : groupBy === 'month' ? "'month'" : "'day'";
    const dateConditions = [];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (dateFilter?.gte) {
      dateConditions.push(`"createdAt" >= $${paramIndex}`);
      params.push(dateFilter.gte);
      paramIndex++;
    }
    if (dateFilter?.lte) {
      dateConditions.push(`"createdAt" <= $${paramIndex}`);
      params.push(dateFilter.lte);
      paramIndex++;
    }

    const dateWhere = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : '';

    const leadsSeries = await this.prisma.$queryRawUnsafe<
      Array<{ period: Date; count: number }>
    >(
      `SELECT DATE_TRUNC(${groupBySql}, "createdAt") as period, COUNT(*)::int as count
       FROM "Lead"
       WHERE "organizationId" = $1 ${dateWhere}
       GROUP BY period
       ORDER BY period ASC`,
      ...params,
    );

    const series = leadsSeries.map((item) => ({
      period: item.period,
      count: Number(item.count),
    }));

    // Breakdown: leads by stage
    // TODO: Stage model not implemented in schema yet - returning empty array
    const breakdown: Array<{ stageId: string; stageName: string; stageColor: string | null; count: number }> = [];
    // Note: Stage functionality not yet implemented in schema
    // const leadsByStageRaw = await this.prisma.$queryRaw<Array<{ stageId: string; _count: number }>>`
    //   SELECT "stageId", COUNT(*)::int as "_count"
    //   FROM "Lead"
    //   WHERE "organizationId" = ${organizationId}
    //   ${dateFilter ? Prisma.sql`AND "createdAt" >= ${dateFilter.gte} AND "createdAt" <= ${dateFilter.lte}` : Prisma.empty}
    //   GROUP BY "stageId"
    //   ORDER BY "_count" DESC
    // `;

    // Assigned leads count (top 10 users)
    const assignedLeadsCount = await this.prisma.lead.groupBy({
      by: ['assignedToId'],
      where: {
        organizationId,
        assignedToId: { not: null },
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    const userIds = assignedLeadsCount.map((l) => l.assignedToId).filter(Boolean) as string[];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const assignedLeads = assignedLeadsCount.map((item) => {
      const user = users.find((u) => u.id === item.assignedToId);
      return {
        userId: item.assignedToId,
        userName: user?.name || 'Unknown',
        userEmail: user?.email || null,
        count: item._count,
      };
    });

    return {
      series,
      breakdown,
      assignedLeadsCount: assignedLeads,
    };
  }

  async getSalesDashboard(organizationId: string, userId: string, filters: DashboardFiltersDto) {
    await this.verifyMembership(organizationId, userId);

    const dateFilter = this.buildDateFilter(filters.from, filters.to);
    const groupBy = filters.groupBy || GroupByPeriod.DAY;

    // Series: sales created by period
    const groupBySql = groupBy === 'week' ? "'week'" : groupBy === 'month' ? "'month'" : "'day'";
    const dateConditions = [];
    const params: any[] = [organizationId];
    let paramIndex = 2;

    if (dateFilter?.gte) {
      dateConditions.push(`"createdAt" >= $${paramIndex}`);
      params.push(dateFilter.gte);
      paramIndex++;
    }
    if (dateFilter?.lte) {
      dateConditions.push(`"createdAt" <= $${paramIndex}`);
      params.push(dateFilter.lte);
      paramIndex++;
    }

    const dateWhere = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : '';

    const salesSeries = await this.prisma.$queryRawUnsafe<
      Array<{ period: Date; count: number }>
    >(
      `SELECT DATE_TRUNC(${groupBySql}, "createdAt") as period, COUNT(*)::int as count
       FROM "Sale"
       WHERE "organizationId" = $1 ${dateWhere}
       GROUP BY period
       ORDER BY period ASC`,
      ...params,
    );

    const salesCreatedSeries = salesSeries.map((item) => ({
      period: item.period,
      count: Number(item.count),
    }));

    // Series: revenue by period
    const groupBySqlRevenue = groupBy === 'week' ? "'week'" : groupBy === 'month' ? "'month'" : "'day'";
    const dateConditionsRevenue = [];
    const paramsRevenue: any[] = [organizationId];
    let paramIndexRevenue = 2;

    if (dateFilter?.gte) {
      dateConditionsRevenue.push(`s."createdAt" >= $${paramIndexRevenue}`);
      paramsRevenue.push(dateFilter.gte);
      paramIndexRevenue++;
    }
    if (dateFilter?.lte) {
      dateConditionsRevenue.push(`s."createdAt" <= $${paramIndexRevenue}`);
      paramsRevenue.push(dateFilter.lte);
      paramIndexRevenue++;
    }

    const dateWhereRevenue = dateConditionsRevenue.length > 0 ? `AND ${dateConditionsRevenue.join(' AND ')}` : '';

    const revenueSeries = await this.prisma.$queryRawUnsafe<
      Array<{ period: Date; revenue: Prisma.Decimal }>
    >(
      `SELECT DATE_TRUNC(${groupBySqlRevenue}, s."createdAt") as period, COALESCE(SUM(si."totalPrice"), 0) as revenue
       FROM "Sale" s
       LEFT JOIN "SaleItem" si ON si."saleId" = s."id"
       WHERE s."organizationId" = $1 ${dateWhereRevenue}
       GROUP BY period
       ORDER BY period ASC`,
      ...paramsRevenue,
    );

    const revenueSeriesData = revenueSeries.map((item) => ({
      period: item.period,
      revenue: item.revenue.toString(),
    }));

    // Breakdown: sales by status
    const salesByStatus = await this.prisma.sale.groupBy({
      by: ['status'],
      where: {
        organizationId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _count: {
        id: true,
      },
    });

    const breakdown = salesByStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    // Top customers (by customerName, top 10)
    const topCustomers = await this.prisma.sale.groupBy({
      by: ['customerName'],
      where: {
        organizationId,
        ...(dateFilter && { createdAt: dateFilter }),
      },
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
      orderBy: {
        _sum: {
          total: 'desc',
        },
      },
      take: 10,
    });

    const topCustomersList = topCustomers.map((c) => ({
      customerName: c.customerName,
      salesCount: c._count.id,
      totalSpent: c._sum.total?.toString() || '0',
    }));

    return {
      salesCreated: salesCreatedSeries,
      revenue: revenueSeriesData,
      breakdown,
      topCustomers: topCustomersList,
    };
  }

  async getStockDashboard(organizationId: string, userId: string, filters: DashboardFiltersDto) {
    await this.verifyMembership(organizationId, userId);

    const dateFilter = this.buildDateFilter(filters.from, filters.to);
    const groupBy = filters.groupBy || GroupByPeriod.DAY;
    const threshold = filters.threshold || 5;

    // Breakdown: stock by status
    const stockByStatus = await this.prisma.stockItem.groupBy({
      by: ['status'],
      where: {
        organizationId,
      },
      _count: {
        id: true,
      },
      _sum: {
        quantity: true,
      },
    });

    const breakdown = stockByStatus.map((s) => ({
      status: s.status,
      count: s._count.id,
      totalQuantity: s._sum.quantity || 0,
    }));

    // Series: movements by period
    const groupBySqlMovements = groupBy === 'week' ? "'week'" : groupBy === 'month' ? "'month'" : "'day'";
    const dateConditionsMovements = [];
    const paramsMovements: any[] = [organizationId];
    let paramIndexMovements = 2;

    if (dateFilter?.gte) {
      dateConditionsMovements.push(`"createdAt" >= $${paramIndexMovements}`);
      paramsMovements.push(dateFilter.gte);
      paramIndexMovements++;
    }
    if (dateFilter?.lte) {
      dateConditionsMovements.push(`"createdAt" <= $${paramIndexMovements}`);
      paramsMovements.push(dateFilter.lte);
      paramIndexMovements++;
    }

    const dateWhereMovements = dateConditionsMovements.length > 0 ? `AND ${dateConditionsMovements.join(' AND ')}` : '';

    const movementsSeries = await this.prisma.$queryRawUnsafe<
      Array<{ period: Date; type: string; count: number }>
    >(
      `SELECT DATE_TRUNC(${groupBySqlMovements}, "createdAt") as period, "type", COUNT(*)::int as count
       FROM "StockMovement"
       WHERE "organizationId" = $1 ${dateWhereMovements}
       GROUP BY period, "type"
       ORDER BY period ASC, "type" ASC`,
      ...paramsMovements,
    );

    // Group by period and type
    const movementsByPeriod: Record<string, Record<string, number>> = {};
    movementsSeries.forEach((item) => {
      const periodKey = item.period.toISOString();
      if (!movementsByPeriod[periodKey]) {
        movementsByPeriod[periodKey] = {};
      }
      movementsByPeriod[periodKey][item.type] = Number(item.count);
    });

    const movements = Object.entries(movementsByPeriod).map(([period, types]) => ({
      period: new Date(period),
      ...types,
    }));

    // Low stock: items with quantity <= threshold
    const lowStock = await this.prisma.stockItem.findMany({
      where: {
        organizationId,
        quantity: {
          lte: threshold,
        },
        status: {
          not: StockStatus.SOLD,
        },
      },
      select: {
        id: true,
        model: true,
        quantity: true,
        status: true,
        location: true,
      },
      orderBy: {
        quantity: 'asc',
      },
      take: 50, // Limit to 50 items
    });

    return {
      breakdown,
      movements,
      lowStock: lowStock.map((item) => ({
        id: item.id,
        model: item.model,
        quantity: item.quantity,
        status: item.status,
        location: item.location,
      })),
    };
  }

  health() {
    return { ok: true, module: 'dashboard' };
  }
}
