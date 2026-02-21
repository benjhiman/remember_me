import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { IntegrationsModule } from './integrations/integrations.module';
// RateLimitModule is NOT needed in worker - worker doesn't handle HTTP requests
// import { RateLimitModule } from './common/rate-limit/rate-limit.module';
// import { MetricsModule } from './common/metrics/metrics.module';
import { LoggerService } from './common/logger/logger.service';
// Import StockService directly instead of StockModule to avoid controllers
import { StockService } from './stock/stock.service';
import { AuditLogModule } from './common/audit/audit-log.module';

/**
 * Worker Module - Only loads modules needed for job processing
 * Does NOT include HTTP controllers or API endpoints
 * Does NOT include RateLimitModule (worker doesn't handle HTTP requests)
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    // MetricsModule and RateLimitModule removed - not needed for background jobs
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
