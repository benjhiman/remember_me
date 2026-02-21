import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAction, AuditEntityType, Prisma } from '@remember-me/prisma';

export interface AuditLogData {
  organizationId: string;
  actorUserId: string | null;
  actorRole?: string | null;      // Role del usuario (OWNER, ADMIN, MANAGER, SELLER)
  actorEmail?: string | null;      // Email del usuario
  requestId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: any;
  after?: any;
  metadata?: any;                  // Contiene: ip, userAgent, saleId, customerId, sellerId, depoId, officeId, etc.
  severity?: 'info' | 'warn' | 'error';
  source?: 'web' | 'api' | 'worker' | 'system';
  ip?: string | null;
  userAgent?: string | null;
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
      // Extract ip and userAgent from metadata if not provided directly
      const ip = data.ip || (data.metadata && typeof data.metadata === 'object' && 'ip' in data.metadata ? data.metadata.ip : null);
      const userAgent = data.userAgent || (data.metadata && typeof data.metadata === 'object' && 'userAgent' in data.metadata ? data.metadata.userAgent : null);

      await this.prisma.auditLog.create({
        data: {
          organizationId: data.organizationId,
          actorUserId: data.actorUserId,
          actorRole: data.actorRole || null,
          actorEmail: data.actorEmail || null,
          requestId: data.requestId || null,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          beforeJson: data.before ? (data.before as Prisma.InputJsonValue) : Prisma.JsonNull,
          afterJson: data.after ? (data.after as Prisma.InputJsonValue) : Prisma.JsonNull,
          metadataJson: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
          severity: data.severity || 'info',
          source: data.source || 'api',
          ip: ip || null,
          userAgent: userAgent || null,
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
