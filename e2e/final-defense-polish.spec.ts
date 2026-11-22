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

test.describe('Final Defense Polish & Hardening Verification', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  test('1. New student clearance shows exact image and PENDING status on Staff review', async ({ page }) => {
    const staffToken = createMockJwt({
      user_id: 201,
      username: 'staff_processor',
      role: 'staff',
      first_name: 'Maria',
      last_name: 'Santos',
    });

    const mockStaff = {
      id: 201,
      userId: 201,
      username: 'staff_processor',
      full_name: 'Maria Santos',
      first_name: 'Maria',
      last_name: 'Santos',
      role: 'staff',
    };

    await page.addInitScript(({ token, staff }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token');
      localStorage.setItem('user', JSON.stringify(staff));
      localStorage.setItem('regquest_user', JSON.stringify(staff));
      localStorage.setItem('regquest_role', 'staff');
      localStorage.removeItem('regquest_latest_clearance_file');
      localStorage.removeItem('regquest_latest_clearance_meta');
    }, { token: staffToken, staff: mockStaff });

    const newRequest = {
      id: 'REQ-NEW-STUDENT-01',
      rawId: 'c9999999-0000-0000-0000-000000000001',
      tracking_number: 'REQ-NEW-STUDENT-01',
      student_name: 'Carlos Yulo',
      student_id: '2023999999',
      user: 501,
      document_type: 'Transcript of Records',
      credential_name: 'Transcript of Records',
      credential_type: 1,
      status: 'Pending',
      rawStatus: 'PENDING',
      assigned_staff: 'Maria Santos',
      assigned_to: 201,
      clearance_id: 'clr-student-501',
      clearance_status: 'PENDING',
      clearance_preview: 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%3E%3Crect%20fill%3D%22%232563eb%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20x%3D%2210%22%20y%3D%2250%22%20fill%3D%22white%22%3ECARLOS%20CLEARANCE%3C%2Ftext%3E%3C%2Fsvg%3E',
      clearance_file_name: 'Carlos_Clearance_2026.svg',
      created_at: new Date().toISOString(),
      payments: [],
    };

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStaff),
      });
    });

    await page.route('**/api/users/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockStaff]),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([newRequest]),
      });
    });

    await page.route('**/api/credential-types/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Transcript of Records', code: 'TOR', price: '125.00' }]),
      });
    });

    await page.route('**/api/clearances/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'clr-student-501', user: 501, status: 'PENDING', file: newRequest.clearance_preview }]),
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

    await expect(page.getByText('REQ-NEW-STUDENT-01').first()).toBeVisible({ timeout: 10000 });

    // Open request processing modal
    const processBtn = page.locator('button.staff-btn-view, button:has-text("View"), button:has-text("Process This")').first();
    await expect(processBtn).toBeVisible({ timeout: 10000 });
    await processBtn.click();

    await expect(page.getByRole('heading', { name: 'Process Credential Request' })).toBeVisible({ timeout: 10000 });

    // Verify clearance status is strictly PENDING (Pending Verification) and NOT pre-verified
    await expect(page.getByText('Pending Verification')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Clearance Verified')).not.toBeVisible();

    // Verify exact file name and Verify button are visible (meaning not yet verified)
    await expect(page.getByText('Carlos_Clearance_2026.svg')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Verify$/i })).toBeVisible();
  });

  test('2. Admin receives zero request processing notifications and is protected from self-deactivation', async ({ page }) => {
    const adminToken = createMockJwt({
      user_id: 1,
      username: 'admin',
      role: 'admin',
      first_name: 'System',
      last_name: 'Administrator',
    });

    const mockAdmin = {
      id: 1,
      userId: 1,
      username: 'admin',
      full_name: 'System Administrator',
      first_name: 'System',
      last_name: 'Administrator',
      role: 'admin',
      email: 'admin@ustp.edu.ph',
      is_active: true,
    };

    await page.addInitScript(({ token, admin }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token');
      localStorage.setItem('user', JSON.stringify(admin));
      localStorage.setItem('regquest_user', JSON.stringify(admin));
      localStorage.setItem('regquest_role', 'admin');
    }, { token: adminToken, admin: mockAdmin });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 'notif-1',
              event_type: 'REQUEST_CREATED',
              message: 'New credential request (REQ-123) submitted by student1.',
              related_object_type: 'CredentialRequest',
              related_object_id: 'REQ-123',
              target_role: 'staff',
              target_roles: ['staff', 'registrar'],
              created_at: new Date().toISOString(),
              is_read: false,
            },
            {
              id: 'notif-2',
              event_type: 'SYSTEM_ANNOUNCEMENT',
              message: 'System scheduled maintenance at 11:00 PM.',
              related_object_type: 'System',
              related_object_id: 'SYS-01',
              target_role: 'admin',
              target_roles: ['admin'],
              created_at: new Date().toISOString(),
              is_read: false,
            },
          ],
        }),
      });
    });

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdmin),
      });
    });

    const mockUsers = [
      mockAdmin,
      {
        id: 2,
        username: 'staff_1',
        full_name: 'Staff Member One',
        first_name: 'Staff',
        last_name: 'One',
        role: 'staff',
        email: 'staff1@ustp.edu.ph',
        is_active: true,
      },
    ];

    await page.route('**/api/users/**', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: mockUsers, count: 2 }),
        });
      }
      return route.continue();
    });

    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');

    // Verify Admin only sees system notifications, NOT request processing notifications
    await expect(page.getByText('System scheduled maintenance')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('New credential request (REQ-123)')).not.toBeVisible();

    // Navigate to Admin Users page
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    // Verify Admin self row is protected
    await expect(page.getByText('Current Account (Protected)')).toBeVisible({ timeout: 10000 });
  });

  test('3. Staff Performance Matrix contains only STAFF users sorted descending', async ({ page }) => {
    const adminToken = createMockJwt({
      user_id: 1,
      username: 'admin',
      role: 'admin',
      first_name: 'System',
      last_name: 'Admin',
    });

    const mockAdmin = {
      id: 1,
      userId: 1,
      username: 'admin',
      full_name: 'System Admin',
      first_name: 'System',
      last_name: 'Admin',
      role: 'admin',
    };

    await page.addInitScript(({ token, admin }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token');
      localStorage.setItem('user', JSON.stringify(admin));
      localStorage.setItem('regquest_user', JSON.stringify(admin));
      localStorage.setItem('regquest_role', 'admin');
    }, { token: adminToken, admin: mockAdmin });

    const usersList = [
      mockAdmin,
      {
        id: 10,
        username: 'registrar_jane',
        full_name: 'Jane Registrar',
        first_name: 'Jane',
        last_name: 'Registrar',
        role: 'registrar',
      },
      {
        id: 20,
        username: 'staff_alpha',
        full_name: 'Staff Alpha',
        first_name: 'Staff',
        last_name: 'Alpha',
        role: 'staff',
      },
      {
        id: 21,
        username: 'staff_beta',
        full_name: 'Staff Beta',
        first_name: 'Staff',
        last_name: 'Beta',
        role: 'staff',
      },
    ];

    const nowIso = new Date().toISOString();
    const requestsList = [
      {
        id: 'REQ-1',
        tracking_number: 'REQ-1',
        student_name: 'Student One',
        student_id: '2023001',
        status: 'RELEASED',
        assigned_staff: 'Staff Alpha',
        assigned_to: 20,
        credential_type: 1,
        created_at: nowIso,
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `REQ-B-${i}`,
        tracking_number: `REQ-B-${i}`,
        student_name: `Student Beta ${i}`,
        student_id: `202300${i + 2}`,
        status: 'RELEASED',
        assigned_staff: 'Staff Beta',
        assigned_to: 21,
        credential_type: 1,
        created_at: nowIso,
      })),
    ];

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdmin),
      });
    });

    await page.route('**/api/users/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: usersList, count: usersList.length }),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: requestsList, count: requestsList.length }),
      });
    });

    await page.route('**/api/credential-types/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'TOR', code: 'TOR', price: '100.00' }]),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      });
    });

    await page.goto('/admin/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('Staff Performance Metrics')).toBeVisible({ timeout: 10000 });

    const tableArea = page.locator('.staff-table');
    await expect(tableArea).toBeVisible();
    await expect(tableArea.getByText('System Admin')).not.toBeVisible();
    await expect(tableArea.getByText('Jane Registrar')).not.toBeVisible();

    await expect(tableArea.getByText('Staff Beta')).toBeVisible();
    await expect(tableArea.getByText('Staff Alpha')).toBeVisible();

    const staffRows = await tableArea.locator('.staff-table-row').allInnerTexts();
    const betaIndex = staffRows.findIndex((r) => r.includes('Staff Beta'));
    const alphaIndex = staffRows.findIndex((r) => r.includes('Staff Alpha'));
    expect(betaIndex).toBeGreaterThanOrEqual(0);
    expect(alphaIndex).toBeGreaterThanOrEqual(0);
    expect(betaIndex).toBeLessThan(alphaIndex);
  });

  test('4. Registrar Auto-Approve toggle is cleanly removed and Select Multiple is present', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const registrarToken = createMockJwt({
      user_id: 301,
      username: 'reg_officer',
      role: 'registrar',
      first_name: 'Jonalin',
      last_name: 'Lagrada',
    });

    const mockRegistrar = {
      id: 301,
      userId: 301,
      username: 'reg_officer',
      full_name: 'Jonalin Lagrada',
      first_name: 'Jonalin',
      last_name: 'Lagrada',
      role: 'registrar',
    };

    await page.addInitScript(({ token, registrar }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token');
      localStorage.setItem('user', JSON.stringify(registrar));
      localStorage.setItem('regquest_user', JSON.stringify(registrar));
      localStorage.setItem('regquest_role', 'registrar');
    }, { token: registrarToken, registrar: mockRegistrar });

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRegistrar),
      });
    });

    await page.route('**/api/settings/registrar-approval/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auto_approve_requests: true,
          active_registrar_name: 'Jonalin Lagrada, MPSM',
          signatory_name: 'Jonalin Lagrada, MPSM',
        }),
      });
    });

    const stubRequest = {
      id: 'REQ-STUB-01',
      rawId: 'stub-uuid-01',
      tracking_number: 'REQ-STUB-01',
      student_name: 'Juan Dela Cruz',
      student_id: '2023101010',
      user: 401,
      document_type: 'Transcript of Records',
      credential_type: 1,
      status: 'READY_FOR_RELEASE',
      date_of_release: '2026-11-25',
      created_at: new Date().toISOString(),
      payments: [{ receipt_reference_number: 'OR-8888', amount: '150.00', status: 'VERIFIED' }],
    };

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [stubRequest],
          count: 1,
        }),
      });
    });

    await page.route('**/api/credential-types/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Transcript of Records', code: 'TOR', price: '150.00' }]),
      });
    });

    await page.route('**/api/users/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [mockRegistrar], count: 1 }),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      });
    });

    // 1. Check Registrar Dashboard: Auto-Approve toggle is removed
    await page.goto('/registrar/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('auto-approve-toggle')).toHaveCount(0);

    // 2. Check Registrar Requests page: Auto-Approve toggle is removed, Select Multiple is present
    await page.goto('/registrar/requests');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('auto-approve-toggle')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Select Multiple/i }).first()).toBeVisible({ timeout: 10000 });
    expect(consoleErrors).toEqual([]);
  });

  test('5. Claim Stub Download button generates and downloads PDF without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    const studentToken = createMockJwt({
      user_id: 401,
      username: 'student_stub',
      role: 'student',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
    });

    const mockStudent = {
      id: 401,
      userId: 401,
      username: 'student_stub',
      full_name: 'Juan Dela Cruz',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      role: 'student',
      student_id: '2023101010',
    };

    const stubRequest = {
      id: 'REQ-STUB-01',
      rawId: 'stub-uuid-01',
      tracking_number: 'REQ-STUB-01',
      student_name: 'Juan Dela Cruz',
      student_id: '2023101010',
      user: 401,
      document_type: 'Transcript of Records',
      credential_type: 1,
      status: 'READY_FOR_RELEASE',
      date_of_release: '2026-11-25',
      created_at: new Date().toISOString(),
      payments: [{ receipt_reference_number: 'OR-8888', amount: '150.00', status: 'VERIFIED' }],
    };

    await page.addInitScript(({ token, student }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token');
      localStorage.setItem('user', JSON.stringify(student));
      localStorage.setItem('regquest_user', JSON.stringify(student));
      localStorage.setItem('regquest_role', 'student');
    }, { token: studentToken, student: mockStudent });

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStudent),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [stubRequest],
          count: 1,
        }),
      });
    });

    await page.route('**/api/credential-types/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Transcript of Records', code: 'TOR', price: '150.00' }]),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], count: 0 }),
      });
    });

    await page.goto('/student/requests?trackId=REQ-STUB-01');
    await page.waitForLoadState('domcontentloaded');

    const stubBtn = page.getByRole('button', { name: /Claim Stub|View Claim Stub|Print Claim Stub/i }).first();
    await expect(stubBtn).toBeVisible({ timeout: 10000 });
    await stubBtn.click();

    await expect(page.getByRole('dialog', { name: /Official Claim Stub/i })).toBeVisible({ timeout: 10000 });

    const downloadBtn = page.getByRole('button', { name: /Download/i });
    await expect(downloadBtn).toBeVisible();

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await downloadBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('Claim-Stub-');
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    expect(consoleErrors).toEqual([]);
  });
});
