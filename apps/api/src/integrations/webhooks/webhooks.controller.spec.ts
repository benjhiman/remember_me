import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { IntegrationProvider, WebhookEventStatus } from '@remember-me/prisma';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let webhooksService: WebhooksService;

  const mockWebhooksService = {
    processWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    webhooksService = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('receiveWebhook', () => {
    it('should return 200 immediately after processing', async () => {
      const payload = { eventType: 'message', data: { text: 'hello' } };
      mockWebhooksService.processWebhook.mockResolvedValue({
        id: 'event-1',
        status: WebhookEventStatus.PENDING,
      });

      const result = await controller.receiveWebhook(IntegrationProvider.WHATSAPP, payload);

      expect(result).toEqual({ status: 'received' });
      expect(mockWebhooksService.processWebhook).toHaveBeenCalledWith(
        IntegrationProvider.WHATSAPP,
        'message',
        payload,
      );
    });

    it('should extract eventType from body.eventType', async () => {
      const payload = { eventType: 'status_update', data: {} };
      mockWebhooksService.processWebhook.mockResolvedValue({ id: 'event-1' });

      await controller.receiveWebhook(IntegrationProvider.INSTAGRAM, payload);

      expect(mockWebhooksService.processWebhook).toHaveBeenCalledWith(
        IntegrationProvider.INSTAGRAM,
        'status_update',
        payload,
      );
    });

    it('should extract eventType from body.type if eventType not present', async () => {
      const payload = { type: 'message_received', data: {} };
      mockWebhooksService.processWebhook.mockResolvedValue({ id: 'event-1' });

      await controller.receiveWebhook(IntegrationProvider.FACEBOOK, payload);

      expect(mockWebhooksService.processWebhook).toHaveBeenCalledWith(
        IntegrationProvider.FACEBOOK,
        'message_received',
        payload,
      );
    });

    it('should use "unknown" as eventType if neither eventType nor type present', async () => {
      const payload = { data: {} };
      mockWebhooksService.processWebhook.mockResolvedValue({ id: 'event-1' });

      await controller.receiveWebhook(IntegrationProvider.WHATSAPP, payload);

      expect(mockWebhooksService.processWebhook).toHaveBeenCalledWith(
        IntegrationProvider.WHATSAPP,
        'unknown',
        payload,
      );
    });

    it('should process webhook for different providers', async () => {
      const payload = { eventType: 'test' };
      mockWebhooksService.processWebhook.mockResolvedValue({ id: 'event-1' });

      await controller.receiveWebhook(IntegrationProvider.INSTAGRAM, payload);
      expect(mockWebhooksService.processWebhook).toHaveBeenCalledWith(
        IntegrationProvider.INSTAGRAM,
        'test',
        payload,
      );

      await controller.receiveWebhook(IntegrationProvider.FACEBOOK, payload);
      expect(mockWebhooksService.processWebhook).toHaveBeenCalledWith(
        IntegrationProvider.FACEBOOK,
        'test',
        payload,
      );
    });
  });
});
