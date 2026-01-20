import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetaAdsService } from './meta-ads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';

@Controller('integrations/meta')
@UseGuards(JwtAuthGuard)
export class MetaAdsController {
  constructor(private readonly metaAdsService: MetaAdsService) {}

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
}
