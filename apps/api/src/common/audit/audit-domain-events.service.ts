import { Injectable, Logger, Optional } from '@nestjs/common';
import { AuditLogService, AuditLogData } from './audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/**
 * AuditDomainEventsService
 * 
 * Centralized event bus for audit logging.
 * Services should use this instead of calling AuditLogService directly.
 * 
 * Features:
 * - Async mode support (queue-based if available)
 * - Synchronous fallback
 * - Automatic request context capture
 * - Performance optimized
 */
@Injectable()
export class AuditDomainEventsService {
  private readonly logger = new Logger(AuditDomainEventsService.name);
  private readonly useAsyncMode: boolean;
  private queueService: any = null; // BullMQ queue adapter if available

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() queueService?: any, // Inject queue service if available
  ) {
    // Enable async mode if worker/queue is enabled
    this.useAsyncMode =
      process.env.WORKER_MODE === '1' ||
      process.env.QUEUE_ENABLED === 'true' ||
      process.env.JOB_RUNNER_ENABLED === 'true';

    if (queueService) {
      this.queueService = queueService;
      this.logger.log('Queue service available - async audit logging enabled');
    } else if (this.useAsyncMode) {
      this.logger.warn('Async mode requested but no queue service available - using sync fallback');
    }
  }

  /**
   * Emit an audit event
   * 
   * This is the main entry point for all audit logging.
   * Services should call this instead of AuditLogService.log() directly.
   */
  async emit(event: AuditLogData): Promise<void> {
    try {
      if (this.useAsyncMode && this.queueService) {
        // Async mode: send to queue
        await this.queueService.add('audit-log', event, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 1000, // Keep last 1000 completed jobs
          },
        });
        this.logger.debug(`Audit event queued: ${event.action} on ${event.entityType}`);
      } else {
        // Sync mode: direct DB write (fire-and-forget)
        await this.auditLogService.log(event);
      }
    } catch (error) {
      // Never break the main request flow
      this.logger.error(
        `Failed to emit audit event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Emit multiple audit events in batch
   * Useful for bulk operations
   */
  async emitBatch(events: AuditLogData[]): Promise<void> {
    if (events.length === 0) return;

    try {
      if (this.useAsyncMode && this.queueService) {
        // Queue all events
        const jobs = events.map((event) => ({
          name: 'audit-log',
          data: event,
          opts: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        }));

        await this.queueService.addBulk(jobs);
        this.logger.debug(`Queued ${events.length} audit events`);
      } else {
        // Sync mode: write all directly (fire-and-forget)
        await Promise.all(events.map((event) => this.auditLogService.log(event)));
      }
    } catch (error) {
      this.logger.error(
        `Failed to emit audit event batch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
