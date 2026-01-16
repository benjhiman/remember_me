import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockConfigService: ConfigService;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'RATE_LIMIT_ENABLED') return 'false';
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize all metrics', () => {
    expect(service.httpRequestsTotal).toBeDefined();
    expect(service.httpRequestDurationMs).toBeDefined();
    expect(service.slowRequestsTotal).toBeDefined();
    expect(service.integrationJobsPendingCount).toBeDefined();
    expect(service.integrationJobsProcessingCount).toBeDefined();
    expect(service.integrationJobsFailedCount).toBeDefined();
    expect(service.webhookEventsTotal).toBeDefined();
    expect(service.messagesOutboundTotal).toBeDefined();
    expect(service.rateLimitHitsTotal).toBeDefined();
  });

  it('should record HTTP request', () => {
    const incSpy = jest.spyOn(service.httpRequestsTotal, 'inc');
    const observeSpy = jest.spyOn(service.httpRequestDurationMs, 'observe');

    service.recordHttpRequest('GET', '/api/test', 200, 100, false);

    expect(incSpy).toHaveBeenCalledWith({ method: 'GET', route: '/api/test', status: '200' });
    expect(observeSpy).toHaveBeenCalledWith({ method: 'GET', route: '/api/test', status: '200' }, 100);
  });

  it('should record slow request', () => {
    const slowSpy = jest.spyOn(service.slowRequestsTotal, 'inc');

    service.recordHttpRequest('GET', '/api/test', 200, 2000, true);

    expect(slowSpy).toHaveBeenCalledWith({ method: 'GET', route: '/api/test' });
  });

  it('should normalize route to avoid cardinality', () => {
    const incSpy = jest.spyOn(service.httpRequestsTotal, 'inc');

    service.recordHttpRequest('GET', '/api/inbox/conversations/123', 200, 100, false);

    expect(incSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/inbox/conversations/:id',
      }),
    );
  });

  it('should record job metrics', () => {
    const setSpy = jest.spyOn(service.integrationJobsPendingCount, 'set');

    service.recordJobMetrics('WHATSAPP', 'SEND_MESSAGE', 5, 2, 1);

    expect(setSpy).toHaveBeenCalledWith({ provider: 'WHATSAPP', jobType: 'SEND_MESSAGE' }, 5);
  });

  it('should record webhook event', () => {
    const incSpy = jest.spyOn(service.webhookEventsTotal, 'inc');
    const observeSpy = jest.spyOn(service.webhookProcessingDurationMs, 'observe');

    service.recordWebhookEvent('WHATSAPP', 'success', 150);

    expect(incSpy).toHaveBeenCalledWith({ provider: 'WHATSAPP', status: 'success' });
    expect(observeSpy).toHaveBeenCalledWith({ provider: 'WHATSAPP' }, 150);
  });

  it('should record rate limit hit', () => {
    const incSpy = jest.spyOn(service.rateLimitHitsTotal, 'inc');

    service.recordRateLimitHit('inbox.send_text');

    expect(incSpy).toHaveBeenCalledWith({ action: 'inbox.send_text' });
  });

  it('should record rate limit rejection', () => {
    const incSpy = jest.spyOn(service.rateLimitRejectedTotal, 'inc');

    service.recordRateLimitRejection('inbox.send_text');

    expect(incSpy).toHaveBeenCalledWith({ action: 'inbox.send_text' });
  });

  it('should get metrics in Prometheus format', async () => {
    const metrics = await service.getMetrics();

    expect(metrics).toContain('# HELP http_requests_total');
    expect(metrics).toContain('# TYPE http_requests_total counter');
  });
});
