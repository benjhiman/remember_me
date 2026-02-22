import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/**
 * AuditRetentionService
 * 
 * Manages automatic cleanup of old audit logs based on retention policy.
 * 
 * Features:
 * - Configurable retention period (AUDIT_RETENTION_DAYS, default 365)
 * - Safe deletion with logging
 * - Can be run as cron job or manual trigger
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);
  private readonly retentionDays: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = parseInt(
      this.configService.get('AUDIT_RETENTION_DAYS') || '365',
      10,
    );

    this.logger.log(`Audit retention service initialized with ${this.retentionDays} days retention`);

    // Auto-start cleanup if enabled
    if (this.configService.get('AUDIT_RETENTION_AUTO_CLEANUP') === 'true') {
      this.startAutoCleanup();
    }
  }

  /**
   * Start automatic cleanup (runs daily)
   */
  startAutoCleanup() {
    if (this.cleanupInterval) {
      this.logger.warn('Auto cleanup already started');
      return;
    }

    // Run cleanup daily at 2 AM
    const runCleanup = () => {
      const now = new Date();
      const nextRun = new Date(now);
      nextRun.setHours(2, 0, 0, 0);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const msUntilNext = nextRun.getTime() - now.getTime();
      this.logger.log(`Next cleanup scheduled for ${nextRun.toISOString()}`);

      setTimeout(() => {
        this.cleanup().catch((error) => {
          this.logger.error(`Auto cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });

        // Schedule next run (24 hours)
        this.cleanupInterval = setInterval(() => {
          this.cleanup().catch((error) => {
            this.logger.error(`Auto cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          });
        }, 24 * 60 * 60 * 1000);
      }, msUntilNext);
    };

    runCleanup();
    this.logger.log('Auto cleanup started');
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.log('Auto cleanup stopped');
    }
  }

  /**
   * Clean up old audit logs
   * Deletes logs older than retentionDays
   */
  async cleanup(): Promise<{ deleted: number; cutoffDate: Date }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    this.logger.log(`Starting audit log cleanup: deleting logs older than ${cutoffDate.toISOString()}`);

    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(`Audit log cleanup completed: ${result.count} logs deleted`);

      return {
        deleted: result.count,
        cutoffDate,
      };
    } catch (error) {
      this.logger.error(
        `Audit log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get retention statistics
   */
  async getStats() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const [total, toDelete, oldest] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      }),
      this.prisma.auditLog.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      retentionDays: this.retentionDays,
      cutoffDate,
      totalLogs: total,
      logsToDelete: toDelete,
      oldestLog: oldest?.createdAt || null,
      autoCleanupEnabled: this.cleanupInterval !== null,
    };
  }
}
