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
  private redisConnection: ConnectionOptions | string;
  private enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly integrationJobsService: IntegrationJobsService,
  ) {
    // Don't initialize Redis connection in constructor - wait until onModuleInit
    // This prevents unnecessary connections in API mode
    this.queueName = this.configService.get<string>('BULLMQ_QUEUE_NAME', 'integration-jobs');
    this.enabled = false; // Will be set to true in onModuleInit if conditions are met
    this.redisConnection = ''; // Will be set in onModuleInit
  }

  async onModuleInit() {
    // Only initialize BullMQ queue if QUEUE_MODE=bullmq AND we're in worker mode
    // In API mode (WORKER_MODE=0, JOB_RUNNER_ENABLED=false), we should not initialize the queue
    // to avoid unnecessary Redis connections
    const queueMode = this.configService.get<string>('QUEUE_MODE', 'db');
    const workerMode = this.configService.get<string>('WORKER_MODE', '0');
    const jobRunnerEnabled = this.configService.get<string>('JOB_RUNNER_ENABLED', 'false');

    // Only initialize if QUEUE_MODE is bullmq AND we're in worker mode (WORKER_MODE=1) AND job runner is enabled
    const isWorkerMode = workerMode === '1' || workerMode === 'true';
    const isJobRunnerEnabled = isWorkerMode && (jobRunnerEnabled === 'true' || jobRunnerEnabled !== 'false');
    const shouldInitialize = queueMode === 'bullmq' && isWorkerMode && isJobRunnerEnabled;

    if (!shouldInitialize) {
      this.logger.log(`BullMQ queue adapter skipped (API mode - QUEUE_MODE=${queueMode}, WORKER_MODE=${workerMode}, JOB_RUNNER_ENABLED=${jobRunnerEnabled})`);
      this.enabled = false;
      return;
    }

    // Get Redis URL - use REDIS_URL as primary, fallback to other variants
    // NEVER default to localhost in production
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      this.configService.get<string>('RATE_LIMIT_REDIS_URL') ||
      this.configService.get<string>('BULL_REDIS_URL') ||
      this.configService.get<string>('QUEUE_REDIS_URL') ||
      this.configService.get<string>('JOB_REDIS_URL');

    if (!redisUrl) {
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'production') {
        throw new Error('REDIS_URL is required for BullMQ in production. Set REDIS_URL environment variable.');
      }
      // Only allow localhost in development
      this.redisConnection = 'redis://localhost:6379';
      this.logger.warn('No REDIS_URL found, using localhost:6379 (development only)');
    } else {
      this.redisConnection = redisUrl;
    }

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
      this.enabled = true;
      this.logger.log(`BullMQ queue adapter initialized (queue: ${this.queueName})`);
    } catch (error) {
      this.logger.error(`Failed to initialize BullMQ queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.enabled = false;
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
