import { Module, NestModule, MiddlewareConsumer, forwardRef } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsSettingsController } from './integrations-settings.controller';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';
import { IntegrationJobsService } from './jobs/integration-jobs.service';
import { JobRunnerService } from './jobs/job-runner.service';
import { JobRunnerLockService } from './jobs/job-runner-lock.service';
import { JobRunnerStateService } from './jobs/job-runner-state.service';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import { IntegrationQueueService } from './jobs/queue/integration-queue.service';
import { DbQueueAdapter } from './jobs/queue/db-queue.adapter';
import { BullMqQueueAdapter } from './jobs/queue/bullmq-queue.adapter';
import { ExternalHttpClientModule } from '../common/http/external-http-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, SettingsModule, ExternalHttpClientModule],
  controllers: [
    IntegrationsController,
    IntegrationsSettingsController,
    WebhooksController,
  ],
  providers: [
    IntegrationsService,
    WebhooksService,
    IntegrationJobsService,
    TokenCryptoService,
    JobRunnerService,
    JobRunnerLockService,
    JobRunnerStateService,
    DbQueueAdapter,
    BullMqQueueAdapter, // Optional: only initialized if QUEUE_MODE=bullmq
    IntegrationQueueService,
  ],
  exports: [
    IntegrationsService,
    IntegrationJobsService,
    IntegrationQueueService,
    JobRunnerService,
  ],
})
export class IntegrationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Webhook middleware configuration removed (Meta Ads/Inbox removed)
  }
}
