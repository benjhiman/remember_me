import { IntegrationJobType, IntegrationProvider } from '@remember-me/prisma';

export interface EnqueueJobParams {
  jobType: IntegrationJobType;
  provider: IntegrationProvider;
  payload: any;
  runAt?: Date;
  organizationId?: string;
  connectedAccountId?: string;
  dedupeKey?: string; // Optional deduplication key
}

export interface IIntegrationQueue {
  /**
   * Enqueue a job
   * @returns Job ID (string) or job object (depending on implementation)
   */
  enqueue(params: EnqueueJobParams): Promise<any>;
  
  /**
   * Check if queue is enabled/available
   */
  isEnabled(): boolean;
}
