import { Module, Global } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogStatsController } from './audit-log-stats.controller';
import { AuditLogExportController } from './audit-log-export.controller';
import { AuditDomainEventsService } from './audit-domain-events.service';
import { AuditRetentionService } from './audit-retention.service';
import { AuditAlertsService } from './audit-alerts.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditLogService, AuditDomainEventsService, AuditRetentionService, AuditAlertsService],
  controllers: [AuditLogController, AuditLogStatsController, AuditLogExportController],
  exports: [AuditLogService, AuditDomainEventsService, AuditRetentionService, AuditAlertsService],
})
export class AuditLogModule {}
