import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { MetaTokenService } from '../meta/meta-token.service';
import { IntegrationJobType, IntegrationProvider, IntegrationJobStatus, ConnectedAccountStatus } from '@remember-me/prisma';

@Injectable()
export class MetaTokenRefreshJobProcessorService {
  private readonly logger = new Logger(MetaTokenRefreshJobProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationJobsService: IntegrationJobsService,
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
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await this.processRefreshTokenJob(job);
  }

  /**
   * Process pending REFRESH_META_TOKEN jobs (DB mode)
   */
  async processPendingJobs(limit: number = 10): Promise<number> {
    const jobs = await this.prisma.integrationJob.findMany({
      where: {
        jobType: IntegrationJobType.REFRESH_META_TOKEN,
        status: IntegrationJobStatus.PENDING,
        runAt: {
          lte: new Date(),
        },
      },
      take: limit,
      orderBy: {
        runAt: 'asc',
      },
    });

    let processed = 0;

    for (const job of jobs) {
      try {
        await this.processRefreshTokenJob(job);
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to process REFRESH_META_TOKEN job ${job.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Job will be retried by IntegrationJobsService
      }
    }

    return processed;
  }

  /**
   * Process a single REFRESH_META_TOKEN job
   */
  private async processRefreshTokenJob(job: any): Promise<void> {
    const { organizationId, connectedAccountId } = job.payloadJson as {
      organizationId: string;
      connectedAccountId: string;
    };

    if (!organizationId || !connectedAccountId) {
      throw new Error('Missing required fields: organizationId, connectedAccountId');
    }

    this.logger.log(`Refreshing token for account ${connectedAccountId} in org ${organizationId}`);

    // Get token record
    const tokenRecord = await this.prisma.oAuthToken.findFirst({
      where: {
        connectedAccount: {
          id: connectedAccountId,
          organizationId,
          status: ConnectedAccountStatus.CONNECTED,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRecord) {
      throw new Error(`Token not found for account ${connectedAccountId}`);
    }

    // Extend token
    await this.metaTokenService.extendToken(connectedAccountId, tokenRecord.id);

    // Mark job as completed
    await this.prisma.integrationJob.update({
      where: { id: job.id },
      data: { status: 'DONE' },
    });

    this.logger.log(`Successfully refreshed token for account ${connectedAccountId}`);
  }
}
