import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { RateLimitService } from '../../common/rate-limit/rate-limit.service';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { MetricsService } from '../../common/metrics/metrics.service';
import { ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('WhatsAppWebhookController', () => {
  let controller: WhatsAppWebhookController;
  let service: WhatsAppWebhookService;

  const mockWhatsAppWebhookService = {
    verifyWebhook: jest.fn(),
    processWebhook: jest.fn(),
  };

  const mockRateLimitService = {
    checkLimit: jest.fn(),
    enabled: true,
  };

  const mockReflector = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppWebhookController],
      providers: [
        {
          provide: WhatsAppWebhookService,
          useValue: mockWhatsAppWebhookService,
        },
        {
          provide: RateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: RateLimitGuard,
          useValue: {
            canActivate: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: Reflector,
          useValue: mockReflector,
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

    controller = module.get<WhatsAppWebhookController>(WhatsAppWebhookController);
    service = module.get<WhatsAppWebhookService>(WhatsAppWebhookService);
    jest.clearAllMocks();
  });

  describe('verifyWebhook (GET)', () => {
    it('should return challenge when token is valid', () => {
      mockWhatsAppWebhookService.verifyWebhook.mockReturnValue('challenge-123');
      const result = controller.verifyWebhook('subscribe', 'valid-token', 'challenge-123');
      expect(result).toBe('challenge-123');
      expect(mockWhatsAppWebhookService.verifyWebhook).toHaveBeenCalledWith(
        'subscribe',
        'valid-token',
        'challenge-123',
      );
    });

    it('should throw ForbiddenException when token is invalid', () => {
      mockWhatsAppWebhookService.verifyWebhook.mockImplementation(() => {
        throw new ForbiddenException('Invalid verify token');
      });
      expect(() => {
        controller.verifyWebhook('subscribe', 'invalid-token', 'challenge-123');
      }).toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when mode is not subscribe', () => {
      mockWhatsAppWebhookService.verifyWebhook.mockImplementation(() => {
        throw new BadRequestException('Invalid hub.mode');
      });
      expect(() => {
        controller.verifyWebhook('unsubscribe', 'valid-token', 'challenge-123');
      }).toThrow(BadRequestException);
    });
  });

  describe('receiveWebhook (POST)', () => {
    it('should return 200 OK after processing webhook', async () => {
      mockWhatsAppWebhookService.processWebhook.mockResolvedValue(undefined);
      const result = await controller.receiveWebhook({ object: 'whatsapp_business_account' });
      expect(result).toEqual({ status: 'ok' });
      expect(mockWhatsAppWebhookService.processWebhook).toHaveBeenCalled();
    });

    it('should pass organizationId from header if provided', async () => {
      mockWhatsAppWebhookService.processWebhook.mockResolvedValue(undefined);
      await controller.receiveWebhook({ object: 'whatsapp_business_account' }, 'org-123');
      expect(mockWhatsAppWebhookService.processWebhook).toHaveBeenCalledWith(
        { object: 'whatsapp_business_account' },
        'org-123',
      );
    });
  });
});
