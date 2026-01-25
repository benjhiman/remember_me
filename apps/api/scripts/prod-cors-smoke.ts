/**
 * Production CORS Smoke Test
 * 
 * Verifies CORS is working correctly in production from a Node.js perspective.
 * 
 * Usage: tsx scripts/prod-cors-smoke.ts
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.iphonealcosto.com/api';
const TEST_ORIGIN = 'https://app.iphonealcosto.com';

interface SmokeResult {
  step: string;
  success: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: any;
  error?: string;
}

const results: SmokeResult[] = [];

// Helper to extract headers as lowercase object
function extractHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

async function verifyHealth(): Promise<SmokeResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Origin': TEST_ORIGIN,
      },
    });

    const headers = extractHeaders(response);
    const status = response.status;
    const allowOrigin = headers['access-control-allow-origin'];
    const appCommit = headers['x-app-commit'];

    if (status !== 200) {
      return {
        step: 'GET /health',
        success: false,
        status,
        headers,
        error: `Expected status 200, got ${status}`,
      };
    }

    if (allowOrigin !== TEST_ORIGIN) {
      return {
        step: 'GET /health',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-origin: ${TEST_ORIGIN}, got: ${allowOrigin || 'missing'}`,
      };
    }

    return {
      step: 'GET /health',
      success: true,
      status,
      headers: {
        'access-control-allow-origin': allowOrigin,
        'x-app-commit': appCommit || 'not-set',
      },
    };
  } catch (error: any) {
    return {
      step: 'GET /health',
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function verifyPreflight(): Promise<SmokeResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': TEST_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization,x-organization-id,x-request-id',
      },
    });

    const headers = extractHeaders(response);
    const status = response.status;
    const allowOrigin = headers['access-control-allow-origin'];
    const allowCredentials = headers['access-control-allow-credentials'];
    const appCommit = headers['x-app-commit'];

    if (status !== 204 && status !== 200) {
      return {
        step: 'OPTIONS /auth/login (preflight)',
        success: false,
        status,
        headers,
        error: `Expected status 204 or 200, got ${status}`,
      };
    }

    if (allowOrigin !== TEST_ORIGIN) {
      return {
        step: 'OPTIONS /auth/login (preflight)',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-origin: ${TEST_ORIGIN}, got: ${allowOrigin || 'missing'}`,
      };
    }

    if (allowCredentials !== 'true') {
      return {
        step: 'OPTIONS /auth/login (preflight)',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-credentials: true, got: ${allowCredentials || 'missing'}`,
      };
    }

    return {
      step: 'OPTIONS /auth/login (preflight)',
      success: true,
      status,
      headers: {
        'access-control-allow-origin': allowOrigin,
        'access-control-allow-credentials': allowCredentials,
        'x-app-commit': appCommit || 'not-set',
      },
    };
  } catch (error: any) {
    return {
      step: 'OPTIONS /auth/login (preflight)',
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function verifyPostLogin(): Promise<SmokeResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Origin': TEST_ORIGIN,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: 'invalid@example.com',
        password: 'invalid',
      }),
    });

    const headers = extractHeaders(response);
    const status = response.status;
    const allowOrigin = headers['access-control-allow-origin'];
    const allowCredentials = headers['access-control-allow-credentials'];
    const appCommit = headers['x-app-commit'];
    
    let body: any = null;
    try {
      body = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    // POST should return 401 or 400 (invalid credentials) BUT with CORS headers
    if (status !== 401 && status !== 400) {
      return {
        step: 'POST /auth/login',
        success: false,
        status,
        headers,
        body,
        error: `Expected status 401 or 400, got ${status}`,
      };
    }

    if (allowOrigin !== TEST_ORIGIN) {
      return {
        step: 'POST /auth/login',
        success: false,
        status,
        headers,
        body,
        error: `Expected access-control-allow-origin: ${TEST_ORIGIN}, got: ${allowOrigin || 'missing'}`,
      };
    }

    if (allowCredentials !== 'true') {
      return {
        step: 'POST /auth/login',
        success: false,
        status,
        headers,
        body,
        error: `Expected access-control-allow-credentials: true, got: ${allowCredentials || 'missing'}`,
      };
    }

    return {
      step: 'POST /auth/login',
      success: true,
      status,
      headers: {
        'access-control-allow-origin': allowOrigin,
        'access-control-allow-credentials': allowCredentials,
        'x-app-commit': appCommit || 'not-set',
      },
      body,
    };
  } catch (error: any) {
    return {
      step: 'POST /auth/login',
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function verifyDebugCors(): Promise<SmokeResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/debug/cors`, {
      method: 'GET',
      headers: {
        'Origin': TEST_ORIGIN,
      },
    });

    const headers = extractHeaders(response);
    const status = response.status;
    const allowOrigin = headers['access-control-allow-origin'];
    const appCommit = headers['x-app-commit'];
    
    let body: any = null;
    try {
      body = await response.json();
    } catch {
      // Ignore JSON parse errors
    }

    if (status !== 200) {
      return {
        step: 'GET /debug/cors',
        success: false,
        status,
        headers,
        body,
        error: `Expected status 200, got ${status}`,
      };
    }

    if (allowOrigin !== TEST_ORIGIN) {
      return {
        step: 'GET /debug/cors',
        success: false,
        status,
        headers,
        body,
        error: `Expected access-control-allow-origin: ${TEST_ORIGIN}, got: ${allowOrigin || 'missing'}`,
      };
    }

    if (!body || body.originReceived !== TEST_ORIGIN) {
      return {
        step: 'GET /debug/cors',
        success: false,
        status,
        headers,
        body,
        error: `Expected body.originReceived: ${TEST_ORIGIN}, got: ${body?.originReceived || 'missing'}`,
      };
    }

    return {
      step: 'GET /debug/cors',
      success: true,
      status,
      headers: {
        'access-control-allow-origin': allowOrigin,
        'x-app-commit': appCommit || 'not-set',
      },
      body,
    };
  } catch (error: any) {
    return {
      step: 'GET /debug/cors',
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function main() {
  console.log('🔍 Production CORS Smoke Test');
  console.log('==============================\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Origin: ${TEST_ORIGIN}\n`);

  // Step 1: Health
  console.log('1. Verifying health endpoint...');
  const healthResult = await verifyHealth();
  results.push(healthResult);
  if (healthResult.success) {
    console.log(`   ✅ ${healthResult.step} - Status: ${healthResult.status}`);
    console.log(`      - access-control-allow-origin: ${healthResult.headers?.['access-control-allow-origin']}`);
    console.log(`      - x-app-commit: ${healthResult.headers?.['x-app-commit']}`);
  } else {
    console.error(`   ❌ ${healthResult.step}`);
    console.error(`      Error: ${healthResult.error}`);
    if (healthResult.headers) {
      console.error(`      Headers:`, JSON.stringify(healthResult.headers, null, 2));
    }
  }

  console.log('');

  // Step 2: Preflight
  console.log('2. Verifying preflight (OPTIONS)...');
  const preflightResult = await verifyPreflight();
  results.push(preflightResult);
  if (preflightResult.success) {
    console.log(`   ✅ ${preflightResult.step} - Status: ${preflightResult.status}`);
    console.log(`      - access-control-allow-origin: ${preflightResult.headers?.['access-control-allow-origin']}`);
    console.log(`      - access-control-allow-credentials: ${preflightResult.headers?.['access-control-allow-credentials']}`);
    console.log(`      - x-app-commit: ${preflightResult.headers?.['x-app-commit']}`);
  } else {
    console.error(`   ❌ ${preflightResult.step}`);
    console.error(`      Error: ${preflightResult.error}`);
    if (preflightResult.headers) {
      console.error(`      Headers:`, JSON.stringify(preflightResult.headers, null, 2));
    }
  }

  console.log('');

  // Step 3: POST login
  console.log('3. Verifying POST /auth/login...');
  const postResult = await verifyPostLogin();
  results.push(postResult);
  if (postResult.success) {
    console.log(`   ✅ ${postResult.step} - Status: ${postResult.status} (401/400 expected)`);
    console.log(`      - access-control-allow-origin: ${postResult.headers?.['access-control-allow-origin']}`);
    console.log(`      - access-control-allow-credentials: ${postResult.headers?.['access-control-allow-credentials']}`);
    console.log(`      - x-app-commit: ${postResult.headers?.['x-app-commit']}`);
  } else {
    console.error(`   ❌ ${postResult.step}`);
    console.error(`      Error: ${postResult.error}`);
    if (postResult.headers) {
      console.error(`      Headers:`, JSON.stringify(postResult.headers, null, 2));
    }
  }

  console.log('');

  // Step 4: Debug CORS
  console.log('4. Verifying debug/cors endpoint...');
  const debugResult = await verifyDebugCors();
  results.push(debugResult);
  if (debugResult.success) {
    console.log(`   ✅ ${debugResult.step} - Status: ${debugResult.status}`);
    console.log(`      - access-control-allow-origin: ${debugResult.headers?.['access-control-allow-origin']}`);
    console.log(`      - x-app-commit: ${debugResult.headers?.['x-app-commit']}`);
    console.log(`      - body.originReceived: ${debugResult.body?.originReceived}`);
    console.log(`      - body.corsAllowed: ${debugResult.body?.corsAllowed}`);
    console.log(`      - body.requestId: ${debugResult.body?.requestId}`);
  } else {
    console.error(`   ❌ ${debugResult.step}`);
    console.error(`      Error: ${debugResult.error}`);
    if (debugResult.headers) {
      console.error(`      Headers:`, JSON.stringify(debugResult.headers, null, 2));
    }
    if (debugResult.body) {
      console.error(`      Body:`, JSON.stringify(debugResult.body, null, 2));
    }
  }

  // Summary
  console.log('\n📊 Smoke Test Summary:');
  console.log('=====================');
  const allPassed = results.every((r) => r.success);

  if (allPassed) {
    console.log('✅ PROD CORS SMOKE PASSED');
    console.log('   → Health endpoint includes CORS headers');
    console.log('   → Preflight responds correctly (204)');
    console.log('   → POST login includes CORS headers');
    console.log('   → Debug endpoint works and receives origin correctly');
    const commitSha = results.find(r => r.headers?.['x-app-commit'])?.headers?.['x-app-commit'] || 'unknown';
    console.log(`   → X-App-Commit: ${commitSha}`);
    process.exit(0);
  } else {
    console.error('❌ PROD CORS SMOKE FAILED');
    results.forEach((r) => {
      if (!r.success) {
        console.error(`   - ${r.step}: ${r.error}`);
        if (r.headers) {
          console.error(`     Headers:`, JSON.stringify(r.headers, null, 2));
        }
      }
    });
    process.exit(1);
  }
}

main();
