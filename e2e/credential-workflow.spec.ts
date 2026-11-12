import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('End-to-End Credential Workflow Lifecycle', () => {
  test('Student submits new request, Staff reviews in queue, Student verifies status', async ({ page }) => {
    // -------------------------------------------------------------------------
    // Phase 1: Student submits a new credential request
    // -------------------------------------------------------------------------
    await loginAs(page, 'student');
    await page.goto('/student/new-request');
    await page.waitForLoadState('domcontentloaded');

    // Confirm form header is rendered
    await expect(page.locator('body')).toContainText(/Request Document|Part 1|Student Request/i);

    // Step 1: Ensure "Yes" (Cleared) is selected
    const clearedYesRadio = page.locator('input[name="isCleared"][value="yes"], input[name="isCleared"]').first();
    if (await clearedYesRadio.isVisible()) {
      await clearedYesRadio.check({ force: true });
    }

    // Attach clearance document
    const clearanceFileInput = page.locator('#ustp-clearance-section input[type="file"], input[type="file"]').first();
    await clearanceFileInput.setInputFiles({
      name: 'sample_clearance.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    // Part 2: Select the first available document type checkbox
    const docOption = page.locator('#ustp-part-2-section input[type="checkbox"], .ustp-doc-col input[type="checkbox"]').first();
    await expect(docOption).toBeVisible({ timeout: 10000 });
    await docOption.check({ force: true });

    // Proceed to Step 2 (Review)
    const nextStepBtn = page.getByRole('button', { name: /Next Step/i }).first();
    await nextStepBtn.click();

    // Verify Review step
    await expect(page.locator('body')).toContainText(/Review Data/i, { timeout: 15000 });

    // Step 2: Submit final request
    const finalSubmitBtn = page.getByRole('button', { name: /Next Step|Submit/i }).last();
    await finalSubmitBtn.click();

    // Step 3: Verify confirmation screen
    await expect(page.locator('.complete-card, body')).toContainText(/Request Submitted!|successfully submitted/i, {
      timeout: 25000,
    });

    // -------------------------------------------------------------------------
    // Phase 2: Staff reviews incoming requests queue
    // -------------------------------------------------------------------------
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await loginAs(page, 'staff');

    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // Table should render with request rows
    await expect(page.locator('.staff-data-table, table')).toBeVisible({ timeout: 20000 });

    // Click "View" on the latest row to open ProcessRequestModal
    const viewButtons = page.locator('.staff-btn-view, button:has-text("View")');
    if ((await viewButtons.count()) > 0) {
      await viewButtons.first().click();

      // Verify ProcessRequestModal opens
      const modal = page.locator('.process-modal, [class*="modal"], form');
      await expect(modal.first()).toBeVisible({ timeout: 15000 });
      await expect(page.locator('body')).toContainText(/Request Details|Update Status|Workflow/i);

      // Close modal
      const closeBtn = page.locator('.modal-close-btn, button:has-text("Close"), button:has-text("Cancel")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }

    // -------------------------------------------------------------------------
    // Phase 3: Student verifies tracking dashboard
    // -------------------------------------------------------------------------
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await loginAs(page, 'student');

    await page.goto('/student/requests');
    await page.waitForLoadState('domcontentloaded');

    // Verify tracking page renders requests cleanly
    await expect(page.locator('body')).toContainText(/Track|Requests|Pending|Status/i, { timeout: 15000 });
  });
});

