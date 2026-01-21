import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { MetaTokenService } from './meta-token.service';

interface MetaAdset {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  end_time?: string;
  campaign_id?: string;
}

interface MetaAdsetsResponse {
  data: MetaAdset[];
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

export interface AdsetWithInsights {
  id: string;
  name: string;
  status: string;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  startTime?: string;
  endTime?: string | null;
  campaignId: string;
  insights: {
    spend: string;
    impressions: number;
    clicks: number;
    ctr: string;
    cpc: string;
  };
}

export interface AdsetsListResponse {
  data: AdsetWithInsights[];
  paging: { after: string | null };
}

@Injectable()
export class MetaAdsetsService {
  private readonly logger = new Logger(MetaAdsetsService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly metaTokenService: MetaTokenService,
  ) {}

  /**
   * List adsets for a campaign
   */
  async listAdsets(
    organizationId: string,
    options: {
      campaignId: string;
      from?: string; // ISO date string
      to?: string; // ISO date string
      limit?: number;
      after?: string; // pagination cursor
    },
  ): Promise<AdsetsListResponse> {
    try {
      // Validate campaignId
      if (!options.campaignId) {
        throw new BadRequestException('campaignId is required');
      }

      // Get valid access token
      const accessToken = await this.metaTokenService.ensureValidToken(
        organizationId,
      );

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

      // Build adsets URL
      const adsetsUrl = `${this.baseUrl}/${options.campaignId}/adsets`;
      const adsetsParams = new URLSearchParams({
        fields: 'id,name,status,daily_budget,lifetime_budget,start_time,end_time,campaign_id',
        limit: limit.toString(),
        access_token: accessToken,
      });

      if (options.after) {
        adsetsParams.append('after', options.after);
      }

      this.logger.log(
        `Fetching adsets for org ${organizationId}, campaign ${options.campaignId}`,
      );

      // Fetch adsets
      const adsetsResponse = await fetch(
        `${adsetsUrl}?${adsetsParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!adsetsResponse.ok) {
        const errorText = await adsetsResponse.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }

        const errorMessage = errorData.error?.message || errorText;
        throw new Error(
          `Meta API error: ${errorMessage} (code: ${errorData.error?.code || adsetsResponse.status})`,
        );
      }

      const adsetsData =
        (await adsetsResponse.json()) as MetaAdsetsResponse;

      if (!adsetsData.data) {
        this.logger.warn(
          `No adsets data returned for campaign ${options.campaignId}`,
        );
        return { data: [], paging: { after: null } };
      }

      // Fetch insights for each adset (can be optimized with batch request later)
      const adsetsWithInsights: AdsetWithInsights[] = await Promise.all(
        adsetsData.data.map(async (adset) => {
          try {
            // Fetch insights for this adset
            const insightsUrl = `${this.baseUrl}/${adset.id}/insights`;
            // Meta API requires time_range as JSON string in the URL
            const timeRange = JSON.stringify({
              since: fromStr,
              until: toStr,
            });
            const insightsParams = new URLSearchParams({
              fields: 'spend,impressions,clicks,ctr,cpc',
              time_range: timeRange,
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
                  {
                    spend: '0',
                    impressions: 0,
                    clicks: 0,
                    ctr: '0.00',
                    cpc: '0.00',
                  },
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
                `Failed to fetch insights for adset ${adset.id}`,
              );
            }

            return {
              id: adset.id,
              name: adset.name || 'Unnamed Adset',
              status: adset.status || 'UNKNOWN',
              dailyBudget: adset.daily_budget || null,
              lifetimeBudget: adset.lifetime_budget || null,
              startTime: adset.start_time,
              endTime: adset.end_time || null,
              campaignId: adset.campaign_id || options.campaignId,
              insights,
            };
          } catch (error) {
            this.logger.warn(
              `Error fetching insights for adset ${adset.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
            // Return adset without insights
            return {
              id: adset.id,
              name: adset.name || 'Unnamed Adset',
              status: adset.status || 'UNKNOWN',
              dailyBudget: adset.daily_budget || null,
              lifetimeBudget: adset.lifetime_budget || null,
              startTime: adset.start_time,
              endTime: adset.end_time || null,
              campaignId: adset.campaign_id || options.campaignId,
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
        adsetsData.paging?.cursors?.after ||
        (adsetsData.paging?.next ? 'has_more' : null);

      return {
        data: adsetsWithInsights,
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
            'No tienes permisos para acceder a los adsets. Verifica los permisos de tu cuenta de Meta.',
          );
        }

        if (errorMessage.includes('campaign') || errorMessage.includes('not found')) {
          throw new BadRequestException(
            'Campaign no encontrada o no accesible. Verifica el campaignId.',
          );
        }
      }

      // Log error without exposing tokens
      this.logger.error(
        `Failed to fetch adsets for org ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw new BadRequestException(
        'Error al obtener los adsets de Meta. Por favor, intenta nuevamente.',
      );
    }
  }
}
