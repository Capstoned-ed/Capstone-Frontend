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

test.describe('ProcessRequestModal Approval/Status Sync & TrackStatusPage Empty Tab Reset', () => {
  test.use({ baseURL: 'http://127.0.0.1:4173' });

  test('Auto-Approve ON: Confirm Request immediately updates Approved by and unlocks Update Status for notes/status advance', async ({ page }) => {
    const staffToken = createMockJwt({
      user_id: 777,
      username: 'staff_maria',
      role: 'staff',
      first_name: 'Maria',
      last_name: 'Santos',
    });

    const pendingReq = {
      id: 9101,
      rawId: 9101,
      tracking_number: 'BSIT-26-11-18-2023100101-1-001',
      student_name: 'Juan Dela Cruz',
      student_id: '2023100101',
      document_type: 'Transcript of Records (TOR)',
      status: 'PENDING',
      rawStatus: 'PENDING',
      clearance_status: 'PENDING',
      payment_status: 'NOT_SUBMITTED',
      is_approved: false,
      is_auto_approved: false,
      approved_by_name: '',
      assigned_staff: 'Maria Santos',
      created_at: '2026-11-18T08:00:00Z',
      request_date: '2026-11-18',
      assessed_amount: '150.00',
      price: '150.00',
      copies: 1,
      payments: [],
    };

    const transitionPayloads: any[] = [];
    let currentReqState: any = { ...pendingReq };

    await page.addInitScript(({ token }) => {
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
    }, { token: staffToken });

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

    await page.route('**/api/settings/registrar-approval/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auto_approve_requests: true,
          default_signatory_name: 'Jonalin T. Lagrada, MPSM',
          default_signatory_title: 'University Registrar',
          active_registrar_name: 'Jonalin T. Lagrada, MPSM',
        }),
      });
    });

    await page.route('**/api/clearances/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      });
    });

    await page.route('**/api/credentials/predict/turnaround/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          predicted_processing_time: 3,
          estimated_completion_date: '2026-11-23',
          is_fallback: false,
        }),
      });
    });

    await page.route('**/api/requests/9101/transition/**', async (route) => {
      const payload = route.request().postDataJSON();
      transitionPayloads.push(payload);
      currentReqState = {
        ...currentReqState,
        status: payload.status,
        rawStatus: payload.status,
        remarks: payload.remarks ?? currentReqState.remarks,
        is_approved: true,
        is_auto_approved: true,
        approved_by_name: 'Jonalin T. Lagrada, MPSM',
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(currentReqState),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      if (route.request().url().includes('/transition/')) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          results: [currentReqState],
        }),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // Open modal
    const viewBtn = page.locator('button.staff-btn-view, button:has-text("View")').first();
    await expect(viewBtn).toBeVisible({ timeout: 15000 });
    await viewBtn.click();

    // Initially Approved by shows Pending Registrar Approval
    const approvedByBox = page.getByTestId('approved-by-display');
    await expect(approvedByBox).toBeVisible({ timeout: 10000 });
    await expect(approvedByBox).toContainText('Pending Registrar Approval');

    // Verify clearance (Verify button or Mark Cleared button)
    const verifyClearanceBtn = page.getByRole('button', { name: /^(Verify|Mark Cleared)$/i }).first();
    await expect(verifyClearanceBtn).toBeVisible({ timeout: 10000 });
    await verifyClearanceBtn.click();

    // Click Confirm Request & Order of Payment
    const confirmBtn = page.getByRole('button', { name: /Confirm Request & Order of Payment/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Issue B (ON): Approved by immediately updates WITHOUT closing modal
    await expect(approvedByBox).toContainText('Jonalin T. Lagrada, MPSM', { timeout: 10000 });
    await expect(approvedByBox).toContainText('Approved');

    // Issue A: Dropdown immediately synced to Pending Payment & offers For Processing
    const statusSelect = page.locator('select.staff-select-input');
    await expect(statusSelect).toHaveValue('Pending Payment');
    await expect(statusSelect.locator('option', { hasText: 'For Processing' })).toHaveCount(1);

    // Issue A (status advance): Selecting For Processing immediately enables Update Status without closing modal
    const updateStatusBtn = page.getByRole('button', { name: /^Update Status$/i });
    await statusSelect.selectOption('For Processing');
    await expect(updateStatusBtn).toBeEnabled();

    // Issue A (notes/remarks): Switching back to Pending Payment and typing remarks ALSO keeps Update Status enabled
    await statusSelect.selectOption('Pending Payment');
    const notesInput = page.locator('input.staff-notes-input');
    await notesInput.fill('Clearance checked and Order of Payment issued.');
    await expect(updateStatusBtn).toBeEnabled();

    // Submit notes update
    await updateStatusBtn.click();
    await expect(updateStatusBtn).toBeHidden({ timeout: 10000 });

    // Confirm both API calls fired with expected statuses
    expect(transitionPayloads.length).toBeGreaterThanOrEqual(2);
    expect(transitionPayloads[0].status).toBe('PAYMENT_PENDING');
    expect(transitionPayloads[1].status).toBe('PAYMENT_PENDING');
    expect(transitionPayloads[1].remarks).toContain('Clearance checked and Order of Payment issued.');
  });

  test.skip('Auto-Approve OFF: Staff sees Waiting for Registrar Approval & cannot confirm; Registrar approves and updates immediately', async ({ page }) => {
    const staffToken = createMockJwt({
      user_id: 777,
      username: 'staff_maria',
      role: 'staff',
      first_name: 'Maria',
      last_name: 'Santos',
    });

    const unapprovedReq = {
      id: 9102,
      rawId: 9102,
      tracking_number: 'BSIT-26-11-18-2023100202-1-002',
      student_name: 'Maria Clara',
      student_id: '2023100202',
      document_type: 'Transcript of Records (TOR)',
      status: 'PENDING',
      rawStatus: 'PENDING',
      clearance_status: 'VERIFIED',
      payment_status: 'NOT_SUBMITTED',
      is_approved: false,
      is_auto_approved: false,
      approved_by_name: '',
      assigned_staff: 'Maria Santos',
      created_at: '2026-11-18T08:00:00Z',
      request_date: '2026-11-18',
      assessed_amount: '150.00',
      price: '150.00',
      copies: 1,
      payments: [],
    };

    await page.addInitScript(({ token }) => {
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
    }, { token: staffToken });

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

    await page.route('**/api/settings/registrar-approval/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auto_approve_requests: false,
          default_signatory_name: 'Jonalin T. Lagrada, MPSM',
          default_signatory_title: 'University Registrar',
          active_registrar_name: 'Jonalin T. Lagrada, MPSM',
        }),
      });
    });

    await page.route('**/api/clearances/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) });
    });

    await page.route('**/api/credentials/predict/turnaround/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ predicted_processing_time: 3, estimated_completion_date: '2026-11-23', is_fallback: false }),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, results: [unapprovedReq] }),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    const viewBtn = page.locator('button.staff-btn-view, button:has-text("View")').first();
    await expect(viewBtn).toBeVisible({ timeout: 15000 });
    await viewBtn.click();

    // Staff sees Waiting for Registrar Approval notice and CANNOT confirm or override status
    await expect(page.getByTestId('approved-by-display')).toContainText('Pending Registrar Approval');
    await expect(page.getByTestId('waiting-registrar-approval-notice')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('waiting-registrar-approval-notice')).toContainText('Waiting for Registrar Approval');

    const confirmBtn = page.getByRole('button', { name: /Confirm Request & Order of Payment/i });
    await expect(confirmBtn).toBeDisabled();

    const statusSelect = page.locator('select.staff-select-input');
    await expect(statusSelect).toBeDisabled();

    // Now test as Registrar approving the same request
    const registrarContext = await page.context().browser()!.newContext();
    const regPage = await registrarContext.newPage();

    const regToken = createMockJwt({
      user_id: 888,
      username: 'reg_jonalin',
      role: 'registrar',
      first_name: 'Jonalin',
      last_name: 'Lagrada',
    });

    let regReqState: any = { ...unapprovedReq };

    await regPage.addInitScript(({ token }) => {
      const mockRegistrar = {
        id: 888,
        userId: 888,
        username: 'reg_jonalin',
        full_name: 'Jonalin T. Lagrada, MPSM',
        role: 'registrar',
        role_type: 'registrar',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_reg');
      localStorage.setItem('user', JSON.stringify(mockRegistrar));
      localStorage.setItem('regquest_user', JSON.stringify(mockRegistrar));
      localStorage.setItem('regquest_role', 'registrar');
    }, { token: regToken });

    await regPage.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 888,
          username: 'reg_jonalin',
          role: 'registrar',
          first_name: 'Jonalin',
          last_name: 'Lagrada',
          full_name: 'Jonalin T. Lagrada, MPSM',
        }),
      });
    });

    await regPage.route('**/api/settings/registrar-approval/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auto_approve_requests: false,
          default_signatory_name: 'Jonalin T. Lagrada, MPSM',
          default_signatory_title: 'University Registrar',
          active_registrar_name: 'Jonalin T. Lagrada, MPSM',
        }),
      });
    });

    await regPage.route('**/api/clearances/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) });
    });

    await regPage.route('**/api/credentials/predict/turnaround/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ predicted_processing_time: 3, estimated_completion_date: '2026-11-23', is_fallback: false }),
      });
    });

    await regPage.route('**/api/requests/9102/approve/**', async (route) => {
      regReqState = {
        ...regReqState,
        is_approved: true,
        is_auto_approved: false,
        approved_by_name: 'Jonalin T. Lagrada, MPSM',
      };
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(regReqState),
      });
    });

    await regPage.route('**/api/requests/**', async (route) => {
      if (route.request().url().includes('/approve/')) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, results: [regReqState] }),
      });
    });

    await regPage.route('**/api/notifications/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) });
    });

    await regPage.setViewportSize({ width: 1280, height: 800 });
    await regPage.goto('/registrar/requests');
    await regPage.waitForLoadState('domcontentloaded');

    const regViewBtn = regPage.locator('button.staff-btn-view, button:has-text("View")').first();
    await expect(regViewBtn).toBeVisible({ timeout: 15000 });
    await regViewBtn.click();

    const approveBtn = regPage.getByTestId('approve-request-btn');
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await approveBtn.click();

    // Immediately updates Approved by to Registrar's full name without closing modal
    await expect(regPage.getByTestId('approved-by-display')).toContainText('Jonalin T. Lagrada, MPSM', { timeout: 10000 });
    await expect(regPage.getByTestId('approved-by-display')).toContainText('Approved');

    await registrarContext.close();
  });

  test('TrackStatusPage: Empty Active Requests (0) hides bottom detail card until Request History is clicked', async ({ page }) => {
    const studentToken = createMockJwt({
      user_id: 555,
      username: '2023100101',
      role: 'student',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
    });

    const claimedRequest = {
      id: 9201,
      rawId: 9201,
      user: 555,
      tracking_number: 'BSIT-26-11-18-2023100101-1-009',
      student_name: 'Juan Dela Cruz',
      student_id: '2023100101',
      credential_type: 1,
      document_type: 'Transcript of Records (TOR)',
      status: 'RELEASED',
      rawStatus: 'RELEASED',
      purpose: 'Employment',
      copies: 1,
      price: '150.00',
      assessed_amount: '150.00',
      created_at: '2026-11-15T08:00:00Z',
      updated_at: '2026-11-18T09:00:00Z',
      date_of_release: '2026-11-18',
      payments: [
        {
          id: 'pay-9201',
          status: 'VERIFIED',
          receipt_reference_number: 'OR-9201',
          amount: '150.00',
        },
      ],
    };

    await page.addInitScript(({ token }) => {
      const mockStudent = {
        id: 555,
        userId: 555,
        username: '2023100101',
        student_id: '2023100101',
        full_name: 'Juan Dela Cruz',
        role: 'student',
        role_type: 'student',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_student');
      localStorage.setItem('user', JSON.stringify(mockStudent));
      localStorage.setItem('regquest_user', JSON.stringify(mockStudent));
      localStorage.setItem('regquest_role', 'student');
    }, { token: studentToken });

    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 555,
          username: '2023100101',
          role: 'student',
          first_name: 'Juan',
          last_name: 'Dela Cruz',
        }),
      });
    });

    await page.route('**/api/credentials/types/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, code: 'TOR', doc_code: '1', name: 'Transcript of Records', price: '150.00', processing_days: 3, is_active: true },
        ]),
      });
    });

    await page.route('**/api/requests/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          results: [claimedRequest],
        }),
      });
    });

    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/student/requests');
    await page.waitForLoadState('domcontentloaded');

    // Active Requests tab is selected with 0 items
    const activeTab = page.getByRole('button', { name: /Active Requests\s*0/i });
    await expect(activeTab).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('No active requests at the moment.')).toBeVisible();

    // Bottom detail card MUST NOT be visible while Active Requests (0) is selected
    await expect(page.getByText('BSIT-26-11-18-2023100101-1-009')).toHaveCount(0);
    await expect(page.locator('.track-status-card, .track-timeline-card')).toHaveCount(0);
    await expect(page.getByText('No Document Requests Yet')).toHaveCount(0);

    // Click Request History tab -> claimed request and its bottom detail card appear
    const historyTab = page.getByRole('button', { name: /Request History/i });
    await historyTab.click();
    await expect(page.getByText('BSIT-26-11-18-2023100101-1-009').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.track-timeline-card, .track-status-card').first()).toBeVisible();

    // Click back to Active Requests (0) -> bottom detail card is hidden again
    await activeTab.click();
    await expect(page.getByText('No active requests at the moment.')).toBeVisible();
    await expect(page.getByText('BSIT-26-11-18-2023100101-1-009')).toHaveCount(0);
    await expect(page.locator('.track-status-card, .track-timeline-card')).toHaveCount(0);
  });
});

