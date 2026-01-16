import { Test, TestingModule } from '@nestjs/testing';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

describe('PricingController', () => {
  let controller: PricingController;
  const mockPricingService = {
    health: jest.fn().mockResolvedValue({ ok: true, module: 'pricing' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PricingController],
      providers: [
        {
          provide: PricingService,
          useValue: mockPricingService,
        },
      ],
    }).compile();

    controller = module.get<PricingController>(PricingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await controller.health();
      expect(result).toEqual({ ok: true, module: 'pricing' });
    });
  });
});
