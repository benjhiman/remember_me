import { Controller, Get, Post, Query, Body, Headers, HttpCode, UseGuards } from '@nestjs/common';
import { InstagramWebhookService } from './instagram-webhook.service';
import { InstagramSignatureGuard } from './instagram-signature.guard';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';

@Controller('webhooks/instagram')
export class InstagramWebhookController {
  constructor(private readonly instagramWebhookService: InstagramWebhookService) {}

  /**
   * Webhook verification (GET) - Meta calls this to verify webhook
   */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.instagramWebhookService.verifyWebhook(mode, token, challenge);
  }

  /**
   * Receive webhook (POST) - Meta sends messages here
   * Signature verification is required if META_APP_SECRET is set
   */
  @Post()
  @HttpCode(200)
  @UseGuards(InstagramSignatureGuard, RateLimitGuard)
  @RateLimit({ action: 'webhook.instagram', limit: 100, windowSec: 60, skipIfDisabled: true })
  async receiveWebhook(
    @Body() body: any,
    @Headers('x-organization-id') organizationId?: string,
  ): Promise<{ status: string }> {
    await this.instagramWebhookService.processWebhook(body, organizationId);
    return { status: 'ok' };
  }
}
