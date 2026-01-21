import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaTokenService } from './meta-token.service';
import { MetaConfigService } from './meta-config.service';
import { MetaAdsCacheService } from './meta-ads-cache.service';
import { MetaBulkInsightsService } from './meta-bulk-insights.service';

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
    private readonly cache: MetaAdsCacheService,
    private readonly bulkInsights: MetaBulkInsightsService,
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
      refresh?: boolean;
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
      const cacheKey = `meta:campaigns:${organizationId}:${normalizedAdAccountId}:${fromStr}:${toStr}:limit=${limit}:after=${options.after || ''}`;
      if (!options.refresh) {
        const cached = await this.cache.getJson<CampaignsListResponse>(cacheKey);
        if (cached) return cached;
      }

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

      const ids = campaignsData.data.map((c) => c.id);
      let insightsMap: Map<string, any> | null = null;
      try {
        insightsMap = await this.bulkInsights.getInsightsMap({
          organizationId,
          adAccountId: normalizedAdAccountId,
          level: 'campaign',
          ids,
          fromYYYYMMDD: fromStr,
          toYYYYMMDD: toStr,
        });
      } catch {
        insightsMap = null;
      }

      const campaignsWithInsights: CampaignWithInsights[] = campaignsData.data.map((campaign) => {
        const insight = insightsMap?.get(campaign.id);
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
          id: campaign.id,
          name: campaign.name || 'Unnamed Campaign',
          status: campaign.status || 'UNKNOWN',
          objective: campaign.objective,
          createdTime: campaign.created_time,
          updatedTime: campaign.updated_time,
          insights,
        };
      });

      // Extract pagination cursor
      const afterCursor =
        campaignsData.paging?.cursors?.after ||
        (campaignsData.paging?.next ? 'has_more' : null);

      const result = {
        data: campaignsWithInsights,
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
