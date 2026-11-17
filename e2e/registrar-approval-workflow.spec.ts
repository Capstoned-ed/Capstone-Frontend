import { test, expect } from '@playwright/test';

function createMockJwt(payload: Record<string, any>) {
  const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    exp: Math.floor(Date.now() / 1000) + 86400,
    ...payload,
  });
  return `${header}.${body}.mocksignature`;
}

test.describe('Registrar Auto-Approval & Dynamic Signatory Workflow', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  test('Registrar dashboard renders and toggles Auto-Approval switch', async ({ page }) => {
    const registrarToken = createMockJwt({
      user_id: 888,
      username: 'reg_jonalin',
      role: 'registrar',
      first_name: 'Jonalin',
      last_name: 'Lagrada',
    });

    await page.addInitScript(({ token }) => {
      const mockRegistrar = {
        id: 888,
        userId: 888,
        username: 'reg_jonalin',
        full_name: 'Jonalin Lagrada, MPSM',
        role: 'registrar',
        role_type: 'registrar',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_reg');
      localStorage.setItem('user', JSON.stringify(mockRegistrar));
      localStorage.setItem('regquest_user', JSON.stringify(mockRegistrar));
      localStorage.setItem('regquest_role', 'registrar');
    }, { token: registrarToken });

    let currentAutoApprove = true;

    await page.route('**/api/settings/registrar-approval/**', async (route) => {
      if (route.request().method() === 'PATCH') {
        const data = route.request().postDataJSON();
        currentAutoApprove = Boolean(data.auto_approve_requests);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            auto_approve_requests: currentAutoApprove,
            default_signatory_name: 'Jonalin T. Lagrada, MPSM',
            default_signatory_title: 'University Registrar',
            active_registrar_name: 'Jonalin Lagrada, MPSM',
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auto_approve_requests: currentAutoApprove,
          default_signatory_name: 'Jonalin T. Lagrada, MPSM',
          default_signatory_title: 'University Registrar',
          active_registrar_name: 'Jonalin Lagrada, MPSM',
        }),
      });
    });

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 888,
          username: 'reg_jonalin',
          role: 'registrar',
          first_name: 'Jonalin',
          last_name: 'Lagrada',
          full_name: 'Jonalin Lagrada, MPSM',
        }),
      });
    });

    await page.route('**/api/credentials/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/registrar');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify toggle switch is present
    const toggleBtn = page.locator('[data-testid="auto-approve-toggle"]');
    await expect(toggleBtn).toBeVisible({ timeout: 15000 });

    const statusBadge = page.locator('[data-testid="auto-approve-status"]');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText('ON');

    // 2. Click toggle to turn OFF
    await toggleBtn.click();
    await expect(statusBadge).toHaveText('OFF');
    expect(currentAutoApprove).toBe(false);

    // 3. Click toggle again to turn ON
    await toggleBtn.click();
    await expect(statusBadge).toHaveText('ON');
    expect(currentAutoApprove).toBe(true);
  });

  test('Mode A (Auto-Approve ON): Process modal displays dynamic auto-approval signatory', async ({ page }) => {
    const staffToken = createMockJwt({
      user_id: 777,
      username: 'staff_maria',
      role: 'staff',
      first_name: 'Maria',
      last_name: 'Santos',
    });

    const mockRequest = {
      id: 9001,
      rawId: 9001,
      tracking_number: 'REQ-2026-9001',
      student_name: 'Juan Dela Cruz',
      student_id: '2023100101',
      document_type: 'Transcript of Records (TOR)',
      status: 'Ready for Release',
      rawStatus: 'READY_FOR_RELEASE',
      clearance_status: 'APPROVED',
      payment_status: 'VERIFIED',
      is_approved: true,
      is_auto_approved: true,
      approved_by_name: 'Jonalin Lagrada, MPSM',
      assigned_staff: 'Maria Santos',
      created_at: '2026-11-17T08:00:00Z',
      request_date: '2026-11-17',
      date_of_release: '2026-11-20',
      or_number: 'OR-2026-9901',
      payments: [
        {
          id: 'pay-1',
          status: 'VERIFIED',
          receipt_reference_number: 'OR-2026-9901',
          amount: '150.00',
        },
      ],
    };

    await page.addInitScript(({ token, reqItem }) => {
      const mockStaff = {
        id: 777,
        userId: 777,
        username: 'staff_maria',
        full_name: 'Maria Santos',
        role: 'staff',
        role_type: 'staff',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_staff');
      localStorage.setItem('user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_role', 'staff');
      localStorage.setItem('regquest_requests', JSON.stringify([reqItem]));
      localStorage.setItem('regquest_assignments', JSON.stringify({
        '9001': 'Maria Santos',
        'REQ-2026-9001': 'Maria Santos',
      }));
    }, { token: staffToken, reqItem: mockRequest });

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 777,
          username: 'staff_maria',
          role: 'staff',
          first_name: 'Maria',
          last_name: 'Santos',
        }),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          results: [mockRequest],
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // Click "View" button in My Assigned Requests to open modal
    const viewBtn = page.locator('button.staff-btn-view, button:has-text("View")').first();
    await expect(viewBtn).toBeVisible({ timeout: 15000 });
    await viewBtn.click();

    // Verify modal displays "Auto-Approved (Jonalin Lagrada, MPSM)" in Approved by field
    await expect(page.getByText(/Auto-Approved \(Jonalin Lagrada, MPSM\)/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();

    // Verify "Claimed & Done" and "Print Claim Stub" are available because request is approved
    await expect(page.getByRole('button', { name: /Print Claim Stub/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Claimed & Done/i })).toBeVisible();
  });

  test('Mode B (Auto-Approve OFF): Staff blocked from releasing until Registrar approves', async ({ page }) => {
    const registrarToken = createMockJwt({
      user_id: 888,
      username: 'reg_jonalin',
      role: 'registrar',
      first_name: 'Jonalin',
      last_name: 'Lagrada',
    });

    let isApprovedOnServer = false;
    let approvedByNameOnServer = '';

    const pendingApprovalRequest = {
      id: 9002,
      rawId: 9002,
      tracking_number: 'REQ-2026-9002',
      student_name: 'Pedro Penduko',
      student_id: '2023100202',
      document_type: 'Certification of Grades',
      status: 'For Processing',
      rawStatus: 'PROCESSING',
      clearance_status: 'APPROVED',
      payment_status: 'VERIFIED',
      is_approved: false,
      is_auto_approved: false,
      approved_by_name: '',
      assigned_staff: 'Jonalin Lagrada, MPSM',
      created_at: '2026-11-17T08:00:00Z',
      request_date: '2026-11-17',
      date_of_release: '2026-11-20',
      or_number: 'OR-2026-9902',
      payments: [
        {
          id: 'pay-2',
          status: 'VERIFIED',
          receipt_reference_number: 'OR-2026-9902',
          amount: '150.00',
        },
      ],
    };

    await page.addInitScript(({ token, reqItem }) => {
      const mockRegistrar = {
        id: 888,
        userId: 888,
        username: 'reg_jonalin',
        full_name: 'Jonalin Lagrada, MPSM',
        role: 'registrar',
        role_type: 'registrar',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_reg');
      localStorage.setItem('user', JSON.stringify(mockRegistrar));
      localStorage.setItem('regquest_user', JSON.stringify(mockRegistrar));
      localStorage.setItem('regquest_role', 'registrar');
      localStorage.setItem('regquest_requests', JSON.stringify([reqItem]));
      localStorage.setItem('regquest_assignments', JSON.stringify({
        '9002': 'Jonalin Lagrada, MPSM',
        'REQ-2026-9002': 'Jonalin Lagrada, MPSM',
      }));
    }, { token: registrarToken, reqItem: pendingApprovalRequest });

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 888,
          username: 'reg_jonalin',
          role: 'registrar',
          first_name: 'Jonalin',
          last_name: 'Lagrada',
          full_name: 'Jonalin Lagrada, MPSM',
        }),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      if (route.request().url().includes('/approve/')) {
        return route.fallback();
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          results: [
            {
              ...pendingApprovalRequest,
              is_approved: isApprovedOnServer,
              approved_by_name: approvedByNameOnServer,
            },
          ],
        }),
      });
    });

    await page.route('**/api/requests/**/approve/**', async (route) => {
      isApprovedOnServer = true;
      approvedByNameOnServer = 'Jonalin Lagrada, MPSM';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...pendingApprovalRequest,
          is_approved: true,
          is_auto_approved: false,
          approved_by_name: approvedByNameOnServer,
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // 1. Open process modal via View button
    const viewBtn = page.locator('button.staff-btn-view, button:has-text("View")').first();
    await expect(viewBtn).toBeVisible({ timeout: 15000 });
    await viewBtn.click();

    // 2. Modal shows "Pending Registrar Approval" and the "Approve Request" button
    await expect(page.getByText(/Pending Registrar Approval/i)).toBeVisible({ timeout: 10000 });
    const approveBtn = page.locator('[data-testid="approve-request-btn"]');
    await expect(approveBtn).toBeVisible();

    // 3. Registrar clicks "Approve Request"
    await approveBtn.click();

    // 4. Verification: approve endpoint was called and UI updates to Approved state
    await expect.poll(() => isApprovedOnServer).toBe(true);
    await expect(page.getByText(/Jonalin Lagrada/i)).toBeVisible();
    await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  });
});
