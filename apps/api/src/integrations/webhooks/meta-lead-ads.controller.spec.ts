import { Test, TestingModule } from '@nestjs/testing';
import { MetaLeadAdsWebhookController } from './meta-lead-ads.controller';
import { MetaLeadAdsService } from './meta-lead-ads.service';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { Reflector } from '@nestjs/core';

describe('MetaLeadAdsWebhookController', () => {
  let controller: MetaLeadAdsWebhookController;
  let service: MetaLeadAdsService;

  const mockService = {
    processWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaLeadAdsWebhookController],
      providers: [
        {
          provide: MetaLeadAdsService,
          useValue: mockService,
        },
        {
          provide: RateLimitGuard,
          useValue: { canActivate: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: RateLimitService,
          useValue: {},
        },
        {
          provide: Reflector,
          useValue: {},
        },
        {
          provide: MetricsService,
          useValue: {
            recordRateLimitHit: jest.fn(),
            recordRateLimitRejection: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<MetaLeadAdsWebhookController>(MetaLeadAdsWebhookController);
    service = module.get<MetaLeadAdsService>(MetaLeadAdsService);

    jest.clearAllMocks();
  });

  describe('receiveWebhook', () => {
    it('should call service.processWebhook and return status ok', async () => {
      mockService.processWebhook.mockResolvedValue(undefined);

      const result = await controller.receiveWebhook({ entry: [] }, 'org-1');

      expect(mockService.processWebhook).toHaveBeenCalledWith({ entry: [] }, 'org-1');
      expect(result).toEqual({ status: 'ok' });
    });
  });
});
