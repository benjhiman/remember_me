import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IntegrationJobType,
  IntegrationProvider,
  IntegrationJobStatus,
} from '@remember-me/prisma';
import { JobRunnerStateService } from './job-runner-state.service';
import { MetricsService } from '../../common/metrics/metrics.service';

export interface EnqueueJobParams {
  jobType: IntegrationJobType;
  provider: IntegrationProvider;
  payload: any;
  runAt?: Date;
  organizationId?: string;
  connectedAccountId?: string;
}

/**
 * IntegrationJobsService - DB-backed queue operations
 * For enqueueing, use IntegrationQueueService which handles BullMQ/DB selection
 */
@Injectable()
export class IntegrationJobsService {
  private readonly logger = new Logger(IntegrationJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stateService: JobRunnerStateService,
    private readonly metricsService?: MetricsService, // Optional to avoid circular dependency
  ) {}

  async enqueue(
    jobType: IntegrationJobType,
    provider: IntegrationProvider,
    payload: any,
    runAt?: Date,
    organizationId?: string,
    connectedAccountId?: string,
    dedupeKey?: string, // Optional deduplication key (not used in DB, kept for API compatibility)
  ) {
    if (!organizationId) {
      throw new Error('organizationId is required for integration jobs');
    }

    // Create DB record
    return this.prisma.integrationJob.create({
      data: {
        organizationId,
        provider,
        jobType,
        payloadJson: payload,
        status: IntegrationJobStatus.PENDING,
        runAt: runAt || new Date(),
        connectedAccountId,
      },
    });
  }

  async fetchNext(limit: number = 10) {
    const now = new Date();

    return this.prisma.integrationJob.findMany({
      where: {
        status: IntegrationJobStatus.PENDING,
        runAt: {
          lte: now,
        },
      },
      orderBy: {
        runAt: 'asc',
      },
      take: limit,
    });
  }

  async markProcessing(jobId: string) {
    return this.prisma.integrationJob.update({
      where: { id: jobId },
      data: {
        status: IntegrationJobStatus.PROCESSING,
      },
    });
  }

  async markDone(jobId: string) {
    return this.prisma.integrationJob.update({
      where: { id: jobId },
      data: {
        status: IntegrationJobStatus.DONE,
      },
    });
  }

  async markFailed(jobId: string, error: string) {
    const job = await this.prisma.integrationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const newAttempts = job.attempts + 1;
    const maxAttempts = 5;

    if (newAttempts >= maxAttempts) {
      // Max attempts reached, mark as failed
      return this.prisma.integrationJob.update({
        where: { id: jobId },
        data: {
          status: IntegrationJobStatus.FAILED,
          attempts: newAttempts,
          lastError: error,
        },
      });
    } else {
      // Retry with exponential backoff: 2^attempts minutes (cap 60 min)
      const backoffMinutes = Math.min(Math.pow(2, newAttempts), 60);
      const runAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      return this.prisma.integrationJob.update({
        where: { id: jobId },
        data: {
          status: IntegrationJobStatus.PENDING,
          attempts: newAttempts,
          lastError: error,
          runAt,
        },
      });
    }
  }

  /**
   * Get job metrics for an organization
   */
  async getMetrics(organizationId: string) {
    const now = new Date();

    // Count jobs by status
    const [pendingCount, processingCount, failedCount] = await Promise.all([
      this.prisma.integrationJob.count({
        where: {
          organizationId,
          status: IntegrationJobStatus.PENDING,
        },
      }),
      this.prisma.integrationJob.count({
        where: {
          organizationId,
          status: IntegrationJobStatus.PROCESSING,
        },
      }),
      this.prisma.integrationJob.count({
        where: {
          organizationId,
          status: IntegrationJobStatus.FAILED,
        },
      }),
    ]);

    // Find oldest pending job
    const oldestPending = await this.prisma.integrationJob.findFirst({
      where: {
        organizationId,
        status: IntegrationJobStatus.PENDING,
      },
      orderBy: {
        runAt: 'asc',
      },
      select: {
        runAt: true,
      },
    });

    const oldestPendingAgeMs = oldestPending
      ? now.getTime() - oldestPending.runAt.getTime()
      : null;

    // Get last run info from JobRunnerState
    const state = await this.stateService.getState();
    const lastRunAt = state?.lastRunAt || null;
    const lastRunDurationMs = state?.lastRunDurationMs || null;

    return {
      pendingCount,
      processingCount,
      failedCount,
      oldestPendingAgeMs,
      lastRunAt,
      lastRunDurationMs,
    };
  }
}
