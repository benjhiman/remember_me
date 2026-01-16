import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { UnauthorizedException } from '@nestjs/common';

describe('MetricsController', () => {
  let controller: MetricsController;
  let metricsService: MetricsService;

  const mockMetricsService = {
    getMetrics: jest.fn().mockResolvedValue('# HELP http_requests_total\n# TYPE http_requests_total counter\n'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    metricsService = module.get<MetricsService>(MetricsService);
    jest.clearAllMocks();
  });

  describe('getMetrics', () => {
    it('should return metrics with valid X-Metrics-Token header', async () => {
      process.env.METRICS_TOKEN = 'test-token';

      const result = await controller.getMetrics('test-token');

      expect(result).toContain('http_requests_total');
      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException with invalid token', async () => {
      process.env.METRICS_TOKEN = 'test-token';

      await expect(controller.getMetrics('wrong-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no token provided and METRICS_TOKEN is set', async () => {
      process.env.METRICS_TOKEN = 'test-token';

      await expect(controller.getMetrics(undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when METRICS_TOKEN is not set', async () => {
      delete process.env.METRICS_TOKEN;

      await expect(controller.getMetrics(undefined)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMetricsAuthenticated', () => {
    it('should return metrics for authenticated users', async () => {
      const result = await controller.getMetricsAuthenticated();

      expect(result).toContain('http_requests_total');
      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    });
  });
});
