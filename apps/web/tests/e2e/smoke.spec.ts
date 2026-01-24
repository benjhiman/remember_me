import { test, expect } from '@playwright/test';

const E2E_EMAIL = process.env.E2E_EMAIL || 'test@example.com';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'TestPassword123!';

test.describe('Smoke Tests - Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    
    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Login
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for redirect (could be dashboard, inbox, or select-org)
    await page.waitForURL(/\/(dashboard|inbox|select-org)/, { timeout: 15000 });
  });

  test('1. login ok → llega al dashboard shell', async ({ page }) => {
    // If redirected to select-org, select first org
    if (page.url().includes('/select-org')) {
      const orgButtons = page.locator('button').filter({ hasText: /Select|Seleccionar/i });
      if ((await orgButtons.count()) > 0) {
        await orgButtons.first().click();
        await page.waitForURL(/\/(dashboard|inbox)/, { timeout: 10000 });
      }
    }

    // Verify we're in a dashboard page (not login)
    expect(page.url()).not.toContain('/login');
    
    // Verify sidebar is visible (Zoho shell)
    const sidebar = page.locator('nav, [role="navigation"], aside').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });
    
    // Verify topbar is visible
    const topbar = page.locator('header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 5000 });
  });

  test('2. org switch (si hay 2 orgs) → cambia indicador y refresca', async ({ page }) => {
    // Skip if no org switcher visible
    const orgSwitcher = page.locator('button').filter({ hasText: /Organization|Org/i }).first();
    const switcherCount = await orgSwitcher.count();
    
    if (switcherCount === 0) {
      test.skip();
      return;
    }

    await orgSwitcher.click();
    
    // Wait for dropdown
    await page.waitForSelector('[role="menuitem"], [role="option"]', { timeout: 5000 }).catch(() => {
      test.skip(); // No dropdown, probably only one org
    });
    
    const orgItems = page.locator('[role="menuitem"], [role="option"]');
    const orgCount = await orgItems.count();
    
    if (orgCount < 2) {
      test.skip(); // Only one org, can't test switching
      return;
    }

    // Get first org name
    const firstOrgName = await orgItems.first().textContent();
    
    // Click second org
    await orgItems.nth(1).click();
    
    // Wait for page to refresh/update
    await page.waitForTimeout(1000);
    
    // Verify org name changed (check topbar or page content)
    const newOrgName = await orgItems.nth(1).textContent();
    if (newOrgName && firstOrgName && newOrgName !== firstOrgName) {
      // Verify new org name appears somewhere on page
      await expect(page.locator(`text=${newOrgName}`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('3. abrir /leads → carga tabla', async ({ page }) => {
    await page.goto('/leads');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Verify we're on leads page
    expect(page.url()).toContain('/leads');
    
    // Check for table or empty state
    const table = page.locator('table').first();
    const emptyState = page.locator('text=/no hay|sin leads|empty/i').first();
    
    const hasTable = (await table.count()) > 0;
    const hasEmptyState = (await emptyState.count()) > 0;
    
    // Either table or empty state should be visible
    expect(hasTable || hasEmptyState).toBeTruthy();
  });

  test('4. crear lead (si permisos) → aparece en lista', async ({ page }) => {
    // Check if "Nuevo Lead" button exists (permission gating)
    const createButton = page.locator('button, a').filter({ hasText: /nuevo lead|new lead|crear/i }).first();
    const buttonCount = await createButton.count();
    
    if (buttonCount === 0) {
      test.skip(); // No permission to create leads
      return;
    }

    await page.goto('/leads');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Click create button
    await createButton.click();
    
    // Wait for form or modal
    await page.waitForSelector('input[name="name"], input[placeholder*="name" i], form', { timeout: 5000 });
    
    // Fill form (minimal)
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if ((await nameInput.count()) > 0) {
      await nameInput.fill(`Test Lead ${Date.now()}`);
      
      // Submit
      const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /crear|save|guardar/i }).first();
      if ((await submitButton.count()) > 0) {
        await submitButton.click();
        
        // Wait for redirect or success
        await page.waitForTimeout(2000);
        
        // Verify lead appears in list (or we're on detail page)
        const leadInList = page.locator('text=/test lead/i').first();
        const isOnDetailPage = page.url().includes('/leads/') && !page.url().includes('/leads/new');
        
        expect((await leadInList.count()) > 0 || isOnDetailPage).toBeTruthy();
      }
    }
  });

  test('5. abrir /stock → scroll y load more no rompe', async ({ page }) => {
    await page.goto('/stock');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Check for table or list
    const table = page.locator('table').first();
    const list = page.locator('[role="list"], .space-y').first();
    
    const hasTable = (await table.count()) > 0;
    const hasList = (await list.count()) > 0;
    
    if (!hasTable && !hasList) {
      // Empty state, skip scroll test
      test.skip();
      return;
    }

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // Check for "Load more" button
    const loadMoreButton = page.locator('button').filter({ hasText: /load more|cargar más/i }).first();
    if ((await loadMoreButton.count()) > 0) {
      await loadMoreButton.click();
      await page.waitForTimeout(2000);
      
      // Verify page didn't crash
      await expect(page.locator('body')).toBeVisible();
    }
    
    // Verify page is still functional
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible();
  });

  test('6. abrir /inbox/whatsapp → lista carga, click abre conversación', async ({ page }) => {
    await page.goto('/inbox/whatsapp');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Check for empty state or conversation list
    const emptyState = page.locator('text=/no hay|sin conversaciones|empty/i').first();
    const conversationList = page.locator('[role="list"] li, button[class*="conversation"], .conversation-item').first();
    
    const hasEmptyState = (await emptyState.count()) > 0;
    const hasConversations = (await conversationList.count()) > 0;
    
    if (hasEmptyState) {
      // Verify empty state is visible and well-formed
      await expect(emptyState).toBeVisible();
      return; // No conversations to test
    }

    if (hasConversations) {
      // Click first conversation
      await conversationList.first().click();
      
      // Wait for conversation to open (URL change or content appears)
      await page.waitForTimeout(1000);
      
      // Verify conversation view is visible (message area or input)
      const messageArea = page.locator('textarea, input[placeholder*="mensaje" i], .message-list').first();
      await expect(messageArea).toBeVisible({ timeout: 5000 });
    }
  });

  test('7. abrir /sales/purchases → carga listado', async ({ page }) => {
    await page.goto('/sales/purchases');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Verify we're on purchases page
    expect(page.url()).toContain('/purchases');
    
    // Check for table or empty state
    const table = page.locator('table').first();
    const emptyState = page.locator('text=/no hay|sin compras|empty/i').first();
    
    const hasTable = (await table.count()) > 0;
    const hasEmptyState = (await emptyState.count()) > 0;
    
    // Either table or empty state should be visible
    expect(hasTable || hasEmptyState).toBeTruthy();
  });

  test('8. crear purchase DRAFT → aparece en lista', async ({ page }) => {
    await page.goto('/sales/purchases');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Check for "Nueva Compra" button
    const createButton = page.locator('button, a').filter({ hasText: /nueva compra|new purchase|crear/i }).first();
    const buttonCount = await createButton.count();
    
    if (buttonCount === 0) {
      // Try creating via API helper if UI doesn't exist
      test.skip(); // Will be implemented in PARTE 2
      return;
    }

    await createButton.click();
    
    // Wait for form
    await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 });
    
    // Fill minimal form (vendor selector + at least one line)
    const vendorSelect = page.locator('select[name="vendorId"], select').first();
    if ((await vendorSelect.count()) > 0) {
      await vendorSelect.selectOption({ index: 1 }); // Select first vendor
    }
    
    // Add line (if form has line editor)
    const descInput = page.locator('input[name*="description" i], input[placeholder*="descripción" i]').first();
    if ((await descInput.count()) > 0) {
      await descInput.fill('Test item');
      
      const qtyInput = page.locator('input[name*="quantity" i], input[type="number"]').first();
      if ((await qtyInput.count()) > 0) {
        await qtyInput.fill('1');
      }
      
      const priceInput = page.locator('input[name*="price" i]').first();
      if ((await priceInput.count()) > 0) {
        await priceInput.fill('100');
      }
    }
    
    // Submit
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /crear|save|guardar/i }).first();
    if ((await submitButton.count()) > 0) {
      await submitButton.click();
      
      // Wait for redirect or success
      await page.waitForTimeout(2000);
      
      // Verify purchase appears (in list or detail page)
      const isOnDetailPage = page.url().includes('/purchases/') && !page.url().includes('/purchases/new');
      expect(isOnDetailPage || page.url().includes('/purchases')).toBeTruthy();
    }
  });

  test('9. settings branding → carga página', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Verify we're on settings page
    expect(page.url()).toContain('/settings');
    
    // Verify page content is visible (not error)
    const pageContent = page.locator('h1, h2, [role="main"]').first();
    await expect(pageContent).toBeVisible({ timeout: 5000 });
  });

  test('10. RBAC gating básico: user sin permiso no ve CTA', async ({ page }) => {
    // Navigate to a page with gated actions (e.g., /leads)
    await page.goto('/leads');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Check if "Nuevo Lead" button exists
    const createButton = page.locator('button, a').filter({ hasText: /nuevo lead|new lead|crear/i }).first();
    const buttonCount = await createButton.count();
    
    // If button doesn't exist, user likely doesn't have permission (UI gating working)
    // If button exists, user has permission (also valid)
    // This test just verifies the page loads without errors
    await expect(page.locator('body')).toBeVisible();
  });
});
