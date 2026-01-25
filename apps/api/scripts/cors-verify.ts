/**
 * CORS Verification Script
 * 
 * Verifies that CORS is correctly configured for production.
 * 
 * Usage: tsx scripts/cors-verify.ts
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.iphonealcosto.com/api';
const TEST_ORIGIN = 'https://app.iphonealcosto.com';

// Helper to extract headers as lowercase object
function extractHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

interface VerificationResult {
  step: string;
  success: boolean;
  status?: number;
  headers?: Record<string, string>;
  error?: string;
}

const results: VerificationResult[] = [];

async function verifyHealthEndpoint(): Promise<VerificationResult> {
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
    const allowCredentials = headers['access-control-allow-credentials'];

    // Validate health response
    const isValidStatus = status === 200;
    const isValidOrigin = allowOrigin === TEST_ORIGIN;
    const isValidCredentials = allowCredentials === 'true';

    if (!isValidStatus) {
      return {
        step: 'GET /health',
        success: false,
        status,
        headers,
        error: `Expected status 200, got ${status}`,
      };
    }

    if (!isValidOrigin) {
      return {
        step: 'GET /health',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-origin: ${TEST_ORIGIN}, got: ${allowOrigin || 'missing'}`,
      };
    }

    if (!isValidCredentials) {
      return {
        step: 'GET /health',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-credentials: true, got: ${allowCredentials || 'missing'}`,
      };
    }

    return {
      step: 'GET /health',
      success: true,
      status,
      headers: {
        'access-control-allow-origin': allowOrigin,
        'access-control-allow-credentials': allowCredentials,
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

async function verifyPreflight(): Promise<VerificationResult> {
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
    const allowHeaders = headers['access-control-allow-headers'] || '';
    const allowMethods = headers['access-control-allow-methods'] || '';

    // Validate preflight response
    const isValidStatus = status === 204 || status === 200;
    const isValidOrigin = allowOrigin === TEST_ORIGIN;
    const isValidCredentials = allowCredentials === 'true';
    const hasRequiredHeaders = 
      allowHeaders.toLowerCase().includes('x-organization-id') &&
      allowHeaders.toLowerCase().includes('authorization');

    if (!isValidStatus) {
      return {
        step: 'Preflight OPTIONS',
        success: false,
        status,
        headers,
        error: `Expected status 204 or 200, got ${status}`,
      };
    }

    if (!isValidOrigin) {
      return {
        step: 'Preflight OPTIONS',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-origin: ${TEST_ORIGIN}, got: ${allowOrigin}`,
      };
    }

    if (!isValidCredentials) {
      return {
        step: 'Preflight OPTIONS',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-credentials: true, got: ${allowCredentials}`,
      };
    }

    if (!hasRequiredHeaders) {
      return {
        step: 'Preflight OPTIONS',
        success: false,
        status,
        headers,
        error: `Missing required headers in access-control-allow-headers. Got: ${allowHeaders}`,
      };
    }

    return {
      step: 'Preflight OPTIONS',
      success: true,
      status,
      headers: {
        'access-control-allow-origin': allowOrigin,
        'access-control-allow-credentials': allowCredentials,
        'access-control-allow-headers': allowHeaders,
        'access-control-allow-methods': allowMethods,
      },
    };
  } catch (error: any) {
    return {
      step: 'Preflight OPTIONS',
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function verifyPostRequest(): Promise<VerificationResult> {
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

    // POST should return 401 (invalid credentials) with CORS headers
    const isValidStatus = status === 401;
    const isValidOrigin = allowOrigin === TEST_ORIGIN;
    const isValidCredentials = allowCredentials === 'true';

    if (!isValidStatus) {
      return {
        step: 'POST /auth/login',
        success: false,
        status,
        headers,
        error: `Expected status 401, got ${status}`,
      };
    }

    if (!isValidOrigin) {
      return {
        step: 'POST /auth/login',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-origin: ${TEST_ORIGIN}, got: ${allowOrigin}`,
      };
    }

    if (!isValidCredentials) {
      return {
        step: 'POST /auth/login',
        success: false,
        status,
        headers,
        error: `Expected access-control-allow-credentials: true, got: ${allowCredentials}`,
      };
    }

    return {
      step: 'POST /auth/login',
      success: true,
      status,
      headers: {
        'access-control-allow-origin': allowOrigin,
        'access-control-allow-credentials': allowCredentials,
      },
    };
  } catch (error: any) {
    return {
      step: 'POST /auth/login',
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function main() {
  console.log('🔍 CORS Verification Script');
  console.log('============================\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Origin: ${TEST_ORIGIN}\n`);

  // Step 1: Verify health endpoint
  console.log('1. Verifying health endpoint (GET /health)...');
  const healthResult = await verifyHealthEndpoint();
  results.push(healthResult);
  
  if (healthResult.success) {
    console.log(`   ✅ ${healthResult.step} - Status: ${healthResult.status}`);
    console.log(`      - access-control-allow-origin: ${healthResult.headers?.['access-control-allow-origin']}`);
    console.log(`      - access-control-allow-credentials: ${healthResult.headers?.['access-control-allow-credentials']}`);
  } else {
    console.error(`   ❌ ${healthResult.step}`);
    console.error(`      Error: ${healthResult.error}`);
    if (healthResult.status) {
      console.error(`      Status: ${healthResult.status}`);
    }
    if (healthResult.headers) {
      console.error(`      Headers:`, JSON.stringify(healthResult.headers, null, 2));
    }
  }

  console.log('');

  // Step 2: Verify preflight
  console.log('2. Verifying preflight (OPTIONS)...');
  const preflightResult = await verifyPreflight();
  results.push(preflightResult);
  
  if (preflightResult.success) {
    console.log(`   ✅ ${preflightResult.step} - Status: ${preflightResult.status}`);
    console.log(`      - access-control-allow-origin: ${preflightResult.headers?.['access-control-allow-origin']}`);
    console.log(`      - access-control-allow-credentials: ${preflightResult.headers?.['access-control-allow-credentials']}`);
    console.log(`      - access-control-allow-headers: ${preflightResult.headers?.['access-control-allow-headers']}`);
    console.log(`      - access-control-allow-methods: ${preflightResult.headers?.['access-control-allow-methods']}`);
  } else {
    console.error(`   ❌ ${preflightResult.step}`);
    console.error(`      Error: ${preflightResult.error}`);
    if (preflightResult.status) {
      console.error(`      Status: ${preflightResult.status}`);
    }
    if (preflightResult.headers) {
      console.error(`      Headers:`, JSON.stringify(preflightResult.headers, null, 2));
    }
  }

  console.log('');

  // Step 3: Verify POST request
  console.log('3. Verifying POST request...');
  const postResult = await verifyPostRequest();
  results.push(postResult);

  if (postResult.success) {
    console.log(`   ✅ ${postResult.step} - Status: ${postResult.status} (401 expected)`);
    console.log(`      - access-control-allow-origin: ${postResult.headers?.['access-control-allow-origin']}`);
    console.log(`      - access-control-allow-credentials: ${postResult.headers?.['access-control-allow-credentials']}`);
  } else {
    console.error(`   ❌ ${postResult.step}`);
    console.error(`      Error: ${postResult.error}`);
    if (postResult.status) {
      console.error(`      Status: ${postResult.status}`);
    }
    if (postResult.headers) {
      console.error(`      Headers:`, JSON.stringify(postResult.headers, null, 2));
    }
  }

  // Summary
  console.log('\n📊 Verification Summary:');
  console.log('========================');
  const allPassed = results.every((r) => r.success);

  if (allPassed) {
    console.log('✅ CORS VERIFY PASSED');
    console.log('   → Health endpoint includes CORS headers');
    console.log('   → Preflight responds correctly (204)');
    console.log('   → POST request includes CORS headers');
    console.log('   → Production origin (https://app.iphonealcosto.com) is allowed');
    process.exit(0);
  } else {
    console.error('❌ CORS VERIFY FAILED');
    results.forEach((r) => {
      if (!r.success) {
        console.error(`   - ${r.step}: ${r.error}`);
        if (r.headers) {
          console.error(`     Relevant headers:`, JSON.stringify(r.headers, null, 2));
        }
      }
    });
    process.exit(1);
  }
}

main();
