import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private registry: Registry;
  private defaultLabels: Record<string, string>;

  // HTTP Metrics
  public httpRequestsTotal!: Counter<string>;
  public httpRequestDurationMs!: Histogram<string>;
  public slowRequestsTotal!: Counter<string>;

  // Job Metrics
  public integrationJobsPendingCount!: Gauge<string>;
  public integrationJobsProcessingCount!: Gauge<string>;
  public integrationJobsFailedCount!: Gauge<string>;
  public integrationJobLatencyMs!: Histogram<string>;
  public integrationJobDurationMs!: Histogram<string>;

  // Webhook Metrics
  public webhookEventsTotal!: Counter<string>;
  public webhookProcessingDurationMs!: Histogram<string>;

  // Messaging Metrics
  public messagesOutboundTotal!: Counter<string>;
  public messageStatusTransitionsTotal!: Counter<string>;
  public inboxMessagesCreatedTotal!: Counter<string>;

  // Rate Limit Metrics
  public rateLimitHitsTotal!: Counter<string>;
  public rateLimitRejectedTotal!: Counter<string>;

  // Meta Ads Metrics
  public metaRequestsTotal!: Counter<string>;
  public metaLatencyMs!: Histogram<string>;

  constructor(private configService: ConfigService) {
    this.registry = new Registry();
    this.defaultLabels = {
      env: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
    };
    this.registry.setDefaultLabels(this.defaultLabels);
    this.initializeMetrics();
  }

  onModuleInit() {
    // Metrics are initialized in constructor
  }

  private initializeMetrics() {
    // HTTP Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDurationMs = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    this.slowRequestsTotal = new Counter({
      name: 'slow_requests_total',
      help: 'Total number of slow requests (exceeding threshold)',
      labelNames: ['method', 'route'],
      registers: [this.registry],
    });

    // Job Metrics
    this.integrationJobsPendingCount = new Gauge({
      name: 'integration_jobs_pending_count',
      help: 'Number of pending integration jobs',
      labelNames: ['provider', 'jobType'],
      registers: [this.registry],
    });

    this.integrationJobsProcessingCount = new Gauge({
      name: 'integration_jobs_processing_count',
      help: 'Number of processing integration jobs',
      labelNames: ['provider', 'jobType'],
      registers: [this.registry],
    });

    this.integrationJobsFailedCount = new Gauge({
      name: 'integration_jobs_failed_count',
      help: 'Number of failed integration jobs',
      labelNames: ['provider', 'jobType'],
      registers: [this.registry],
    });

    this.integrationJobLatencyMs = new Histogram({
      name: 'integration_job_latency_ms',
      help: 'Time from runAt to job start in milliseconds',
      labelNames: ['provider', 'jobType'],
      buckets: [100, 500, 1000, 5000, 10000, 30000, 60000],
      registers: [this.registry],
    });

    this.integrationJobDurationMs = new Histogram({
      name: 'integration_job_duration_ms',
      help: 'Job execution duration in milliseconds',
      labelNames: ['provider', 'jobType', 'status'],
      buckets: [100, 500, 1000, 5000, 10000, 30000, 60000],
      registers: [this.registry],
    });

    // Webhook Metrics
    this.webhookEventsTotal = new Counter({
      name: 'webhook_events_total',
      help: 'Total number of webhook events received',
      labelNames: ['provider', 'status'],
      registers: [this.registry],
    });

    this.webhookProcessingDurationMs = new Histogram({
      name: 'webhook_processing_duration_ms',
      help: 'Webhook processing duration in milliseconds',
      labelNames: ['provider'],
      buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000],
      registers: [this.registry],
    });

    // Messaging Metrics
    this.messagesOutboundTotal = new Counter({
      name: 'messages_outbound_total',
      help: 'Total number of outbound messages',
      labelNames: ['provider', 'status'],
      registers: [this.registry],
    });

    this.messageStatusTransitionsTotal = new Counter({
      name: 'message_status_transitions_total',
      help: 'Total number of message status transitions',
      labelNames: ['provider', 'from', 'to'],
      registers: [this.registry],
    });

    this.inboxMessagesCreatedTotal = new Counter({
      name: 'inbox_messages_created_total',
      help: 'Total number of inbound messages created (after idempotency)',
      labelNames: ['provider'],
      registers: [this.registry],
    });

    // Rate Limit Metrics
    this.rateLimitHitsTotal = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit checks',
      labelNames: ['action'],
      registers: [this.registry],
    });

    this.rateLimitRejectedTotal = new Counter({
      name: 'rate_limit_rejected_total',
      help: 'Total number of rate limit rejections',
      labelNames: ['action'],
      registers: [this.registry],
    });

    // Meta Ads Metrics
    this.metaRequestsTotal = new Counter({
      name: 'meta_requests_total',
      help: 'Total number of Meta Graph/Marketing API requests',
      labelNames: ['endpoint', 'status'],
      registers: [this.registry],
    });

    this.metaLatencyMs = new Histogram({
      name: 'meta_latency_ms',
      help: 'Meta Graph/Marketing API request latency in milliseconds',
      labelNames: ['endpoint', 'status'],
      buckets: [25, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
      registers: [this.registry],
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get registry for custom metrics
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(method: string, route: string, status: number, durationMs: number, isSlow: boolean = false) {
    const normalizedRoute = this.normalizeRoute(route);
    this.httpRequestsTotal.inc({ method, route: normalizedRoute, status: status.toString() });
    this.httpRequestDurationMs.observe({ method, route: normalizedRoute, status: status.toString() }, durationMs);
    if (isSlow) {
      this.slowRequestsTotal.inc({ method, route: normalizedRoute });
    }
  }

  /**
   * Record integration job metrics
   */
  recordJobMetrics(
    provider: string,
    jobType: string,
    pendingCount: number,
    processingCount: number,
    failedCount: number,
  ) {
    this.integrationJobsPendingCount.set({ provider, jobType }, pendingCount);
    this.integrationJobsProcessingCount.set({ provider, jobType }, processingCount);
    this.integrationJobsFailedCount.set({ provider, jobType }, failedCount);
  }

  /**
   * Record job latency (time from runAt to start)
   */
  recordJobLatency(provider: string, jobType: string, latencyMs: number) {
    this.integrationJobLatencyMs.observe({ provider, jobType }, latencyMs);
  }

  /**
   * Record job duration (time from start to done)
   */
  recordJobDuration(provider: string, jobType: string, status: string, durationMs: number) {
    this.integrationJobDurationMs.observe({ provider, jobType, status }, durationMs);
  }

  /**
   * Record webhook event
   */
  recordWebhookEvent(provider: string, status: string, durationMs?: number) {
    this.webhookEventsTotal.inc({ provider, status });
    if (durationMs !== undefined) {
      this.webhookProcessingDurationMs.observe({ provider }, durationMs);
    }
  }

  recordInboxMessageCreated(provider: string) {
    this.inboxMessagesCreatedTotal.inc({ provider });
  }

  recordMetaRequest(endpoint: string, status: number, durationMs: number) {
    const statusLabel = status.toString();
    this.metaRequestsTotal.inc({ endpoint, status: statusLabel });
    this.metaLatencyMs.observe({ endpoint, status: statusLabel }, durationMs);
  }

  /**
   * Record outbound message
   */
  recordOutboundMessage(provider: string, status: string) {
    this.messagesOutboundTotal.inc({ provider, status });
  }

  /**
   * Record message status transition
   */
  recordMessageStatusTransition(provider: string, from: string, to: string) {
    this.messageStatusTransitionsTotal.inc({ provider, from, to });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(action: string) {
    this.rateLimitHitsTotal.inc({ action });
  }

  /**
   * Record rate limit rejection
   */
  recordRateLimitRejection(action: string) {
    this.rateLimitRejectedTotal.inc({ action });
  }

  /**
   * Normalize route to avoid cardinality explosion
   * e.g., /api/inbox/conversations/123 -> /api/inbox/conversations/:id
   */
  private normalizeRoute(route: string): string {
    // Remove UUIDs and IDs from routes
    return route
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/[0-9a-f]{24}/gi, '/:id') // MongoDB ObjectId
      .replace(/\/\d+/g, '/:id') // Numeric IDs
      .replace(/\?.*$/, ''); // Remove query strings
  }
}
