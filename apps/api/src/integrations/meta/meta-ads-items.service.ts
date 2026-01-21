import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  BadGatewayException,
} from '@nestjs/common';
import { MetaTokenService } from './meta-token.service';
import { MetaAdsCacheService } from './meta-ads-cache.service';
import { MetaBulkInsightsService } from './meta-bulk-insights.service';
import { MetaConfigService } from './meta-config.service';

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

  constructor(
    private readonly metaTokenService: MetaTokenService,
    private readonly metaConfigService: MetaConfigService,
    private readonly cache: MetaAdsCacheService,
    private readonly bulkInsights: MetaBulkInsightsService,
  ) {}

  async listAds(
    organizationId: string,
    options: {
      adsetId?: string;
      from?: string; // ISO date string
      to?: string; // ISO date string
      limit?: number;
      after?: string; // pagination cursor
      refresh?: boolean;
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
    const cacheKey = `meta:ads:${organizationId}:adset=${options.adsetId}:${fromStr}:${toStr}:limit=${limit}:after=${options.after || ''}`;
    if (!options.refresh) {
      const cached = await this.cache.getJson<AdsListResponse>(cacheKey);
      if (cached) return cached;
    }

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

      let adAccountId: string | null = null;
      try {
        const cfg = await this.metaConfigService.getConfig(organizationId);
        adAccountId = cfg.adAccountId;
      } catch {
        adAccountId = null;
      }

      const ids = ads.map((a) => a.id);
      let insightsMap: Map<string, any> | null = null;
      if (adAccountId && ids.length) {
        try {
          insightsMap = await this.bulkInsights.getInsightsMap({
            organizationId,
            adAccountId,
            level: 'ad',
            ids,
            fromYYYYMMDD: fromStr,
            toYYYYMMDD: toStr,
          });
        } catch {
          insightsMap = null;
        }
      }

      const data: AdWithInsights[] = ads.map((ad) => {
        const insight = insightsMap?.get(ad.id);
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
          id: ad.id,
          name: ad.name || 'Unnamed Ad',
          status: ad.status || 'UNKNOWN',
          insights,
        };
      });

      const afterCursor =
        adsData.paging?.cursors?.after ||
        (adsData.paging?.next ? 'has_more' : null);

      const result = {
        data,
        paging: { after: afterCursor || null },
      };
      await this.cache.setJson(cacheKey, result);
      return result;
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

