#!/usr/bin/env node

/**
 * Smoke test for Audit Log API endpoint
 * 
 * Usage:
 *   export API_URL=http://localhost:4000
 *   export TEST_TOKEN=<jwt-token>
 *   pnpm --filter @remember-me/api audit:smoke
 * 
 * Or in Railway:
 *   railway run pnpm --filter @remember-me/api audit:smoke
 */

import * as https from 'https';
import * as http from 'http';

const API_URL = process.env.API_URL || 'http://localhost:4000';
const TEST_TOKEN = process.env.TEST_TOKEN || '';

interface TestResult {
  name: string;
  passed: boolean;
  statusCode?: number;
  error?: string;
  response?: any;
}

const results: TestResult[] = [];

function makeRequest(
  method: string,
  path: string,
  token?: string,
  expectedStatus?: number,
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    } as any;

    const req = client.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : null;
          resolve({ statusCode: res.statusCode || 200, body });
        } catch (e) {
          resolve({ statusCode: res.statusCode || 200, body: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function runTest(name: string, testFn: () => Promise<void>) {
  try {
    await testFn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error.message || String(error),
    });
    console.error(`❌ ${name}: ${error.message || String(error)}`);
  }
}

async function main() {
  console.log('🧪 Starting Audit Log Smoke Tests...\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Token provided: ${TEST_TOKEN ? 'Yes' : 'No'}\n`);

  // Test 1: GET /api/audit-logs without auth (should fail)
  await runTest('GET /api/audit-logs without auth (expect 401/403)', async () => {
    const { statusCode } = await makeRequest('GET', '/api/audit-logs');
    if (statusCode !== 401 && statusCode !== 403) {
      throw new Error(`Expected 401/403, got ${statusCode}`);
    }
  });

  if (!TEST_TOKEN) {
    console.log('\n⚠️  No TEST_TOKEN provided. Skipping authenticated tests.\n');
    printResults();
    process.exit(0);
  }

  // Test 2: GET /api/audit-logs with auth (should succeed if OWNER)
  await runTest('GET /api/audit-logs with auth (expect 200 or 403)', async () => {
    const { statusCode, body } = await makeRequest('GET', '/api/audit-logs', TEST_TOKEN);
    if (statusCode === 200) {
      // Validate response structure
      if (!body.data || !Array.isArray(body.data)) {
        throw new Error('Response missing data array');
      }
      if (typeof body.total !== 'number') {
        throw new Error('Response missing total');
      }
      if (!body.meta) {
        throw new Error('Response missing meta');
      }
      console.log(`   Found ${body.total} audit logs`);
    } else if (statusCode === 403) {
      console.log('   User is not OWNER (expected for non-owner users)');
    } else {
      throw new Error(`Expected 200 or 403, got ${statusCode}: ${JSON.stringify(body)}`);
    }
  });

  // Test 3: GET /api/audit-logs with filters
  await runTest('GET /api/audit-logs with filters', async () => {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 7);
    const dateTo = new Date();

    const url = new URL('/api/audit-logs', API_URL);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '10');
    url.searchParams.set('dateFrom', dateFrom.toISOString().split('T')[0]);
    url.searchParams.set('dateTo', dateTo.toISOString().split('T')[0]);
    url.searchParams.set('actorRole', 'OWNER');

    const { statusCode, body } = await makeRequest('GET', url.pathname + url.search, TEST_TOKEN);
    if (statusCode === 200) {
      console.log(`   Filtered results: ${body.data.length} of ${body.total}`);
    } else if (statusCode === 403) {
      console.log('   User is not OWNER (skipping filter test)');
    } else {
      throw new Error(`Expected 200 or 403, got ${statusCode}`);
    }
  });

  // Test 4: GET /api/audit-logs with invalid pageSize (should fail)
  await runTest('GET /api/audit-logs with pageSize > 100 (expect 400)', async () => {
    const url = new URL('/api/audit-logs', API_URL);
    url.searchParams.set('pageSize', '200');

    const { statusCode, body } = await makeRequest('GET', url.pathname + url.search, TEST_TOKEN);
    if (statusCode === 400) {
      console.log(`   Validation error: ${body.message || 'pageSize too large'}`);
    } else if (statusCode === 403) {
      console.log('   User is not OWNER (skipping validation test)');
    } else {
      throw new Error(`Expected 400 or 403, got ${statusCode}`);
    }
  });

  // Test 5: GET /api/audit-logs with search < 3 chars (should fail)
  await runTest('GET /api/audit-logs with search < 3 chars (expect 400)', async () => {
    const url = new URL('/api/audit-logs', API_URL);
    url.searchParams.set('search', 'ab');

    const { statusCode, body } = await makeRequest('GET', url.pathname + url.search, TEST_TOKEN);
    if (statusCode === 400) {
      console.log(`   Validation error: ${body.message || 'search too short'}`);
    } else if (statusCode === 403) {
      console.log('   User is not OWNER (skipping validation test)');
    } else {
      throw new Error(`Expected 400 or 403, got ${statusCode}`);
    }
  });

  printResults();
}

function printResults() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('='.repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (!result.passed && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(50) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
