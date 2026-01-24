import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { LeadsModule } from './leads/leads.module';
import { StockModule } from './stock/stock.module';
import { PricingModule } from './pricing/pricing.module';
import { SalesModule } from './sales/sales.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { OrganizationInterceptor } from './common/interceptors/organization.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerService } from './common/logger/logger.service';
import { AuditLogModule } from './common/audit/audit-log.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { IntegrationsModule } from './integrations/integrations.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { ExternalHttpClientModule } from './common/http/external-http-client.module';
import { SettingsModule } from './settings/settings.module';
import { CustomersModule } from './customers/customers.module';
import { VendorsModule } from './vendors/vendors.module';
import { PurchasesModule } from './purchases/purchases.module';
import { LedgerModule } from './ledger/ledger.module';

// Resolve .env path relative to apps/api directory
// Works from any CWD: finds apps/api/.env whether running from root or apps/api
const envFilePath = (() => {
  const fs = require('fs');
  
  // Strategy: Always resolve to apps/api/.env relative to project root
  // In dev: __dirname = apps/api/src
  // In prod: __dirname = dist/apps/api/src
  
  // First, find project root by looking for pnpm-workspace.yaml or package.json with workspaces
  let searchDir = __dirname;
  let projectRoot: string | null = null;
  
  // Walk up to find project root (max 6 levels)
  for (let i = 0; i < 6; i++) {
    const workspaceFile = path.join(searchDir, 'pnpm-workspace.yaml');
    if (fs.existsSync(workspaceFile)) {
      projectRoot = searchDir;
      break;
    }
    const parent = path.dirname(searchDir);
    if (parent === searchDir) break;
    searchDir = parent;
  }
  
  // If found project root, use it
  if (projectRoot) {
    const envFile = path.join(projectRoot, 'apps', 'api', '.env');
    if (fs.existsSync(envFile)) {
      return envFile;
    }
  }
  
  // Fallback: resolve relative to __dirname
  // In dev: apps/api/src -> ../.. = apps/api -> .env
  // In prod: dist/apps/api/src -> ../../../../apps/api/.env
  if (__dirname.includes('dist')) {
    // We're in dist, go to project root then apps/api
    const distApiDir = path.resolve(__dirname, '../..'); // dist/apps/api
    const projectRootFromDist = path.resolve(distApiDir, '../../..'); // project root
    return path.join(projectRootFromDist, 'apps', 'api', '.env');
  } else {
    // We're in source, go up to apps/api
    const apiDir = path.resolve(__dirname, '../..'); // apps/api
    return path.join(apiDir, '.env');
  }
})();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePath,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    LeadsModule,
    StockModule,
    PricingModule,
    SalesModule,
    DashboardModule,
    AuditLogModule,
    IdempotencyModule,
    IntegrationsModule,
    SettingsModule,
    CustomersModule,
    VendorsModule,
    PurchasesModule,
    RateLimitModule,
    MetricsModule,
    ExternalHttpClientModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggerService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    // PermissionsGuard is applied per-endpoint with @RequirePermissions
    // Not global to maintain backward compatibility
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: OrganizationInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
