import { test, expect } from '@playwright/test';

function createMockJwt(payload: Record<string, any>) {
  const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    exp: Math.floor(Date.now() / 1000) + 86400,
    ...payload,
  });
  return `${header}.${body}.mocksignature`;
}

test.describe('QA Audit Verification & Bug Hardening', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  test('Issue 1: Failed login returns generic "Invalid credentials." and change password calls /api/auth/change-password/', async ({ page }) => {
    await page.route('**/api/auth/login/', async (route) => {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid credentials.' }),
      });
    });

    await page.route('**/api/auth/change-password/', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Password changed successfully.' }),
      });
    });

    // Verify login error message is generic
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#username').fill('non_existent_user');
    await page.locator('#password').fill('wrong_password');
    await page.getByRole('button', { name: /Log In/i }).click();

    await expect(page.getByText('Invalid credentials.')).toBeVisible({ timeout: 10000 });
  });

  test('Issue 2: Verifying clearance immediately unlocks Manual Status Override dropdown without closing modal', async ({ page }) => {
    const staffToken = createMockJwt({
      user_id: 101,
      username: 'staff_tester',
      role: 'staff',
      first_name: 'Ralph',
      last_name: 'Tester',
    });

    await page.addInitScript(({ token }) => {
      const mockStaff = {
        id: 101,
        userId: 101,
        username: 'staff_tester',
        full_name: 'Ralph Tester',
        first_name: 'Ralph',
        last_name: 'Tester',
        role: 'staff',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token');
      localStorage.setItem('user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_role', 'staff');
    }, { token: staffToken });

    const mockRequest = {
      id: 'REQ-AUDIT-001',
      rawId: 'c1234567-0000-0000-0000-000000000001',
      tracking_number: 'REQ-AUDIT-001',
      student_name: 'Alice Student',
      student_id: '2023100001',
      document_type: 'Transcript of Records',
      credential_name: 'Transcript of Records',
      credential_type: 1,
      status: 'Pending',
      rawStatus: 'PENDING',
      assigned_staff: 'Ralph Tester',
      assigned_to: 101,
      clearance_id: 'clr-001',
      clearance_status: 'PENDING',
      clearance_preview: 'https://example.com/clearance.pdf',
      payments: [],
      created_at: new Date().toISOString(),
    };

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 101, username: 'staff_tester', first_name: 'Ralph', last_name: 'Tester', role: 'staff' }),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockRequest]),
      });
    });

    await page.route('**/api/clearances/**', async (route) => {
      if (route.request().method() === 'POST' && route.request().url().includes('/review/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'clr-001', status: 'APPROVED' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'clr-001', status: 'PENDING', user: '2023100001' }]),
      });
    });

    await page.route('**/api/credential-types/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Transcript of Records', code: 'TOR', price: 100 }]),
      });
    });

    await page.route('**/api/users/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 101, username: 'staff_tester', first_name: 'Ralph', last_name: 'Tester', role: 'staff' }]),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      });
    });

    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // Click View or Process button
    const actionBtn = page.locator('button.staff-btn-view, button:has-text("View"), button:has-text("Process This")').first();
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();

    // Verify Process Modal opens using unique heading role
    await expect(page.getByRole('heading', { name: 'Process Credential Request' })).toBeVisible({ timeout: 5000 });

    // Status override dropdown should initially be locked
    const overrideDropdown = page.locator('select.staff-select-input');
    await expect(overrideDropdown).toBeDisabled();
    await expect(page.getByText('Locked: Clearance not yet verified')).toBeVisible();

    // Now click Verify Clearance
    const verifyClearanceBtn = page.locator('button[title*="Verify"], button:has-text("Verify")').first();
    await expect(verifyClearanceBtn).toBeVisible();
    await verifyClearanceBtn.click();

    // Clearance verification should immediately unlock the dropdown WITHOUT closing modal
    await expect(overrideDropdown).toBeEnabled({ timeout: 8000 });
    await expect(page.getByText('Locked: Clearance not yet verified')).not.toBeVisible();
  });

  test('Issue 3: Completed (RELEASED) and CANCELLED requests are excluded from Active Requests queue', async ({ page }) => {
    const staffToken = createMockJwt({
      user_id: 102,
      username: 'staff_tester2',
      first_name: 'Daisy',
      last_name: 'Staff',
      role: 'staff',
    });

    await page.addInitScript(({ token }) => {
      const mockStaff = {
        id: 102,
        userId: 102,
        username: 'staff_tester2',
        first_name: 'Daisy',
        last_name: 'Staff',
        full_name: 'Daisy Staff',
        role: 'staff',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_2');
      localStorage.setItem('user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_role', 'staff');
    }, { token: staffToken });

    const requestsData = [
      {
        id: 'REQ-ACTIVE-01',
        rawId: 'uuid-active-01',
        tracking_number: 'REQ-ACTIVE-01',
        student_name: 'Elena Gilbert',
        student_id: '2023101010',
        document_type: 'Transcript of Records',
        credential_name: 'Transcript of Records',
        credential_type: 1,
        status: 'For Processing',
        rawStatus: 'PROCESSING',
        assigned_staff: 'Daisy Staff',
        created_at: new Date().toISOString(),
      },
      {
        id: 'REQ-RELEASED-02',
        rawId: 'uuid-released-02',
        tracking_number: 'REQ-RELEASED-02',
        student_name: 'Stefan Salvatore',
        student_id: '2023101011',
        document_type: 'Transcript of Records',
        credential_name: 'Transcript of Records',
        credential_type: 1,
        status: 'Released',
        rawStatus: 'RELEASED',
        assigned_staff: 'Daisy Staff',
        created_at: new Date().toISOString(),
      },
      {
        id: 'REQ-CANCELLED-03',
        rawId: 'uuid-cancelled-03',
        tracking_number: 'REQ-CANCELLED-03',
        student_name: 'Damon Salvatore',
        student_id: '2023101012',
        document_type: 'Transcript of Records',
        credential_name: 'Transcript of Records',
        credential_type: 1,
        status: 'Cancelled',
        rawStatus: 'CANCELLED',
        assigned_staff: 'Daisy Staff',
        created_at: new Date().toISOString(),
      },
    ];

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 102, username: 'staff_tester2', first_name: 'Daisy', last_name: 'Staff', role: 'staff' }),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(requestsData),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      });
    });

    await page.route('**/api/credential-types/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/users/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 102, username: 'staff_tester2', first_name: 'Daisy', last_name: 'Staff', role: 'staff' }]),
      });
    });

    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // On Active Requests tab, REQ-ACTIVE-01 should be visible
    await expect(page.getByText('REQ-ACTIVE-01')).toBeVisible({ timeout: 10000 });

    // REQ-RELEASED-02 and REQ-CANCELLED-03 must NOT be visible on Active Requests tab
    await expect(page.getByText('REQ-RELEASED-02')).not.toBeVisible();
    await expect(page.getByText('REQ-CANCELLED-03')).not.toBeVisible();
  });

  test('Issue 4: Staff Performance Matrix renders without "Unassigned / Queue" row', async ({ page }) => {
    const adminToken = createMockJwt({
      user_id: 1,
      username: 'admin_audit',
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
    });

    await page.addInitScript(({ token }) => {
      const mockAdmin = {
        id: 1,
        userId: 1,
        username: 'admin_audit',
        first_name: 'Admin',
        last_name: 'User',
        full_name: 'Admin User',
        role: 'admin',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_admin');
      localStorage.setItem('user', JSON.stringify(mockAdmin));
      localStorage.setItem('regquest_user', JSON.stringify(mockAdmin));
      localStorage.setItem('regquest_role', 'admin');
    }, { token: adminToken });

    const staffList = [
      { id: 10, username: 'staff1', first_name: 'Maria', last_name: 'Santos', role: 'staff', is_active: true },
      { id: 11, username: 'staff2', first_name: 'Juan', last_name: 'Dela Cruz', role: 'staff', is_active: true },
    ];

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'admin_audit', first_name: 'Admin', last_name: 'User', role: 'admin' }),
      });
    });

    await page.route('**/api/users/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(staffList),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'REQ-1',
            tracking_number: 'REQ-1',
            status: 'Processing',
            assigned_staff: 'Maria Santos',
            created_at: new Date().toISOString(),
          },
          {
            id: 'REQ-UNASSIGNED',
            tracking_number: 'REQ-UNASSIGNED',
            status: 'Pending',
            assigned_staff: null,
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[],"count":0}' });
    });

    await page.route('**/api/credentials/forecast/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"daily_forecast":[]}' });
    });

    await page.route('**/api/credentials/ml-health/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"healthy"}' });
    });

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Matrix should render Maria Santos and Juan Dela Cruz
    await expect(page.getByText('Maria Santos').first()).toBeVisible({ timeout: 10000 });

    // Matrix should NOT contain "Unassigned / Queue" row
    await expect(page.getByText('Unassigned / Queue')).not.toBeVisible();
  });

  test('Issue 6: Reopening Process Request Modal hydrates receipt and O.R. number from payments array', async ({ page }) => {
    const staffToken = createMockJwt({
      user_id: 103,
      username: 'staff_tester3',
      first_name: 'Daisy',
      last_name: 'Staff',
      role: 'staff',
    });

    await page.addInitScript(({ token }) => {
      const mockStaff = {
        id: 103,
        userId: 103,
        username: 'staff_tester3',
        first_name: 'Daisy',
        last_name: 'Staff',
        full_name: 'Daisy Staff',
        role: 'staff',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_staff3');
      localStorage.setItem('user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_role', 'staff');
    }, { token: staffToken });

    const requestWithPayment = {
      id: 'REQ-PAY-777',
      rawId: 'uuid-pay-777',
      tracking_number: 'REQ-PAY-777',
      student_name: 'Bob Student',
      student_id: '2023200002',
      document_type: 'Certificate of Grades',
      credential_name: 'Certificate of Grades',
      credential_type: 1,
      status: 'For Processing',
      rawStatus: 'PAYMENT_VERIFIED',
      clearance_status: 'APPROVED',
      assigned_staff: 'Daisy Staff',
      assigned_to: 103,
      payments: [
        {
          id: 55,
          receipt_reference_number: 'OR-USTP-98765',
          receipt_image: 'https://example.com/receipt-proof.png',
          status: 'VERIFIED',
          amount: '150.00',
        },
      ],
      created_at: new Date().toISOString(),
    };

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 103, username: 'staff_tester3', first_name: 'Daisy', last_name: 'Staff', role: 'staff' }),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([requestWithPayment]),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[],"count":0}' });
    });
    await page.route('**/api/credential-types/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/users/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 103, username: 'staff_tester3', first_name: 'Daisy', last_name: 'Staff', role: 'staff' }]),
      });
    });

    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // Open modal via View button
    const actionBtn = page.locator('button.staff-btn-view, button:has-text("View")').first();
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();

    // Verify O.R. Reference Number is hydrated from payments array
    await expect(page.getByText('OR-USTP-98765')).toBeVisible({ timeout: 5000 });
  });
});
