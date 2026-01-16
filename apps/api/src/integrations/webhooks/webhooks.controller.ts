import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { IntegrationProvider } from '@remember-me/prisma';
import { IsEnum, IsObject } from 'class-validator';

class WebhookPayloadDto {
  @IsObject()
  data: any;
}

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(':provider')
  async receiveWebhook(
    @Param('provider') provider: IntegrationProvider,
    @Body() body: any,
  ) {
    // Extract event type from body (provider-specific)
    // For now, use a default event type
    const eventType = body.eventType || body.type || 'unknown';

    // Process webhook (saves event and creates job)
    await this.webhooksService.processWebhook(provider, eventType, body);

    // Return 200 immediately (ack)
    return { status: 'received' };
  }
}
