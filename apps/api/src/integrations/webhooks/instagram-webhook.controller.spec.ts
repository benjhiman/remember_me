import { Test, TestingModule } from '@nestjs/testing';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { InstagramWebhookService } from './instagram-webhook.service';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { Reflector } from '@nestjs/core';

describe('InstagramWebhookController', () => {
  let controller: InstagramWebhookController;
  let service: InstagramWebhookService;

  const mockService = {
    verifyWebhook: jest.fn(),
    processWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstagramWebhookController],
      providers: [
        {
          provide: InstagramWebhookService,
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

    controller = module.get<InstagramWebhookController>(InstagramWebhookController);
    service = module.get<InstagramWebhookService>(InstagramWebhookService);

    jest.clearAllMocks();
  });

  describe('verifyWebhook', () => {
    it('should call service.verifyWebhook and return challenge', () => {
      mockService.verifyWebhook.mockReturnValue('challenge123');

      const result = controller.verifyWebhook('subscribe', 'test_token', 'challenge123');

      expect(mockService.verifyWebhook).toHaveBeenCalledWith('subscribe', 'test_token', 'challenge123');
      expect(result).toBe('challenge123');
    });
  });

  describe('receiveWebhook', () => {
    it('should call service.processWebhook and return status ok', async () => {
      mockService.processWebhook.mockResolvedValue(undefined);

      const result = await controller.receiveWebhook({ object: 'instagram', entry: [] }, 'org-1');

      expect(mockService.processWebhook).toHaveBeenCalledWith({ object: 'instagram', entry: [] }, 'org-1');
      expect(result).toEqual({ status: 'ok' });
    });
  });
});
