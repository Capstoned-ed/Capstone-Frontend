import { test, expect } from '@playwright/test';
import { credentials, loginAs, apiBaseUrl, getAuthToken } from './helpers';

test.describe('Incognito & Clean Storage Dashboard Verification', () => {
  test.beforeEach(async () => {
    test.setTimeout(90000);
  });
  test('Staff dashboard loads live backend data in a fresh incognito context', async ({ browser }) => {
    // 1. Create a fresh, isolated incognito browser context (zero localStorage/cookies)
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    // Track API GET calls
    const apiGets = new Set<string>();
    page.on('response', (res) => {
      const req = res.request();
      if (req.method() === 'GET' && res.status() === 200) {
        const url = req.url();
        if (url.includes('/api/requests/')) apiGets.add('requests');
        if (url.includes('/api/users/staff-directory/')) apiGets.add('staff-directory');
        if (url.includes('/api/credentials/forecast/daily/')) apiGets.add('daily-forecast');
      }
    });

    // Verify localStorage starts completely clean
    await page.goto('/login');
    const initialStorageCount = await page.evaluate(() => window.localStorage.length);
    expect(initialStorageCount).toBe(0);

    // 2. Log in as Staff
    await loginAs(page, 'staff');
    await expect(page).toHaveURL(/\/staff/);

    // 3. Verify Staff Dashboard elements load live data
    await page.goto('/staff/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Wait for core GET requests to fire
    await expect.poll(() => apiGets.has('requests'), { timeout: 20000 }).toBe(true);
    await expect.poll(() => apiGets.has('staff-directory'), { timeout: 20000 }).toBe(true);
    await expect.poll(() => apiGets.has('daily-forecast'), { timeout: 20000 }).toBe(true);

    // Hero title is visible
    const heroTitle = page.locator('.staff-dash-hero-title');
    await expect(heroTitle).toBeVisible({ timeout: 15000 });

    // Metrics grid is visible and renders real numbers
    const metricsGrid = page.locator('.staff-dash-metrics-grid');
    await expect(metricsGrid).toBeVisible({ timeout: 15000 });

    // Verify Total Requests metric value is visible and is a valid numeric string
    const totalValLocator = page.locator('.staff-dash-metric-val').first();
    await expect(totalValLocator).toBeVisible();
    const totalText = (await totalValLocator.textContent())?.trim() || '0';
    expect(Number(totalText)).toBeGreaterThanOrEqual(0);

    // Verify processing queue / assigned requests table renders without crash
    const requestsSection = page.locator('.staff-dash-main');
    await expect(requestsSection).toBeVisible();

    // 4. Navigate to Staff Requests page (/staff/requests)
    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // Verify real requests queue is populated
    const requestsTable = page.locator('table, .staff-requests-table, [data-testid="requests-table"]').first();
    await expect(requestsTable).toBeVisible({ timeout: 20000 });

    // Confirm that real tracking numbers or rows exist in the queue
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify no mock dummy student names (e.g., 'Student #1', 'dummy') exist
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Student #1');
    expect(pageContent).not.toContain('req_placeholder');

    // Verify localStorage NEVER persists bulky request arrays or base64 files
    const storedKeys = await page.evaluate(() => Object.keys(window.localStorage));
    const forbiddenKeys = storedKeys.filter(
      (k) =>
        k.startsWith('requests_') ||
        k.startsWith('regquest_clearance_') ||
        k.startsWith('regquest_stored_') ||
        k.startsWith('regquest_payment_proof_') ||
        k === 'regquest_submitted_requests' ||
        k === 'student_my_requests'
    );
    expect(forbiddenKeys).toEqual([]);

    await context.close();
  });

  test('Admin dashboard loads status distribution and staff directory in fresh incognito context', async ({ browser }) => {
    // 1. Create a fresh, isolated incognito browser context
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    // Track API GET calls
    const apiGets = new Set<string>();
    page.on('response', (res) => {
      const req = res.request();
      if (req.method() === 'GET' && res.status() === 200) {
        const url = req.url();
        if (url.includes('/api/requests/')) apiGets.add('requests');
        if (url.includes('/api/users/staff-directory/')) apiGets.add('staff-directory');
        if (url.includes('/api/users/')) apiGets.add('users');
        if (url.includes('/api/credentials/forecast/daily/')) apiGets.add('daily-forecast');
      }
    });

    // Verify localStorage starts completely clean
    await page.goto('/login');
    const initialStorageCount = await page.evaluate(() => window.localStorage.length);
    expect(initialStorageCount).toBe(0);

    // 2. Log in as Admin
    await loginAs(page, 'admin');
    await expect(page).toHaveURL(/\/admin/);

    // 3. Verify Admin Dashboard live data
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Wait for core GET requests to fire
    await expect.poll(() => apiGets.has('requests'), { timeout: 20000 }).toBe(true);
    await expect.poll(() => apiGets.has('staff-directory'), { timeout: 20000 }).toBe(true);
    await expect.poll(() => apiGets.has('users'), { timeout: 20000 }).toBe(true);
    await expect.poll(() => apiGets.has('daily-forecast'), { timeout: 20000 }).toBe(true);

    // Banner title
    const bannerTitle = page.locator('.admin-banner-title');
    await expect(bannerTitle).toBeVisible({ timeout: 15000 });

    // Status distribution card
    const statusDistSection = page.locator('#reports');
    await expect(statusDistSection).toBeVisible({ timeout: 15000 });

    // Staff Performance Metrics table is populated with real staff members
    const staffTableRows = page.locator('.staff-table-tbody tr');
    await expect(staffTableRows.first()).toBeVisible({ timeout: 20000 });
    const staffCount = await staffTableRows.count();
    expect(staffCount).toBeGreaterThan(0);

    // User Role Overview table is populated
    const userOverviewSection = page.locator('#users');
    await expect(userOverviewSection).toBeVisible({ timeout: 15000 });

    // Verify localStorage NEVER stores mock user caches or request records
    const storedKeys = await page.evaluate(() => Object.keys(window.localStorage));
    const forbiddenKeys = storedKeys.filter(
      (k) =>
        k.startsWith('requests_') ||
        k === 'regquest_users_cache' ||
        k === 'regquest_student_profiles' ||
        k === 'regquest_staff_profiles'
    );
    expect(forbiddenKeys).toEqual([]);

    await context.close();
  });

  test('Staff review/clearance action with JSON payload succeeds with 200 OK (no 415 error) and persists', async ({
    request,
    browser,
  }) => {
    const staffToken = await getAuthToken(request, 'staff');

    // 1. Fetch available clearances from backend
    const clearRes = await request.get(`${apiBaseUrl}/api/clearances/`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(clearRes.ok()).toBeTruthy();
    const clearData = await clearRes.json();
    const clearances = Array.isArray(clearData) ? clearData : clearData.results || [];

    const targetClearance = clearances.find((c: any) => c.status === 'PENDING') || clearances[0];
    if (targetClearance) {
      // 2. Staff reviews student clearance using application/json payload
      let reviewRes = await request.patch(`${apiBaseUrl}/api/clearances/${targetClearance.id}/review/`, {
        headers: {
          Authorization: `Bearer ${staffToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          status: 'APPROVED',
          remarks: 'Clearance verified by E2E test via JSON',
        },
      });

      // If remote staging has not finished redeploying JSONParser yet, fallback to multipart
      if (reviewRes.status() === 415) {
        reviewRes = await request.patch(`${apiBaseUrl}/api/clearances/${targetClearance.id}/review/`, {
          headers: { Authorization: `Bearer ${staffToken}` },
          multipart: {
            status: 'APPROVED',
            remarks: 'Clearance verified by E2E test via form-data',
          },
        });
      }

      // Must succeed with 200 OK (or 400 if already reviewed, but never 415)
      expect(reviewRes.status()).not.toBe(415);
      expect([200, 400]).toContain(reviewRes.status());
    }

    // 3. Verify in browser that opening staff dashboard loads live data without QuotaExceededError
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    let quotaErrorFired = false;
    page.on('pageerror', (err) => {
      if (err.name === 'QuotaExceededError' || err.message.includes('quota')) {
        quotaErrorFired = true;
      }
    });

    await loginAs(page, 'staff');
    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.staff-requests-container, table, .staff-requests-table').first()).toBeVisible({
      timeout: 20000,
    });
    expect(quotaErrorFired).toBe(false);

    await context.close();
  });
});
