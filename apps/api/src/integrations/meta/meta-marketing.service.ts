import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MetaTokenService } from './meta-token.service';
import { ExternalHttpClientService } from '../../common/http/external-http-client.service';
import { IntegrationProvider, MetaSpendLevel } from '@remember-me/prisma';

interface MetaInsightsResponse {
  data: Array<{
    campaign_id?: string;
    adset_id?: string;
    ad_id?: string;
    spend: string;
    impressions?: string;
    clicks?: string;
    date_start: string;
    date_stop: string;
  }>;
  paging?: {
    next?: string;
    previous?: string;
  };
}

@Injectable()
export class MetaMarketingService {
  private readonly logger = new Logger(MetaMarketingService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly metaTokenService: MetaTokenService,
    private readonly externalHttpClient?: ExternalHttpClientService, // Optional for mocking
  ) {}

  /**
   * Get access token for organization (uses MetaTokenService)
   */
  private async getAccessToken(organizationId: string): Promise<string> {
    return this.metaTokenService.ensureValidToken(organizationId);
  }

  /**
   * Get account ID (ad account) for organization (uses MetaTokenService)
   */
  private async getAdAccountId(organizationId: string, adAccountId?: string): Promise<string> {
    return this.metaTokenService.getAdAccountId(organizationId, adAccountId);
  }

  /**
   * Fetch insights from Meta Marketing API
   */
  async getInsights(
    organizationId: string,
    options: {
      level: MetaSpendLevel;
      datePreset?: 'yesterday' | 'today' | 'last_7d' | 'last_30d';
      dateStart?: string; // YYYY-MM-DD
      dateEnd?: string; // YYYY-MM-DD
    },
  ): Promise<MetaInsightsResponse['data']> {
    const accessToken = await this.getAccessToken(organizationId);
    const adAccountId = await this.getAdAccountId(organizationId);

    const levelLower = options.level.toLowerCase(); // CAMPAIGN -> campaign
    const fields = ['spend', 'impressions', 'clicks', 'campaign_id', 'adset_id', 'ad_id'];

    // Build date range
    let timeRange: string;
    if (options.datePreset) {
      timeRange = `time_preset=${options.datePreset}`;
    } else if (options.dateStart && options.dateEnd) {
      timeRange = `time_range={'since':'${options.dateStart}','until':'${options.dateEnd}'}`;
    } else {
      // Default to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      timeRange = `time_range={'since':'${dateStr}','until':'${dateStr}'}`;
    }

    const url = `${this.baseUrl}/act_${adAccountId}/insights?level=${levelLower}&fields=${fields.join(',')}&${timeRange}&access_token=${accessToken}`;

    this.logger.debug(`Fetching Meta insights: ${url.replace(accessToken, '***')}`);

    let retries = 3;
    let lastError: Error | null = null;
    const httpClient = this.externalHttpClient?.isMockMode() ? this.externalHttpClient : { fetch: global.fetch };

    while (retries > 0) {
      try {
        const response = await httpClient.fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData: any;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }

          // Handle rate limiting
          if (response.status === 429 || (errorData.error?.code === 4 || errorData.error?.code === 17)) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
            this.logger.warn(`Rate limited. Retrying after ${retryAfter} seconds...`);
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            retries--;
            continue;
          }

          // Handle other errors
          throw new Error(
            `Meta API error: ${errorData.error?.message || errorText} (code: ${errorData.error?.code || response.status})`,
          );
        }

        const data = (await response.json()) as MetaInsightsResponse;

        // Handle pagination if needed
        const allData = [...data.data];
        let nextUrl = data.paging?.next;

        while (nextUrl && retries > 0) {
          try {
            const nextResponse = await httpClient.fetch(nextUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (!nextResponse.ok) {
              break; // Stop pagination on error
            }

            const nextData = (await nextResponse.json()) as MetaInsightsResponse;
            allData.push(...nextData.data);
            nextUrl = nextData.paging?.next;
          } catch (error) {
            this.logger.warn(`Error fetching next page: ${error instanceof Error ? error.message : 'Unknown error'}`);
            break;
          }
        }

        return allData;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        this.logger.warn(`Error fetching Meta insights (${retries} retries left): ${lastError.message}`);

        if (retries > 1) {
          // Exponential backoff
          const delay = Math.pow(2, 3 - retries) * 1000; // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        retries--;
      }
    }

    throw new Error(`Failed to fetch Meta insights after retries: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Fetch spend for a specific date
   */
  async getSpendForDate(
    organizationId: string,
    date: Date,
    level: MetaSpendLevel = MetaSpendLevel.CAMPAIGN,
  ): Promise<MetaInsightsResponse['data']> {
    const dateStr = date.toISOString().split('T')[0];
    return this.getInsights(organizationId, {
      level,
      dateStart: dateStr,
      dateEnd: dateStr,
    });
  }
}
