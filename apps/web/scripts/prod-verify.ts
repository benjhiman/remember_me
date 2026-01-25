/**
 * Frontend Production Verification Script
 * 
 * Simulates frontend bootstrap and verifies critical endpoints.
 * 
 * Usage: ts-node scripts/prod-verify.ts
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.iphonealcosto.com/api';

interface VerificationResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
}

const results: VerificationResult[] = [];

async function verifyHealthEndpoint(): Promise<VerificationResult> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }

    const duration = Date.now() - startTime;
    return {
      step: 'Health Check',
      success: true,
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      step: 'Health Check',
      success: false,
      duration,
      error: error.message || 'Unknown error',
    };
  }
}

async function verifyAuthEndpoint(): Promise<VerificationResult> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeoutId);

    // 401 is expected if not authenticated, that's OK
    if (response.status === 401 || response.status === 200) {
      const duration = Date.now() - startTime;
      return {
        step: 'Auth /me (401/200 OK)',
        success: true,
        duration,
      };
    }

    throw new Error(`Unexpected status: ${response.status}`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // AbortError is OK (timeout), but we want to know about it
    if (error.name === 'AbortError') {
      return {
        step: 'Auth /me (timeout)',
        success: false,
        duration,
        error: 'Request timed out after 5s',
      };
    }
    
    return {
      step: 'Auth /me',
      success: false,
      duration,
      error: error.message || 'Unknown error',
    };
  }
}

async function verifyConfig(): Promise<VerificationResult> {
  const startTime = Date.now();
  
  if (!API_BASE_URL) {
    return {
      step: 'Config Validation',
      success: false,
      duration: 0,
      error: 'NEXT_PUBLIC_API_BASE_URL is not set',
    };
  }

  if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
    return {
      step: 'Config Validation',
      success: false,
      duration: 0,
      error: `API_BASE_URL contains localhost: ${API_BASE_URL}`,
    };
  }

  if (!API_BASE_URL.startsWith('https://')) {
    return {
      step: 'Config Validation',
      success: false,
      duration: 0,
      error: `API_BASE_URL must use HTTPS: ${API_BASE_URL}`,
    };
  }

  return {
    step: 'Config Validation',
    success: true,
    duration: Date.now() - startTime,
  };
}

async function main() {
  console.log('🔍 Frontend Production Verification');
  console.log('===================================\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  // Step 1: Config validation
  const configResult = await verifyConfig();
  results.push(configResult);
  console.log(`${configResult.success ? '✅' : '❌'} ${configResult.step}`);
  if (!configResult.success) {
    console.error(`   Error: ${configResult.error}`);
  }

  if (!configResult.success) {
    console.error('\n❌ VERIFY FAILED: Configuration invalid');
    process.exit(1);
  }

  // Step 2: Health check
  const healthResult = await verifyHealthEndpoint();
  results.push(healthResult);
  console.log(`${healthResult.success ? '✅' : '❌'} ${healthResult.step} (${healthResult.duration}ms)`);
  if (!healthResult.success) {
    console.error(`   Error: ${healthResult.error}`);
  }

  // Step 3: Auth endpoint (should not hang)
  const authResult = await verifyAuthEndpoint();
  results.push(authResult);
  console.log(`${authResult.success ? '✅' : '❌'} ${authResult.step} (${authResult.duration}ms)`);
  if (!authResult.success) {
    console.error(`   Error: ${authResult.error}`);
  }

  // Summary
  console.log('\n📊 Verification Summary:');
  console.log('========================');
  const allPassed = results.every((r) => r.success);
  
  if (allPassed) {
    console.log('✅ VERIFY PASSED');
    console.log('   → Configuration valid');
    console.log('   → Health endpoint responds');
    console.log('   → Auth endpoint does not hang');
    process.exit(0);
  } else {
    console.error('❌ VERIFY FAILED');
    results.forEach((r) => {
      if (!r.success) {
        console.error(`   - ${r.step}: ${r.error}`);
      }
    });
    process.exit(1);
  }
}

main();
