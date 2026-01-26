import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration
 * 
 * Run tests with: pnpm --filter @remember-me/web test:e2e
 * 
 * Environment variables:
 * - E2E_BASE_URL: Base URL for tests (default: https://app.iphonealcosto.com)
 * - E2E_EMAIL: Test user email
 * - E2E_PASSWORD: Test user password
 * - E2E_ORG_NAME: Test organization name (optional)
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || (process.env.NODE_ENV === 'production' 
      ? 'https://app.iphonealcosto.com' 
      : 'http://localhost:3000'),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
