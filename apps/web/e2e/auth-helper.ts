import { Page, APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL || 'https://api.iphonealcosto.com/api';
const TEST_EMAIL = process.env.E2E_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'TestPassword123!';

export interface AuthState {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    organizationId: string;
    organizationName: string;
    role: string;
  };
}

/**
 * Login via API and return auth state
 */
export async function loginViaAPI(
  request: APIRequestContext,
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD
): Promise<AuthState> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: {
      email,
      password,
    },
  });

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Login failed: ${response.status()} ${error}`);
  }

  const data = await response.json();

  if (data.requiresOrgSelection) {
    throw new Error('User has multiple orgs - use selectOrganization first');
  }

  if (!data.accessToken || !data.refreshToken || !data.user) {
    throw new Error('Invalid login response');
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}

/**
 * Set auth state in browser (localStorage)
 */
export async function setAuthState(page: Page, authState: AuthState) {
  await page.goto('/login');
  
  // Set auth state in localStorage (same format as Zustand persist)
  await page.evaluate((state) => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          user: state.user,
          tempToken: null,
        },
        version: 0,
      })
    );
  }, authState);

  // Reload to apply auth state
  await page.reload();
  
  // Wait for redirect to dashboard/inbox
  await page.waitForURL(/^\/(dashboard|inbox)/, { timeout: 10000 });
}

/**
 * Login and set auth state in one call
 */
export async function loginAndSetState(
  page: Page,
  request: APIRequestContext,
  email?: string,
  password?: string
): Promise<AuthState> {
  const authState = await loginViaAPI(request, email, password);
  await setAuthState(page, authState);
  return authState;
}
