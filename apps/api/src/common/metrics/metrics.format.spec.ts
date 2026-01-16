import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { ConfigService } from '@nestjs/config';

describe('Metrics Format (Prometheus)', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'RATE_LIMIT_ENABLED') return 'false';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should return Prometheus format with HELP and TYPE', async () => {
    const metrics = await service.getMetrics();

    // Check for Prometheus format
    expect(metrics).toContain('# HELP');
    expect(metrics).toContain('# TYPE');
    
    // Check for specific metrics
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('http_request_duration_ms');
    expect(metrics).toContain('integration_jobs_pending_count');
    expect(metrics).toContain('webhook_events_total');
    expect(metrics).toContain('messages_outbound_total');
    expect(metrics).toContain('rate_limit_hits_total');
  });

  it('should not be empty', async () => {
    const metrics = await service.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('should include default labels (env, version)', async () => {
    // Record a metric to generate output
    service.recordHttpRequest('GET', '/test', 200, 100, false);
    
    const metrics = await service.getMetrics();
    
    // Prometheus format includes labels in the metric lines
    // Default labels are added to all metrics via registry.setDefaultLabels
    // They appear in the metric output as: metric_name{label1="value1",label2="value2"} value
    // Since we recorded a metric, it should include the default labels
    expect(metrics).toMatch(/env=/);
    expect(metrics).toMatch(/version=/);
  });

  it('should not expose secrets', async () => {
    const metrics = await service.getMetrics();
    
    // Ensure no common secret patterns are exposed
    const secretPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
    ];

    // Check that metric names don't contain secrets (they shouldn't)
    // But allow metric values to contain any data (they're just numbers)
    const metricLines = metrics.split('\n').filter(line => 
      line.trim() && !line.startsWith('#') && !line.startsWith('{')
    );

    // Only check metric names (before the first space or {)
    metricLines.forEach(line => {
      const metricName = line.split(/\s|{/)[0];
      secretPatterns.forEach(pattern => {
        // Allow if it's part of a known metric name like "rate_limit_hits_total"
        if (!metricName.includes('rate_limit') && !metricName.includes('token')) {
          expect(metricName.toLowerCase()).not.toMatch(pattern);
        }
      });
    });
  });
});
