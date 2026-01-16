import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, AuditEntityType, Prisma } from '@remember-me/prisma';

export interface AuditLogData {
  organizationId: string;
  actorUserId: string | null;
  requestId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: any;
  after?: any;
  metadata?: any;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly failMode: 'OPEN' | 'CLOSED';

  constructor(private readonly prisma: PrismaService) {
    this.failMode = (process.env.AUDIT_FAIL_MODE || 'OPEN').toUpperCase() as 'OPEN' | 'CLOSED';
  }

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: data.organizationId,
          actorUserId: data.actorUserId,
          requestId: data.requestId || null,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          beforeJson: data.before ? (data.before as Prisma.InputJsonValue) : Prisma.JsonNull,
          afterJson: data.after ? (data.after as Prisma.InputJsonValue) : Prisma.JsonNull,
          metadataJson: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create audit log: ${errorMessage}`, errorStack);

      if (this.failMode === 'CLOSED') {
        throw new InternalServerErrorException({
          statusCode: 500,
          message: 'Audit log failed',
          errorCode: 'AUDIT_LOG_FAILED',
          error: 'InternalServerError',
        });
      }
      // OPEN mode: log error and continue
    }
  }
}
