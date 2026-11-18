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

const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('Admin Calendar Read-Only, Auto-Approve & Role Dropdowns, Staff Confirm Payment Order Auto-Close', () => {
  test.use({ baseURL: 'http://127.0.0.1:4173' });

  test('Fix 1: Admin Processing Calendar opens strictly read-only details modal with View Only (Admin) badge and zero mutation buttons', async ({ page }) => {
    const adminToken = createMockJwt({
      user_id: 1,
      username: 'admin_chief',
      role: 'admin',
      first_name: 'Admin',
      last_name: 'Chief',
    });

    const today = new Date();
    const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayIso = `${todayDateStr}T09:00:00Z`;

    const calReq = {
      id: 'aaaa1111-2222-3333-4444-555566667777',
      user: 501,
      tracking_number: 'BSIT-26-11-18-23100501-1-001',
      student_name: 'Carlos Mendoza',
      student_id: '2023100501',
      credential_type: 1,
      document_type: 'Transcript of Records (TOR)',
      status: 'PAYMENT_VERIFIED',
      copies: 2,
      total_amount: '250.00',
      assessed_amount: '250.00',
      created_at: todayIso,
      request_date: todayDateStr,
      release_date: todayDateStr,
      payments: [],
    };

    await page.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_admin');
    }, { token: adminToken });

    await page.route('**/api/users/me/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'admin_chief', role: 'admin', first_name: 'Admin', last_name: 'Chief' }),
      })
    );
    await page.route('**/api/users/**', (route) => {
      if (route.request().url().includes('/me')) return route.fallback();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/credentials/types/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, code: 'TOR', doc_code: '1', name: 'Transcript of Records (TOR)', price: '125.00', processing_days: 5, is_active: true }]),
      })
    );
    await page.route('**/api/clearances/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/requests/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([calReq]) })
    );
    await page.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/calendar');

    // Click today's cell on the calendar (has active badge/day number)
    const dayCell = page.locator('.calendar-day-cell.has-events, .calendar-day-cell.is-today').first();
    await expect(dayCell).toBeVisible({ timeout: 15000 });
    await dayCell.click();

    // Calendar date modal shows View Only (Admin) badge and View Details (not Process / View)
    await expect(page.getByTestId('admin-view-only-badge')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('admin-view-only-badge')).toHaveText('View Only (Admin)');

    // Switch to New Requests tab if To Process is empty, or find View Details button
    const viewDetailsBtn = page.getByRole('button', { name: /View Details/i }).first();
    if (!(await viewDetailsBtn.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /New Requests/i }).click();
    }
    await expect(viewDetailsBtn).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /Process \/ View/i })).toHaveCount(0);

    // Click View Details -> opens strictly read-only modal with ZERO mutation buttons
    await viewDetailsBtn.click();
    const readonlyModal = page.getByTestId('admin-readonly-details-modal');
    await expect(readonlyModal).toBeVisible({ timeout: 10000 });
    await expect(readonlyModal.getByTestId('admin-modal-readonly-badge')).toHaveText('View Only (Admin)');
    await expect(readonlyModal).toContainText('Carlos Mendoza');
    await expect(readonlyModal).toContainText('Transcript of Records (TOR)');

    // Zero processing/mutation controls inside Admin modal
    await expect(readonlyModal.getByRole('button', { name: /Update Status/i })).toHaveCount(0);
    await expect(readonlyModal.getByRole('button', { name: /Confirm/i })).toHaveCount(0);
    await expect(readonlyModal.getByRole('button', { name: /Approve/i })).toHaveCount(0);
    await expect(readonlyModal.locator('select')).toHaveCount(0);
  });

  test('Fix 2: Auto-Approve ON lets Staff bypass straight to READY_FOR_RELEASE, and Registrar sees Registrar-specific dropdown options', async ({ browser }) => {
    const reqUuid = 'bbbb1111-2222-3333-4444-555566667777';
    const processingReq = {
      id: reqUuid,
      user: 502,
      tracking_number: 'BSIT-26-11-18-23100502-1-002',
      student_name: 'Maria Clara',
      student_id: '2023100502',
      credential_type: 1,
      document_type: 'Transcript of Records (TOR)',
      status: 'PROCESSING',
      rawStatus: 'PROCESSING',
      clearance_status: 'APPROVED',
      payment_status: 'VERIFIED',
      is_approved: true,
      is_auto_approved: true,
      approved_by_name: 'Elena Reyes',
      assigned_staff: 'Maria Santos',
      or_number: 'OR-2026-4455',
      created_at: new Date().toISOString(),
      payments: [{ id: 'p1', status: 'VERIFIED', receipt_reference_number: 'OR-2026-4455', amount: '125.00' }],
    };

    // Part A: Staff with Auto-Approve ON sees Ready for Release (NOT Pending Payment!)
    const staffCtx = await browser.newContext();
    const staffPage = await staffCtx.newPage();
    const staffToken = createMockJwt({ user_id: 777, username: 'staff_maria', role: 'staff', first_name: 'Maria', last_name: 'Santos' });
    let capturedStaffTransition: any = null;

    await staffPage.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_staff');
    }, { token: staffToken });

    await staffPage.route('**/api/users/me/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 777, username: 'staff_maria', role: 'staff', first_name: 'Maria', last_name: 'Santos' }) })
    );
    await staffPage.route('**/api/settings/registrar-approval/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ auto_approve_requests: true, auto_approve: true, active_registrar_name: 'Elena Reyes' }) })
    );
    await staffPage.route('**/api/clearances/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await staffPage.route('**/api/credentials/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await staffPage.route('**/api/notifications/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
    await staffPage.route(`**/api/requests/${reqUuid}/transition/**`, (route) => {
      capturedStaffTransition = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...processingReq,
          status: 'READY_FOR_RELEASE',
          is_approved: true,
          is_auto_approved: true,
          approved_by_name: 'Elena Reyes',
          remarks: 'Auto-approved via Registrar Auto-Approve setting',
        }),
      });
    });
    await staffPage.route(`**/api/requests/${reqUuid}/`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(processingReq) })
    );
    await staffPage.route('**/api/requests/**', (route) => {
      if (route.request().url().includes(reqUuid)) return route.fallback();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([processingReq]) });
    });

    await staffPage.setViewportSize({ width: 1280, height: 800 });
    await staffPage.goto('/staff/requests');
    await staffPage.locator('button.staff-btn-view, button:has-text("View")').first().click();

    const staffSelect = staffPage.locator('select.staff-select-input');
    await expect(staffSelect).toBeVisible({ timeout: 10000 });
    const staffOptions = await staffSelect.locator('option:not([disabled])').allTextContents();
    expect(staffOptions).toContain('Ready for Release');
    expect(staffOptions).not.toContain('Pending Payment');

    await staffSelect.selectOption('Ready for Release');
    await staffPage.getByRole('button', { name: /^Update Status$/i }).click();
    await expect.poll(() => capturedStaffTransition?.status).toBe('PENDING_REGISTRAR_APPROVAL');
    await staffCtx.close();

    // Part B: Registrar sees Registrar-specific dropdown options (NEVER Pending Payment!)
    const regCtx = await browser.newContext();
    const regPage = await regCtx.newPage();
    const regToken = createMockJwt({ user_id: 909, username: 'reg_elena', role: 'registrar', first_name: 'Elena', last_name: 'Reyes' });

    await regPage.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_reg');
    }, { token: regToken });

    await regPage.route('**/api/users/me/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 909, username: 'reg_elena', role: 'registrar', first_name: 'Elena', last_name: 'Reyes' }) })
    );
    await regPage.route('**/api/settings/registrar-approval/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ auto_approve_requests: false, auto_approve: false, active_registrar_name: 'Elena Reyes' }) })
    );
    await regPage.route('**/api/clearances/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await regPage.route('**/api/credentials/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await regPage.route('**/api/notifications/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
    await regPage.route(`**/api/requests/${reqUuid}/`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(processingReq) })
    );
    await regPage.route('**/api/requests/**', (route) => {
      if (route.request().url().includes(reqUuid)) return route.fallback();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([processingReq]) });
    });

    await regPage.setViewportSize({ width: 1280, height: 800 });
    await regPage.goto('/registrar/requests');
    await regPage.locator('button.staff-btn-view, button:has-text("View")').first().click();

    const regSelect = regPage.locator('select.staff-select-input');
    await expect(regSelect).toBeVisible({ timeout: 10000 });
    const regOptions = await regSelect.locator('option:not([disabled])').allTextContents();
    expect(regOptions).toEqual(
      expect.arrayContaining([
        'Approved / Ready for Release',
        'Released / Completed',
        'Returned to Staff / For Processing',
        'Rejected',
      ])
    );
    expect(regOptions).not.toContain('Pending Payment');
    await regCtx.close();
  });

  test('Fix 3: Staff Confirm Payment Order on PAYMENT_PENDING succeeds without manual remarks, hides redundant Update Status, and auto-closes modal', async ({ page }) => {
    const reqUuid = 'cccc1111-2222-3333-4444-555566667777';
    const paymentUuid = 'dddd1111-2222-3333-4444-555566667777';
    const receiptUrl = `http://127.0.0.1:4173/api/payments/${paymentUuid}/download/`;

    const pendingPayReq = {
      id: reqUuid,
      user: 503,
      tracking_number: 'BSIT-26-11-18-23100503-1-003',
      student_name: 'Jose Rizal',
      student_id: '2023100503',
      credential_type: 1,
      document_type: 'Transcript of Records (TOR)',
      status: 'PAYMENT_PENDING',
      rawStatus: 'PAYMENT_PENDING',
      clearance_status: 'APPROVED',
      payment_status: 'PENDING',
      is_approved: true,
      is_auto_approved: true,
      approved_by_name: 'Elena Reyes',
      assigned_staff: 'Maria Santos',
      or_number: 'OR-2026-8899',
      receipt_image: receiptUrl,
      assessed_amount: '125.00',
      total_amount: '125.00',
      created_at: new Date().toISOString(),
      payments: [
        {
          id: paymentUuid,
          request: reqUuid,
          status: 'PENDING',
          receipt_reference_number: 'OR-2026-8899',
          receipt_image: receiptUrl,
          amount: '125.00',
          uploaded_at: new Date().toISOString(),
        },
      ],
    };

    const staffToken = createMockJwt({ user_id: 777, username: 'staff_maria', role: 'staff', first_name: 'Maria', last_name: 'Santos' });
    let capturedTransition: any = null;

    await page.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_staff');
    }, { token: staffToken });

    await page.route('**/api/users/me/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 777, username: 'staff_maria', role: 'staff', first_name: 'Maria', last_name: 'Santos' }) })
    );
    await page.route('**/api/settings/registrar-approval/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ auto_approve_requests: true, active_registrar_name: 'Elena Reyes' }) })
    );
    await page.route('**/api/clearances/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await page.route('**/api/credentials/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
    await page.route('**/api/notifications/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }));
    await page.route(`**/api/payments/${paymentUuid}/download/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG_BUFFER })
    );
    await page.route(`**/api/payments/${paymentUuid}/verify/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: paymentUuid, status: 'VERIFIED' }) })
    );
    await page.route(`**/api/requests/${reqUuid}/transition/**`, (route) => {
      capturedTransition = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...pendingPayReq, status: 'PAYMENT_VERIFIED', payment_status: 'VERIFIED' }),
      });
    });
    await page.route(`**/api/requests/${reqUuid}/`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pendingPayReq) })
    );
    await page.route('**/api/requests/**', (route) => {
      if (route.request().url().includes(reqUuid)) return route.fallback();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([pendingPayReq]) });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/staff/requests');
    await page.locator('button.staff-btn-view, button:has-text("View")').first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Redundant Update Status button is hidden in PAYMENT_PENDING confirmation step
    await expect(dialog.getByRole('button', { name: /^Update Status$/i })).toHaveCount(0);

    // Dropdown does NOT re-offer Pending Payment as a selectable option
    const selectOpts = await dialog.locator('select.staff-select-input option:not([disabled])').allTextContents();
    expect(selectOpts).not.toContain('Pending Payment');

    // Leave remarks input completely blank and click Confirm Payment Order
    const confirmPaymentBtn = dialog.getByTestId('confirm-payment-order-btn');
    await expect(confirmPaymentBtn).toBeVisible();
    await expect(confirmPaymentBtn).toContainText('Confirm Payment Order');
    await confirmPaymentBtn.click();

    // Backend transition receives default remark & PAYMENT_VERIFIED, toast fires, modal auto-closes!
    await expect.poll(() => capturedTransition?.status).toBe('PAYMENT_VERIFIED');
    expect(capturedTransition.remarks).toContain('Payment order confirmed by staff');
    await expect(page.getByText(/Payment order confirmed/i)).toBeVisible({ timeout: 10000 });
    await expect(dialog).toBeHidden({ timeout: 10000 });
  });
});

