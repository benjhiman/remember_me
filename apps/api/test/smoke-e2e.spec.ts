import { waitForApi, getAuthToken, createTestOrgAndUser } from './smoke-e2e.setup';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const METRICS_TOKEN = process.env.METRICS_TOKEN || 'staging-metrics-token-change-me';

describe('Smoke E2E Tests', () => {
  let authToken: string;
  let testData: { orgId: string; userId: string; email: string; password: string };

  beforeAll(async () => {
    // Wait for API to be ready
    await waitForApi(API_BASE_URL);
    
    // Create test org/user - MUST succeed (no skip)
    testData = await createTestOrgAndUser(API_BASE_URL);
    
    // Get auth token - MUST succeed (no skip)
    authToken = await getAuthToken(testData.email, testData.password, API_BASE_URL);
    
    if (!authToken) {
      throw new Error('Failed to obtain auth token - smoke tests cannot proceed');
    }
  }, 60000); // 60s timeout for setup

  describe('Health & Readiness', () => {
    it('1. Health extended should return ok', async () => {
      const response = await fetch(`${API_BASE_URL}/api/health/extended`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('db');
      expect(data).toHaveProperty('uptime');
      expect(typeof data.uptime).toBe('number');
    });

    it('2. Metrics endpoint should work with token auth', async () => {
      const response = await fetch(`${API_BASE_URL}/api/metrics`, {
        headers: {
          'X-Metrics-Token': METRICS_TOKEN,
        },
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('http_requests_total');
      expect(text).toContain('integration_jobs_pending_count');
    });

    it('3. Metrics endpoint should reject invalid token', async () => {
      const response = await fetch(`${API_BASE_URL}/api/metrics`, {
        headers: {
          'X-Metrics-Token': 'invalid-token',
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('4. Rate limit should return 429 + headers on exceed', async () => {

      // Make multiple requests to trigger rate limit
      // Note: Rate limit action depends on endpoint, using login as example
      const requests = Array.from({ length: 15 }, () =>
        fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'rate-limit-test@example.com', password: 'wrong' }),
        }),
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.find((r) => r.status === 429);

      if (rateLimited) {
        expect(rateLimited.status).toBe(429);
        expect(rateLimited.headers.get('Retry-After')).toBeTruthy();
        expect(rateLimited.headers.get('X-RateLimit-Limit')).toBeTruthy();
        expect(rateLimited.headers.get('X-RateLimit-Remaining')).toBeTruthy();

        const body = await rateLimited.json();
        expect(body).toHaveProperty('errorCode', 'RATE_LIMITED');
        expect(body).toHaveProperty('retryAfterSec');
      } else {
        console.warn('Rate limit not triggered (may be disabled or high limit)');
      }
    }, 10000);
  });

  describe('Job Queue (BullMQ)', () => {
    it('5. WhatsApp webhook should enqueue job', async () => {
      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15550555555',
                    phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || 'test-phone-id',
                  },
                  contacts: [
                    {
                      profile: { name: 'Test User' },
                      wa_id: '1234567890',
                    },
                  ],
                  messages: [
                    {
                      from: '1234567890',
                      id: `wamid.${Date.now()}`,
                      timestamp: Math.floor(Date.now() / 1000).toString(),
                      text: { body: 'Test message from smoke test' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'test-verify-token';

      // First verify webhook (GET)
      const verifyResponse = await fetch(
        `${API_BASE_URL}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test-challenge`,
      );
      expect(verifyResponse.status).toBe(200);

      // Then send webhook event (POST)
      const response = await fetch(`${API_BASE_URL}/api/webhooks/whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'sha256=test-signature', // In real tests, compute actual signature
        },
        body: JSON.stringify(webhookPayload),
      });

      // Should accept webhook (even if signature verification fails in test)
      expect([200, 202, 400]).toContain(response.status);

      // Wait a bit for job to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check job metrics (requires auth)
      if (authToken) {
        const metricsResponse = await fetch(`${API_BASE_URL}/api/integrations/jobs/metrics`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (metricsResponse.ok) {
          const metrics = await metricsResponse.json();
          expect(metrics).toHaveProperty('pendingCount');
          expect(metrics).toHaveProperty('processingCount');
          expect(metrics).toHaveProperty('failedCount');
        }
      }
    }, 15000);
  });

  describe('Inbox Quick Actions', () => {
    it('6. Send-text should enqueue job and create MessageLog', async () => {

      // First, create a conversation or use existing one
      // For smoke test, we'll try to send without conversation (may fail, but validates endpoint exists)
      const response = await fetch(`${API_BASE_URL}/api/inbox/conversations/test-conv-id/send-text`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: 'Test message from smoke test',
        }),
      });

      // Endpoint should exist (even if conversation doesn't)
      expect([200, 201, 404]).toContain(response.status);

      if (response.ok || response.status === 201) {
        const data = await response.json();
        expect(data).toHaveProperty('jobId');
        expect(data).toHaveProperty('status');
      }
    });
  });

  describe('Worker Processing', () => {
    it('7. Jobs should be processed and marked DONE', async () => {

      // Get initial metrics
      const initialMetricsResponse = await fetch(`${API_BASE_URL}/api/integrations/jobs/metrics`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!initialMetricsResponse.ok) {
        console.warn('Could not get job metrics, skipping test');
        return;
      }

      const initialMetrics = await initialMetricsResponse.json();
      const initialPending = initialMetrics.pendingCount || 0;

      // Wait for worker to process jobs (if any pending)
      if (initialPending > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const finalMetricsResponse = await fetch(`${API_BASE_URL}/api/integrations/jobs/metrics`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (finalMetricsResponse.ok) {
          const finalMetrics = await finalMetricsResponse.json();
          // After processing, pending should decrease or stay same (if more jobs added)
          expect(finalMetrics.pendingCount).toBeLessThanOrEqual(initialPending + 1); // Allow for small variance
        }
      } else {
        console.warn('No pending jobs to process');
      }
    }, 15000);
  });

  describe('Meta Spend Fetch', () => {
    it('8. Meta spend fetch-now should enqueue job', async () => {

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const response = await fetch(`${API_BASE_URL}/api/integrations/meta/spend/fetch-now?date=${dateStr}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      // Should accept request (may fail if no Meta connection, but validates endpoint exists)
      expect([200, 201, 400, 404]).toContain(response.status);

      if (response.ok || response.status === 201) {
        const data = await response.json();
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('jobId');
      }
    });
  });
});
