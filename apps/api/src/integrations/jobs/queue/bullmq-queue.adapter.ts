import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { IntegrationJobsService } from '../integration-jobs.service';
import { IIntegrationQueue, EnqueueJobParams } from './i-integration-queue.interface';
import { Queue, QueueOptions, ConnectionOptions } from 'bullmq';
import { IntegrationProvider, IntegrationJobStatus } from '@remember-me/prisma';

export interface BullMqJobData {
  jobId: string; // DB job ID
  jobType: string;
  provider: IntegrationProvider;
  organizationId: string;
  payload: any;
  runAt?: Date;
  connectedAccountId?: string;
}

@Injectable()
export class BullMqQueueAdapter implements IIntegrationQueue, OnModuleInit {
  private readonly logger = new Logger(BullMqQueueAdapter.name);
  private queue: Queue<BullMqJobData> | null = null;
  private readonly queueName: string;
  private readonly redisConnection: ConnectionOptions | string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly integrationJobsService: IntegrationJobsService,
  ) {
    // Get Redis URL
    const redisUrl =
      this.configService.get<string>('RATE_LIMIT_REDIS_URL') ||
      this.configService.get<string>('REDIS_URL') ||
      'redis://localhost:6379';

    this.redisConnection = redisUrl;
    this.queueName = this.configService.get<string>('BULLMQ_QUEUE_NAME', 'integration-jobs');
    this.enabled = true; // This adapter is only instantiated when BullMQ is enabled
  }

  async onModuleInit() {
    try {
      const queueOptions: QueueOptions = {
        connection: this.redisConnection as ConnectionOptions,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2 seconds (BullMQ will calculate 2^attempt * delay)
            // Note: BullMQ's exponential backoff is in milliseconds
            // We approximate the DB behavior (2^attempt minutes, cap 60) by configuring
            // delay=2000ms which gives: 2s, 4s, 8s, 16s, 32s for attempts 1-5
            // For exact minute-based behavior matching DB, we'd need custom backoff function
          },
          removeOnComplete: true, // Remove completed jobs
          removeOnFail: false, // Keep failed jobs for inspection
        },
      };

      this.queue = new Queue<BullMqJobData>(this.queueName, queueOptions);
      this.logger.log(`BullMQ queue adapter initialized (queue: ${this.queueName})`);
    } catch (error) {
      this.logger.error(`Failed to initialize BullMQ queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async enqueue(params: EnqueueJobParams): Promise<any> {
    if (!this.queue) {
      throw new Error('BullMQ queue not initialized');
    }

    if (!params.organizationId) {
      throw new Error('organizationId is required for integration jobs');
    }

    // Always create DB record first (for traceability and fallback)
    const dbJob = await this.integrationJobsService.enqueue(
      params.jobType,
      params.provider,
      params.payload,
      params.runAt,
      params.organizationId,
      params.connectedAccountId,
      params.dedupeKey,
    );

    // Calculate delay if runAt is in the future
    const delay = params.runAt && params.runAt > new Date()
      ? params.runAt.getTime() - Date.now()
      : undefined;

    // Generate deterministic jobId for deduplication
    // Format: ${jobType}:${organizationId}:${dedupeKey} or use DB job ID
    let jobId: string;
    if (params.dedupeKey) {
      jobId = `${params.jobType}:${params.organizationId}:${params.dedupeKey}`;
    } else {
      jobId = dbJob.id;
    }

    // Enqueue to BullMQ
    const job = await this.queue.add(
      params.jobType, // Job name
      {
        jobId: dbJob.id,
        jobType: params.jobType,
        provider: params.provider,
        organizationId: params.organizationId,
        payload: params.payload,
        runAt: params.runAt,
        connectedAccountId: params.connectedAccountId,
      },
      {
        jobId, // Deterministic ID for deduplication
        delay, // Schedule job if runAt is in the future
      },
    );

    this.logger.debug(`Enqueued job ${job.id} to BullMQ (DB job ID: ${dbJob.id}, type: ${params.jobType})`);
    return dbJob; // Return DB job for compatibility
  }

  isEnabled(): boolean {
    return this.enabled && this.queue !== null;
  }

  /**
   * Get queue instance (for worker/monitoring)
   */
  getQueue(): Queue<BullMqJobData> | null {
    return this.queue;
  }
}
