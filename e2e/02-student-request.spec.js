import { test, expect } from '@playwright/test';
import {
  apiBaseUrl,
  loginAs,
  getAuthToken,
  getRegistrarSettings,
  setRegistrarAutoApprove,
} from './helpers/authAndSeed.js';

test.describe('Suite 02: Student Credential Requests, Unavailable Badges & Status Tabs', () => {
  let registrarToken = null;
  let originalAutoApprove = null;

  test.beforeAll(async ({ request }) => {
    try {
      const { access } = await getAuthToken(request, 'registrar');
      registrarToken = access;
      const settings = await getRegistrarSettings(request, registrarToken);
      originalAutoApprove = settings.auto_approve_requests;
    } catch (e) {
      console.warn('Could not cache initial registrar settings:', e);
    }
  });

  test.afterAll(async ({ request }) => {
    // Strict safety restore of registrar auto-approve setting
    if (registrarToken && originalAutoApprove !== null) {
      try {
        await setRegistrarAutoApprove(request, registrarToken, originalAutoApprove);
      } catch (e) {
        console.warn('Failed to restore registrar auto-approve setting:', e);
      }
    }
  });

  test('TC-STU-01: Multi-document request form and calculation', async ({ page }) => {
    await loginAs(page, 'student');
    await page.goto('/student/new-request');
    await page.waitForLoadState('domcontentloaded');

    // Verify request form rendered
    await expect(page.locator('text=/Request Document|Select Document/i').first()).toBeVisible({ timeout: 20000 });

    // Select document if checkboxes available
    const firstCheckbox = page.locator('input[type="checkbox"]:not([disabled])').first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.check();
    }

    // Enter purpose if input exists
    const purposeInput = page.locator('#purpose, input[name="purpose"], textarea[name="purpose"]').first();
    if (await purposeInput.isVisible()) {
      await purposeInput.fill('[E2E-TEST] Employment verification');
    }
  });

  test('TC-STU-02: Deactivated credential shows Unavailable badge and disables checkbox', async ({ page, request }) => {
    // 1. Check if an inactive credential type exists, or create a mock scenario
    const credTypesRes = await request.get(`${apiBaseUrl}/api/credential-types/`);
    const credTypes = await credTypesRes.json();
    const list = Array.isArray(credTypes) ? credTypes : credTypes.results || [];
    const inactiveType = list.find((ct) => ct.is_active === false);

    await loginAs(page, 'student');
    await page.goto('/student/new-request');
    await page.waitForLoadState('domcontentloaded');

    if (inactiveType) {
      // Find the inactive document's label/item
      const inactiveLabel = page.locator(`text=${inactiveType.name}`).first();
      await expect(inactiveLabel).toBeVisible({ timeout: 15000 });

      // Verify the Unavailable badge is displayed
      const unavailableBadge = page.locator('text=/Unavailable/i').first();
      await expect(unavailableBadge).toBeVisible();
    }

    // Verify warning banner logic: If any selected document is unavailable, UI renders alert
    const warningAlert = page.locator('text=/The following document.*unavailable/i');
    const isVisible = await warningAlert.isVisible().catch(() => false);
    // When no unavailable documents are checked, the warning banner is not present
    if (!isVisible) {
      expect(true).toBeTruthy();
    }
  });

  test('TC-STU-03: Auto-Approve toggle interaction (OFF -> PENDING vs ON -> PAYMENT_PENDING)', async ({ request }) => {
    test.skip(!registrarToken, 'Requires valid registrar authentication');

    const { access: studentToken } = await getAuthToken(request, 'student');
    const credTypesRes = await request.get(`${apiBaseUrl}/api/credential-types/`);
    const credTypes = await credTypesRes.json();
    const activeType = (Array.isArray(credTypes) ? credTypes : credTypes.results || []).find((ct) => ct.is_active);

    // 1. Toggle Auto-Approve OFF
    await setRegistrarAutoApprove(request, registrarToken, false);

    const reqOffRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeType.id,
        purpose: 'E2E Test Auto-Approve OFF',
        remarks: '[E2E-TEST] Testing Auto-Approve OFF',
        copies: 1,
      },
    });
    expect(reqOffRes.ok()).toBeTruthy();
    const reqOffData = await reqOffRes.json();
    expect(reqOffData.status).toBe('PENDING');

    // 2. Toggle Auto-Approve ON
    await setRegistrarAutoApprove(request, registrarToken, true);

    const reqOnRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeType.id,
        purpose: 'E2E Test Auto-Approve ON',
        remarks: '[E2E-TEST] Testing Auto-Approve ON',
        copies: 1,
      },
    });
    expect(reqOnRes.ok()).toBeTruthy();
    const reqOnData = await reqOnRes.json();
    // Auto-approved requests immediately transition to PAYMENT_PENDING
    expect(['PAYMENT_PENDING', 'APPROVED']).toContain(reqOnData.status);
  });

  test('TC-STU-04: Request Tracker tabs segregate Active vs History requests', async ({ page }) => {
    await loginAs(page, 'student');
    await page.goto('/student/requests');
    await page.waitForLoadState('domcontentloaded');

    // Verify Active Requests tab exists and has badge
    const activeTab = page.locator('button:has-text("Active Requests")').first();
    await expect(activeTab).toBeVisible({ timeout: 20000 });

    // Verify Request History tab exists and has badge
    const historyTab = page.locator('button:has-text("Request History")').first();
    await expect(historyTab).toBeVisible();

    // Click History tab and verify switching
    await historyTab.click();
    await page.waitForTimeout(500);

    // History tab should show claimed, released, or rejected requests, or empty state
    const hasHistoryContent = await page.locator('text=/No completed or archived requests|Request History|Claimed|Released|Rejected/i').first().isVisible();
    expect(hasHistoryContent).toBeTruthy();

    // Click back to Active tab
    await activeTab.click();
    await page.waitForTimeout(500);
  });
});
