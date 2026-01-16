import { Test, TestingModule } from '@nestjs/testing';
import { MetaMarketingService } from './meta-marketing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MetaTokenService } from './meta-token.service';
import { IntegrationProvider, MetaSpendLevel } from '@remember-me/prisma';
import { BadRequestException } from '@nestjs/common';

describe('MetaMarketingService', () => {
  let service: MetaMarketingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    connectedAccount: {
      findFirst: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockMetaTokenService = {
    ensureValidToken: jest.fn(),
    getAdAccountId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaMarketingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MetaTokenService,
          useValue: mockMetaTokenService,
        },
      ],
    }).compile();

    service = module.get<MetaMarketingService>(MetaMarketingService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAccessToken', () => {
    it('should get token from MetaTokenService', async () => {
      mockMetaTokenService.ensureValidToken.mockResolvedValue('test-token');

      const token = await service['getAccessToken']('org-1');

      expect(token).toBe('test-token');
      expect(mockMetaTokenService.ensureValidToken).toHaveBeenCalledWith('org-1');
    });

    it('should throw if no token available', async () => {
      mockMetaTokenService.ensureValidToken.mockRejectedValue(
        new BadRequestException('No token found'),
      );

      await expect(service['getAccessToken']('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getInsights', () => {
    beforeEach(() => {
      mockMetaTokenService.ensureValidToken.mockResolvedValue('test-token');
      mockMetaTokenService.getAdAccountId.mockResolvedValue('act_123');
    });

    it('should fetch insights from Meta API', async () => {
      const mockResponse = {
        data: [
          {
            campaign_id: 'campaign-1',
            spend: '100.50',
            impressions: '1000',
            clicks: '50',
            date_start: '2024-01-15',
            date_stop: '2024-01-15',
          },
        ],
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      } as Response);

      const result = await service.getInsights('org-1', {
        level: MetaSpendLevel.CAMPAIGN,
        datePreset: 'yesterday',
      });

      expect(result).toHaveLength(1);
      expect(result[0].campaign_id).toBe('campaign-1');
      expect(result[0].spend).toBe('100.50');
    });

    it('should handle rate limiting with retry', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '1' }),
          text: async () => JSON.stringify({ error: { code: 4, message: 'Rate limit' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
          headers: new Headers(),
        } as Response);

      const result = await service.getInsights('org-1', {
        level: MetaSpendLevel.CAMPAIGN,
        datePreset: 'yesterday',
      });

      expect(result).toEqual([]);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle pagination', async () => {
      const firstPage = {
        data: [{ campaign_id: 'campaign-1', spend: '50' }],
        paging: { next: 'https://graph.facebook.com/v21.0/next-page' },
      };

      const secondPage = {
        data: [{ campaign_id: 'campaign-2', spend: '75' }],
        paging: {},
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => firstPage,
          headers: new Headers(),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => secondPage,
          headers: new Headers(),
        } as Response);

      const result = await service.getInsights('org-1', {
        level: MetaSpendLevel.CAMPAIGN,
        datePreset: 'yesterday',
      });

      expect(result).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use date range when provided', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
        headers: new Headers(),
      } as Response);

      await service.getInsights('org-1', {
        level: MetaSpendLevel.CAMPAIGN,
        dateStart: '2024-01-01',
        dateEnd: '2024-01-31',
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain("time_range={'since':'2024-01-01','until':'2024-01-31'}");
    });

    it('should default to yesterday if no date provided', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
        headers: new Headers(),
      } as Response);

      await service.getInsights('org-1', {
        level: MetaSpendLevel.CAMPAIGN,
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain('time_range');
    });
  });

  describe('getSpendForDate', () => {
    beforeEach(() => {
      mockMetaTokenService.ensureValidToken.mockResolvedValue('test-token');
      mockMetaTokenService.getAdAccountId.mockResolvedValue('act_123');
    });

    it('should fetch spend for specific date', async () => {
      const date = new Date('2024-01-15');
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              campaign_id: 'campaign-1',
              spend: '100',
              date_start: '2024-01-15',
              date_stop: '2024-01-15',
            },
          ],
        }),
        headers: new Headers(),
      } as Response);

      const result = await service.getSpendForDate('org-1', date);

      expect(result).toHaveLength(1);
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain("time_range={'since':'2024-01-15','until':'2024-01-15'}");
    });
  });
});
