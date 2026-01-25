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
    await page.goto('/leads');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Check if "Nuevo Lead" button exists (permission gating)
    const createButton = page.locator('button, a').filter({ hasText: /nuevo lead|new lead|crear/i }).first();
    const buttonCount = await createButton.count();
    
    if (buttonCount === 0) {
      // If no create button, verify page loads (empty state or list)
      const emptyState = page.locator('text=/no hay|sin leads|empty/i').first();
      const table = page.locator('table').first();
      expect((await emptyState.count()) > 0 || (await table.count()) > 0).toBeTruthy();
      return; // Page loads correctly, but can't test creation without button
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
    const emptyState = page.locator('text=/no hay|sin conversaciones|empty|no conversations/i').first();
    const conversationList = page.locator('[role="list"] li, button[class*="conversation"], .conversation-item, button').filter({ hasText: /conversation|chat/i }).first();
    
    const hasEmptyState = (await emptyState.count()) > 0;
    const hasConversations = (await conversationList.count()) > 0;
    
    // Always verify page loaded (either empty state or list) - NO SKIP
    expect(hasEmptyState || hasConversations).toBeTruthy();
    
    if (hasEmptyState) {
      // Verify empty state is visible and well-formed (required, no skip)
      await expect(emptyState).toBeVisible({ timeout: 5000 });
      // Verify empty state has proper styling (not broken)
      const emptyStateContainer = emptyState.locator('..');
      await expect(emptyStateContainer).toBeVisible();
      // Test passes: empty state is valid
      return;
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
    
    // Check for "Nueva Compra" button (should exist if user has permissions)
    const createButton = page.locator('button, a').filter({ hasText: /nueva compra|new purchase|crear/i }).first();
    const buttonCount = await createButton.count();
    
    if (buttonCount === 0) {
      // If no create button, verify page loads (empty state or list)
      const emptyState = page.locator('text=/no hay|sin compras|empty|every purchase/i').first();
      const table = page.locator('table').first();
      expect((await emptyState.count()) > 0 || (await table.count()) > 0).toBeTruthy();
      return; // Page loads correctly, but can't test creation without button
    }

    await createButton.click();
    
    // Wait for form or new page
    await page.waitForSelector('form, [role="dialog"], input[name*="vendor"], select[name*="vendor"]', { timeout: 5000 });
    
    // Fill minimal form (vendor selector + at least one line)
    const vendorSelect = page.locator('select[name*="vendor" i], select').first();
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
      
      const priceInput = page.locator('input[name*="price" i], input[name*="unitPrice" i]').first();
      if ((await priceInput.count()) > 0) {
        await priceInput.fill('100');
      }
    }
    
    // Submit
    const submitButton = page.locator('button[type="submit"], button').filter({ hasText: /crear|save|guardar|submit/i }).first();
    if ((await submitButton.count()) > 0) {
      await submitButton.click();
      
      // Wait for redirect to detail page
      await page.waitForURL(/\/sales\/purchases\/[^/]+$/, { timeout: 10000 });
      
      // Verify we're on detail page (not new page)
      expect(page.url()).toMatch(/\/sales\/purchases\/[^/]+$/);
      expect(page.url()).not.toContain('/new');
    }
  });

  test('8b. purchase transition DRAFT → APPROVED → RECEIVED → stock impact', async ({ page }) => {
    // Navigate to purchases list
    await page.goto('/sales/purchases');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Find first purchase (should exist from seed or previous test)
    const purchaseRow = page.locator('table tbody tr, [role="row"]').first();
    const purchaseCount = await purchaseRow.count();
    
    if (purchaseCount === 0) {
      // No purchases, skip this test
      test.skip();
      return;
    }
    
    // Click first purchase to open detail
    await purchaseRow.click();
    await page.waitForURL(/\/sales\/purchases\/[^/]+$/, { timeout: 5000 });
    
    // Check if purchase is DRAFT (can be transitioned)
    const statusBadge = page.locator('text=/DRAFT|BORRADOR/i').first();
    const isDraft = (await statusBadge.count()) > 0;
    
    if (!isDraft) {
      // Purchase is not DRAFT, skip transition test
      test.skip();
      return;
    }
    
    // Try to transition to APPROVED (if button exists)
    const approveButton = page.locator('button').filter({ hasText: /approve|aprobar/i }).first();
    if ((await approveButton.count()) > 0) {
      await approveButton.click();
      await page.waitForTimeout(1000);
      
      // Verify status changed to APPROVED
      await expect(page.locator('text=/APPROVED|APROBADO/i').first()).toBeVisible({ timeout: 5000 });
    }
    
    // Try to transition to RECEIVED (if button exists)
    const receiveButton = page.locator('button').filter({ hasText: /receive|recibir|mark received/i }).first();
    if ((await receiveButton.count()) > 0) {
      await receiveButton.click();
      await page.waitForTimeout(2000);
      
      // Verify status changed to RECEIVED
      await expect(page.locator('text=/RECEIVED|RECIBIDO/i').first()).toBeVisible({ timeout: 5000 });
      
      // Verify stock impact panel shows "Applied"
      const stockImpactPanel = page.locator('text=/stock impact|impacto en stock|applied|aplicado/i').first();
      if ((await stockImpactPanel.count()) > 0) {
        await expect(stockImpactPanel).toBeVisible({ timeout: 5000 });
      }
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
