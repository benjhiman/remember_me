import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  BadGatewayException,
} from '@nestjs/common';
import { MetaTokenService } from './meta-token.service';

interface MetaAd {
  id: string;
  name?: string;
  status?: string;
  adset_id?: string;
}

interface MetaAdsResponse {
  data: MetaAd[];
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

export interface AdWithInsights {
  id: string;
  name: string;
  status: string;
  insights: {
    spend: string;
    impressions: number;
    clicks: number;
    ctr: string;
    cpc: string;
  };
}

export interface AdsListResponse {
  data: AdWithInsights[];
  paging: { after: string | null };
}

@Injectable()
export class MetaAdsItemsService {
  private readonly logger = new Logger(MetaAdsItemsService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(private readonly metaTokenService: MetaTokenService) {}

  async listAds(
    organizationId: string,
    options: {
      adsetId?: string;
      from?: string; // ISO date string
      to?: string; // ISO date string
      limit?: number;
      after?: string; // pagination cursor
    },
  ): Promise<AdsListResponse> {
    if (!options.adsetId) {
      throw new BadRequestException('adsetId is required');
    }

    // Get valid access token
    const accessToken = await this.metaTokenService.ensureValidToken(
      organizationId,
    );

    // Default date range: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const fromDate = options.from ? new Date(options.from) : thirtyDaysAgo;
    const toDate = options.to ? new Date(options.to) : now;

    const fromStr = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const toStr = toDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const limit = Math.min(options.limit || 25, 100);

    try {
      const adsUrl = `${this.baseUrl}/${options.adsetId}/ads`;
      const adsParams = new URLSearchParams({
        fields: 'id,name,status,adset_id',
        limit: limit.toString(),
        access_token: accessToken,
      });

      if (options.after) {
        adsParams.append('after', options.after);
      }

      this.logger.log(
        `Fetching ads for org ${organizationId}, adset ${options.adsetId}`,
      );

      const adsResponse = await fetch(`${adsUrl}?${adsParams.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!adsResponse.ok) {
        const errorText = await adsResponse.text();
        let errorData: any;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }

        const msg = errorData.error?.message || errorText;
        const code = errorData.error?.code || adsResponse.status;
        this.logger.warn(
          `Meta API error listing ads (org=${organizationId}, adset=${options.adsetId}): code=${code} message=${msg}`,
        );
        throw new BadGatewayException(
          'Error consultando Meta Graph API (ads). Reintentá en unos minutos.',
        );
      }

      const adsData = (await adsResponse.json()) as MetaAdsResponse;
      const ads = adsData.data || [];

      const data: AdWithInsights[] = await Promise.all(
        ads.map(async (ad) => {
          const insightsUrl = `${this.baseUrl}/${ad.id}/insights`;
          const timeRange = JSON.stringify({ since: fromStr, until: toStr });
          const insightsParams = new URLSearchParams({
            fields: 'spend,impressions,clicks,ctr,cpc',
            time_range: timeRange,
            access_token: accessToken,
          });

          let insights = {
            spend: '0.00',
            impressions: 0,
            clicks: 0,
            ctr: '0.00',
            cpc: '0.00',
          };

          try {
            const insightsResponse = await fetch(
              `${insightsUrl}?${insightsParams.toString()}`,
              {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
              },
            );

            if (insightsResponse.ok) {
              const insightsData =
                (await insightsResponse.json()) as MetaInsightsResponse;
              if (insightsData.data && insightsData.data.length > 0) {
                const aggregated = insightsData.data.reduce(
                  (acc, item) => ({
                    spend: (
                      parseFloat(acc.spend) + parseFloat(item.spend || '0')
                    ).toFixed(2),
                    impressions:
                      acc.impressions + parseInt(item.impressions || '0', 10),
                    clicks: acc.clicks + parseInt(item.clicks || '0', 10),
                    ctr: item.ctr || acc.ctr,
                    cpc: item.cpc || acc.cpc,
                  }),
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
                `Meta API error listing ad insights (ad=${ad.id}) status=${insightsResponse.status}`,
              );
            }
          } catch (e) {
            this.logger.warn(
              `Error fetching insights for ad ${ad.id}: ${e instanceof Error ? e.message : 'Unknown error'}`,
            );
          }

          return {
            id: ad.id,
            name: ad.name || 'Unnamed Ad',
            status: ad.status || 'UNKNOWN',
            insights,
          };
        }),
      );

      const afterCursor =
        adsData.paging?.cursors?.after ||
        (adsData.paging?.next ? 'has_more' : null);

      return {
        data,
        paging: { after: afterCursor || null },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        if (error.message.includes('No valid access token')) {
          throw new BadRequestException(
            'Meta no conectado. Por favor, conecta tu cuenta de Meta a través de OAuth.',
          );
        }
        throw error;
      }

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof BadGatewayException) {
        throw error;
      }

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid') && msg.includes('token')) {
          throw new UnauthorizedException(
            'Token de Meta inválido. Por favor, reconecta tu cuenta de Meta.',
          );
        }
      }

      this.logger.error(
        `Failed to fetch ads for org ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new BadGatewayException(
        'Error consultando Meta Graph API (ads).',
      );
    }
  }
}

