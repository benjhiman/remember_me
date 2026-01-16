import { Controller, Post, Body, Headers, HttpCode, UseGuards } from '@nestjs/common';
import { MetaLeadAdsService } from './meta-lead-ads.service';
import { InstagramSignatureGuard } from './instagram-signature.guard';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';

@Controller('webhooks/meta-lead-ads')
export class MetaLeadAdsWebhookController {
  constructor(private readonly metaLeadAdsService: MetaLeadAdsService) {}

  /**
   * Receive Meta Lead Ads webhook (POST)
   * Signature verification is required if META_APP_SECRET is set
   */
  @Post()
  @HttpCode(200)
  @UseGuards(InstagramSignatureGuard, RateLimitGuard) // Reuse Instagram signature guard (same META_APP_SECRET)
  @RateLimit({ action: 'webhook.meta_lead_ads', limit: 50, windowSec: 60, skipIfDisabled: true })
  async receiveWebhook(
    @Body() body: any,
    @Headers('x-organization-id') organizationId?: string,
  ): Promise<{ status: string }> {
    await this.metaLeadAdsService.processWebhook(body, organizationId);
    return { status: 'ok' };
  }
}
