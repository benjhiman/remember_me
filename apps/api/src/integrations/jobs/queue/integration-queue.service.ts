import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IIntegrationQueue, EnqueueJobParams } from './i-integration-queue.interface';
import { DbQueueAdapter } from './db-queue.adapter';
import { BullMqQueueAdapter } from './bullmq-queue.adapter';

/**
 * Main integration queue service that selects the appropriate adapter
 * based on QUEUE_MODE environment variable with fallback to DB
 */
@Injectable()
export class IntegrationQueueService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationQueueService.name);
  private adapter: IIntegrationQueue | null = null;
  private readonly queueMode: 'db' | 'bullmq';

  constructor(
    private readonly configService: ConfigService,
    private readonly dbAdapter: DbQueueAdapter,
    private readonly bullMqAdapter?: BullMqQueueAdapter, // Optional to avoid initialization errors if Redis unavailable
  ) {
    const mode = this.configService.get<string>('QUEUE_MODE', 'db');
    this.queueMode = (mode === 'bullmq' || mode === 'bull') ? 'bullmq' : 'db';
  }

  async onModuleInit() {
    // Select adapter based on QUEUE_MODE
    // In API mode, always use DB adapter (BullMQ should not be initialized)
    const workerMode = this.configService.get<string>('WORKER_MODE', '0');
    const jobRunnerEnabled = this.configService.get<string>('JOB_RUNNER_ENABLED', 'false');
    const isWorkerMode = workerMode === '1' || workerMode === 'true';
    const isJobRunnerEnabled = isWorkerMode && (jobRunnerEnabled === 'true' || jobRunnerEnabled !== 'false');

    if (this.queueMode === 'bullmq' && isWorkerMode && isJobRunnerEnabled) {
      if (this.bullMqAdapter && this.bullMqAdapter.isEnabled()) {
        this.adapter = this.bullMqAdapter;
        this.logger.log('Using BullMQ queue adapter');
      } else {
        this.logger.warn('QUEUE_MODE=bullmq but BullMQ adapter not available, falling back to DB queue');
        this.adapter = this.dbAdapter;
      }
    } else {
      // In API mode or if BullMQ not enabled, use DB adapter
      if (this.queueMode === 'bullmq' && !isWorkerMode) {
        this.logger.log('Using DB queue adapter (API mode - BullMQ skipped)');
      } else {
        this.logger.log('Using DB queue adapter');
      }
      this.adapter = this.dbAdapter;
    }
  }

  /**
   * Enqueue a job using the selected adapter
   */
  async enqueue(params: EnqueueJobParams): Promise<any> {
    if (!this.adapter) {
      // Fallback to DB if adapter not initialized
      this.logger.warn('Queue adapter not initialized, using DB fallback');
      return this.dbAdapter.enqueue(params);
    }

    try {
      return await this.adapter.enqueue(params);
    } catch (error) {
      // If BullMQ fails, fallback to DB
      if (this.queueMode === 'bullmq' && this.adapter !== this.dbAdapter) {
        this.logger.error(`BullMQ enqueue failed: ${error instanceof Error ? error.message : 'Unknown error'}, falling back to DB`);
        return this.dbAdapter.enqueue(params);
      }
      throw error;
    }
  }

  /**
   * Get the current adapter (for worker/monitoring)
   */
  getAdapter(): IIntegrationQueue | null {
    return this.adapter;
  }

  /**
   * Check if BullMQ adapter is active
   */
  isBullMqEnabled(): boolean {
    return this.adapter === this.bullMqAdapter && this.bullMqAdapter?.isEnabled() === true;
  }

  /**
   * Get BullMQ adapter (for worker)
   */
  getBullMqAdapter(): BullMqQueueAdapter | undefined {
    return this.bullMqAdapter;
  }
}
