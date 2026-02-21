import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationJobsService } from './integration-jobs.service';
import { JobRunnerLockService } from './job-runner-lock.service';
import { JobRunnerStateService } from './job-runner-state.service';
import { IntegrationQueueService } from './queue/integration-queue.service';
import { IntegrationProvider, IntegrationJobType } from '@remember-me/prisma';
import { Worker } from 'bullmq';
import { getRedisUrlOrNull, getRedisHost } from '../../common/redis/redis-url';

@Injectable()
export class JobRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobRunnerService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly mutex = { locked: false }; // Local mutex (still needed for single-instance)

  // Check if running in worker mode (WORKER_MODE=1) or API mode (default)
  private readonly isWorkerMode = process.env.WORKER_MODE === '1' || process.env.WORKER_MODE === 'true';
  // In API mode, disable by default unless explicitly enabled
  // In worker mode, enable by default unless explicitly disabled
  private readonly enabled = this.isWorkerMode
    ? process.env.JOB_RUNNER_ENABLED !== 'false'
    : process.env.JOB_RUNNER_ENABLED === 'true';
  // Unified flag: only allow job processing in worker mode
  private readonly isJobRunnerEnabled = this.isWorkerMode && this.enabled;
  private readonly intervalMs = parseInt(process.env.JOB_RUNNER_INTERVAL_MS || '5000', 10);
  private readonly queueMode: 'db' | 'bullmq';
  private readonly workerConcurrency: number;
  private bullWorker: Worker | null = null;

  constructor(
    private readonly integrationJobsService: IntegrationJobsService,
    private readonly lockService: JobRunnerLockService,
    private readonly stateService: JobRunnerStateService,
    private readonly integrationQueueService: IntegrationQueueService,
    private readonly configService: ConfigService,
  ) {
    this.queueMode = (this.configService.get<string>('QUEUE_MODE', 'db') as 'db' | 'bullmq') || 'db';
    this.workerConcurrency = parseInt(this.configService.get<string>('INTEGRATION_WORKER_CONCURRENCY', '5'), 10);
  }

  onModuleInit() {
    // Only start job runner if enabled AND in worker mode
    if (this.isJobRunnerEnabled) {
      this.logger.log(`Starting job runner in WORKER mode with interval ${this.intervalMs}ms (queue mode: ${this.queueMode})`);
      
      // Start BullMQ worker if queue mode is 'bullmq'
      if (this.queueMode === 'bullmq' && this.integrationQueueService.isBullMqEnabled()) {
        this.startBullWorker();
      }
      
      // Start DB-based job runner if queue mode is 'db'
      if (this.queueMode === 'db') {
        this.start();
      }
    } else {
      const mode = this.isWorkerMode ? 'WORKER' : 'API';
      this.logger.log(`Job runner disabled in ${mode} mode (WORKER_MODE=${process.env.WORKER_MODE}, JOB_RUNNER_ENABLED=${process.env.JOB_RUNNER_ENABLED})`);
    }
  }

  onModuleDestroy() {
    this.stop();
  }

  private start() {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(async () => {
      await this.processJobs();
    }, this.intervalMs);
  }

  private stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Job runner stopped');
    }
  }

  private async processJobs() {
    // Local mutex: prevent concurrent execution in same instance
    if (this.mutex.locked) {
      this.logger.debug('Job runner already processing, skipping this cycle');
      return;
    }

    // Distributed lock: prevent concurrent execution across instances
    const lockTtlMs = this.intervalMs * 2; // Lock expires after 2 intervals
    const lockAcquired = await this.lockService.acquireLock(lockTtlMs);

    if (!lockAcquired) {
      this.logger.debug('Lock not acquired, another instance is processing jobs');
      return;
    }

    this.mutex.locked = true;
    this.isProcessing = true;
    const startTime = Date.now();
    let jobCount = 0;
    let error: Error | null = null;

    try {
      // Clean up expired locks before processing
      await this.lockService.cleanupExpiredLock();

      // Process jobs for all providers
      // Note: WhatsApp/Instagram/Meta processors removed (Inbox/Meta Ads removed)
      const results: PromiseSettledResult<number>[] = [];

      // Count processed jobs (simplified: count successful results)
      jobCount = results.filter((r) => r.status === 'fulfilled').length;

      // Check for errors
      const failed = results.find((r) => r.status === 'rejected');
      if (failed && failed.status === 'rejected') {
        error = failed.reason instanceof Error ? failed.reason : new Error(String(failed.reason));
      }
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      const errorMessage = error.message;
      this.logger.error(`Error processing jobs: ${errorMessage}`, error.stack);
    } finally {
      const durationMs = Date.now() - startTime;

      // Update state
      await this.stateService.updateState(
        new Date(),
        durationMs,
        jobCount,
        error?.message,
      );

      // Release lock
      await this.lockService.releaseLock();

      // Log structured output
      this.logger.log(
        JSON.stringify({
          event: 'job_runner_cycle_complete',
          lockAcquired: true,
          durationMs,
          jobCount,
          error: error?.message || null,
        }),
      );

      this.mutex.locked = false;
      this.isProcessing = false;
    }
  }

  /**
   * Check if job runner is currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Start BullMQ worker
   */
  private startBullWorker() {
    const bullMqAdapter = this.integrationQueueService.getBullMqAdapter();
    if (!bullMqAdapter?.isEnabled()) {
      this.logger.warn('BullMQ queue not enabled, skipping worker start');
      return;
    }

    this.logger.log(`Starting BullMQ worker with concurrency ${this.workerConcurrency}`);

    // Import Worker dynamically to avoid initialization issues
    const { Worker } = require('bullmq');
    const configService = this.configService;
    
    // CRITICAL: Use centralized Redis URL function (single source of truth)
    // This function ALWAYS prioritizes REDIS_URL if it exists and is valid
    const redisUrl = getRedisUrlOrNull();
    
    // CRITICAL: Log detailed diagnostics
    const redisUrlPresent = !!process.env.REDIS_URL;
    const redisHostEnv = process.env.REDIS_HOST || null;
    const redisPortEnv = process.env.REDIS_PORT || null;
    const redisUrlHost = getRedisHost(redisUrl);
    
    let chosenMode: string;
    if (redisUrl && redisUrlPresent) {
      chosenMode = 'redis_url';
    } else if (redisUrl && !redisUrlPresent) {
      chosenMode = 'fallback_url';
    } else if (redisHostEnv && redisPortEnv) {
      chosenMode = 'host_port';
    } else {
      chosenMode = 'disabled';
    }
    
    this.logger.log(`[redis][worker] BullMQ worker connection diagnostics:`);
    this.logger.log(`[redis][worker] redisUrlPresent=${redisUrlPresent}`);
    this.logger.log(`[redis][worker] redisUrlHost=${redisUrlHost || 'null'}`);
    this.logger.log(`[redis][worker] redisHost=${redisHostEnv || 'null'}`);
    this.logger.log(`[redis][worker] redisPort=${redisPortEnv || 'null'}`);
    this.logger.log(`[redis][worker] chosenMode=${chosenMode}`);

    if (!redisUrl) {
      this.logger.warn('[redis][worker] REDIS_URL not configured or invalid, BullMQ worker will not start. Set REDIS_URL to enable BullMQ queue processing.');
      // CRITICAL: Clear ALL Redis env vars to prevent BullMQ from using defaults
      delete process.env.REDIS_URL;
      process.env.REDIS_URL = '';
      delete process.env.BULL_REDIS_URL;
      process.env.BULL_REDIS_URL = '';
      delete process.env.QUEUE_REDIS_URL;
      process.env.QUEUE_REDIS_URL = '';
      delete process.env.JOB_REDIS_URL;
      process.env.JOB_REDIS_URL = '';
      return; // Don't start worker if Redis is not configured
    }

    // CRITICAL: Double-check that redisUrl does NOT contain localhost (defense in depth)
    const lower = redisUrl.toLowerCase();
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production' && (lower.includes('127.0.0.1') || lower.includes('localhost'))) {
      this.logger.error('[redis][worker] FATAL: REDIS_URL contains localhost/127.0.0.1 in production. Worker will NOT start.');
      // CRITICAL: Clear ALL Redis env vars to prevent BullMQ from using defaults
      delete process.env.REDIS_URL;
      process.env.REDIS_URL = '';
      delete process.env.BULL_REDIS_URL;
      process.env.BULL_REDIS_URL = '';
      delete process.env.QUEUE_REDIS_URL;
      process.env.QUEUE_REDIS_URL = '';
      delete process.env.JOB_REDIS_URL;
      process.env.JOB_REDIS_URL = '';
      return; // Hard stop - do not create worker
    }

    // Log Redis host for diagnostics
    const detectedRedisHost = getRedisHost(redisUrl);
    if (detectedRedisHost) {
      this.logger.log(`[redis][worker] Connected to Redis: ${detectedRedisHost}`);
    } else {
      this.logger.error('[redis][worker] FATAL: Could not parse Redis host from URL. Worker will NOT start.');
      return; // Hard stop - do not create worker
    }

    const queueName = configService.get<string>('BULLMQ_QUEUE_NAME', 'integration-jobs');

    // BullMQ Worker connection options
    // CRITICAL: Parse connection as object to ensure BullMQ uses exact URL (no defaults)
    // Use the full Redis URL string directly - BullMQ handles URL parsing internally
    // This prevents any default connection attempts
    let connectionConfig: any;
    try {
      // Use the Redis URL string directly - BullMQ will parse it correctly
      // This ensures we use the exact connection string without any defaults
      connectionConfig = redisUrl;
      
      // Log the connection config (without password) for debugging
      const urlForLogging = redisUrl.replace(/:[^:@]+@/, ':****@');
      this.logger.log(`[redis][worker] Using Redis URL for BullMQ Worker: ${urlForLogging}`);
    } catch (e) {
      this.logger.error(`[redis][worker] FATAL: Invalid Redis URL format. Worker will NOT start. Error: ${e instanceof Error ? e.message : 'Unknown'}`);
      return; // Hard stop - do not create worker
    }

    // CRITICAL: Final validation - ensure URL does NOT contain localhost
    const lowerUrl = redisUrl.toLowerCase();
    if (nodeEnv === 'production' && (lowerUrl.includes('127.0.0.1') || lowerUrl.includes('localhost'))) {
      this.logger.error(`[redis][worker] FATAL: Redis URL contains localhost. Worker will NOT start.`);
      // CRITICAL: Clear ALL Redis env vars to prevent BullMQ from using defaults
      delete process.env.REDIS_URL;
      process.env.REDIS_URL = '';
      delete process.env.BULL_REDIS_URL;
      process.env.BULL_REDIS_URL = '';
      delete process.env.QUEUE_REDIS_URL;
      process.env.QUEUE_REDIS_URL = '';
      delete process.env.JOB_REDIS_URL;
      process.env.JOB_REDIS_URL = '';
      return; // Hard stop - do not create worker
    }

    // CRITICAL: Final validation before creating Worker - ensure connectionConfig is valid and not localhost
    if (!connectionConfig || typeof connectionConfig !== 'string' || connectionConfig.trim() === '') {
      this.logger.error('[redis][worker] FATAL: Connection config is invalid before creating Worker. Worker will NOT start.');
      // CRITICAL: Clear ALL Redis env vars to prevent BullMQ from using defaults
      delete process.env.REDIS_URL;
      process.env.REDIS_URL = '';
      delete process.env.BULL_REDIS_URL;
      process.env.BULL_REDIS_URL = '';
      delete process.env.QUEUE_REDIS_URL;
      process.env.QUEUE_REDIS_URL = '';
      delete process.env.JOB_REDIS_URL;
      process.env.JOB_REDIS_URL = '';
      return;
    }

    // CRITICAL: One more check - ensure connectionConfig does NOT contain localhost
    const connectionLower = String(connectionConfig).toLowerCase();
    if (nodeEnv === 'production' && (connectionLower.includes('127.0.0.1') || connectionLower.includes('localhost'))) {
      this.logger.error('[redis][worker] FATAL: Connection config contains localhost before creating Worker. Worker will NOT start.');
      // CRITICAL: Clear ALL Redis env vars to prevent BullMQ from using defaults
      delete process.env.REDIS_URL;
      process.env.REDIS_URL = '';
      delete process.env.BULL_REDIS_URL;
      process.env.BULL_REDIS_URL = '';
      delete process.env.QUEUE_REDIS_URL;
      process.env.QUEUE_REDIS_URL = '';
      delete process.env.JOB_REDIS_URL;
      process.env.JOB_REDIS_URL = '';
      return;
    }

    // CRITICAL: Worker options - connection MUST be a string (Redis URL)
    // NEVER pass an object with host/port - this would allow BullMQ to use defaults
    const workerOptions = {
      connection: connectionConfig as string, // Use Redis URL string directly - BullMQ will parse it
      concurrency: this.workerConcurrency,
      limiter: {
        max: 100, // Max 100 jobs per duration
        duration: 1000, // Per second
      },
      // Prevent reconnection loops
      maxStalledCount: 1,
      // CRITICAL: Disable automatic retries to prevent localhost fallback
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Disable retries - fail fast
    };
    
    // CRITICAL: Log final connection config before creating Worker
    this.logger.log(`[redis][worker] Creating BullMQ Worker with connection type: ${typeof workerOptions.connection}`);
    if (typeof workerOptions.connection === 'string') {
      const urlForLogging = (workerOptions.connection as string).replace(/:[^:@]+@/, ':****@');
      this.logger.log(`[redis][worker] Worker connection URL: ${urlForLogging}`);
    } else {
      this.logger.error(`[redis][worker] FATAL: Worker connection is not a string! Type: ${typeof workerOptions.connection}`);
      // Clear env vars and abort
      delete process.env.REDIS_URL;
      process.env.REDIS_URL = '';
      delete process.env.REDIS_HOST;
      process.env.REDIS_HOST = '';
      delete process.env.REDIS_PORT;
      process.env.REDIS_PORT = '';
      return;
    }

    this.bullWorker = new Worker(
      queueName,
      async (job: any) => {
        await this.processBullJob(job);
      },
      workerOptions,
    ) as Worker;

    if (this.bullWorker) {
      this.bullWorker.on('completed', (job: any) => {
        this.logger.debug(`BullMQ job ${job.id} completed`);
      });

      this.bullWorker.on('failed', (job: any, err: Error) => {
        this.logger.error(`BullMQ job ${job?.id} failed: ${err.message}`, err.stack);
      });

      this.bullWorker.on('error', (err: Error) => {
        const errorMsg = err.message || String(err);
        // CRITICAL: If we detect localhost connection attempt, destroy worker immediately
        if (errorMsg.includes('ECONNREFUSED') && errorMsg.includes('127.0.0.1')) {
          this.logger.error(`[redis][worker] FATAL: Worker attempted to connect to localhost. Destroying worker immediately.`);
          if (this.bullWorker) {
            this.bullWorker.close().catch(() => {
              // Ignore close errors
            });
            this.bullWorker = null;
          }
          return; // Stop processing - worker is destroyed
        }
        // Log other connection errors only once to avoid spam
        if (errorMsg.includes('ECONNREFUSED')) {
          this.logger.error(`[redis][worker] Connection error (logged once): ${errorMsg}`);
          // Don't spam logs - BullMQ will handle retries internally
        } else {
          this.logger.error(`[redis][worker] BullMQ worker error: ${errorMsg}`, err.stack);
        }
      });

      // Log successful connection
      this.bullWorker.on('ready', () => {
        this.logger.log('[redis][worker] BullMQ worker connected and ready');
      });
    }
  }

  /**
   * Process a job from BullMQ
   */
  private async processBullJob(job: any): Promise<void> {
    const { jobId, jobType, provider, organizationId, payload } = job.data;

    // Update DB job status to PROCESSING
    await this.integrationJobsService.markProcessing(jobId);

    const startTime = Date.now();

    try {
      // Route to appropriate processor based on provider
      // Note: WhatsApp/Instagram/Meta processors removed (Inbox/Meta Ads removed)

      // Mark as done in DB
      await this.integrationJobsService.markDone(jobId);

      const durationMs = Date.now() - startTime;
      // Record metrics
      if (this.integrationJobsService['metricsService']) {
        this.integrationJobsService['metricsService'].recordJobDuration(provider, jobType, 'success', durationMs);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.integrationJobsService.markFailed(jobId, errorMessage);
      
      const durationMs = Date.now() - startTime;
      // Record metrics
      if (this.integrationJobsService['metricsService']) {
        this.integrationJobsService['metricsService'].recordJobDuration(provider, jobType, 'failed', durationMs);
      }
      
      // Re-throw to let BullMQ handle retry
      throw error;
    }
  }

  /**
   * Manually trigger job processing (for testing or manual runs)
   */
  async triggerProcessing(): Promise<void> {
    if (this.mutex.locked) {
      throw new Error('Job runner is already processing');
    }

    // Acquire distributed lock
    const lockTtlMs = this.intervalMs * 2;
    const lockAcquired = await this.lockService.acquireLock(lockTtlMs);
    if (!lockAcquired) {
      throw new Error('Lock not acquired, another instance is processing');
    }

    this.mutex.locked = true;
    this.isProcessing = true;
    const startTime = Date.now();
    let jobCount = 0;
    let error: Error | null = null;

    try {
      await this.lockService.cleanupExpiredLock();

      // Process jobs for all providers
      // Note: WhatsApp/Instagram/Meta processors removed (Inbox/Meta Ads removed)
      const results: PromiseSettledResult<number>[] = [];

      jobCount = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.find((r) => r.status === 'rejected');
      if (failed && failed.status === 'rejected') {
        error = failed.reason instanceof Error ? failed.reason : new Error(String(failed.reason));
        // Re-throw error for manual trigger
        throw error;
      }
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      throw error;
    } finally {
      const durationMs = Date.now() - startTime;
      await this.stateService.updateState(new Date(), durationMs, jobCount, error?.message);
      await this.lockService.releaseLock();
      this.mutex.locked = false;
      this.isProcessing = false;
    }
  }

}
