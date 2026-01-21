import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsService } from './meta-ads.service';
import { IntegrationProvider, ConnectedAccountStatus } from '@remember-me/prisma';

interface MetaConfig {
  adAccountId?: string;
}

@Injectable()
export class MetaConfigService {
  private readonly logger = new Logger(MetaConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaAdsService: MetaAdsService,
  ) {}

  /**
   * Get Meta configuration for organization
   */
  async getConfig(organizationId: string): Promise<{
    adAccountId: string | null;
    connected: boolean;
  }> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }

    const settings = (organization.settings as any) || {};
    const metaConfig: MetaConfig = settings.meta || {};

    // Check if Meta is connected
    const connectedAccount = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: { in: ['INSTAGRAM', 'FACEBOOK'] },
        status: 'CONNECTED',
      },
    });

    return {
      adAccountId: metaConfig.adAccountId || null,
      connected: !!connectedAccount,
    };
  }

  /**
   * Update Meta configuration for organization
   */
  async updateConfig(
    organizationId: string,
    adAccountId: string,
  ): Promise<{ adAccountId: string }> {
    // Normalize adAccountId (ensure it starts with "act_")
    const normalizedAdAccountId = adAccountId.startsWith('act_')
      ? adAccountId
      : `act_${adAccountId}`;

    // Validate that the ad account is accessible
    const accessibleAccounts = await this.metaAdsService.listAdAccounts(
      organizationId,
    );

    const accountExists = accessibleAccounts.some(
      (acc) => acc.id === normalizedAdAccountId,
    );

    if (!accountExists) {
      throw new BadRequestException(
        'Ad account no accesible por este token. Verifica que el ad account ID sea correcto y que tengas permisos para accederlo.',
      );
    }

    // Get current settings
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }

    const settings = (organization.settings as any) || {};
    const updatedSettings = {
      ...settings,
      meta: {
        ...(settings.meta || {}),
        adAccountId: normalizedAdAccountId,
      },
    };

    // Update organization settings
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: updatedSettings },
    });

    this.logger.log(
      `Updated Meta config for org ${organizationId}: adAccountId=${normalizedAdAccountId}`,
    );

    return { adAccountId: normalizedAdAccountId };
  }
}
