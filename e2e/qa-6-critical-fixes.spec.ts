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

// Minimal valid 1x1 PNG buffer for receipt image tests
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test.describe('6 Critical Pre-Defense Integration & RBAC Fixes', () => {
  test.use({ baseURL: 'http://127.0.0.1:4173' });

  test('Fix 1: TrackStatusPage displays actual requested copies (never hardcoded 1 copy)', async ({ page }) => {
    const studentToken = createMockJwt({
      user_id: 501,
      username: '2023100501',
      role: 'student',
      first_name: 'Carlos',
      last_name: 'Mendoza',
    });

    const todayIso = new Date().toISOString();
    const mockRequests = [
      {
        id: 'aaaaaaaa-1111-1111-1111-111111111111',
        user: 501,
        tracking_number: 'BSIT-26-11-18-23100501-1-001',
        student_name: 'Carlos Mendoza',
        student_id: '2023100501',
        credential_type: 1,
        credential_name: 'Transcript of Records (TOR)',
        document_type: 'Transcript of Records (TOR)',
        copies: 3,
        status: 'PENDING',
        remarks: '[Transcript of Records (TOR)] Employment [Copies: 3]',
        created_at: todayIso,
        updated_at: todayIso,
        payments: [],
      },
      {
        id: 'aaaaaaaa-2222-2222-2222-222222222222',
        user: 501,
        tracking_number: 'BSIT-26-11-18-23100501-2-002',
        student_name: 'Carlos Mendoza',
        student_id: '2023100501',
        credential_type: 2,
        credential_name: 'Honorable Dismissal',
        document_type: 'Honorable Dismissal',
        status: 'PENDING',
        remarks: '[Honorable Dismissal] Transfer [Copies: 4]',
        created_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date(Date.now() - 60000).toISOString(),
        payments: [],
      },
    ];

    await page.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_student');
    }, { token: studentToken });

    await page.route('**/api/users/me/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 501,
          username: '2023100501',
          role: 'student',
          first_name: 'Carlos',
          last_name: 'Mendoza',
        }),
      })
    );

    await page.route('**/api/credentials/types/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, code: 'TOR', doc_code: '1', name: 'Transcript of Records (TOR)', price: '125.00', processing_days: 5, is_active: true },
          { id: 2, code: 'HD', doc_code: '2', name: 'Honorable Dismissal', price: '100.00', processing_days: 5, is_active: true },
        ]),
      })
    );

    await page.route('**/api/requests/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRequests),
      })
    );

    await page.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    await page.route('**/api/credentials/predict-turnaround/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ predicted_processing_time: 5 }) })
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/student/requests');

    const copiesVal = page.getByTestId('track-copies-value');
    await expect(copiesVal).toBeVisible({ timeout: 15000 });
    await expect(copiesVal).toHaveText('3 copies');

    // Select second request (parsed from [Copies: 4] in remarks)
    await page.getByText('BSIT-26-11-18-23100501-2-002').first().click();
    await expect(copiesVal).toHaveText('4 copies');
  });

  test('Fix 2: Registrar Auto-Approve toggle is removed from Registrar Dashboard and Requests queue', async ({ page }) => {
    const regToken = createMockJwt({
      user_id: 909,
      username: 'reg_elena',
      role: 'registrar',
      first_name: 'Elena',
      last_name: 'Reyes',
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_reg');
    }, { token: regToken });

    await page.route('**/api/users/me/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 909,
          username: 'reg_elena',
          role: 'registrar',
          first_name: 'Elena',
          last_name: 'Reyes',
          full_name: 'Elena Reyes',
        }),
      })
    );

    await page.route('**/api/settings/registrar-approval/**', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          auto_approve_requests: true,
          default_signatory_name: 'Elena Reyes',
          default_signatory_title: 'University Registrar',
          active_registrar_name: 'Elena Reyes',
        }),
      });
    });

    await page.route('**/api/requests/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/credentials/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/users/**', (route) => {
      if (route.request().url().includes('/me')) return route.fallback();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/clearances/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/registrar/dashboard');
    await expect(page.getByTestId('auto-approve-toggle')).toHaveCount(0);

    // Also verify RegistrarRequestsPage
    await page.goto('/registrar/requests');
    await expect(page.getByTestId('auto-approve-toggle')).toHaveCount(0);
  });

  test('Fix 3: Student receipt upload binds to exact request UUID and Staff modal fetches live detail + renders authenticated blob preview', async ({ page }) => {
    const reqUuid = '11111111-2222-3333-4444-555555555555';
    const paymentUuid = '99999999-8888-7777-6666-555555555555';
    const receiptDownloadUrl = `http://127.0.0.1:4173/api/payments/${paymentUuid}/download/`;

    let uploadedMultipartText = '';
    let paymentUploadedOnServer = false;

    const studentToken = createMockJwt({
      user_id: 502,
      username: '2023100502',
      role: 'student',
      first_name: 'Ana',
      last_name: 'Lim',
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_student2');
    }, { token: studentToken });

    await page.route('**/api/users/me/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 502, username: '2023100502', role: 'student', first_name: 'Ana', last_name: 'Lim' }),
      })
    );

    await page.route('**/api/credentials/types/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, code: 'TOR', doc_code: '1', name: 'Transcript of Records (TOR)', price: '125.00', processing_days: 5, is_active: true }]),
      })
    );

    await page.route('**/api/payments/', async (route) => {
      if (route.request().method() === 'POST') {
        uploadedMultipartText = route.request().postData() || '';
        paymentUploadedOnServer = true;
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: paymentUuid,
            request: reqUuid,
            amount: '125.00',
            receipt_reference_number: 'OR-2026-7788',
            receipt_image: receiptDownloadUrl,
            status: 'PENDING',
            uploaded_at: new Date().toISOString(),
          }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/requests/**', (route) => {
      const payments = paymentUploadedOnServer
        ? [
            {
              id: paymentUuid,
              request: reqUuid,
              amount: '125.00',
              receipt_reference_number: 'OR-2026-7788',
              receipt_image: receiptDownloadUrl,
              status: 'PENDING',
              uploaded_at: new Date().toISOString(),
            },
          ]
        : [];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: reqUuid,
            user: 502,
            tracking_number: 'BSIT-26-11-18-23100502-1-001',
            student_name: 'Ana Lim',
            student_id: '2023100502',
            credential_type: 1,
            document_type: 'Transcript of Records (TOR)',
            status: 'PAYMENT_PENDING',
            assessed_amount: '125.00',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            payments,
          },
        ]),
      });
    });

    await page.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/student/payments');

    // Open payment upload modal
    const uploadBtn = page.getByRole('button', { name: /Attach Payment Picture|Update Receipt Picture/i }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 15000 });
    await uploadBtn.click();

    await page.locator('input[placeholder*="OR" i], input[placeholder*="Receipt" i]').first().fill('OR-2026-7788');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });
    await page.locator('form button[type="submit"]').click();

    await expect.poll(() => paymentUploadedOnServer).toBe(true);
    expect(uploadedMultipartText).toContain(reqUuid);
    expect(uploadedMultipartText).toContain('OR-2026-7788');

    // Now open a completely fresh Incognito Staff context (ZERO shared localStorage/sessionStorage!)
    // Simulate stale list row (payments: []) while live GET /api/requests/<uuid>/ returns the uploaded payment!
    const staffContext = await page.context().browser()!.newContext();
    const staffPage = await staffContext.newPage();

    const staffToken = createMockJwt({
      user_id: 777,
      username: 'staff_maria',
      role: 'staff',
      first_name: 'Maria',
      last_name: 'Santos',
    });

    let receiptDownloadAuthHeader = '';

    await staffPage.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_staff');
    }, { token: staffToken });

    await staffPage.route('**/api/users/me/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 777, username: 'staff_maria', role: 'staff', first_name: 'Maria', last_name: 'Santos' }),
      })
    );

    await staffPage.route('**/api/settings/registrar-approval/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ auto_approve_requests: true, active_registrar_name: 'Elena Reyes' }),
      })
    );

    await staffPage.route('**/api/clearances/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await staffPage.route('**/api/credentials/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await staffPage.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    await staffPage.route(`**/api/payments/${paymentUuid}/download/**`, (route) => {
      receiptDownloadAuthHeader = route.request().headers()['authorization'] || '';
      if (!receiptDownloadAuthHeader.startsWith('Bearer ')) {
        return route.fulfill({ status: 401, body: 'Unauthorized' });
      }
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: TINY_PNG_BUFFER,
      });
    });

    // Live single-request detail returns the newly uploaded payment!
    await staffPage.route(`**/api/requests/${reqUuid}/`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: reqUuid,
          user: 502,
          tracking_number: 'BSIT-26-11-18-23100502-1-001',
          student_name: 'Ana Lim',
          student_id: '2023100502',
          credential_type: 1,
          document_type: 'Transcript of Records (TOR)',
          status: 'PAYMENT_PENDING',
          clearance_status: 'APPROVED',
          assigned_staff: 'Maria Santos',
          assessed_amount: '125.00',
          or_number: 'OR-2026-7788',
          receipt_image: receiptDownloadUrl,
          payment_status: 'PENDING',
          payments: [
            {
              id: paymentUuid,
              request: reqUuid,
              amount: '125.00',
              receipt_reference_number: 'OR-2026-7788',
              receipt_image: receiptDownloadUrl,
              status: 'PENDING',
              uploaded_at: new Date().toISOString(),
            },
          ],
          created_at: new Date().toISOString(),
        }),
      })
    );

    // Simulate stale list response (payments: [] before detail refetch)
    await staffPage.route('**/api/requests/**', (route) => {
      if (route.request().url().includes(reqUuid)) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: reqUuid,
            user: 502,
            tracking_number: 'BSIT-26-11-18-23100502-1-001',
            student_name: 'Ana Lim',
            student_id: '2023100502',
            credential_type: 1,
            document_type: 'Transcript of Records (TOR)',
            status: 'PAYMENT_PENDING',
            clearance_status: 'APPROVED',
            assigned_staff: 'Maria Santos',
            assessed_amount: '125.00',
            payments: [],
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await staffPage.setViewportSize({ width: 1280, height: 800 });
    await staffPage.goto('/staff/requests');

    const viewBtn = staffPage.locator('button.staff-btn-view, button:has-text("View")').first();
    await expect(viewBtn).toBeVisible({ timeout: 15000 });
    await viewBtn.click();

    // Staff modal refetches live detail, downloads receipt WITH Bearer auth, and renders blob: image!
    const thumbImg = staffPage.getByTestId('receipt-thumbnail-img');
    await expect(thumbImg).toBeVisible({ timeout: 15000 });
    const src = await thumbImg.getAttribute('src');
    expect(src?.startsWith('blob:')).toBe(true);
    expect(receiptDownloadAuthHeader).toContain('Bearer ');
    await expect(staffPage.getByTestId('payment-receipt-box')).toContainText('OR-2026-7788');

    await staffContext.close();
  });

  test('Fix 4: Staff page refresh waits for /api/users/me/ hydration with zero Access Restricted flash', async ({ page }) => {
    // JWT intentionally omits role so role MUST come from delayed /api/users/me/
    const staffTokenNoRole = createMockJwt({
      user_id: 777,
      username: 'staff_maria',
      first_name: 'Maria',
      last_name: 'Santos',
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_staff');
    }, { token: staffTokenNoRole });

    await page.route('**/api/users/me/**', async (route) => {
      await new Promise((r) => setTimeout(r, 450));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 777,
          username: 'staff_maria',
          role: 'STAFF', // Uppercase to also verify normalization!
          first_name: 'Maria',
          last_name: 'Santos',
        }),
      });
    });

    await page.route('**/api/requests/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/credentials/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    let sawForbiddenUrl = false;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && (frame.url().includes('/forbidden') || frame.url().includes('/403'))) {
        sawForbiddenUrl = true;
      }
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/staff/dashboard');
    await expect(page.getByRole('heading', { name: /Staff Dashboard/i })).toBeVisible({ timeout: 15000 });

    // Perform hard page reload and confirm zero /403 redirect or Access Restricted flash
    await page.reload();
    await expect(page.getByRole('heading', { name: /Staff Dashboard/i })).toBeVisible({ timeout: 15000 });
    expect(sawForbiddenUrl).toBe(false);
    await expect(page.getByText(/Access Restricted/i)).toHaveCount(0);
    expect(page.url()).toContain('/staff/dashboard');
  });

  test('Fix 5: Strict Role Route Isolation blocks STAFF from /registrar/*, ADMIN from /registrar/*, REGISTRAR from /staff/* and /admin/*', async ({ browser }) => {
    const verifyBlocked = async (role: string, forbiddenPath: string) => {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      const tok = createMockJwt({ user_id: 100, username: `user_${role}`, role });
      await p.addInitScript(({ token }) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', 'mock_refresh');
      }, { token: tok });
      await p.route('**/api/users/me/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 100, username: `user_${role}`, role, first_name: 'Test', last_name: role }),
        })
      );
      await p.route('**/api/notifications/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
      );

      await p.goto(`http://127.0.0.1:4173${forbiddenPath}`);
      await expect(p).toHaveURL(/\/forbidden/, { timeout: 15000 });
      await expect(p.getByRole('heading', { name: /Access Restricted/i })).toBeVisible();
      await ctx.close();
    };

    await verifyBlocked('staff', '/registrar/dashboard');
    await verifyBlocked('staff', '/admin/dashboard');
    await verifyBlocked('admin', '/registrar/dashboard');
    await verifyBlocked('registrar', '/staff/dashboard');
    await verifyBlocked('registrar', '/admin/dashboard');
    await verifyBlocked('student', '/registrar/dashboard');
  });

  test('Fix 6: Admin Analytics dynamically aggregates live document request counts including custom DB credential types', async ({ page }) => {
    const adminToken = createMockJwt({
      user_id: 1,
      username: 'admin_chief',
      role: 'admin',
      first_name: 'Admin',
      last_name: 'Chief',
    });

    const todayIso = new Date().toISOString();
    const liveCredTypes = [
      { id: 1, code: 'TOR', doc_code: '1', name: 'Transcript of Records (TOR)', price: '125.00', processing_days: 5, is_active: true },
      { id: 2, code: 'HD', doc_code: '2', name: 'Honorable Dismissal', price: '100.00', processing_days: 5, is_active: true },
      { id: 99, code: 'GMC', doc_code: '12', name: 'Certificate of Good Moral', price: '75.00', processing_days: 2, is_active: true },
    ];

    const liveRequests = [
      { id: 'r1', tracking_number: 'BSIT-26-11-18-001-1-001', credential_type: 1, credential_name: 'Transcript of Records (TOR)', status: 'PENDING', created_at: todayIso },
      { id: 'r2', tracking_number: 'BSIT-26-11-18-002-1-002', credential_type: 1, credential_name: 'Transcript of Records (TOR)', status: 'RELEASED', created_at: todayIso },
      { id: 'r3', tracking_number: 'BSIT-26-11-18-003-2-003', credential_type: 2, credential_name: 'Honorable Dismissal', status: 'PROCESSING', created_at: todayIso },
      { id: 'r4', tracking_number: 'BSIT-26-11-18-004-12-004', credential_type: 99, credential_name: 'Certificate of Good Moral', status: 'PENDING', created_at: todayIso },
      { id: 'r5', tracking_number: 'BSIT-26-11-18-005-12-005', credential_type: 99, credential_name: 'Certificate of Good Moral', status: 'RELEASED', created_at: todayIso },
      { id: 'r6', tracking_number: 'BSIT-26-11-18-006-12-006', credential_type: 99, credential_name: 'Certificate of Good Moral', status: 'PAYMENT_PENDING', created_at: todayIso },
    ];

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

    await page.route('**/api/credentials/types/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(liveCredTypes) })
    );

    await page.route('**/api/requests/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(liveRequests) })
    );

    await page.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/analytics');

    const table = page.locator('table.breakdown-table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Verify ALL 3 live document types appear with exact live counts (including custom DB credential!)
    const torRow = table.locator('tbody tr', { hasText: 'Transcript of Records (TOR)' });
    await expect(torRow).toBeVisible();
    await expect(torRow.locator('td.td-total')).toHaveText('2');

    const hdRow = table.locator('tbody tr', { hasText: 'Honorable Dismissal' });
    await expect(hdRow).toBeVisible();
    await expect(hdRow.locator('td.td-total')).toHaveText('1');

    const gmcRow = table.locator('tbody tr', { hasText: 'Certificate of Good Moral' });
    await expect(gmcRow).toBeVisible();
    await expect(gmcRow.locator('td.td-total')).toHaveText('3');

    // Grand total row equals 6
    const totalRow = table.locator('tr.breakdown-total-row');
    await expect(totalRow.locator('td.td-total')).toHaveText('6');
  });
});

