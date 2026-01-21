import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { MetaTokenService } from './meta-token.service';
import { MetaAdsCacheService } from './meta-ads-cache.service';
import { MetaBulkInsightsService } from './meta-bulk-insights.service';
import { MetaConfigService } from './meta-config.service';

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
    private readonly metaConfigService: MetaConfigService,
    private readonly cache: MetaAdsCacheService,
    private readonly bulkInsights: MetaBulkInsightsService,
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
      refresh?: boolean;
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
      const cacheKey = `meta:adsets:${organizationId}:campaign=${options.campaignId}:${fromStr}:${toStr}:limit=${limit}:after=${options.after || ''}`;
      if (!options.refresh) {
        const cached = await this.cache.getJson<AdsetsListResponse>(cacheKey);
        if (cached) return cached;
      }

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

      let adAccountId: string | null = null;
      try {
        const cfg = await this.metaConfigService.getConfig(organizationId);
        adAccountId = cfg.adAccountId;
      } catch {
        adAccountId = null;
      }

      const ids = adsetsData.data.map((a) => a.id);
      let insightsMap: Map<string, any> | null = null;
      if (adAccountId) {
        try {
          insightsMap = await this.bulkInsights.getInsightsMap({
            organizationId,
            adAccountId,
            level: 'adset',
            ids,
            fromYYYYMMDD: fromStr,
            toYYYYMMDD: toStr,
          });
        } catch {
          insightsMap = null;
        }
      }

      const adsetsWithInsights: AdsetWithInsights[] = adsetsData.data.map((adset) => {
        const insight = insightsMap?.get(adset.id);
        const insights = insight
          ? {
              spend: insight.spend,
              impressions: insight.impressions,
              clicks: insight.clicks,
              ctr: insight.ctr,
              cpc: insight.cpc,
            }
          : {
              spend: '0.00',
              impressions: 0,
              clicks: 0,
              ctr: '0.00',
              cpc: '0.00',
            };

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
      });

      // Extract pagination cursor
      const afterCursor =
        adsetsData.paging?.cursors?.after ||
        (adsetsData.paging?.next ? 'has_more' : null);

      const result = {
        data: adsetsWithInsights,
        paging: { after: afterCursor || null },
      };
      await this.cache.setJson(cacheKey, result);
      return result;
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
