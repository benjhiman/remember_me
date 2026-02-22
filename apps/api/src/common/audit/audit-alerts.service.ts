import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditDomainEventsService } from './audit-domain-events.service';
import { AuditAction, AuditEntityType } from '@remember-me/prisma';

/**
 * AuditAlertsService
 * 
 * Monitors audit logs for suspicious patterns and generates alerts.
 * 
 * Alerts:
 * - >50 LOGIN_FAILED in 10 minutes for same user
 * - >100 events in 1 minute for same actor
 * 
 * Future: Can integrate with Slack/Webhook
 */
@Injectable()
export class AuditAlertsService {
  private readonly logger = new Logger(AuditAlertsService.name);
  private readonly checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditDomainEvents: AuditDomainEventsService,
  ) {
    // Start monitoring if enabled
    if (process.env.AUDIT_ALERTS_ENABLED === 'true') {
      this.startMonitoring();
    }
  }

  /**
   * Start monitoring for alerts (runs every 5 minutes)
   */
  startMonitoring() {
    if (this.checkInterval) {
      this.logger.warn('Monitoring already started');
      return;
    }

    // Check every 5 minutes
    setInterval(() => {
      this.checkAlerts().catch((error) => {
        this.logger.error(`Alert check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    }, 5 * 60 * 1000);

    this.logger.log('Audit alerts monitoring started');
  }

  /**
   * Check for alert conditions
   */
  async checkAlerts(): Promise<void> {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // Check for excessive LOGIN_FAILED attempts
    const failedLogins = await this.prisma.auditLog.groupBy({
      by: ['actorUserId', 'actorEmail'],
      where: {
        action: AuditAction.LOGIN_FAILED,
        createdAt: {
          gte: tenMinutesAgo,
        },
        actorUserId: { not: null },
      },
      _count: true,
      having: {
        actorUserId: {
          _count: {
            gt: 50,
          },
        },
      },
    });

    for (const login of failedLogins) {
      if (login._count > 50) {
        this.logger.warn(
          `ALERT: User ${login.actorEmail || login.actorUserId} has ${login._count} failed login attempts in last 10 minutes`,
        );

        // Log alert as audit event
        await this.auditDomainEvents.emit({
          organizationId: 'system', // System-level alert
          actorUserId: null,
          actorRole: null,
          actorEmail: null,
          requestId: null,
          action: AuditAction.UPDATE, // Using UPDATE as alert action
          entityType: AuditEntityType.User,
          entityId: login.actorUserId || 'unknown',
          before: null,
          after: {
            alert: 'EXCESSIVE_LOGIN_FAILURES',
            count: login._count,
            timeWindow: '10 minutes',
          },
          metadata: {
            alertType: 'EXCESSIVE_LOGIN_FAILURES',
            userId: login.actorUserId,
            email: login.actorEmail,
            count: login._count,
            threshold: 50,
          },
          source: 'system',
          severity: 'warn',
        });
      }
    }

    // Check for excessive activity (same actor, >100 events in 1 minute)
    const excessiveActivity = await this.prisma.auditLog.groupBy({
      by: ['actorUserId', 'actorEmail'],
      where: {
        createdAt: {
          gte: oneMinuteAgo,
        },
        actorUserId: { not: null },
      },
      _count: true,
      having: {
        actorUserId: {
          _count: {
            gt: 100,
          },
        },
      },
    });

    for (const activity of excessiveActivity) {
      if (activity._count > 100) {
        this.logger.warn(
          `ALERT: User ${activity.actorEmail || activity.actorUserId} has ${activity._count} events in last 1 minute`,
        );

        // Log alert as audit event
        await this.auditDomainEvents.emit({
          organizationId: 'system', // System-level alert
          actorUserId: null,
          actorRole: null,
          actorEmail: null,
          requestId: null,
          action: AuditAction.UPDATE,
          entityType: AuditEntityType.User,
          entityId: activity.actorUserId || 'unknown',
          before: null,
          after: {
            alert: 'EXCESSIVE_ACTIVITY',
            count: activity._count,
            timeWindow: '1 minute',
          },
          metadata: {
            alertType: 'EXCESSIVE_ACTIVITY',
            userId: activity.actorUserId,
            email: activity.actorEmail,
            count: activity._count,
            threshold: 100,
          },
          source: 'system',
          severity: 'warn',
        });
      }
    }
  }
}
