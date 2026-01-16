import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import { IntegrationProvider, WebhookEventStatus, IntegrationJobType } from '@remember-me/prisma';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationQueueService: IntegrationQueueService,
  ) {}

  async processWebhook(
    provider: IntegrationProvider,
    eventType: string,
    payload: any,
    organizationId?: string,
  ) {
    // Validate provider
    if (!Object.values(IntegrationProvider).includes(provider)) {
      throw new BadRequestException(`Invalid provider: ${provider}`);
    }

    // Save webhook event
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider,
        eventType,
        payloadJson: payload,
        status: WebhookEventStatus.PENDING,
      },
    });

    // Create integration job to process webhook asynchronously
    // If organizationId is provided, associate job with org (multi-org strict)
    await this.integrationQueueService.enqueue({
      jobType: IntegrationJobType.PROCESS_WEBHOOK,
      provider,
      payload: {
        webhookEventId: webhookEvent.id,
        eventType,
        payload,
        organizationId,
      },
      organizationId,
    });

    return webhookEvent;
  }
}
