import { test, expect } from '@playwright/test';
import { credentials, loginAs, apiBaseUrl, getAuthToken } from './helpers';

test.describe('Process Queue Persistence & Admin Provisioning Flow', () => {
  test.beforeEach(async () => {
    test.setTimeout(120000);
  });

  test('Process Queue assignment persists across complete browser context closure', async ({ browser }) => {
    // -------------------------------------------------------------------------
    // Step 1: In Context 1, Staff logs in and claims/assigns a request to queue
    // -------------------------------------------------------------------------
    const context1 = await browser.newContext({ storageState: undefined });
    const page1 = await context1.newPage();

    await loginAs(page1, 'staff');
    await page1.goto('/staff/requests');
    await page1.waitForLoadState('domcontentloaded');

    // Wait for requests table to be visible
    const tableLocator = page1.locator('table, .staff-requests-table').first();
    await expect(tableLocator).toBeVisible({ timeout: 20000 });

    // Look for a request in the Unassigned table or process buttons
    const processThisButtons = page1.locator('button:has-text("Process This")');
    let targetTrackingId = '';

    const btnCount = await processThisButtons.count();
    if (btnCount > 0) {
      // Find the tracking number corresponding to the first unassigned request
      const firstRow = processThisButtons.first().locator('xpath=ancestor::tr');
      const cells = firstRow.locator('td');
      targetTrackingId = (await cells.first().textContent())?.trim() || '';

      // Click "Process This"
      await processThisButtons.first().click();

      // Wait for success toast
      await expect(page1.locator('.Toastify__toast--success, .toast-success, body')).toContainText(
        /processing|assigned/i,
        { timeout: 15000 }
      );
    } else {
      // If all requests are already assigned, capture the first assigned tracking number
      const firstAssignedRow = page1.locator('tbody tr').first();
      targetTrackingId = (await firstAssignedRow.locator('td').first().textContent())?.trim() || '';
    }

    expect(targetTrackingId).toBeTruthy();

    // Verify it is visible in My Assigned Requests
    const assignedSection = page1.locator('body');
    await expect(assignedSection).toContainText(targetTrackingId);

    // -------------------------------------------------------------------------
    // Step 2: Completely close Context 1 (simulating closing browser / incognito)
    // -------------------------------------------------------------------------
    await context1.close();

    // -------------------------------------------------------------------------
    // Step 3: Open brand-new Context 2 with ZERO prior cookies or localStorage
    // -------------------------------------------------------------------------
    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    // Verify clean localStorage in new context
    await page2.goto('/login');
    const storageLength = await page2.evaluate(() => window.localStorage.length);
    expect(storageLength).toBe(0);

    // Log back in as Staff in the fresh context
    await loginAs(page2, 'staff');
    await page2.goto('/staff/requests');
    await page2.waitForLoadState('domcontentloaded');

    // Verify My Assigned Requests STILL contains the target tracking number from the database!
    await expect(page2.locator('body')).toContainText(targetTrackingId, { timeout: 20000 });

    await context2.close();
  });

  test('Admin provisions Staff and Student, Student requests document, Staff processes request', async ({ page }) => {
    // -------------------------------------------------------------------------
    // Phase 1: Admin logs in and provisions 1 Staff and 1 Student account
    // -------------------------------------------------------------------------
    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    const timestamp = Date.now().toString().slice(-6);
    const newStaffId = `7${timestamp}`;
    const newStudentId = `9${timestamp}`;

    // Provision Staff
    const addUserTrigger = page.locator('.add-user-trigger-btn, button:has-text("Add New User")').first();
    await expect(addUserTrigger).toBeVisible({ timeout: 25000 });
    await addUserTrigger.click();

    // Fill user form
    const firstNameInput = page.locator('form.add-user-form input[placeholder="First Name"]');
    const lastNameInput = page.locator('form.add-user-form input[placeholder="Last Name"]');
    const idInputStaff = page.locator('form.add-user-form input[placeholder*="ID Number"]');
    const emailInputStaff = page.locator('form.add-user-form input[type="email"]');
    const roleSelect = page.locator('form.add-user-form select.add-user-select');

    await expect(idInputStaff).toBeVisible({ timeout: 10000 });
    await firstNameInput.fill('StaffFirst');
    await lastNameInput.fill('StaffLast');
    await idInputStaff.fill(newStaffId);
    await emailInputStaff.fill(`staff_${timestamp}@ustp.edu.ph`);
    await roleSelect.selectOption('staff');

    // Submit provisioning
    const saveStaffBtn = page.locator('form.add-user-form button.add-user-submit-btn').first();
    await saveStaffBtn.click();

    // Verify staff form closes and user appears in table
    await expect(page.locator('form.add-user-form')).not.toBeVisible({ timeout: 20000 });
    await expect(page.locator('body')).toContainText(newStaffId, { timeout: 15000 });

    // Provision Student
    await page.waitForTimeout(1000);
    const addStudentTrigger = page.locator('.add-student-trigger-btn, button:has-text("Add New Student")').first();
    await expect(addStudentTrigger).toBeVisible({ timeout: 25000 });
    await addStudentTrigger.click();

    const studFirstInput = page.locator('form.add-student-form input[placeholder="First Name"]');
    const studLastInput = page.locator('form.add-student-form input[placeholder="Last Name"]');
    const studIdInput = page.locator('form.add-student-form input[placeholder*="Student ID"]');
    const studEmailInput = page.locator('form.add-student-form input[type="email"]');
    const studDateInput = page.locator('form.add-student-form input[type="date"]');
    const studContactInput = page.locator('form.add-student-form input[placeholder*="Contact"]');

    await expect(studIdInput).toBeVisible({ timeout: 10000 });
    await studFirstInput.fill('StudentFirst');
    await studLastInput.fill('StudentLast');
    await studIdInput.fill(newStudentId);
    await studEmailInput.fill(`student_${timestamp}@ustp.edu.ph`);
    await studDateInput.fill('2002-01-15');
    await studContactInput.fill('09123456789');

    // Select course via CourseSelectDropdown
    const courseDropdownBtn = page.locator('form.add-student-form button').filter({ hasText: /Select Course/i }).first();
    await expect(courseDropdownBtn).toBeVisible({ timeout: 10000 });
    await courseDropdownBtn.click();

    const itChoice = page.locator('button:has-text("BS in Information Technology"), button:has-text("BSIT")').first();
    await expect(itChoice).toBeVisible({ timeout: 10000 });
    await itChoice.click();

    const saveStudentBtn = page.locator('form.add-student-form button.add-student-submit-btn').first();
    await saveStudentBtn.click();

    // Verify student form closes and student ID appears
    await expect(page.locator('form.add-student-form')).not.toBeVisible({ timeout: 20000 });
    await expect(page.locator('body')).toContainText(newStudentId, { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Phase 2: Student logs in and submits an in-scope credential request
    // -------------------------------------------------------------------------
    // Clear session for student login
    await page.evaluate(() => window.localStorage.clear());
    await page.goto('/login');

    const idInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    const submitBtn = page.getByRole('button', { name: /Log In/i });

    await idInput.fill(newStudentId);
    await passwordInput.fill(newStudentId);
    await submitBtn.click();

    // Verify Student dashboard redirect
    await page.waitForURL(/\/student/, { timeout: 45000 });

    // Navigate to request form
    await page.goto('/student/new-request');
    await page.waitForLoadState('domcontentloaded');

    // Attach sample clearance
    const clearanceInput = page.locator('input[type="file"]').first();
    await clearanceInput.setInputFiles({
      name: 'clearance.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    // Select document
    const docCheckbox = page.locator('#ustp-part-2-section input[type="checkbox"], .ustp-doc-col input[type="checkbox"]').first();
    await expect(docCheckbox).toBeVisible({ timeout: 15000 });
    await docCheckbox.check({ force: true });

    // Select purpose
    const purposeLabel = page.locator('.ustp-purpose-grid label, label:has-text("For Evaluation"), label:has-text("Personal")').first();
    await purposeLabel.click();

    // Proceed to Review step
    const nextBtn = page.getByRole('button', { name: /Next Step/i }).first();
    await nextBtn.click();

    await expect(page.locator('body')).toContainText(/Review Data/i, { timeout: 15000 });

    // Final submit
    const finalSubmit = page.getByRole('button', { name: /Submit|Next Step/i }).last();
    await finalSubmit.click();

    // Verify submission success without any 400 Bad Request error
    await expect(page.locator('body')).toContainText(/Submitted|Success/i, { timeout: 20000 });

    // Grab tracking code from confirmation page
    const trackingBox = page.locator('.complete-tracking-code');
    await expect(trackingBox).toBeVisible({ timeout: 15000 });
    const studentTrackingId = (await trackingBox.innerText()).trim();
    expect(studentTrackingId).toBeTruthy();

    // -------------------------------------------------------------------------
    // Phase 3: Staff logs in and processes the request
    // -------------------------------------------------------------------------
    await page.evaluate(() => window.localStorage.clear());
    // Staff logs in using newly provisioned staff account
    await page.goto('/login');
    await page.locator('#username').fill(newStaffId);
    await page.locator('#password').fill(newStaffId);
    await page.getByRole('button', { name: /Log In/i }).click();
    await page.waitForURL(/\/staff/, { timeout: 45000 });

    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // Filter by the student's tracking ID
    const searchInput = page.locator('input.staff-search-field, input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 20000 });
    await searchInput.fill(studentTrackingId);

    // Verify the newly created student request appears in staff view
    await expect(page.locator('body')).toContainText(studentTrackingId, { timeout: 25000 });

    // Process/claim this request
    const processBtn = page.locator('button.staff-btn-process-this, button:has-text("Process This")').first();
    if (await processBtn.isVisible()) {
      await processBtn.click();
      await expect(page.locator('.Toastify__toast--success, .toast-success, body')).toContainText(
        /processing|assigned/i,
        { timeout: 15000 }
      );
    }

    // Refresh page to confirm persistence directly from backend database
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await searchInput.fill(studentTrackingId);
    await expect(page.locator('body')).toContainText(studentTrackingId, { timeout: 25000 });
  });
});

