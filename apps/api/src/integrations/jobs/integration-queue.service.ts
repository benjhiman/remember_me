import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueOptions, WorkerOptions, ConnectionOptions } from 'bullmq';
import {
  IntegrationJobType,
  IntegrationProvider,
  IntegrationJobStatus,
} from '@remember-me/prisma';
import { PrismaService } from '../../prisma/prisma.service';

export interface QueueJobData {
  jobId: string; // DB job ID
  jobType: IntegrationJobType;
  provider: IntegrationProvider;
  organizationId: string;
  payload: any;
  runAt?: Date;
  connectedAccountId?: string;
}

@Injectable()
export class IntegrationQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationQueueService.name);
  private queue: Queue<QueueJobData> | null = null;
  private readonly queueName = 'integration-jobs';
  private readonly redisConnection: ConnectionOptions | string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Use REDIS_URL as primary, fallback to other variants
    // NEVER default to localhost in production
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      this.configService.get<string>('RATE_LIMIT_REDIS_URL') ||
      this.configService.get<string>('BULL_REDIS_URL') ||
      this.configService.get<string>('QUEUE_REDIS_URL') ||
      this.configService.get<string>('JOB_REDIS_URL');
    
    if (!redisUrl) {
      // Don't use localhost fallback - disable queue if no Redis URL
      this.redisConnection = '' as any;
      this.enabled = false;
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'production') {
        this.logger.warn('[redis] REDIS_URL not configured, IntegrationQueueService disabled. Set REDIS_URL to enable queue processing.');
      } else {
        this.logger.warn('[redis] No REDIS_URL found, IntegrationQueueService disabled. Set REDIS_URL to enable queue processing.');
      }
    } else {
      // Parse Redis URL for BullMQ connection
      // BullMQ accepts connection string directly or ConnectionOptions
      this.redisConnection = redisUrl as any; // BullMQ accepts string URLs
      
      // Queue is enabled if QUEUE_MODE is 'bull' or 'dual'
      const queueMode = this.configService.get<string>('QUEUE_MODE', 'db');
      this.enabled = queueMode === 'bull' || queueMode === 'dual';
    }
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('[redis] BullMQ queue disabled (QUEUE_MODE != bull|dual or REDIS_URL missing)');
      return;
    }

    if (!this.redisConnection || this.redisConnection === '') {
      this.logger.warn('[redis] Redis connection not configured, queue will not initialize');
      this.enabled = false;
      return;
    }

    // CRITICAL: Validate Redis URL to prevent localhost connections
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'production');
    const redisUrl = this.redisConnection as string;
    if (nodeEnv === 'production') {
      if (redisUrl.includes('localhost') || 
          redisUrl.includes('127.0.0.1') || 
          redisUrl.includes('redis://redis:') ||
          redisUrl === 'redis://redis:6379') {
        this.logger.error('[redis] REDIS_URL contains localhost/127.0.0.1 - cannot use in production. Queue disabled.');
        this.enabled = false;
        return;
      }
    }

    try {
      // Parse and log Redis host (without credentials) for diagnostics
      try {
        const url = new URL(redisUrl);
        const host = url.hostname;
        const port = url.port || '6379';
        this.logger.log(`[redis] Connected to Redis: ${host}:${port}`);
      } catch (e) {
        this.logger.warn(`[redis] Could not parse Redis URL (non-critical): ${redisUrl.substring(0, 30)}...`);
      }

      const queueOptions: QueueOptions = {
        connection: this.redisConnection as ConnectionOptions,
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2 seconds
          },
          removeOnComplete: true, // Remove completed jobs
          removeOnFail: false, // Keep failed jobs for inspection
        },
      };

      this.queue = new Queue<QueueJobData>(this.queueName, queueOptions);
      this.logger.log(`[redis] BullMQ queue initialized`);
    } catch (error) {
      this.logger.error(`[redis] Failed to initialize BullMQ queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.enabled = false;
      // Don't throw - allow app to continue without queue
    }
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
      this.logger.log('BullMQ queue closed');
    }
  }

  /**
   * Enqueue a job to BullMQ
   * @param jobData Job data
   * @param dedupeKey Optional deduplication key (e.g., messageId, leadId)
   * @returns BullMQ Job ID
   */
  async enqueue(
    jobData: QueueJobData,
    dedupeKey?: string,
  ): Promise<string> {
    if (!this.queue) {
      throw new Error('BullMQ queue not initialized');
    }

    // Generate deterministic jobId for deduplication
    // Format: ${jobType}:${organizationId}:${dedupeKey}
    let jobId: string;
    if (dedupeKey) {
      jobId = `${jobData.jobType}:${jobData.organizationId}:${dedupeKey}`;
    } else {
      // Fallback to DB job ID if no dedupe key
      jobId = jobData.jobId;
    }

    // Calculate delay if runAt is in the future
    const delay = jobData.runAt && jobData.runAt > new Date()
      ? jobData.runAt.getTime() - Date.now()
      : undefined;

    const job = await this.queue.add(
      jobData.jobType, // Job name
      jobData,
      {
        jobId, // Deterministic ID for deduplication
        delay, // Schedule job if runAt is in the future
      },
    );

    this.logger.debug(`Enqueued job ${job.id} (type: ${jobData.jobType}, org: ${jobData.organizationId})`);
    return job.id!;
  }

  /**
   * Create a worker to process jobs
   * @param processor Function to process jobs
   * @param concurrency Number of concurrent jobs (default: 5)
   * @returns Worker instance
   */
  createWorker(
    processor: (job: Job<QueueJobData>) => Promise<void>,
    concurrency: number = 5,
  ): Worker<QueueJobData> {
    if (!this.queue) {
      throw new Error('BullMQ queue not initialized');
    }

    const workerOptions: WorkerOptions = {
      connection: this.redisConnection as ConnectionOptions,
      concurrency,
      limiter: {
        max: 100, // Max 100 jobs per duration
        duration: 1000, // Per second
      },
    };

    const worker = new Worker<QueueJobData>(
      this.queueName,
      async (job: Job<QueueJobData>) => {
        this.logger.debug(`Processing job ${job.id} (type: ${job.data.jobType}, org: ${job.data.organizationId})`);
        await processor(job);
      },
      workerOptions,
    );

    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`, err.stack);
    });

    worker.on('error', (err) => {
      this.logger.error(`Worker error: ${err.message}`, err.stack);
    });

    this.logger.log(`BullMQ worker created with concurrency ${concurrency}`);
    return worker;
  }

  /**
   * Get queue instance (for testing/monitoring)
   */
  getQueue(): Queue<QueueJobData> | null {
    return this.queue;
  }

  /**
   * Check if queue is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.queue !== null;
  }
}
