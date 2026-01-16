import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AttributionService } from './attribution.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  const mockDashboardService = {
    health: jest.fn().mockResolvedValue({ ok: true, module: 'dashboard' }),
  };
  const mockAttributionService = {
    getMetaAttributionMetrics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
        {
          provide: AttributionService,
          useValue: mockAttributionService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await controller.health();
      expect(result).toEqual({ ok: true, module: 'dashboard' });
    });
  });
});
