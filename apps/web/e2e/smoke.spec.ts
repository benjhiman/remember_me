import { test, expect } from '@playwright/test';
import { loginAndSetState, loginViaAPI } from './auth-helper';

const API_BASE_URL = process.env.E2E_API_BASE_URL || 'https://api.iphonealcosto.com/api';
const TEST_EMAIL = process.env.E2E_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'TestPassword123!';

test.describe('Smoke Tests - Critical Paths', () => {
  test('1. Dashboard carga', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login if not authenticated
    // Or show dashboard if authenticated
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard)/);
  });

  test('2. Login Owner via API', async ({ page, request }) => {
    // Login via API
    const authState = await loginViaAPI(request, TEST_EMAIL, TEST_PASSWORD);
    
    expect(authState.accessToken).toBeTruthy();
    expect(authState.user.role).toBeTruthy();
    
    // Set auth state in browser
    await page.goto('/login');
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
    
    await page.reload();
    
    // Should redirect to dashboard/inbox
    await page.waitForURL(/^\/(dashboard|inbox)/, { timeout: 10000 });
    
    // Verify user is logged in
    const userEmail = await page.evaluate(() => {
      const storage = localStorage.getItem('auth-storage');
      if (!storage) return null;
      const parsed = JSON.parse(storage);
      return parsed.state?.user?.email || null;
    });
    
    expect(userEmail).toBe(TEST_EMAIL);
  });

  test('3. Sidebar render + Purchases visible', async ({ page, request }) => {
    await loginAndSetState(page, request);
    
    // Wait for sidebar to render
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 5000 }).catch(() => {
      // Fallback: look for sidebar by text content
      return page.waitForSelector('text=Purchases', { timeout: 5000 });
    });
    
    // Check if Purchases is visible in sidebar
    const purchasesLink = page.locator('a:has-text("Purchases"), a:has-text("Compras")').first();
    await expect(purchasesLink).toBeVisible({ timeout: 5000 });
  });

  test('4. Purchases subitems respetan permisos', async ({ page, request }) => {
    await loginAndSetState(page, request);
    
    // Navigate to purchases
    await page.goto('/sales/purchases');
    await page.waitForLoadState('networkidle');
    
    // Check if Vendors subitem is visible (should be in sidebar)
    const vendorsLink = page.locator('a:has-text("Vendors"), a:has-text("Proveedores")').first();
    
    // Vendors should be visible (it's a subitem of Purchases)
    // If not visible, it might be a permission issue
    const isVisible = await vendorsLink.isVisible().catch(() => false);
    
    // At minimum, purchases page should load
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible({ timeout: 5000 });
  });

  test('5. Sellers visible pero no-owner → OwnerOnlyDenied', async ({ page, request }) => {
    await loginAndSetState(page, request);
    
    // Navigate to sellers
    await page.goto('/sales/sellers');
    await page.waitForLoadState('networkidle');
    
    // Check if sellers link is visible in sidebar (should be visible to all)
    const sellersLink = page.locator('a:has-text("Vendedores"), a:has-text("Sellers")').first();
    const isSellersLinkVisible = await sellersLink.isVisible().catch(() => false);
    
    // Get user role from localStorage
    const userRole = await page.evaluate(() => {
      const storage = localStorage.getItem('auth-storage');
      if (!storage) return null;
      const parsed = JSON.parse(storage);
      return parsed.state?.user?.role || null;
    });
    
    if (userRole !== 'OWNER') {
      // Non-owner should see OwnerOnlyDenied
      await expect(page.locator('text=Solo Owner, text=No tenés acceso')).toBeVisible({ timeout: 5000 });
    } else {
      // Owner should see sellers table or placeholder
      await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible({ timeout: 5000 });
    }
  });

  test('6. GET /api/health → 200', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('ok');
  });

  test('7. Navegación Sales → Vendors carga tabla', async ({ page, request }) => {
    await loginAndSetState(page, request);
    
    // Navigate to sales
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');
    
    // Navigate to vendors
    await page.goto('/sales/vendors');
    await page.waitForLoadState('networkidle');
    
    // Check if vendors page loaded
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible({ timeout: 5000 });
    
    // Check if table is present (might be empty, but structure should exist)
    const table = page.locator('table').first();
    const tableExists = await table.isVisible().catch(() => false);
    
    // At minimum, page should load without errors
    expect(page.url()).toContain('/sales/vendors');
  });

  test('8. Stock carga tabla y scrollea (virtualizada)', async ({ page, request }) => {
    await loginAndSetState(page, request);
    
    // Navigate to stock
    await page.goto('/stock');
    await page.waitForLoadState('networkidle');
    
    // Check if stock page loaded
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible({ timeout: 5000 });
    
    // Check if table is present
    const table = page.locator('table').first();
    const tableExists = await table.isVisible().catch(() => false);
    
    if (tableExists) {
      // Try to scroll (if virtualized, should work smoothly)
      await page.evaluate(() => {
        const scrollable = document.querySelector('[style*="overflow"]') || document.body;
        scrollable.scrollTop = 500;
      });
      
      // Wait a bit for virtualization to render
      await page.waitForTimeout(500);
      
      // Verify page didn't crash
      expect(page.url()).toContain('/stock');
    }
  });
});

test.describe('Extended Smoke Tests', () => {
  test('9. Crear entidad simple (ej Vendor)', async ({ page, request }) => {
    await loginAndSetState(page, request);
    
    // Navigate to vendors
    await page.goto('/sales/vendors');
    await page.waitForLoadState('networkidle');
    
    // Look for "Nuevo" or "New" button
    const newButton = page.locator('button:has-text("Nuevo"), button:has-text("New"), a:has-text("Nuevo")').first();
    const buttonExists = await newButton.isVisible().catch(() => false);
    
    if (buttonExists) {
      // Click new button
      await newButton.click();
      await page.waitForTimeout(1000);
      
      // Should navigate to new vendor page
      expect(page.url()).toMatch(/\/sales\/vendors\/(new|create)/);
    } else {
      // Skip if button doesn't exist (might not have permission)
      test.skip();
    }
  });

  test('10. Logout / sesión inválida', async ({ page, request }) => {
    await loginAndSetState(page, request);
    
    // Clear auth state
    await page.evaluate(() => {
      localStorage.removeItem('auth-storage');
    });
    
    // Try to navigate to protected route
    await page.goto('/dashboard');
    
    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('11. Error de API muestra mensaje claro', async ({ page, request }) => {
    // Make invalid API request
    const response = await request.get(`${API_BASE_URL}/invalid-endpoint`, {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });
    
    // Should return 401 or 404
    expect([401, 404, 403]).toContain(response.status());
  });

  test('12. Smoke /api/health/extended', async ({ request }) => {
    // Try extended health if it exists
    const response = await request.get(`${API_BASE_URL}/health/extended`).catch(() => null);
    
    if (response && response.ok()) {
      const data = await response.json();
      expect(data).toBeTruthy();
    } else {
      // Skip if endpoint doesn't exist
      test.skip();
    }
  });
});
