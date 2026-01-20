import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetaTokenService } from './meta-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { IntegrationProvider, ConnectedAccountStatus } from '@remember-me/prisma';

@Controller('integrations/meta')
@UseGuards(JwtAuthGuard)
export class MetaIntegrationsController {
  constructor(
    private readonly metaTokenService: MetaTokenService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * List connected Meta accounts for organization
   */
  @Get('connected-accounts')
  async listConnectedAccounts(@CurrentOrganization() organizationId: string) {
    const accounts = await this.prisma.connectedAccount.findMany({
      where: {
        organizationId,
        provider: { in: [IntegrationProvider.INSTAGRAM, IntegrationProvider.FACEBOOK] },
      },
      include: {
        oauthTokens: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            expiresAt: true,
            scopes: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((account) => {
      const metadata = (account.metadataJson as any) || {};
      const token = account.oauthTokens?.[0];

      return {
        id: account.id,
        provider: account.provider,
        displayName: account.displayName,
        status: account.status,
        externalAccountId: account.externalAccountId,
        metadata: {
          metaUserId: metadata.metaUserId,
          pageId: metadata.pageId,
          igUserId: metadata.igUserId,
          adAccounts: metadata.adAccounts || [],
        },
        token: token
          ? {
              expiresAt: token.expiresAt,
              scopes: token.scopes,
            }
          : null,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    });
  }

  /**
   * @deprecated Use MetaAdsController.listAdAccounts instead
   * This endpoint only returns cached ad accounts from metadata.
   * For real-time data from Meta API, use GET /api/integrations/meta/ad-accounts
   */
  @Get('ad-accounts')
  async listAdAccountsLegacy(@CurrentOrganization() organizationId: string) {
    const accounts = await this.metaTokenService.listAdAccounts(organizationId);
    return accounts;
  }
}
