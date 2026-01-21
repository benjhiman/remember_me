import { Injectable, Logger } from '@nestjs/common';
import { MetaTokenService } from './meta-token.service';
import { MetricsService } from '../../common/metrics/metrics.service';

export type MetaInsightLevel = 'campaign' | 'adset' | 'ad';

export interface Insight {
  spend: string;
  impressions: number;
  clicks: number;
  ctr: string;
  cpc: string;
}

@Injectable()
export class MetaBulkInsightsService {
  private readonly logger = new Logger(MetaBulkInsightsService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly metaTokenService: MetaTokenService,
    private readonly metricsService: MetricsService,
  ) {}

  async getInsightsMap(params: {
    organizationId: string;
    adAccountId: string; // must be act_*
    level: MetaInsightLevel;
    ids: string[];
    fromYYYYMMDD: string;
    toYYYYMMDD: string;
  }): Promise<Map<string, Insight>> {
    const { organizationId, adAccountId, level, ids, fromYYYYMMDD, toYYYYMMDD } = params;
    const map = new Map<string, Insight>();
    if (!ids.length) return map;

    const accessToken = await this.metaTokenService.ensureValidToken(organizationId);
    const levelLower = level;

    const idField =
      level === 'campaign' ? 'campaign_id' : level === 'adset' ? 'adset_id' : 'ad_id';
    const filterField =
      level === 'campaign' ? 'campaign.id' : level === 'adset' ? 'adset.id' : 'ad.id';

    const timeRange = JSON.stringify({ since: fromYYYYMMDD, until: toYYYYMMDD });
    const filtering = JSON.stringify([{ field: filterField, operator: 'IN', value: ids }]);

    const url = `${this.baseUrl}/act_${adAccountId.replace(/^act_/, '')}/insights`;
    const qs = new URLSearchParams({
      level: levelLower,
      fields: `spend,impressions,clicks,ctr,cpc,${idField}`,
      time_range: timeRange,
      filtering,
      access_token: accessToken,
    });

    const endpointLabel = `insights.bulk.${levelLower}`;
    const start = Date.now();
    const res = await fetch(`${url}?${qs.toString()}`, { method: 'GET' });
    this.metricsService.recordMetaRequest(endpointLabel, res.status, Date.now() - start);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      this.logger.warn(`Bulk insights failed (${levelLower}) status=${res.status} body=${txt.substring(0, 200)}`);
      throw new Error(`Bulk insights failed: ${res.status}`);
    }

    const json = (await res.json()) as { data?: any[] };
    for (const row of json.data || []) {
      const id = row[idField];
      if (!id) continue;
      map.set(String(id), {
        spend: String(row.spend ?? '0.00'),
        impressions: parseInt(row.impressions ?? '0', 10) || 0,
        clicks: parseInt(row.clicks ?? '0', 10) || 0,
        ctr: String(row.ctr ?? '0.00'),
        cpc: String(row.cpc ?? '0.00'),
      });
    }

    return map;
  }
}

