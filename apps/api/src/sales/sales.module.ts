import { Module, forwardRef } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../common/audit/audit-log.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AttributionService } from '../dashboard/attribution.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, AuditLogModule, SettingsModule, forwardRef(() => IntegrationsModule)],
  controllers: [SalesController],
  providers: [SalesService, AttributionService],
  exports: [SalesService],
})
export class SalesModule {}
