import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MetaAdsService } from './meta-ads.service';
import { MetaCampaignsService, CampaignsListResponse } from './meta-campaigns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';

@Controller('integrations/meta')
@UseGuards(JwtAuthGuard)
export class MetaAdsController {
  constructor(
    private readonly metaAdsService: MetaAdsService,
    private readonly metaCampaignsService: MetaCampaignsService,
  ) {}

  /**
   * List ad accounts accessible by the organization's Meta account
   * GET /api/integrations/meta/ad-accounts
   * 
   * Requires:
   * - Authorization: Bearer <token>
   * - X-Organization-Id: <org-id>
   * 
   * Returns:
   * {
   *   "data": [
   *     {
   *       "id": "act_123456789",
   *       "name": "My Ad Account",
   *       "accountStatus": 1,
   *       "currency": "USD",
   *       "timezone": "America/New_York"
   *     }
   *   ]
   * }
   */
  @Get('ad-accounts')
  async listAdAccounts(@CurrentOrganization() organizationId: string) {
    const accounts = await this.metaAdsService.listAdAccounts(organizationId);
    return { data: accounts };
  }

  /**
   * List campaigns for organization's ad account
   * GET /api/integrations/meta/campaigns
   * 
   * Query Parameters:
   * - adAccountId (optional): Override the configured ad account
   * - from (optional): ISO date string (default: 30 days ago)
   * - to (optional): ISO date string (default: today)
   * - limit (optional): Number of campaigns per page (default: 25, max: 100)
   * - after (optional): Pagination cursor
   * 
   * Returns:
   * {
   *   "data": [
   *     {
   *       "id": "123",
   *       "name": "Campaign name",
   *       "status": "ACTIVE",
   *       "objective": "...",
   *       "createdTime": "...",
   *       "updatedTime": "...",
   *       "insights": {
   *         "spend": "0.00",
   *         "impressions": 0,
   *         "clicks": 0,
   *         "ctr": "0.00",
   *         "cpc": "0.00"
   *       }
   *     }
   *   ],
   *   "paging": { "after": "..." | null }
   * }
   */
  @Get('campaigns')
  async listCampaigns(
    @CurrentOrganization() organizationId: string,
    @Query('adAccountId') adAccountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('after') after?: string,
  ): Promise<CampaignsListResponse> {
    return this.metaCampaignsService.listCampaigns(organizationId, {
      adAccountId,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : undefined,
      after,
    });
  }
}
