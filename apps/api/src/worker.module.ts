import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { LoggerService } from './common/logger/logger.service';
import { StockModule } from './stock/stock.module';

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
    IntegrationsModule, // Includes JobRunnerService and all processors
    StockModule, // Includes ReservationsExpirerService
  ],
  providers: [LoggerService],
})
export class WorkerModule {}
