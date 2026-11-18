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

test.describe('Multi-Document Recording, Combined Payment Submission & Admin Breakdown', () => {
  test.use({ baseURL: 'http://127.0.0.1:4173' });

  test('Student submits TOR (2 copies) + Evaluation (1 copy), uploads ₱300.00 payment receipt, and Admin Dashboard & Analytics show BOTH documents', async ({ browser }) => {
    const reqUuid = '77777777-8888-9999-aaaa-bbbbbbbbbbbb';
    const trackingNo = 'BSIT-26-11-18-23100777-15-001';
    const todayIso = new Date().toISOString();

    const liveCredTypes = [
      { id: 1, code: 'TOR', doc_code: '1', name: 'Transcript of Records (TOR)', price: '125.00', processing_days: 7, is_active: true },
      { id: 3, code: 'EVAL', doc_code: '5', name: 'Evaluation', price: '50.00', processing_days: 3, is_active: true },
      { id: 2, code: 'HD', doc_code: '2', name: 'Honorable Dismissal', price: '100.00', processing_days: 5, is_active: true },
    ];

    let capturedCreatePayload: any = null;
    let persistedRequest: any = null;
    let capturedPaymentBody = '';
    let paymentSucceeded = false;

    // 1. STUDENT FLOW: Submit 1 request with 2 different documents (TOR x2 + Evaluation x1 = ₱300.00)
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();

    const studentToken = createMockJwt({
      user_id: 707,
      username: '2023100777',
      role: 'student',
      first_name: 'Liza',
      last_name: 'Soberano',
    });

    await studentPage.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_student707');
    }, { token: studentToken });

    await studentPage.route('**/api/users/me/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 707,
          username: '2023100777',
          role: 'student',
          first_name: 'Liza',
          last_name: 'Soberano',
          email: 'liza@ustp.edu.ph',
          course_name: 'BS in Information Technology',
          course_code: 'BSIT',
          contact_number: '09171234567',
          year_level: '4th year',
        }),
      })
    );

    await studentPage.route('**/api/credentials/types/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(liveCredTypes),
      })
    );

    await studentPage.route('**/api/clearances/**', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'clr-707', status: 'PENDING' }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await studentPage.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    await studentPage.route('**/api/credentials/predict-turnaround/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ predicted_processing_time: 5 }) })
    );

    await studentPage.route('**/api/requests/', async (route) => {
      if (route.request().method() === 'POST') {
        capturedCreatePayload = route.request().postDataJSON();
        const items = capturedCreatePayload.document_items || [];
        const totalAmt = items
          .reduce((s: number, it: any) => s + parseFloat(it.unit_price) * Number(it.copies), 0)
          .toFixed(2);
        const totalCopies = items.reduce((s: number, it: any) => s + Number(it.copies), 0);
        const itemsJson = JSON.stringify(items);

        persistedRequest = {
          id: reqUuid,
          user: 707,
          tracking_number: trackingNo,
          student_name: 'Liza Soberano',
          student_id: '2023100777',
          credential_type: 1,
          credential_name: 'Transcript of Records (TOR)',
          credential_code: 'TOR',
          status: 'PAYMENT_PENDING', // Ready for payment in next step
          copies: totalCopies,
          document_items: items,
          total_amount: totalAmt,
          assessed_amount: totalAmt,
          remarks: `${capturedCreatePayload.remarks} [Total:${totalAmt}] [Items:${itemsJson}]`,
          created_at: todayIso,
          updated_at: todayIso,
          payments: [],
        };

        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(persistedRequest),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(persistedRequest ? [persistedRequest] : []),
      });
    });

    await studentPage.route('**/api/requests/**', (route) => {
      if (route.request().url().endsWith('/api/requests/')) return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(persistedRequest ? [persistedRequest] : []),
      });
    });

    await studentPage.route('**/api/payments/', async (route) => {
      if (route.request().method() === 'POST') {
        capturedPaymentBody = route.request().postData() || '';
        // Enforce backend-identical Decimal total price check (300.00)!
        if (!capturedPaymentBody.includes('300.00')) {
          return route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              amount: ['Amount is less than the required total price of 300.00.'],
            }),
          });
        }
        paymentSucceeded = true;
        const payObj = {
          id: 'pay-multi-707',
          request: reqUuid,
          amount: '300.00',
          receipt_reference_number: 'OR-2026-MULTI-01',
          receipt_image: 'http://127.0.0.1:4173/api/payments/pay-multi-707/download/',
          status: 'PENDING',
          uploaded_at: new Date().toISOString(),
        };
        if (persistedRequest) {
          persistedRequest = {
            ...persistedRequest,
            payments: [payObj],
            or_number: 'OR-2026-MULTI-01',
            payment_status: 'PENDING',
          };
        }
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(payObj),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await studentPage.setViewportSize({ width: 1280, height: 800 });
    await studentPage.goto('/student/new-request');

    // Step 1: Attach required clearance image first
    await studentPage.locator('input[type="file"]').first().setInputFiles({
      name: 'clearance.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });

    // Step 1: Select BOTH Transcript of Records AND Evaluation
    await studentPage.getByLabel(/Transcript of Records/i).check();
    await studentPage.getByLabel(/Evaluation \(P/i).check();

    // Select purpose (For Employment)
    await studentPage.getByLabel(/For Employment/i).check();

    // Proceed to Step 2 (Review)
    await studentPage.getByRole('button', { name: /Next Step/i }).click();

    // Increase TOR copies from 1 -> 2 (first "+" button)
    const plusBtn = studentPage.locator('button:has-text("+")').first();
    await expect(plusBtn).toBeVisible({ timeout: 10000 });
    await plusBtn.click();

    // Fill contact number if empty
    const contactInput = studentPage.locator('#review-contact-input');
    if (await contactInput.isVisible()) {
      const val = await contactInput.inputValue();
      if (!val) await contactInput.fill('09171234567');
    }

    // Submit Request (Step 2 submit button is labeled "Next Step")
    await studentPage.getByRole('button', { name: /Next Step|Submit Request/i }).click();
    await expect.poll(() => Boolean(capturedCreatePayload)).toBe(true);

    // Assert Fix 1 payload: BOTH documents, exact copies, and combined total_amount 300.00!
    expect(capturedCreatePayload.copies).toBe(3);
    expect(capturedCreatePayload.total_amount).toBe('300.00');
    expect(capturedCreatePayload.document_items).toHaveLength(2);
    expect(capturedCreatePayload.document_items.map((it: any) => it.name)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Transcript of Records/i), expect.stringMatching(/Evaluation/i)])
    );

    // Verify TrackStatusPage displays BOTH documents, 3 copies breakdown, and ₱300.00!
    await studentPage.goto('/student/requests');
    await expect(studentPage.getByTestId('track-document-value')).toContainText(/Transcript of Records/i, { timeout: 15000 });
    await expect(studentPage.getByTestId('track-document-value')).toContainText(/Evaluation/i);
    await expect(studentPage.getByTestId('track-copies-value')).toContainText('3 copies');
    await expect(studentPage.getByTestId('track-amount-value')).toHaveText('₱300.00');

    // 2. STUDENT PAYMENT UPLOAD: Upload receipt and verify exact ₱300.00 amount passes without error!
    await studentPage.goto('/student/payments');
    const attachBtn = studentPage.getByRole('button', { name: /Attach Payment Picture/i }).first();
    await expect(attachBtn).toBeVisible({ timeout: 15000 });
    await attachBtn.click();

    // Confirm modal displays exact ₱300.00 fee (not ₱100.00!)
    await expect(studentPage.getByText('₱300.00').first()).toBeVisible();

    await studentPage.locator('input[placeholder*="OR" i], input[placeholder*="Receipt" i]').first().fill('OR-2026-MULTI-01');
    await studentPage.locator('input[type="file"]').setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });
    await studentPage.locator('form button[type="submit"]').click();

    await expect.poll(() => paymentSucceeded).toBe(true);
    expect(capturedPaymentBody).toContain(reqUuid);
    expect(capturedPaymentBody).toContain('300.00');
    expect(capturedPaymentBody).toContain('OR-2026-MULTI-01');

    await studentCtx.close();

    // 3. ADMIN DASHBOARD & ANALYTICS: Verify BOTH TOR and Evaluation appear in live breakdowns!
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    const adminToken = createMockJwt({
      user_id: 1,
      username: 'admin_chief',
      role: 'admin',
      first_name: 'Admin',
      last_name: 'Chief',
    });

    await adminPage.addInitScript(({ token }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_admin');
    }, { token: adminToken });

    await adminPage.route('**/api/users/me/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, username: 'admin_chief', role: 'admin', first_name: 'Admin', last_name: 'Chief' }),
      })
    );

    await adminPage.route('**/api/users/**', (route) => {
      if (route.request().url().includes('/me')) return route.fallback();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await adminPage.route('**/api/credentials/types/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(liveCredTypes) })
    );

    await adminPage.route('**/api/credentials/forecast/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ daily_forecast: [] }) })
    );

    await adminPage.route('**/api/requests/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([persistedRequest]) })
    );

    await adminPage.route('**/api/notifications/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) })
    );

    await adminPage.setViewportSize({ width: 1280, height: 800 });

    // Check Admin Dashboard Request Volume card shows BOTH documents in live legend
    await adminPage.goto('/admin/dashboard');
    const volumeSection = adminPage.locator('#volume');
    await expect(volumeSection).toBeVisible({ timeout: 15000 });
    await expect(volumeSection.getByText(/Transcript of Records \(TOR\)/i)).toBeVisible({ timeout: 10000 });
    await expect(volumeSection.getByText(/^Evaluation$/i)).toBeVisible({ timeout: 10000 });

    // Check Admin Analytics Document Type Breakdown table shows BOTH documents with exact copy counts!
    await adminPage.goto('/admin/analytics');
    const table = adminPage.locator('table.breakdown-table');
    await expect(table).toBeVisible({ timeout: 15000 });

    const torRow = table.locator('tbody tr', { hasText: 'Transcript of Records (TOR)' });
    await expect(torRow).toBeVisible();
    await expect(torRow.locator('td.td-total')).toHaveText('2');

    const evalRow = table.locator('tbody tr', { hasText: 'Evaluation' });
    await expect(evalRow).toBeVisible();
    await expect(evalRow.locator('td.td-total')).toHaveText('1');

    const totalRow = table.locator('tr.breakdown-total-row');
    await expect(totalRow.locator('td.td-total')).toHaveText('3');

    await adminCtx.close();
  });
});

