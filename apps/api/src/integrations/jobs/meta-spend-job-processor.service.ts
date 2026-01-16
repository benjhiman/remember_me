import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { MetaMarketingService } from '../meta/meta-marketing.service';
import { MetaTokenService } from '../meta/meta-token.service';
import { IntegrationJobType, IntegrationProvider, IntegrationJobStatus, MetaSpendLevel } from '@remember-me/prisma';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MetaSpendJobProcessorService {
  private readonly logger = new Logger(MetaSpendJobProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationJobsService: IntegrationJobsService,
    private readonly metaMarketingService: MetaMarketingService,
    private readonly metaTokenService: MetaTokenService,
  ) {}

  /**
   * Process a job from BullMQ queue
   */
  async processJobFromQueue(
    jobId: string,
    payload: any,
    organizationId: string,
  ): Promise<void> {
    const job = await this.prisma.integrationJob.findUnique({
      where: { id: jobId },
      include: {
        organization: true,
      },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await this.processFetchSpendJob(job);
  }

  /**
   * Process pending FETCH_META_SPEND jobs (DB mode)
   */
  async processPendingJobs(limit: number = 10): Promise<number> {
    const jobs = await this.prisma.integrationJob.findMany({
      where: {
        jobType: IntegrationJobType.FETCH_META_SPEND,
        status: IntegrationJobStatus.PENDING,
        runAt: {
          lte: new Date(),
        },
      },
      take: limit,
      orderBy: {
        runAt: 'asc',
      },
      include: {
        organization: true,
      },
    });

    let processed = 0;

    for (const job of jobs) {
      try {
        await this.processFetchSpendJob(job);
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to process FETCH_META_SPEND job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Job will be retried by IntegrationJobsService
      }
    }

    return processed;
  }

  /**
   * Process a single FETCH_META_SPEND job
   */
  private async processFetchSpendJob(job: any): Promise<void> {
    const { organizationId, date, level } = job.payloadJson as {
      organizationId: string;
      date: string; // YYYY-MM-DD
      level?: MetaSpendLevel;
    };

    if (!organizationId || !date) {
      throw new Error('Missing required fields: organizationId, date');
    }

    const targetDate = new Date(date);
    const spendLevel = level || MetaSpendLevel.CAMPAIGN;

    this.logger.log(`Fetching Meta spend for org ${organizationId}, date ${date}, level ${spendLevel}`);

    // Fetch insights from Meta API
    const insights = await this.metaMarketingService.getInsights(organizationId, {
      level: spendLevel,
      dateStart: date,
      dateEnd: date,
    });

    // Upsert spend data
    for (const insight of insights) {
      const spend = parseFloat(insight.spend || '0');
      const impressions = insight.impressions ? parseInt(insight.impressions, 10) : null;
      const clicks = insight.clicks ? parseInt(insight.clicks, 10) : null;

      // Determine which IDs to use based on level
      let campaignId: string | null = null;
      let adsetId: string | null = null;
      let adId: string | null = null;

      if (spendLevel === MetaSpendLevel.CAMPAIGN) {
        campaignId = insight.campaign_id || null;
      } else if (spendLevel === MetaSpendLevel.ADSET) {
        campaignId = insight.campaign_id || null;
        adsetId = insight.adset_id || null;
      } else if (spendLevel === MetaSpendLevel.AD) {
        campaignId = insight.campaign_id || null;
        adsetId = insight.adset_id || null;
        adId = insight.ad_id || null;
      }

      // Find existing record
      const existing = await this.prisma.metaSpendDaily.findFirst({
        where: {
          organizationId,
          date: targetDate,
          level: spendLevel,
          campaignId: campaignId || null,
          adsetId: adsetId || null,
          adId: adId || null,
        },
      });

      if (existing) {
        // Update existing record
        await this.prisma.metaSpendDaily.update({
          where: { id: existing.id },
          data: {
            spend: new Decimal(spend),
            impressions,
            clicks,
          },
        });
      } else {
        // Create new record
        await this.prisma.metaSpendDaily.create({
          data: {
            organizationId,
            provider: IntegrationProvider.INSTAGRAM, // Meta via Instagram provider
            date: targetDate,
            level: spendLevel,
            campaignId,
            adsetId,
            adId,
            spend: new Decimal(spend),
            impressions,
            clicks,
            currency: 'USD', // TODO: Get from API if available
          },
        });
      }
    }

    // Mark job as completed
    await this.prisma.integrationJob.update({
      where: { id: job.id },
      data: { status: 'DONE' },
    });

    this.logger.log(`Successfully processed FETCH_META_SPEND job ${job.id} (${insights.length} records)`);
  }
}
