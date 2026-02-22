import { Module, Global } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogStatsController } from './audit-log-stats.controller';
import { AuditLogExportController } from './audit-log-export.controller';
import { AuditDomainEventsService } from './audit-domain-events.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditLogService, AuditDomainEventsService],
  controllers: [AuditLogController, AuditLogStatsController, AuditLogExportController],
  exports: [AuditLogService, AuditDomainEventsService],
})
export class AuditLogModule {}
