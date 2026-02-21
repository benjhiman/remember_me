import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { LoggerService } from './common/logger/logger.service';
// Import StockService directly instead of StockModule to avoid controllers
import { StockService } from './stock/stock.service';
import { PrismaModule as StockPrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './common/audit/audit-log.module';

/**
 * Worker Module - Only loads modules needed for job processing
 * Does NOT include HTTP controllers or API endpoints
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    MetricsModule, // Needed by RateLimitModule
    RateLimitModule, // Needed by IntegrationsModule
    AuditLogModule, // Needed by StockService
    // Import IntegrationsModule but exclude its controllers
    IntegrationsModule,
  ],
  providers: [
    LoggerService,
    // Provide StockService directly without StockController
    StockService,
  ],
  exports: [StockService], // Export for use in job processors
})
export class WorkerModule {}
