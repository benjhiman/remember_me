/**
 * Development-only auth helper
 * Automatically creates test user and logs in during development
 * NEVER runs in production
 */

const TEST_USER_EMAIL = 'test@iphonealcosto.com';
const TEST_USER_PASSWORD = 'Test1234!!';
const TEST_USER_NAME = 'Test User';
const TEST_ORG_NAME = 'iPhone al costo';
const TEST_ORG_SLUG = 'iphone-al-costo';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    role: string;
  };
}

interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    role: string;
  };
  requiresOrgSelection?: boolean;
  organizations?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
  tempToken?: string;
}

/**
 * Create test user if it doesn't exist (idempotent)
 */
async function createTestUser(): Promise<RegisterResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        name: TEST_USER_NAME,
        organizationName: TEST_ORG_NAME,
        organizationSlug: TEST_ORG_SLUG,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else if (response.status === 409) {
      // User already exists, that's fine
      return null;
    } else {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.warn('[Dev Auth] Failed to create test user:', error.message);
      return null;
    }
  } catch (error) {
    console.warn('[Dev Auth] Error creating test user:', error);
    return null;
  }
}

/**
 * Login with test user credentials
 */
async function loginTestUser(): Promise<LoginResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.warn('[Dev Auth] Failed to login test user:', error.message);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn('[Dev Auth] Error logging in test user:', error);
    return null;
  }
}

/**
 * Auto-login in development mode
 * Returns auth data if successful, null otherwise
 */
export async function devAutoLogin(): Promise<{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    role: string;
  };
} | null> {
  // Only run in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Try to create user first (idempotent - won't fail if exists)
  const registerResult = await createTestUser();
  if (registerResult) {
    return {
      accessToken: registerResult.accessToken,
      refreshToken: registerResult.refreshToken,
      user: registerResult.user,
    };
  }

  // If user exists, try to login
  const loginResult = await loginTestUser();
  if (loginResult?.accessToken && loginResult?.refreshToken && loginResult?.user) {
    return {
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      user: loginResult.user,
    };
  }

  // If user has multiple orgs, we'd need to handle select-organization
  // For now, just return null and let normal login flow handle it
  if (loginResult?.requiresOrgSelection && loginResult.tempToken) {
    console.warn('[Dev Auth] Test user has multiple organizations, manual selection required');
    return null;
  }

  return null;
}
