import { Module, NestModule, MiddlewareConsumer, forwardRef } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsSettingsController } from './integrations-settings.controller';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';
import { WhatsAppWebhookController } from './webhooks/whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './webhooks/whatsapp-webhook.service';
import { WhatsAppSignatureGuard } from './webhooks/whatsapp-signature.guard';
import { WhatsAppRawBodyMiddleware } from './webhooks/whatsapp-raw-body.middleware';
import { IntegrationJobsService } from './jobs/integration-jobs.service';
import { WhatsAppJobProcessorService } from './jobs/whatsapp-job-processor.service';
import { JobRunnerService } from './jobs/job-runner.service';
import { JobRunnerLockService } from './jobs/job-runner-lock.service';
import { JobRunnerStateService } from './jobs/job-runner-state.service';
import { InboxService } from './inbox/inbox.service';
import { InboxController } from './inbox/inbox.controller';
import { WhatsAppTemplatesService } from './whatsapp/whatsapp-templates.service';
import { WhatsAppTemplatesController } from './whatsapp/whatsapp-templates.controller';
import { WhatsAppAutomationsService } from './whatsapp/whatsapp-automations.service';
import { WhatsAppAutomationsController } from './whatsapp/whatsapp-automations.controller';
import { InstagramWebhookController } from './webhooks/instagram-webhook.controller';
import { InstagramWebhookService } from './webhooks/instagram-webhook.service';
import { InstagramSignatureGuard } from './webhooks/instagram-signature.guard';
import { InstagramRawBodyMiddleware } from './webhooks/instagram-raw-body.middleware';
import { InstagramJobProcessorService } from './jobs/instagram-job-processor.service';
import { MetaSpendJobProcessorService } from './jobs/meta-spend-job-processor.service';
import { MetaTokenRefreshJobProcessorService } from './jobs/meta-token-refresh-job-processor.service';
import { MetaMarketingService } from './meta/meta-marketing.service';
import { MetaOAuthService } from './meta/meta-oauth.service';
import { MetaOAuthController } from './meta/meta-oauth.controller';
import { MetaIntegrationsController } from './meta/meta-integrations.controller';
import { MetaAdsController } from './meta/meta-ads.controller';
import { MetaAdsService } from './meta/meta-ads.service';
import { MetaAdsCacheService } from './meta/meta-ads-cache.service';
import { MetaBulkInsightsService } from './meta/meta-bulk-insights.service';
import { MetaConfigController } from './meta/meta-config.controller';
import { MetaConfigService } from './meta/meta-config.service';
import { MetaCampaignsService } from './meta/meta-campaigns.service';
import { MetaAdsetsService } from './meta/meta-adsets.service';
import { MetaAdsItemsService } from './meta/meta-ads-items.service';
import { MetaTokenService } from './meta/meta-token.service';
import { TokenCryptoService } from '../common/crypto/token-crypto.service';
import { MetaLeadAdsWebhookController } from './webhooks/meta-lead-ads.controller';
import { MetaLeadAdsService } from './webhooks/meta-lead-ads.service';
import { MetaLeadAdsRawBodyMiddleware } from './webhooks/meta-lead-ads-raw-body.middleware';
import { IntegrationQueueService } from './jobs/queue/integration-queue.service';
import { DbQueueAdapter } from './jobs/queue/db-queue.adapter';
import { BullMqQueueAdapter } from './jobs/queue/bullmq-queue.adapter';
import { ExternalHttpClientModule } from '../common/http/external-http-client.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LeadsModule } from '../leads/leads.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, forwardRef(() => LeadsModule), ExternalHttpClientModule],
  controllers: [
    IntegrationsController,
    IntegrationsSettingsController,
    WebhooksController,
    WhatsAppWebhookController,
    InstagramWebhookController,
    MetaLeadAdsWebhookController,
    MetaOAuthController,
    MetaIntegrationsController,
    MetaAdsController,
    MetaConfigController,
    InboxController,
    WhatsAppTemplatesController,
    WhatsAppAutomationsController,
  ],
  providers: [
    IntegrationsService,
    WebhooksService,
    WhatsAppWebhookService,
    WhatsAppSignatureGuard,
    InstagramWebhookService,
    InstagramSignatureGuard,
    MetaLeadAdsService,
    IntegrationJobsService,
    WhatsAppJobProcessorService,
    InstagramJobProcessorService,
    MetaSpendJobProcessorService,
    MetaTokenRefreshJobProcessorService,
    MetaMarketingService,
    MetaOAuthService,
    MetaTokenService,
    MetaAdsService,
    MetaAdsCacheService,
    MetaBulkInsightsService,
    MetaConfigService,
    MetaCampaignsService,
    MetaAdsetsService,
    MetaAdsItemsService,
    TokenCryptoService,
    JobRunnerService,
    JobRunnerLockService,
    JobRunnerStateService,
    InboxService,
    WhatsAppTemplatesService,
    WhatsAppAutomationsService,
    DbQueueAdapter,
    BullMqQueueAdapter, // Optional: only initialized if QUEUE_MODE=bullmq
    IntegrationQueueService,
  ],
  exports: [
    IntegrationsService,
    IntegrationJobsService,
    IntegrationQueueService,
    WhatsAppJobProcessorService,
    InstagramJobProcessorService,
    JobRunnerService,
    InboxService,
    WhatsAppTemplatesService,
    WhatsAppAutomationsService,
  ],
})
export class IntegrationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply raw body middleware to webhook routes for signature verification
    consumer.apply(WhatsAppRawBodyMiddleware).forRoutes('webhooks/whatsapp');
    consumer.apply(InstagramRawBodyMiddleware).forRoutes('webhooks/instagram');
    consumer.apply(MetaLeadAdsRawBodyMiddleware).forRoutes('webhooks/meta-lead-ads');
  }
}
