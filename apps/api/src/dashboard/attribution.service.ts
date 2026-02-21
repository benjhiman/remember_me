import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttributionSource, SaleStatus } from '@remember-me/prisma';
import { Prisma } from '@prisma/client';

@Injectable()
export class AttributionService {
  private readonly logger = new Logger(AttributionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create attribution snapshot when a sale is paid
   * Called from SalesService.paySale()
   */
  async createAttributionSnapshot(
    tx: Prisma.TransactionClient,
    organizationId: string,
    saleId: string,
    leadId: string | null,
  ): Promise<void> {
    // If no leadId, try to find lead by customer phone/email
    let resolvedLeadId = leadId;

    if (!resolvedLeadId) {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        select: {
          customerPhone: true,
          customerEmail: true,
        },
      });

      if (sale?.customerPhone) {
        const lead = await tx.lead.findFirst({
          where: {
            organizationId,
            phone: sale.customerPhone,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (lead) {
          resolvedLeadId = lead.id;
        }
      } else if (sale?.customerEmail) {
        const lead = await tx.lead.findFirst({
          where: {
            organizationId,
            email: sale.customerEmail,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (lead) {
          resolvedLeadId = lead.id;
        }
      }
    }

    // If still no lead, skip attribution
    if (!resolvedLeadId) {
      this.logger.debug(`No lead found for sale ${saleId}, skipping attribution snapshot`);
      return;
    }

    // Get lead with customFields
    const lead = await tx.lead.findUnique({
      where: { id: resolvedLeadId },
      select: {
        id: true,
        customFields: true,
        tags: true,
      },
    });

    if (!lead) {
      return;
    }

    // Check if lead has META_ADS tag or meta attribution data
    const hasMetaAdsTag = lead.tags?.includes('META_ADS') || false;
    const customFields = lead.customFields as any;
    const hasMetaAttribution =
      customFields?.metaCampaignId || customFields?.metaAdId || customFields?.metaLeadgenId;

    if (!hasMetaAdsTag && !hasMetaAttribution) {
      this.logger.debug(`Lead ${resolvedLeadId} does not have Meta Ads attribution, skipping snapshot`);
      return;
    }

    // Check if snapshot already exists (idempotency)
    const existingSnapshot = await tx.metaAttributionSnapshot.findUnique({
      where: { saleId },
    });

    if (existingSnapshot) {
      this.logger.debug(`Attribution snapshot already exists for sale ${saleId}`);
      return;
    }

    // Create snapshot
    await tx.metaAttributionSnapshot.create({
      data: {
        organizationId,
        saleId,
        leadId: resolvedLeadId,
        source: AttributionSource.META_LEAD_ADS,
        campaignId: customFields?.metaCampaignId || null,
        adsetId: customFields?.metaAdsetId || null,
        adId: customFields?.metaAdId || null,
        formId: customFields?.metaFormId || null,
        pageId: customFields?.metaPageId || null,
        leadgenId: customFields?.metaLeadgenId || null,
      },
    });

    this.logger.log(`Created attribution snapshot for sale ${saleId} from lead ${resolvedLeadId}`);
  }

  /**
   * Get attribution metrics grouped by campaign/adset/ad
   */
  async getMetaAttributionMetrics(
    organizationId: string,
    filters: {
      from?: Date;
      to?: Date;
      groupBy: 'campaign' | 'adset' | 'ad';
      includeZeroRevenue?: boolean;
    },
  ) {
    const where: Prisma.MetaAttributionSnapshotWhereInput = {
      organizationId,
      createdAt: filters.from || filters.to
        ? {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          }
        : undefined,
    };

    // Get all snapshots with sales data
    const snapshots = await this.prisma.metaAttributionSnapshot.findMany({
      where,
      include: {
        sale: {
          include: {
            items: true,
          },
        },
        lead: {
          select: {
            id: true,
          },
        },
      },
    });

    // Get spend data for the same date range
    // TODO: MetaSpendDaily model not in schema - returning empty array
    const spendRecords: any[] = [];
    // const spendWhere: Prisma.MetaSpendDailyWhereInput = {
    //   organizationId,
    //   date: filters.from || filters.to
    //     ? {
    //         ...(filters.from ? { gte: filters.from } : {}),
    //         ...(filters.to ? { lte: filters.to } : {}),
    //       }
    //     : undefined,
    // };
    // const spendRecords = (await this.prisma.metaSpendDaily.findMany({
    //   where: spendWhere,
    // })) || [];

    // Group by campaign/adset/ad
    const groups = new Map<
      string,
      {
        id: string | null;
        leadIds: Set<string>;
        salesCount: number;
        revenue: number;
        spend: number;
      }
    >();

    for (const snapshot of snapshots) {
      const groupKey =
        filters.groupBy === 'campaign'
          ? snapshot.campaignId || 'unknown'
          : filters.groupBy === 'adset'
            ? snapshot.adsetId || 'unknown'
            : snapshot.adId || 'unknown';

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey === 'unknown' ? null : groupKey,
          leadIds: new Set(),
          salesCount: 0,
          revenue: 0,
          spend: 0,
        });
      }

      const group = groups.get(groupKey)!;

      // Count unique leads
      if (snapshot.leadId) {
        group.leadIds.add(snapshot.leadId);
      }

      // Count sales and revenue (only PAID sales)
      if (snapshot.sale && snapshot.sale.status === SaleStatus.PAID) {
        group.salesCount++;
        const saleTotal = parseFloat(snapshot.sale.total.toString());
        group.revenue += saleTotal;
      }
    }

    // Aggregate spend by group
    for (const spendRecord of spendRecords) {
      const spendGroupKey =
        filters.groupBy === 'campaign'
          ? spendRecord.campaignId || 'unknown'
          : filters.groupBy === 'adset'
            ? spendRecord.adsetId || 'unknown'
            : spendRecord.adId || 'unknown';

      if (groups.has(spendGroupKey)) {
        const group = groups.get(spendGroupKey)!;
        group.spend += parseFloat(spendRecord.spend.toString());
      } else if (filters.includeZeroRevenue) {
        // Include spend even if no revenue
        groups.set(spendGroupKey, {
          id: spendGroupKey === 'unknown' ? null : spendGroupKey,
          leadIds: new Set(),
          salesCount: 0,
          revenue: 0,
          spend: parseFloat(spendRecord.spend.toString()),
        });
      }
    }

    // Calculate metrics for each group
    const results = Array.from(groups.entries()).map(([key, group]) => {
      const leadsCount = group.leadIds.size;
      const avgTicket = group.salesCount > 0 ? group.revenue / group.salesCount : 0;
      const conversionRate = leadsCount > 0 ? group.salesCount / leadsCount : 0;
      // ROAS = revenue / spend (only if both > 0, otherwise null)
      const roas = group.spend > 0 && group.revenue > 0 ? group.revenue / group.spend : null;

      return {
        [filters.groupBy === 'campaign' ? 'campaignId' : filters.groupBy === 'adset' ? 'adsetId' : 'adId']:
          group.id,
        leadsCount,
        salesCount: group.salesCount,
        revenue: group.revenue,
        spend: group.spend,
        avgTicket,
        conversionRate,
        roas,
      };
    });

    // Filter out zero revenue if requested (but keep if there's spend)
    if (!filters.includeZeroRevenue) {
      return results.filter((r) => r.revenue > 0 || r.spend > 0);
    }

    return results;
  }
}
