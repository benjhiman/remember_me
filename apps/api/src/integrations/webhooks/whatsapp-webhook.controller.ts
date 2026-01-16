import { Controller, Get, Post, Query, Body, Headers, HttpCode, UseGuards } from '@nestjs/common';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { WhatsAppSignatureGuard } from './whatsapp-signature.guard';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly whatsappWebhookService: WhatsAppWebhookService) {}

  /**
   * Webhook verification (GET) - Meta calls this to verify webhook
   */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.whatsappWebhookService.verifyWebhook(mode, token, challenge);
  }

  /**
   * Receive webhook (POST) - Meta sends messages here
   * Signature verification is required if WHATSAPP_APP_SECRET is set
   */
  @Post()
  @HttpCode(200)
  @UseGuards(WhatsAppSignatureGuard, RateLimitGuard)
  @RateLimit({ action: 'webhook.whatsapp', limit: 100, windowSec: 60, skipIfDisabled: true })
  async receiveWebhook(
    @Body() body: any,
    @Headers('x-organization-id') organizationId?: string,
  ): Promise<{ status: string }> {
    await this.whatsappWebhookService.processWebhook(body, organizationId);
    return { status: 'ok' };
  }
}
