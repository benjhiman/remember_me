#!/usr/bin/env node
/**
 * Production Smoke Tests for API
 * 
 * Tests critical endpoints with real user credentials.
 * Exit code: 0 if all pass, !=0 if any fail.
 */

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  statusCode?: number;
  duration: number;
  error?: string;
}

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    organizationId: string;
  };
  requiresOrgSelection?: boolean;
  organizations?: Array<{ id: string; name: string; slug: string }>;
  tempToken?: string;
}

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.iphonealcosto.com';
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  url: string,
  options: RequestInit = {}
): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const duration = Date.now() - start;
    const status = response.ok ? 'pass' : 'fail';
    
    if (!response.ok) {
      const text = await response.text();
      return {
        name,
        status,
        statusCode: response.status,
        duration,
        error: text.substring(0, 200),
      };
    }

    return {
      name,
      status,
      statusCode: response.status,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      name,
      status: 'fail',
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function login(): Promise<{ accessToken: string; organizationId: string } | null> {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.error('❌ TEST_EMAIL and TEST_PASSWORD must be set');
    return null;
  }

  const loginResult = await testEndpoint(
    'POST /api/auth/login',
    `${API_BASE_URL}/api/auth/login`,
    {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    }
  );

  if (loginResult.status !== 'pass') {
    return null;
  }

  // Fetch the actual response
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
  });

  const loginData: LoginResponse = await response.json();

  // Handle direct login (single organization)
  if (loginData.accessToken && loginData.user) {
    return {
      accessToken: loginData.accessToken,
      organizationId: loginData.user.organizationId,
    };
  }

  // Handle organization selection (multiple organizations)
  if (loginData.requiresOrgSelection && loginData.tempToken && loginData.organizations && loginData.organizations.length > 0) {
    const firstOrg = loginData.organizations[0];
    const selectResult = await testEndpoint(
      'POST /api/auth/select-organization',
      `${API_BASE_URL}/api/auth/select-organization`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${loginData.tempToken}`,
        },
        body: JSON.stringify({
          organizationId: firstOrg.id,
        }),
      }
    );

    if (selectResult.status !== 'pass') {
      return null;
    }

    // Fetch the actual response
    const selectResponse = await fetch(`${API_BASE_URL}/api/auth/select-organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.tempToken}`,
      },
      body: JSON.stringify({
        organizationId: firstOrg.id,
      }),
    });

    const selectData: LoginResponse = await selectResponse.json();
    if (selectData.accessToken && selectData.user) {
      return {
        accessToken: selectData.accessToken,
        organizationId: selectData.user.organizationId,
      };
    }
  }

  return null;
}

async function runTests() {
  console.log('🚀 Starting Production Smoke Tests\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Email: ${TEST_EMAIL ? '***' + TEST_EMAIL.split('@')[1] : 'NOT SET'}\n`);

  // 1. Health checks
  results.push(await testEndpoint('GET /api/health', `${API_BASE_URL}/api/health`));
  results.push(await testEndpoint('GET /api/health/extended', `${API_BASE_URL}/api/health/extended`));

  // 2. Login
  const auth = await login();
  if (!auth) {
    console.error('❌ Login failed - cannot continue with authenticated tests');
    printResults();
    process.exit(1);
  }

  const { accessToken, organizationId } = auth;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'X-Organization-Id': organizationId,
  };

  // 3. Authenticated endpoints
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateRange = {
    from: thirtyDaysAgo.toISOString(),
    to: now.toISOString(),
  };

  results.push(
    await testEndpoint(
      'GET /api/leads?limit=1',
      `${API_BASE_URL}/api/leads?limit=1`,
      { headers }
    )
  );

  results.push(
    await testEndpoint(
      'GET /api/stock?limit=1',
      `${API_BASE_URL}/api/stock?limit=1`,
      { headers }
    )
  );

  results.push(
    await testEndpoint(
      'GET /api/sales?limit=1',
      `${API_BASE_URL}/api/sales?limit=1`,
      { headers }
    )
  );

  results.push(
    await testEndpoint(
      `GET /api/dashboard/overview?from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`,
      `${API_BASE_URL}/api/dashboard/overview?from=${encodeURIComponent(dateRange.from)}&to=${encodeURIComponent(dateRange.to)}`,
      { headers }
    )
  );

  printResults();
}

function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  results.forEach((result) => {
    const icon = result.status === 'pass' ? '✅' : '❌';
    const statusCode = result.statusCode ? ` [${result.statusCode}]` : '';
    const duration = `${result.duration}ms`;
    console.log(`${icon} ${result.name}${statusCode} - ${duration}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '-'.repeat(80));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('-'.repeat(80) + '\n');

  if (failed > 0) {
    console.error('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed');
    process.exit(0);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
