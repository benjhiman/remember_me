import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaTokenService } from './meta-token.service';
import { MetaConfigService } from './meta-config.service';

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  created_time?: string;
  updated_time?: string;
}

interface MetaCampaignsResponse {
  data: MetaCampaign[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

interface MetaInsightsResponse {
  data: Array<{
    spend?: string;
    impressions?: string;
    clicks?: string;
    ctr?: string;
    cpc?: string;
    date_start?: string;
    date_stop?: string;
  }>;
}

export interface CampaignWithInsights {
  id: string;
  name: string;
  status: string;
  objective?: string;
  createdTime?: string;
  updatedTime?: string;
  insights: {
    spend: string;
    impressions: number;
    clicks: number;
    ctr: string;
    cpc: string;
  };
}

export interface CampaignsListResponse {
  data: CampaignWithInsights[];
  paging: { after: string | null };
}

@Injectable()
export class MetaCampaignsService {
  private readonly logger = new Logger(MetaCampaignsService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaTokenService: MetaTokenService,
    private readonly metaConfigService: MetaConfigService,
  ) {}

  /**
   * List campaigns for organization's ad account
   */
  async listCampaigns(
    organizationId: string,
    options: {
      adAccountId?: string;
      from?: string; // ISO date string
      to?: string; // ISO date string
      limit?: number;
      after?: string; // pagination cursor
    },
  ): Promise<CampaignsListResponse> {
    try {
      // Get valid access token
      const accessToken = await this.metaTokenService.ensureValidToken(
        organizationId,
      );

      // Get adAccountId from query or config
      let adAccountId = options.adAccountId;
      if (!adAccountId) {
        const config = await this.metaConfigService.getConfig(organizationId);
        if (!config.adAccountId) {
          throw new BadRequestException(
            'No hay Ad Account configurada. Setear en /api/integrations/meta/config',
          );
        }
        adAccountId = config.adAccountId;
      }

      // Normalize adAccountId (ensure it starts with "act_")
      const normalizedAdAccountId = adAccountId.startsWith('act_')
        ? adAccountId
        : `act_${adAccountId}`;

      // Default date range: last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const fromDate = options.from
        ? new Date(options.from)
        : thirtyDaysAgo;
      const toDate = options.to ? new Date(options.to) : now;

      const fromStr = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const toStr = toDate.toISOString().split('T')[0]; // YYYY-MM-DD

      const limit = Math.min(options.limit || 25, 100); // Max 100 per Meta API

      // Build campaigns URL
      const campaignsUrl = `${this.baseUrl}/${normalizedAdAccountId}/campaigns`;
      const campaignsParams = new URLSearchParams({
        fields: 'id,name,status,objective,created_time,updated_time',
        limit: limit.toString(),
        access_token: accessToken,
      });

      if (options.after) {
        campaignsParams.append('after', options.after);
      }

      this.logger.log(
        `Fetching campaigns for org ${organizationId}, adAccount ${normalizedAdAccountId}`,
      );

      // Fetch campaigns
      const campaignsResponse = await fetch(
        `${campaignsUrl}?${campaignsParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!campaignsResponse.ok) {
        const errorText = await campaignsResponse.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }

        const errorMessage = errorData.error?.message || errorText;
        throw new Error(
          `Meta API error: ${errorMessage} (code: ${errorData.error?.code || campaignsResponse.status})`,
        );
      }

      const campaignsData =
        (await campaignsResponse.json()) as MetaCampaignsResponse;

      if (!campaignsData.data) {
        this.logger.warn(
          `No campaigns data returned for adAccount ${normalizedAdAccountId}`,
        );
        return { data: [], paging: { after: null } };
      }

      // Fetch insights for each campaign (can be optimized with batch request later)
      const campaignsWithInsights: CampaignWithInsights[] = await Promise.all(
        campaignsData.data.map(async (campaign) => {
          try {
            // Fetch insights for this campaign
            const insightsUrl = `${this.baseUrl}/${campaign.id}/insights`;
            const insightsParams = new URLSearchParams({
              fields: 'spend,impressions,clicks,ctr,cpc',
              time_range: JSON.stringify({
                since: fromStr,
                until: toStr,
              }),
              access_token: accessToken,
            });

            const insightsResponse = await fetch(
              `${insightsUrl}?${insightsParams.toString()}`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
              },
            );

            let insights = {
              spend: '0.00',
              impressions: 0,
              clicks: 0,
              ctr: '0.00',
              cpc: '0.00',
            };

            if (insightsResponse.ok) {
              const insightsData =
                (await insightsResponse.json()) as MetaInsightsResponse;
              if (insightsData.data && insightsData.data.length > 0) {
                // Aggregate insights if multiple date ranges
                const aggregated = insightsData.data.reduce(
                  (acc, item) => {
                    return {
                      spend:
                        (
                          parseFloat(acc.spend) +
                          parseFloat(item.spend || '0')
                        ).toFixed(2),
                      impressions:
                        acc.impressions +
                        parseInt(item.impressions || '0', 10),
                      clicks: acc.clicks + parseInt(item.clicks || '0', 10),
                      ctr: item.ctr || acc.ctr,
                      cpc: item.cpc || acc.cpc,
                    };
                  },
                  { spend: '0', impressions: 0, clicks: 0, ctr: '0.00', cpc: '0.00' },
                );
                insights = {
                  spend: aggregated.spend,
                  impressions: aggregated.impressions,
                  clicks: aggregated.clicks,
                  ctr: aggregated.ctr || '0.00',
                  cpc: aggregated.cpc || '0.00',
                };
              }
            } else {
              this.logger.warn(
                `Failed to fetch insights for campaign ${campaign.id}`,
              );
            }

            return {
              id: campaign.id,
              name: campaign.name || 'Unnamed Campaign',
              status: campaign.status || 'UNKNOWN',
              objective: campaign.objective,
              createdTime: campaign.created_time,
              updatedTime: campaign.updated_time,
              insights,
            };
          } catch (error) {
            this.logger.warn(
              `Error fetching insights for campaign ${campaign.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            // Return campaign without insights
            return {
              id: campaign.id,
              name: campaign.name || 'Unnamed Campaign',
              status: campaign.status || 'UNKNOWN',
              objective: campaign.objective,
              createdTime: campaign.created_time,
              updatedTime: campaign.updated_time,
              insights: {
                spend: '0.00',
                impressions: 0,
                clicks: 0,
                ctr: '0.00',
                cpc: '0.00',
              },
            };
          }
        }),
      );

      // Extract pagination cursor
      const afterCursor =
        campaignsData.paging?.cursors?.after ||
        (campaignsData.paging?.next ? 'has_more' : null);

      return {
        data: campaignsWithInsights,
        paging: { after: afterCursor || null },
      };
    } catch (error) {
      // Handle specific error cases
      if (error instanceof BadRequestException) {
        if (error.message.includes('No valid access token')) {
          throw new BadRequestException(
            'Meta no conectado. Por favor, conecta tu cuenta de Meta a través de OAuth.',
          );
        }
        throw error;
      }

      // Handle Meta API errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('invalid') && errorMessage.includes('token')) {
          this.logger.error(
            `Invalid token for org ${organizationId}: ${error.message}`,
          );
          throw new UnauthorizedException(
            'Token de Meta inválido. Por favor, reconecta tu cuenta de Meta.',
          );
        }

        if (
          errorMessage.includes('permission') ||
          errorMessage.includes('access')
        ) {
          this.logger.error(
            `Permission denied for org ${organizationId}: ${error.message}`,
          );
          throw new UnauthorizedException(
            'No tienes permisos para acceder a las campañas. Verifica los permisos de tu cuenta de Meta.',
          );
        }

        if (errorMessage.includes('ad account')) {
          throw new BadRequestException(
            'Ad Account no encontrada o no accesible. Verifica la configuración.',
          );
        }
      }

      // Log error without exposing tokens
      this.logger.error(
        `Failed to fetch campaigns for org ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw new BadRequestException(
        'Error al obtener las campañas de Meta. Por favor, intenta nuevamente.',
      );
    }
  }
}
