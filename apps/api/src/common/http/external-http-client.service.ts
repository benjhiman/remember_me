import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service to intercept and mock external HTTP calls for testing
 * When EXTERNAL_HTTP_MODE=mock, returns fake responses instead of real API calls
 */
@Injectable()
export class ExternalHttpClientService {
  private readonly logger = new Logger(ExternalHttpClientService.name);
  private readonly mockMode: boolean;

  constructor(private readonly configService: ConfigService) {
    const httpMode = this.configService.get<string>('EXTERNAL_HTTP_MODE', 'real');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'production');
    this.mockMode = httpMode === 'mock' || nodeEnv === 'test';
    
    if (this.mockMode) {
      this.logger.warn('EXTERNAL_HTTP_MODE=mock: All external API calls will be mocked');
    }
  }

  /**
   * Check if mock mode is enabled
   */
  isMockMode(): boolean {
    return this.mockMode;
  }

  /**
   * Mock WhatsApp Cloud API send message
   */
  async mockWhatsAppSendMessage(phoneNumberId: string, to: string, message: any): Promise<any> {
    this.logger.debug(`[MOCK] WhatsApp send message to ${to}`);
    
    return {
      messaging_product: 'whatsapp',
      contacts: [{ input: to, wa_id: to.replace('+', '') }],
      messages: [
        {
          id: `wamid.mock.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`,
        },
      ],
    };
  }

  /**
   * Mock WhatsApp Cloud API send template
   */
  async mockWhatsAppSendTemplate(phoneNumberId: string, to: string, template: any): Promise<any> {
    this.logger.debug(`[MOCK] WhatsApp send template to ${to}`);
    
    return {
      messaging_product: 'whatsapp',
      contacts: [{ input: to, wa_id: to.replace('+', '') }],
      messages: [
        {
          id: `wamid.mock.template.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`,
        },
      ],
    };
  }

  /**
   * Mock Instagram Graph API send message
   */
  async mockInstagramSendMessage(pageId: string, recipientId: string, message: string): Promise<any> {
    this.logger.debug(`[MOCK] Instagram send message to ${recipientId}`);
    
    return {
      recipient_id: recipientId,
      message_id: `igmid.mock.${Date.now()}.${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Mock Meta Marketing API get insights
   */
  async mockMetaMarketingGetInsights(
    level: string,
    startDate: string,
    endDate: string,
    accessToken: string,
    adAccountId: string,
  ): Promise<any[]> {
    this.logger.debug(`[MOCK] Meta Marketing get insights for ${adAccountId} (${level})`);
    
    // Return fake spend data
    return [
      {
        campaign_id: 'mock-campaign-1',
        campaign_name: 'Mock Campaign 1',
        adset_id: 'mock-adset-1',
        ad_id: 'mock-ad-1',
        level: level,
        spend: '10.50',
        impressions: 1000,
        clicks: 50,
        currency: 'USD',
      },
    ];
  }

  /**
   * Wrap a fetch call - if mock mode, return mock response
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    if (!this.mockMode) {
      // Real mode: use native fetch
      return global.fetch(url, options);
    }

    // Mock mode: intercept based on URL
    const urlObj = new URL(url);

    // WhatsApp Cloud API
    if (urlObj.hostname.includes('graph.facebook.com') && urlObj.pathname.includes('/v') && urlObj.pathname.includes('/messages')) {
      const method = options?.method || 'GET';
      if (method === 'POST') {
        const body = options?.body ? JSON.parse(options.body as string) : {};
        const phoneNumberId = urlObj.pathname.split('/')[4];
        const to = body.to || 'unknown';
        
        if (body.type === 'template') {
          const mockResponse = await this.mockWhatsAppSendTemplate(phoneNumberId, to, body);
          return new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } else {
          const mockResponse = await this.mockWhatsAppSendMessage(phoneNumberId, to, body);
          return new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
    }

    // Instagram Graph API
    if (urlObj.hostname.includes('graph.facebook.com') && urlObj.pathname.includes('/v') && urlObj.pathname.includes('/messages')) {
      const method = options?.method || 'GET';
      if (method === 'POST') {
        const body = options?.body ? JSON.parse(options.body as string) : {};
        const pageId = urlObj.pathname.split('/')[4];
        const recipientId = body.recipient?.id || 'unknown';
        const messageText = body.message?.text || '';
        
        const mockResponse = await this.mockInstagramSendMessage(pageId, recipientId, messageText);
        return new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Meta Marketing API (insights)
    if (urlObj.hostname.includes('graph.facebook.com') && urlObj.searchParams.has('fields') && urlObj.searchParams.get('fields')?.includes('spend')) {
      const adAccountId = urlObj.pathname.split('/')[urlObj.pathname.split('/').length - 1] || 'unknown';
      const level = urlObj.searchParams.get('level') || 'campaign';
      const datePreset = urlObj.searchParams.get('date_preset') || 'last_30d';
      
      const mockResponse = await this.mockMetaMarketingGetInsights(level, datePreset, datePreset, 'mock-token', adAccountId);
      return new Response(JSON.stringify({ data: mockResponse }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Default: return real fetch (for internal APIs)
    return global.fetch(url, options);
  }
}
