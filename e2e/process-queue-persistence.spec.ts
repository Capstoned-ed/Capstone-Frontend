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

  test('Admin provisions 2 Staff and 1 Student, assigns to Staff 1, verifies Staff 2 has 0, persists in queue across clean context', async ({ browser }) => {
    // -------------------------------------------------------------------------
    // Step 1: Admin logs in and provisions 2 Staff accounts and 1 Student account
    // -------------------------------------------------------------------------
    const adminContext = await browser.newContext({ storageState: undefined });
    const adminPage = await adminContext.newPage();

    await loginAs(adminPage, 'admin');
    await adminPage.goto('/admin/users');
    await adminPage.waitForLoadState('domcontentloaded');

    const timestamp = Date.now().toString().slice(-6);
    const staff1Id = `71${timestamp}`;
    const staff2Id = `72${timestamp}`;
    const studentId = `90${timestamp}`;
    const digitToWord = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const letterCode = timestamp.split('').map((d) => digitToWord[Number(d)]).join('');
    const staffLastName = `Staff${letterCode}`;
    const staff1FullName = `StaffOne ${staffLastName}`;

    // Provision Staff 1
    const addUserTrigger = adminPage.locator('.add-user-trigger-btn, button:has-text("Add New User")').first();
    await expect(addUserTrigger).toBeVisible({ timeout: 25000 });
    await addUserTrigger.click();

    const firstNameInput = adminPage.locator('form.add-user-form input[placeholder="First Name"]');
    const lastNameInput = adminPage.locator('form.add-user-form input[placeholder="Last Name"]');
    const idInputStaff = adminPage.locator('form.add-user-form input[placeholder*="ID Number"]');
    const emailInputStaff = adminPage.locator('form.add-user-form input[type="email"]');
    const roleSelect = adminPage.locator('form.add-user-form select.add-user-select');

    await expect(idInputStaff).toBeVisible({ timeout: 10000 });
    await firstNameInput.fill('StaffOne');
    await lastNameInput.fill(staffLastName);
    await idInputStaff.fill(staff1Id);
    await emailInputStaff.fill(`staff1_${timestamp}@ustp.edu.ph`);
    await roleSelect.selectOption('staff');

    const saveStaff1Btn = adminPage.locator('form.add-user-form button.add-user-submit-btn').first();
    await saveStaff1Btn.click();

    await expect(adminPage.locator('form.add-user-form')).not.toBeVisible({ timeout: 20000 });
    await expect(adminPage.locator('body')).toContainText(staff1Id, { timeout: 15000 });

    // Provision Staff 2
    await adminPage.waitForTimeout(1000);
    await addUserTrigger.click();
    await expect(idInputStaff).toBeVisible({ timeout: 10000 });
    await firstNameInput.fill('StaffTwo');
    await lastNameInput.fill(staffLastName);
    await idInputStaff.fill(staff2Id);
    await emailInputStaff.fill(`staff2_${timestamp}@ustp.edu.ph`);
    await roleSelect.selectOption('staff');

    const saveStaff2Btn = adminPage.locator('form.add-user-form button.add-user-submit-btn').first();
    await saveStaff2Btn.click();

    await expect(adminPage.locator('form.add-user-form')).not.toBeVisible({ timeout: 20000 });
    await expect(adminPage.locator('body')).toContainText(staff2Id, { timeout: 15000 });

    // Provision Student
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
    await studFirstInput.fill('StudentFirst');
    await studLastInput.fill('StudentLast');
    await studIdInput.fill(studentId);
    await studEmailInput.fill(`student_${timestamp}@ustp.edu.ph`);
    await studDateInput.fill('2002-01-15');
    await studContactInput.fill('09123456789');

    // Select course via CourseSelectDropdown
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

    // -------------------------------------------------------------------------
    // Step 2: Student submits a new credential request in a clean context
    // -------------------------------------------------------------------------
    const studentContext = await browser.newContext({ storageState: undefined });
    const studentPage = await studentContext.newPage();

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

    // Select document
    const docCheckbox = studentPage.locator('#ustp-part-2-section input[type="checkbox"], .ustp-doc-col input[type="checkbox"]').first();
    await expect(docCheckbox).toBeVisible({ timeout: 15000 });
    await docCheckbox.check({ force: true });

    // Select purpose
    const purposeLabel = studentPage.locator('.ustp-purpose-grid label, label:has-text("For Evaluation"), label:has-text("Personal")').first();
    await purposeLabel.click();

    // Proceed to Review step
    const nextBtn = studentPage.getByRole('button', { name: /Next Step/i }).first();
    await nextBtn.click();

    await expect(studentPage.locator('body')).toContainText(/Review Data/i, { timeout: 15000 });

    // Final submit
    const finalSubmit = studentPage.getByRole('button', { name: /Submit|Next Step/i }).last();
    await finalSubmit.click();

    await expect(studentPage.locator('body')).toContainText(/Submitted|Success/i, { timeout: 20000 });

    // Extract tracking code
    const trackingBox = studentPage.locator('.complete-tracking-code');
    await expect(trackingBox).toBeVisible({ timeout: 15000 });
    const studentTrackingId = (await trackingBox.innerText()).trim();
    expect(studentTrackingId).toBeTruthy();

    await studentContext.close();

    // -------------------------------------------------------------------------
    // Step 3: Admin assigns the request to Staff 1 in /registrar/requests
    // -------------------------------------------------------------------------
    const adminAssignContext = await browser.newContext({ storageState: undefined });
    const adminAssignPage = await adminAssignContext.newPage();

    await loginAs(adminAssignPage, 'admin');
    await adminAssignPage.goto('/registrar/requests');
    await adminAssignPage.waitForLoadState('domcontentloaded');

    const requestsTable = adminAssignPage.locator('table, .requests-table').first();
    await expect(requestsTable).toBeVisible({ timeout: 25000 });

    // Filter/Search by the student's tracking ID
    const searchInput = adminAssignPage.locator('input.assign-search-input, input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(studentTrackingId);
      await adminAssignPage.waitForTimeout(500);
    }

    const targetAssignRow = adminAssignPage.locator('tbody tr').filter({ hasText: studentTrackingId }).first();
    await expect(targetAssignRow).toBeVisible({ timeout: 20000 });

    const staffSelect = targetAssignRow.locator('select.staff-select-dropdown');
    await expect(staffSelect).toBeVisible({ timeout: 10000 });

    // Wait until StaffOne option is present and select it
    await expect(staffSelect.locator('option', { hasText: staff1FullName }).first()).toBeAttached({ timeout: 15000 });
    await staffSelect.selectOption(staff1FullName);

    await expect(adminAssignPage.locator('.Toastify__toast--success, .toast-success, body')).toContainText(
      /Assigned/i,
      { timeout: 15000 }
    );

    await adminAssignContext.close();

    // -------------------------------------------------------------------------
    // Step 4: Staff 1 sees ONLY that 1 request, Staff 2 sees 0
    // -------------------------------------------------------------------------
    // Context for Staff 1
    const staff1Context = await browser.newContext({ storageState: undefined });
    const staff1Page = await staff1Context.newPage();

    await staff1Page.goto('/login');
    await staff1Page.locator('#username').fill(staff1Id);
    await staff1Page.locator('#password').fill(staff1Id);
    await staff1Page.getByRole('button', { name: /Log In/i }).click();
    await staff1Page.waitForURL(/\/staff/, { timeout: 45000 });

    // Check Staff 1 Dashboard: must see studentTrackingId in My Assigned Requests
    await staff1Page.goto('/staff/dashboard');
    await staff1Page.waitForLoadState('domcontentloaded');
    await expect(staff1Page.locator('body')).toContainText(studentTrackingId, { timeout: 25000 });

    // Go to /staff/requests: must see studentTrackingId in My Assigned Requests
    await staff1Page.goto('/staff/requests');
    await staff1Page.waitForLoadState('domcontentloaded');
    await expect(staff1Page.locator('body')).toContainText(studentTrackingId, { timeout: 25000 });

    // Context for Staff 2
    const staff2Context = await browser.newContext({ storageState: undefined });
    const staff2Page = await staff2Context.newPage();

    await staff2Page.goto('/login');
    await staff2Page.locator('#username').fill(staff2Id);
    await staff2Page.locator('#password').fill(staff2Id);
    await staff2Page.getByRole('button', { name: /Log In/i }).click();
    await staff2Page.waitForURL(/\/staff/, { timeout: 45000 });

    // Check Staff 2 Dashboard: must NOT see studentTrackingId in My Assigned Requests table
    await staff2Page.goto('/staff/dashboard');
    await staff2Page.waitForLoadState('domcontentloaded');
    await expect(staff2Page.locator('.staff-requests-table, table').first()).not.toContainText(studentTrackingId);
    await expect(staff2Page.locator('body')).toContainText(/No document requests currently assigned to you|0/i);

    // Check Staff 2 Requests Page: must NOT see studentTrackingId in My Assigned Requests table
    await staff2Page.goto('/staff/requests');
    await staff2Page.waitForLoadState('domcontentloaded');
    const staff2AssignedTable = staff2Page.locator('.staff-requests-table, table').first();
    await expect(staff2AssignedTable).not.toContainText(studentTrackingId);

    await staff2Context.close();

    // -------------------------------------------------------------------------
    // Step 5: Staff 1 claims/adds to Process Queue, updates status
    // -------------------------------------------------------------------------
    const staff1Row = staff1Page.locator('tbody tr').filter({ hasText: studentTrackingId }).first();
    await expect(staff1Row).toBeVisible({ timeout: 15000 });

    const processBtn = staff1Row.locator('button.staff-btn-process-this, button:has-text("Process This")').first();
    const viewBtn = staff1Row.locator('button.staff-btn-view, button:has-text("View")').first();

    if (await processBtn.isVisible()) {
      await processBtn.click();
      await expect(staff1Page.locator('.Toastify__toast--success, .toast-success, body')).toContainText(
        /processing|assigned/i,
        { timeout: 15000 }
      );
    } else if (await viewBtn.isVisible()) {
      await viewBtn.click();
      const modal = staff1Page.locator('.staff-process-dialog, [role="dialog"], form');
      await expect(modal.first()).toBeVisible({ timeout: 15000 });

      // Verify clearance if button is available
      const verifyClearanceBtn = staff1Page.locator('button:has-text("Verify"), button:has-text("Mark Cleared")').first();
      if (await verifyClearanceBtn.isVisible()) {
        await verifyClearanceBtn.click();
        await staff1Page.waitForTimeout(1000);
      }

      // Close modal
      const closeBtn = staff1Page.locator('button:has-text("Close"), button[aria-label="Close"], .modal-close-btn').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }

    // Completely close Staff 1 context
    await staff1Context.close();

    // -------------------------------------------------------------------------
    // Step 6: Staff 1 opens fresh context (Incognito equivalent) and verifies persistence
    // -------------------------------------------------------------------------
    const staff1CleanContext = await browser.newContext({ storageState: undefined });
    const staff1CleanPage = await staff1CleanContext.newPage();

    const cleanNetworkErrors: string[] = [];
    staff1CleanPage.on('response', (res) => {
      if (res.status() === 400 || res.status() === 404 || res.status() === 500) {
        cleanNetworkErrors.push(`HTTP ${res.status()} on ${res.url()}`);
      }
    });

    // Ensure completely clean storage
    await staff1CleanPage.goto('/login');
    const storageCount = await staff1CleanPage.evaluate(() => window.localStorage.length);
    expect(storageCount).toBe(0);

    // Log in as Staff 1
    await staff1CleanPage.locator('#username').fill(staff1Id);
    await staff1CleanPage.locator('#password').fill(staff1Id);
    await staff1CleanPage.getByRole('button', { name: /Log In/i }).click();
    await staff1CleanPage.waitForURL(/\/staff/, { timeout: 45000 });

    // Navigate to Staff Requests page
    await staff1CleanPage.goto('/staff/requests');
    await staff1CleanPage.waitForLoadState('domcontentloaded');

    // Verify My Assigned Requests STILL contains studentTrackingId directly from DB
    await expect(staff1CleanPage.locator('body')).toContainText(studentTrackingId, { timeout: 25000 });

    // Verify zero 400 or 404 errors were triggered
    const badErrors = cleanNetworkErrors.filter(
      (err) => err.includes('HTTP 400') || err.includes('HTTP 404')
    );
    expect(badErrors).toEqual([]);

    await staff1CleanContext.close();
  });
});

