// Smoke E2E Test Setup
// This file runs before all smoke e2e tests

// Default timeout for all tests (can be overridden per test)
jest.setTimeout(30000);

// Helper to wait for API to be ready
export async function waitForApi(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:4000', maxRetries: number = 30, delayMs: number = 1000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // API not ready yet, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`API at ${baseUrl} did not become ready after ${maxRetries} retries`);
}

// Helper to create a test organization and user
export async function createTestOrgAndUser(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:4000') {
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'TestPassword123!';
  const orgName = process.env.TEST_ORG_NAME || 'Test Organization';

  // Use bootstrap endpoint to create org/user if in test mode
  try {
    const bootstrapResponse = await fetch(`${baseUrl}/api/test/bootstrap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, orgName }),
    });

    if (bootstrapResponse.ok) {
      const bootstrapData = await bootstrapResponse.json();
      return {
        orgId: bootstrapData.organizationId,
        userId: bootstrapData.userId,
        email: bootstrapData.email,
        password,
      };
    }
  } catch (error) {
    // Bootstrap endpoint might not be available (production mode)
    console.warn('Bootstrap endpoint not available, using env vars');
  }

  // Fallback to env vars (should fail if not set in test mode)
  const orgId = process.env.TEST_ORG_ID;
  const userId = process.env.TEST_USER_ID;

  if (!orgId || !userId) {
    throw new Error('TEST_ORG_ID and TEST_USER_ID must be set, or bootstrap endpoint must be available (NODE_ENV=test or STAGING_TEST_MODE=true)');
  }

  return {
    orgId,
    userId,
    email,
    password,
  };
}

// Helper to get auth token
export async function getAuthToken(
  email: string,
  password: string,
  baseUrl: string = process.env.API_BASE_URL || 'http://localhost:4000',
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get auth token (${response.status}): ${errorText}. Make sure user exists and password is correct.`);
  }

  const data = await response.json();
  if (!data.accessToken) {
    throw new Error('Auth response missing accessToken');
  }
  return data.accessToken;
}
