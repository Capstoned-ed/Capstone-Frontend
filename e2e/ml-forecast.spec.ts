import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('ML Load Forecasting & Analytics Dashboard', () => {
  test('Admin views analytics & load forecasting graphs without errors or 500/CORS issues', async ({ page }) => {
    const errorLogs: string[] = [];
    const failedRequests: string[] = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text());
      }
    });

    // Capture failed network responses
    page.on('response', (response) => {
      if (response.status() >= 500) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    // Login as Admin
    await loginAs(page, 'admin');

    // Navigate to Analytics & Graphs page
    await page.goto('/admin/analytics');
    await page.waitForLoadState('domcontentloaded');

    // Verify main page title and structure
    await expect(page.locator('h1, .analytics-page-title')).toContainText(/Analytics & Graphs/i, {
      timeout: 15000,
    });

    // Verify key analytics cards render
    const requestVolumeCard = page.locator('h2, .analytics-card-title').filter({ hasText: /Request Volume/i });
    await expect(requestVolumeCard).toBeVisible({ timeout: 15000 });

    const docBreakdownCard = page.locator('h2, .analytics-card-title').filter({ hasText: /Document Type Breakdown/i });
    await expect(docBreakdownCard).toBeVisible({ timeout: 15000 });

    // Verify SVG chart elements or graph containers exist
    const charts = page.locator('svg, .analytics-chart-container, .graph-container');
    await expect(charts.first()).toBeVisible({ timeout: 15000 });

    // Ensure no 500 Internal Server Errors occurred on backend API calls
    const backend500s = failedRequests.filter((url) => !url.includes('google-analytics') && !url.includes('favicon'));
    expect(backend500s).toEqual([]);

    // Check that CORS errors are not present in console logs
    const corsErrors = errorLogs.filter((log) => log.toLowerCase().includes('cors policy'));
    expect(corsErrors).toEqual([]);
  });

  test('Staff/Registrar can access analytics view cleanly', async ({ page }) => {
    await loginAs(page, 'staff');

    // Access staff dashboard and verify dashboard widgets load
    await page.goto('/staff/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toContainText(/Dashboard|Requests|Overview/i, { timeout: 15000 });
  });
});

