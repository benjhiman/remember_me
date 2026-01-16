import { Injectable } from '@nestjs/common';
import { IntegrationJobsService } from '../integration-jobs.service';
import { IIntegrationQueue, EnqueueJobParams } from './i-integration-queue.interface';

/**
 * Database-backed queue adapter (existing implementation)
 * Wraps IntegrationJobsService for compatibility
 */
@Injectable()
export class DbQueueAdapter implements IIntegrationQueue {
  constructor(private readonly integrationJobsService: IntegrationJobsService) {}

  async enqueue(params: EnqueueJobParams): Promise<any> {
    return this.integrationJobsService.enqueue(
      params.jobType,
      params.provider,
      params.payload,
      params.runAt,
      params.organizationId,
      params.connectedAccountId,
      params.dedupeKey,
    );
  }

  isEnabled(): boolean {
    return true; // DB queue is always available
  }
}
