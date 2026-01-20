#!/usr/bin/env node
/**
 * Production Smoke Tests for Web Frontend
 * 
 * Tests that the frontend is accessible and responding.
 * Exit code: 0 if all pass, !=0 if any fail.
 */

interface TestResult {
  name: string;
  status: 'pass' | 'fail';
  statusCode?: number;
  duration: number;
  error?: string;
}

const WEB_BASE_URL = process.env.WEB_BASE_URL || 'https://app.iphonealcosto.com';

const results: TestResult[] = [];

async function testEndpoint(name: string, url: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'RememberMe-SmokeTest/1.0',
      },
    });
    const duration = Date.now() - start;
    const status = response.ok ? 'pass' : 'fail';

    if (!response.ok) {
      return {
        name,
        status,
        statusCode: response.status,
        duration,
        error: `HTTP ${response.status}`,
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

async function runTests() {
  console.log('🚀 Starting Web Smoke Tests\n');
  console.log(`Web Base URL: ${WEB_BASE_URL}\n`);

  // Test root and login page
  results.push(await testEndpoint('GET /', `${WEB_BASE_URL}/`));
  results.push(await testEndpoint('GET /login', `${WEB_BASE_URL}/login`));

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
