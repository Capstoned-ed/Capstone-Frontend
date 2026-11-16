import { test, expect } from '@playwright/test';
import { credentials, loginAs, apiBaseUrl } from './helpers';

test.describe('Incognito & Clean Storage Dashboard Verification', () => {
  test.beforeEach(async () => {
    test.setTimeout(90000);
  });
  test('Staff dashboard loads live backend data in a fresh incognito context', async ({ browser }) => {
    // 1. Create a fresh, isolated incognito browser context (zero localStorage/cookies)
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

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

    await context.close();
  });

  test('Admin dashboard loads status distribution and staff directory in fresh incognito context', async ({ browser }) => {
    // 1. Create a fresh, isolated incognito browser context
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

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

    await context.close();
  });
});
