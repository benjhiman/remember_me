import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppJobProcessorService } from './whatsapp-job-processor.service';
import { InstagramJobProcessorService } from './instagram-job-processor.service';
import { MetaSpendJobProcessorService } from './meta-spend-job-processor.service';
import { MetaTokenRefreshJobProcessorService } from './meta-token-refresh-job-processor.service';
import { WhatsAppAutomationsService } from '../whatsapp/whatsapp-automations.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { JobRunnerLockService } from './job-runner-lock.service';
import { JobRunnerStateService } from './job-runner-state.service';
import { IntegrationQueueService } from './queue/integration-queue.service';
import { WhatsAppAutomationTrigger, IntegrationProvider, IntegrationJobType, ConnectedAccountStatus } from '@remember-me/prisma';
import { Worker } from 'bullmq';

@Injectable()
export class JobRunnerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobRunnerService.name);
  private intervalId: NodeJS.Timeout | null = null;
  private noReplyIntervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly mutex = { locked: false }; // Local mutex (still needed for single-instance)

  // Check if running in worker mode (WORKER_MODE=1) or API mode (default)
  private readonly isWorkerMode = process.env.WORKER_MODE === '1' || process.env.WORKER_MODE === 'true';
  // In API mode, disable by default unless explicitly enabled
  // In worker mode, enable by default unless explicitly disabled
  private readonly enabled = this.isWorkerMode
    ? process.env.JOB_RUNNER_ENABLED !== 'false'
    : process.env.JOB_RUNNER_ENABLED === 'true';
  private readonly intervalMs = parseInt(process.env.JOB_RUNNER_INTERVAL_MS || '5000', 10);
  private readonly noReplyScanEnabled = process.env.NO_REPLY_SCAN_ENABLED === 'true';
  private readonly noReplyScanIntervalMs = parseInt(process.env.NO_REPLY_SCAN_INTERVAL_MS || '300000', 10); // Default 5 minutes
  private readonly metaSpendEnabled = process.env.META_SPEND_ENABLED === 'true';
  private metaSpendIntervalId: NodeJS.Timeout | null = null;
  private readonly metaTokenRefreshEnabled = process.env.META_TOKEN_REFRESH_ENABLED === 'true';
  private metaTokenRefreshIntervalId: NodeJS.Timeout | null = null;
  private readonly queueMode: 'db' | 'bullmq';
  private readonly workerConcurrency: number;
  private bullWorker: Worker | null = null;

  constructor(
    private readonly whatsappJobProcessor: WhatsAppJobProcessorService,
    private readonly instagramJobProcessor: InstagramJobProcessorService,
    private readonly metaSpendJobProcessor: MetaSpendJobProcessorService,
    private readonly metaTokenRefreshJobProcessor: MetaTokenRefreshJobProcessorService,
    private readonly automationsService: WhatsAppAutomationsService,
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
    if (this.enabled) {
      const mode = this.isWorkerMode ? 'WORKER' : 'API';
      this.logger.log(`Starting job runner in ${mode} mode with interval ${this.intervalMs}ms (queue mode: ${this.queueMode})`);
      
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
      this.logger.log(`Job runner disabled in ${mode} mode (JOB_RUNNER_ENABLED=${process.env.JOB_RUNNER_ENABLED})`);
    }

    // NO_REPLY scan should only run in Worker mode, not in API mode
    if (this.noReplyScanEnabled && this.isWorkerMode) {
      this.logger.log(`NO_REPLY_24H scanner enabled. Scanning every ${this.noReplyScanIntervalMs}ms.`);
      this.noReplyIntervalId = setInterval(() => this.scanNoReply(), this.noReplyScanIntervalMs);
      // Run once immediately on startup
      this.scanNoReply();
    } else if (this.noReplyScanEnabled && !this.isWorkerMode) {
      this.logger.log('NO_REPLY_24H scanner disabled in API mode (only runs in Worker mode).');
    } else {
      this.logger.log('NO_REPLY_24H scanner disabled.');
    }

    // Meta Spend and Token Refresh schedulers should only run in Worker mode
    if (this.metaSpendEnabled && this.isWorkerMode) {
      this.logger.log('Meta Spend fetch scheduler enabled. Scheduling daily jobs.');
      this.scheduleMetaSpendJobs();
      // Schedule daily at 6 AM (configurable via cron or interval)
      const cronExpression = process.env.META_SPEND_CRON || '0 6 * * *'; // Default: 6 AM daily
      this.scheduleMetaSpendCron(cronExpression);
    } else if (this.metaSpendEnabled && !this.isWorkerMode) {
      this.logger.log('Meta Spend fetch scheduler disabled in API mode (only runs in Worker mode).');
    } else {
      this.logger.log('Meta Spend fetch scheduler disabled.');
    }

    if (this.metaTokenRefreshEnabled && this.isWorkerMode) {
      this.logger.log('Meta Token refresh scheduler enabled. Scheduling daily jobs.');
      this.scheduleTokenRefreshJobs();
      // Schedule daily at 4 AM (configurable via cron)
      const cronExpression = process.env.META_TOKEN_REFRESH_CRON || '0 4 * * *'; // Default: 4 AM daily
      this.scheduleTokenRefreshCron(cronExpression);
    } else if (this.metaTokenRefreshEnabled && !this.isWorkerMode) {
      this.logger.log('Meta Token refresh scheduler disabled in API mode (only runs in Worker mode).');
    } else {
      this.logger.log('Meta Token refresh scheduler disabled.');
    }
  }

  onModuleDestroy() {
    this.stop();
    if (this.noReplyIntervalId) {
      clearInterval(this.noReplyIntervalId);
      this.noReplyIntervalId = null;
      this.logger.log('NO_REPLY_24H scanner stopped.');
    }
    if (this.metaSpendIntervalId) {
      clearInterval(this.metaSpendIntervalId);
      this.metaSpendIntervalId = null;
      this.logger.log('Meta Spend scheduler stopped.');
    }
    if (this.metaTokenRefreshIntervalId) {
      clearInterval(this.metaTokenRefreshIntervalId);
      this.metaTokenRefreshIntervalId = null;
      this.logger.log('Meta Token refresh scheduler stopped.');
    }
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
      const results = await Promise.allSettled([
        this.whatsappJobProcessor.processPendingJobs(10),
        this.instagramJobProcessor.processPendingJobs(10),
        this.metaSpendJobProcessor.processPendingJobs(10),
        this.metaTokenRefreshJobProcessor.processPendingJobs(10),
      ]);

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
    // Get Redis URL - use REDIS_URL as primary, fallback to other variants
    // NEVER default to localhost in production
    let redisUrl =
      configService.get<string>('REDIS_URL') ||
      configService.get<string>('RATE_LIMIT_REDIS_URL') ||
      configService.get<string>('BULL_REDIS_URL') ||
      configService.get<string>('QUEUE_REDIS_URL') ||
      configService.get<string>('JOB_REDIS_URL');

    if (!redisUrl) {
      const nodeEnv = configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'production') {
        throw new Error('REDIS_URL is required for BullMQ worker in production. Set REDIS_URL environment variable.');
      }
      // Only allow localhost in development
      this.logger.warn('No REDIS_URL found, using localhost:6379 (development only)');
      redisUrl = 'redis://localhost:6379';
    }
    const queueName = configService.get<string>('BULLMQ_QUEUE_NAME', 'integration-jobs');

    const workerOptions = {
      connection: redisUrl,
      concurrency: this.workerConcurrency,
      limiter: {
        max: 100, // Max 100 jobs per duration
        duration: 1000, // Per second
      },
    };

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
        this.logger.error(`BullMQ worker error: ${err.message}`, err.stack);
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
      if (provider === IntegrationProvider.WHATSAPP) {
        await this.whatsappJobProcessor.processJobFromQueue(jobId, jobType, payload, organizationId);
      } else if (provider === IntegrationProvider.INSTAGRAM) {
        await this.instagramJobProcessor.processJobFromQueue(jobId, jobType, payload, organizationId);
      } else if (jobType === IntegrationJobType.FETCH_META_SPEND) {
        // Meta spend jobs (can come from any provider)
        await this.metaSpendJobProcessor.processJobFromQueue(jobId, payload, organizationId);
      } else if (jobType === IntegrationJobType.REFRESH_META_TOKEN) {
        // Meta token refresh jobs (can come from any provider)
        await this.metaTokenRefreshJobProcessor.processJobFromQueue(jobId, payload, organizationId);
      }

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
      const results = await Promise.allSettled([
        this.whatsappJobProcessor.processPendingJobs(10),
        this.instagramJobProcessor.processPendingJobs(10),
        this.metaSpendJobProcessor.processPendingJobs(10),
        this.metaTokenRefreshJobProcessor.processPendingJobs(10),
      ]);

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

  /**
   * Scan for leads with no reply in 24h and trigger NO_REPLY_24H automation
   */
  private async scanNoReply(): Promise<void> {
    try {
      this.logger.debug('Starting NO_REPLY_24H scan...');

      // Get all organizations
      const organizations = await this.automationsService['prisma'].organization.findMany({
        select: { id: true },
      });

      for (const org of organizations) {
        try {
          // Find leads with last inbound message > 24h ago and no outbound after
          const twentyFourHoursAgo = new Date();
          twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

          // Get last inbound messages per phone
          const lastInboundMessages = await this.automationsService['prisma'].messageLog.findMany({
            where: {
              provider: IntegrationProvider.WHATSAPP,
              direction: 'INBOUND',
              createdAt: {
                lte: twentyFourHoursAgo,
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            distinct: ['to'], // One per phone
          });

          for (const inboundMsg of lastInboundMessages) {
            const phone = inboundMsg.to;

            // Check if there's an outbound message after this inbound
            const outboundAfter = await this.automationsService['prisma'].messageLog.findFirst({
              where: {
                provider: IntegrationProvider.WHATSAPP,
                direction: 'OUTBOUND',
                to: phone,
                createdAt: {
                  gt: inboundMsg.createdAt,
                },
              },
            });

            if (outboundAfter) {
              continue; // There was an outbound after, skip
            }

            // Find lead by phone
            const lead = await this.automationsService['prisma'].lead.findFirst({
              where: {
                organizationId: org.id,
                phone,
                deletedAt: null,
              },
            });

            if (lead) {
              // Trigger NO_REPLY_24H automation
              await this.automationsService.processTrigger(
                org.id,
                WhatsAppAutomationTrigger.NO_REPLY_24H,
                {
                  leadId: lead.id,
                  phone,
                  delayHours: 0, // Execute immediately (already 24h passed)
                },
              );
            }
          }
        } catch (error) {
          this.logger.error(`Error scanning NO_REPLY for org ${org.id}:`, error);
        }
      }

      this.logger.debug('NO_REPLY_24H scan completed.');
    } catch (error) {
      this.logger.error('Error in NO_REPLY_24H scan:', error);
    }
  }

  /**
   * Schedule Meta Spend fetch jobs for all organizations with Meta accounts
   */
  private async scheduleMetaSpendJobs(): Promise<void> {
    try {
      const organizations = await this.automationsService['prisma'].organization.findMany({
        include: {
          connectedAccounts: {
            where: {
              provider: { in: [IntegrationProvider.INSTAGRAM, IntegrationProvider.FACEBOOK] },
              status: 'CONNECTED',
            },
          },
        },
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      for (const org of organizations) {
        if (org.connectedAccounts.length > 0) {
          // Schedule job for yesterday's spend (default)
          await this.integrationJobsService.enqueue(
            IntegrationJobType.FETCH_META_SPEND,
            IntegrationProvider.INSTAGRAM,
            {
              organizationId: org.id,
              date: dateStr,
              level: 'CAMPAIGN', // Default to campaign level
            },
            new Date(), // Run immediately
            org.id,
          );

          this.logger.log(`Scheduled FETCH_META_SPEND job for org ${org.id}, date ${dateStr}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error scheduling Meta Spend jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Schedule Meta Spend fetch using cron-like expression (simplified)
   * Supports: "0 6 * * *" (minute hour * * *)
   */
  private scheduleMetaSpendCron(cronExpression: string): void {
    // Parse cron expression (simplified: only supports minute and hour)
    const parts = cronExpression.split(' ');
    if (parts.length < 2) {
      this.logger.warn(`Invalid cron expression: ${cronExpression}. Using default 6 AM.`);
      return;
    }

    const minute = parseInt(parts[0], 10);
    const hour = parseInt(parts[1], 10);

    if (isNaN(minute) || isNaN(hour)) {
      this.logger.warn(`Invalid cron expression: ${cronExpression}. Using default 6 AM.`);
      return;
    }

    // Calculate milliseconds until next scheduled time
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hour, minute, 0, 0);

    // If scheduled time has passed today, schedule for tomorrow
    if (scheduled < now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    const msUntilScheduled = scheduled.getTime() - now.getTime();

    // Schedule initial run
    setTimeout(() => {
      this.scheduleMetaSpendJobs();
      // Then schedule daily interval (24 hours)
      this.metaSpendIntervalId = setInterval(() => {
        this.scheduleMetaSpendJobs();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilScheduled);

    this.logger.log(`Meta Spend jobs scheduled to run daily at ${hour}:${minute.toString().padStart(2, '0')}`);
  }

  /**
   * Schedule Meta Token refresh jobs for all organizations with Meta accounts
   */
  private async scheduleTokenRefreshJobs(): Promise<void> {
    try {
      const accounts = await this.automationsService['prisma'].connectedAccount.findMany({
        where: {
          provider: { in: [IntegrationProvider.INSTAGRAM, IntegrationProvider.FACEBOOK] },
          status: ConnectedAccountStatus.CONNECTED,
        },
        include: {
          oauthTokens: {
            where: {
              expiresAt: {
                // Tokens expiring in less than 7 days
                lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                gt: new Date(), // But not expired yet
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      for (const account of accounts) {
        if (account.oauthTokens.length > 0) {
          // Schedule refresh job
          await this.integrationQueueService.enqueue({
            jobType: IntegrationJobType.REFRESH_META_TOKEN,
            provider: IntegrationProvider.INSTAGRAM,
            payload: {
              organizationId: account.organizationId,
              connectedAccountId: account.id,
            },
            runAt: new Date(), // Run immediately
            organizationId: account.organizationId,
            connectedAccountId: account.id,
          });

          this.logger.log(`Scheduled REFRESH_META_TOKEN job for account ${account.id}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error scheduling Meta Token refresh jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Schedule Meta Token refresh using cron-like expression
   */
  private scheduleTokenRefreshCron(cronExpression: string): void {
    const parts = cronExpression.split(' ');
    if (parts.length < 2) {
      this.logger.warn(`Invalid cron expression: ${cronExpression}. Using default 4 AM.`);
      return;
    }

    const minute = parseInt(parts[0], 10);
    const hour = parseInt(parts[1], 10);

    if (isNaN(minute) || isNaN(hour)) {
      this.logger.warn(`Invalid cron expression: ${cronExpression}. Using default 4 AM.`);
      return;
    }

    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hour, minute, 0, 0);

    if (scheduled < now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    const msUntilScheduled = scheduled.getTime() - now.getTime();

    setTimeout(() => {
      this.scheduleTokenRefreshJobs();
      // Then schedule daily interval (24 hours)
      this.metaTokenRefreshIntervalId = setInterval(() => {
        this.scheduleTokenRefreshJobs();
      }, 24 * 60 * 60 * 1000);
    }, msUntilScheduled);

    this.logger.log(`Meta Token refresh jobs scheduled to run daily at ${hour}:${minute.toString().padStart(2, '0')}`);
  }
}
