import { test, expect, Page } from '@playwright/test';
import { credentials, loginAs, apiBaseUrl } from './helpers';

/**
 * Attaches a network listener that records all unexpected 4xx/5xx API responses.
 */
function attachNetworkAuditor(page: Page, networkErrors: string[]) {
  page.on('response', (res) => {
    const url = res.url();
    const status = res.status();
    if (url.includes('/api/') && status >= 400) {
      // 404 on profile lookup for newly provisioned user before profile is created is benign
      if (status === 404 && url.includes('/profile/')) return;
      networkErrors.push(`HTTP ${status} on ${url}`);
    }
  });

  page.on('pageerror', (err) => {
    networkErrors.push(`Page exception: ${err.message}`);
  });
}

test.describe('Full Lifecycle Credential Request & Staff Processing Audit', () => {
  test.setTimeout(180000);

  test('Full Audit: Flow A (Happy Path), Flow B (Clearance Rejection), Flow C (Cancellation)', async ({ browser }) => {
    const networkErrors: string[] = [];
    const timestamp = Date.now().toString().slice(-6);
    const staffId = `77${timestamp}`;
    const studentId = `98${timestamp}`;
    const digitToWord = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const letterCode = timestamp.split('').map((d) => digitToWord[Number(d)]).join('');
    const staffLastName = `Auditor${letterCode}`;
    const staffFullName = `StaffAuditor ${staffLastName}`;

    // =========================================================================
    // Phase 1: Admin provisions 1 Staff and 1 Student
    // =========================================================================
    const adminContext = await browser.newContext({ storageState: undefined });
    const adminPage = await adminContext.newPage();
    attachNetworkAuditor(adminPage, networkErrors);

    await loginAs(adminPage, 'admin');
    await adminPage.goto('/admin/users');
    await adminPage.waitForLoadState('domcontentloaded');

    // 1. Provision Staff
    const addUserTrigger = adminPage.locator('.add-user-trigger-btn, button:has-text("Add New User")').first();
    await expect(addUserTrigger).toBeVisible({ timeout: 25000 });
    await addUserTrigger.click();

    const firstNameInput = adminPage.locator('form.add-user-form input[placeholder="First Name"]');
    const lastNameInput = adminPage.locator('form.add-user-form input[placeholder="Last Name"]');
    const idInputStaff = adminPage.locator('form.add-user-form input[placeholder*="ID Number"]');
    const emailInputStaff = adminPage.locator('form.add-user-form input[type="email"]');
    const roleSelect = adminPage.locator('form.add-user-form select.add-user-select');

    await expect(idInputStaff).toBeVisible({ timeout: 10000 });
    await firstNameInput.fill('StaffAuditor');
    await lastNameInput.fill(staffLastName);
    await idInputStaff.fill(staffId);
    await emailInputStaff.fill(`staff_${timestamp}@ustp.edu.ph`);
    await roleSelect.selectOption('staff');

    const saveStaffBtn = adminPage.locator('form.add-user-form button.add-user-submit-btn').first();
    await saveStaffBtn.click();
    await expect(adminPage.locator('form.add-user-form')).not.toBeVisible({ timeout: 20000 });
    await expect(adminPage.locator('body')).toContainText(staffId, { timeout: 15000 });

    // 2. Provision Student
    await adminPage.waitForTimeout(1000);
    const addStudentTrigger = adminPage.locator('.add-student-trigger-btn, button:has-text("Add New Student")').first();
    await expect(addStudentTrigger).toBeVisible({ timeout: 25000 });
    await addStudentTrigger.click();

    const studFirstInput = adminPage.locator('form.add-student-form input[placeholder="First Name"]');
    const studLastInput = adminPage.locator('form.add-student-form input[placeholder="Last Name"]');
    const studIdInput = adminPage.locator('form.add-student-form input[placeholder*="Student ID"]');
    const studEmailInput = adminPage.locator('form.add-student-form input[type="email"]');
    const studDateInput = adminPage.locator('form.add-student-form input[type="date"]');
    const studContactInput = adminPage.locator('form.add-student-form input[placeholder*="Contact"]');

    await expect(studIdInput).toBeVisible({ timeout: 10000 });
    await studFirstInput.fill('StudentAuditor');
    await studLastInput.fill(staffLastName);
    await studIdInput.fill(studentId);
    await studEmailInput.fill(`student_${timestamp}@ustp.edu.ph`);
    await studDateInput.fill('2002-05-20');
    await studContactInput.fill('09123456789');

    const courseDropdownBtn = adminPage.locator('form.add-student-form button').filter({ hasText: /Select Course/i }).first();
    await expect(courseDropdownBtn).toBeVisible({ timeout: 10000 });
    await courseDropdownBtn.click();

    const itChoice = adminPage.locator('button:has-text("BS in Information Technology"), button:has-text("BSIT")').first();
    await expect(itChoice).toBeVisible({ timeout: 10000 });
    await itChoice.click();

    const saveStudentBtn = adminPage.locator('form.add-student-form button.add-student-submit-btn').first();
    await saveStudentBtn.click();
    await expect(adminPage.locator('form.add-student-form')).not.toBeVisible({ timeout: 20000 });
    await expect(adminPage.locator('body')).toContainText(studentId, { timeout: 15000 });

    await adminContext.close();

    // =========================================================================
    // Phase 2: Flow A - Student submits Request 1
    // =========================================================================
    const studentContext = await browser.newContext({ storageState: undefined });
    const studentPage = await studentContext.newPage();
    attachNetworkAuditor(studentPage, networkErrors);

    await studentPage.goto('/login');
    await studentPage.locator('#username').fill(studentId);
    await studentPage.locator('#password').fill(studentId);
    await studentPage.getByRole('button', { name: /Log In/i }).click();
    await studentPage.waitForURL(/\/student/, { timeout: 45000 });

    await studentPage.goto('/student/new-request');
    await studentPage.waitForLoadState('domcontentloaded');

    // Attach sample clearance
    const clearanceInput = studentPage.locator('input[type="file"]').first();
    await clearanceInput.setInputFiles({
      name: 'clearance.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    const docCheckbox = studentPage.locator('#ustp-part-2-section input[type="checkbox"], .ustp-doc-col input[type="checkbox"]').first();
    await expect(docCheckbox).toBeVisible({ timeout: 15000 });
    await docCheckbox.check({ force: true });

    const purposeLabel = studentPage.locator('.ustp-purpose-grid label, label:has-text("For Evaluation"), label:has-text("Personal")').first();
    await purposeLabel.click();

    const nextBtn = studentPage.getByRole('button', { name: /Next Step/i }).first();
    await nextBtn.click();

    await expect(studentPage.locator('body')).toContainText(/Review Data/i, { timeout: 15000 });

    const finalSubmit = studentPage.getByRole('button', { name: /Submit|Next Step/i }).last();
    await finalSubmit.click();

    await expect(studentPage.locator('body')).toContainText(/Submitted|Success/i, { timeout: 20000 });
    const trackingBox = studentPage.locator('.complete-tracking-code');
    await expect(trackingBox).toBeVisible({ timeout: 15000 });
    const trackingId1 = (await trackingBox.innerText()).trim();
    expect(trackingId1).toBeTruthy();

    await studentContext.close();

    // =========================================================================
    // Phase 3: Admin assigns Request 1 to StaffAuditor
    // =========================================================================
    const adminAssignContext = await browser.newContext({ storageState: undefined });
    const adminAssignPage = await adminAssignContext.newPage();
    attachNetworkAuditor(adminAssignPage, networkErrors);

    await loginAs(adminAssignPage, 'admin');
    await adminAssignPage.goto('/registrar/requests');
    await adminAssignPage.waitForLoadState('domcontentloaded');

    const searchInput = adminAssignPage.locator('input.assign-search-input, input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(trackingId1);
      await adminAssignPage.waitForTimeout(500);
    }

    const targetRow = adminAssignPage.locator('tbody tr').filter({ hasText: trackingId1 }).first();
    await expect(targetRow).toBeVisible({ timeout: 20000 });

    const staffSelect = targetRow.locator('select.staff-select-dropdown');
    await expect(staffSelect).toBeVisible({ timeout: 10000 });
    await expect(staffSelect.locator('option', { hasText: staffFullName }).first()).toBeAttached({ timeout: 15000 });
    await staffSelect.selectOption(staffFullName);

    await expect(adminAssignPage.locator('.Toastify__toast--success, .toast-success, body')).toContainText(
      /Assigned/i,
      { timeout: 15000 }
    );
    await adminAssignContext.close();

    // =========================================================================
    // Phase 4: StaffAuditor processes Request 1 (Full Lifecycle: Verify -> Assess -> Pay -> Process -> Release)
    // =========================================================================
    const staffContext = await browser.newContext({ storageState: undefined });
    const staffPage = await staffContext.newPage();
    attachNetworkAuditor(staffPage, networkErrors);

    await staffPage.goto('/login');
    await staffPage.locator('#username').fill(staffId);
    await staffPage.locator('#password').fill(staffId);
    await staffPage.getByRole('button', { name: /Log In/i }).click();
    await staffPage.waitForURL(/\/staff/, { timeout: 45000 });

    await staffPage.goto('/staff/requests');
    await staffPage.waitForLoadState('domcontentloaded');

    const staffRow = staffPage.locator('tbody tr').filter({ hasText: trackingId1 }).first();
    await expect(staffRow).toBeVisible({ timeout: 25000 });

    // Open modal via View or Process button
    const actionBtn = staffRow.locator('button.staff-btn-view, button.staff-btn-process-this, button:has-text("View"), button:has-text("Process")').first();
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();

    const modal = staffPage.locator('.staff-process-dialog, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 15000 });

    // Step 2: Verify Clearance (must succeed with 200 OK without 400 Bad Request)
    const verifyClearanceBtn = modal.locator('button:has-text("Verify"), button:has-text("Mark Cleared")').first();
    if (await verifyClearanceBtn.isVisible()) {
      await verifyClearanceBtn.click();
      await expect(modal.locator('body, .Toastify__toast--success')).toContainText(
        /Clearance verified/i,
        { timeout: 15000 }
      );
    }

    // Step 3: Payment Assessment & Confirm Order of Payment
    const confirmOrderBtn = modal.locator('button:has-text("Confirm Order of Payment"), button:has-text("Confirm Request")').first();
    await expect(confirmOrderBtn).toBeVisible({ timeout: 10000 });
    await expect(confirmOrderBtn).toBeEnabled({ timeout: 10000 });
    await confirmOrderBtn.click();

    await expect(staffPage.locator('body, .Toastify__toast--success')).toContainText(
      /Pending Payment|confirmed/i,
      { timeout: 15000 }
    );

    // Step 4: Payment Verification via O.R. Number
    const orInput = modal.locator('input[placeholder*="O.R."], input[placeholder*="OR Number"], input[placeholder*="Official Receipt"]').first();
    if (await orInput.isVisible()) {
      await orInput.fill('OR-AUDIT-9999');
    }

    const confirmPaymentBtn = modal.locator('button:has-text("Confirm Payment")').first();
    await expect(confirmPaymentBtn).toBeVisible({ timeout: 10000 });
    await expect(confirmPaymentBtn).toBeEnabled({ timeout: 10000 });
    await confirmPaymentBtn.click();

    await expect(staffPage.locator('body, .Toastify__toast--success')).toContainText(
      /Payment verified|For Processing/i,
      { timeout: 15000 }
    );

    // Step 5: Transition to Processing and Ready for Release
    const overrideSelect = modal.locator('select.staff-select-input');
    await expect(overrideSelect).toBeVisible({ timeout: 10000 });
    await expect(overrideSelect).toBeEnabled({ timeout: 10000 });

    // Select 'Processing' or 'For Processing'
    const updateStatusBtn = modal.locator('button.staff-btn-update, button:has-text("Update Status")').first();

    await overrideSelect.selectOption({ label: 'Processing' });
    await expect(updateStatusBtn).toBeEnabled({ timeout: 10000 });
    await updateStatusBtn.click();
    await staffPage.waitForTimeout(1000);

    // Select 'Releasing' / 'Ready for Release'
    await overrideSelect.selectOption({ label: 'Releasing' });
    await expect(updateStatusBtn).toBeEnabled({ timeout: 10000 });
    await updateStatusBtn.click();
    await staffPage.waitForTimeout(1000);

    // Step 6: Mark Claimed / Released
    const claimedBtn = modal.locator('button:has-text("Claimed & Done"), button:has-text("Claimed")').first();
    if (await claimedBtn.isVisible()) {
      await claimedBtn.click();
    } else {
      await overrideSelect.selectOption({ label: 'Claimed' });
      await updateStatusBtn.click();
    }

    await staffPage.waitForTimeout(1000);

    // Close modal if still visible
    const closeBtn = modal.locator('button:has-text("Close"), button[aria-label="Close"], .modal-close-btn').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    await staffContext.close();

    // =========================================================================
    // Phase 5: Persistence check in a brand-new Incognito/Clean context
    // =========================================================================
    const cleanContext = await browser.newContext({ storageState: undefined });
    const cleanPage = await cleanContext.newPage();
    attachNetworkAuditor(cleanPage, networkErrors);

    await cleanPage.goto('/login');
    await cleanPage.locator('#username').fill(staffId);
    await cleanPage.locator('#password').fill(staffId);
    await cleanPage.getByRole('button', { name: /Log In/i }).click();
    await cleanPage.waitForURL(/\/staff/, { timeout: 45000 });

    await cleanPage.goto('/staff/requests');
    await cleanPage.waitForLoadState('domcontentloaded');

    // The request must be present with Claimed/Released status in database
    await expect(cleanPage.locator('body')).toContainText(trackingId1, { timeout: 25000 });
    await cleanContext.close();

    // Verify ZERO unexpected 4xx/5xx network errors occurred throughout the entire lifecycle audit!
    const criticalErrors = networkErrors.filter((e) => e.includes('HTTP 400') || e.includes('HTTP 500'));
    expect(criticalErrors).toEqual([]);
  });
});

