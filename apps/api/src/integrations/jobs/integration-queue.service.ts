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
    // Use RATE_LIMIT_REDIS_URL if available, otherwise REDIS_URL, fallback to default
    const redisUrl =
      this.configService.get<string>('RATE_LIMIT_REDIS_URL') ||
      this.configService.get<string>('REDIS_URL') ||
      'redis://localhost:6379';
    
    // Parse Redis URL for BullMQ connection
    // BullMQ accepts connection string directly or ConnectionOptions
    // We'll use the URL string directly for simplicity
    this.redisConnection = redisUrl as any; // BullMQ accepts string URLs
    
    // Queue is enabled if QUEUE_MODE is 'bull' or 'dual'
    const queueMode = this.configService.get<string>('QUEUE_MODE', 'db');
    this.enabled = queueMode === 'bull' || queueMode === 'dual';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('BullMQ queue disabled (QUEUE_MODE != bull|dual)');
      return;
    }

    try {
      const redisUrl =
        this.configService.get<string>('RATE_LIMIT_REDIS_URL') ||
        this.configService.get<string>('REDIS_URL') ||
        'redis://localhost:6379';

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
      this.logger.log(`BullMQ queue initialized (Redis: ${redisUrl})`);
    } catch (error) {
      this.logger.error(`Failed to initialize BullMQ queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
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
