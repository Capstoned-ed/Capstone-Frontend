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

test.describe('Fresh Incognito Context Verification (Login -> All 4 Dashboards)', () => {
  const nowIso = new Date().toISOString();
  const sampleUsers = [
    { id: 1, username: 'admin', full_name: 'System Admin', first_name: 'System', last_name: 'Admin', role: 'admin', is_active: true },
    { id: 10, username: 'reg_officer', full_name: 'Jonalin Lagrada', first_name: 'Jonalin', last_name: 'Lagrada', role: 'registrar', is_active: true },
    { id: 20, username: '20230020', full_name: 'Maria Santos', first_name: 'Maria', last_name: 'Santos', role: 'staff', is_active: true },
    { id: 21, username: '20230021', full_name: 'Jose Reyes', first_name: 'Jose', last_name: 'Reyes', role: 'staff', is_active: true },
  ];

  const sampleRequests = [
    { id: 'REQ-01', tracking_number: 'IT-26-11-18-1001-1-001', student_name: 'Ana Cruz', student_id: '20231001', status: 'PENDING', assigned_staff: 'Maria Santos', assigned_to: 20, credential_type: 1, document_type: 'Transcript of Records (TOR)', created_at: nowIso },
    { id: 'REQ-02', tracking_number: 'IT-26-11-18-1002-1-001', student_name: 'Ben Diaz', student_id: '20231002', status: 'PROCESSING', assigned_staff: 'Maria Santos', assigned_to: 20, credential_type: 1, document_type: 'Transcript of Records (TOR)', created_at: nowIso },
    { id: 'REQ-03', tracking_number: 'IT-26-11-18-1003-2-001', student_name: 'Cara Lim', student_id: '20231003', status: 'READY_FOR_RELEASE', assigned_staff: 'Maria Santos', assigned_to: 20, credential_type: 2, document_type: 'Honorable Dismissal', created_at: nowIso },
    { id: 'REQ-04', tracking_number: 'IT-26-11-18-1004-5-001', student_name: 'Dan Tan', student_id: '20231004', status: 'RELEASED', assigned_staff: 'Maria Santos', assigned_to: 20, credential_type: 3, document_type: 'Evaluation', created_at: nowIso },
    { id: 'REQ-05', tracking_number: 'IT-26-11-18-1005-1-001', student_name: 'Eva Go', student_id: '20231005', status: 'PAYMENT_VERIFIED', assigned_staff: 'Jose Reyes', assigned_to: 21, credential_type: 1, document_type: 'Transcript of Records (TOR)', created_at: nowIso },
  ];

  async function setupIncognitoRoutes(page: any, loginUser: any, accessToken: string) {
    await page.route('**/api/auth/login/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access: accessToken, refresh: 'mock_refresh_token' }),
      })
    );
    await page.route('**/api/users/**', (route: any) => {
      const url = route.request().url();
      if (url.includes('/api/users/me/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(loginUser) });
      }
      if (url.includes('/api/users/staff-directory/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sampleUsers) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: sampleUsers, count: sampleUsers.length }) });
    });
    await page.route('**/api/requests/**', (route: any) => {
      const url = route.request().url();
      // Simulate a 2-page DRF paginated response where RELEASED requests live on Page 2
      if (url.includes('page=2')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: sampleRequests.length,
            next: null,
            results: sampleRequests.slice(3),
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: sampleRequests.length,
          next: 'http://localhost:8000/api/requests/?page=2',
          results: sampleRequests.slice(0, 3),
        }),
      });
    });
    await page.route('**/api/credential-types/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, code: 'TOR', doc_code: '9', name: 'Transcript of Records (TOR)', price: '175.00', processing_days: 7, is_active: true },
          { id: 2, code: 'HD', doc_code: '2', name: 'Honorable Dismissal', price: '100.00', processing_days: 5, is_active: true },
          { id: 3, code: 'EVAL', doc_code: '5', name: 'Evaluation', price: '50.00', processing_days: 3, is_active: true },
        ]),
      })
    );
    await page.route('**/api/clearances/**', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/notifications/**', (route: any) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], count: 0 }) })
    );
    await page.route('**/api/settings/registrar-approval/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ auto_approve_requests: true, active_registrar_name: 'Jonalin Lagrada, MPSM' }),
      })
    );
    await page.route('**/api/credentials/forecast/daily/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          total_predicted_requests: 133,
          forecast: [
            { date: '2026-11-18', weekday: 'Wednesday', predicted_requests: 35 },
            { date: '2026-11-19', weekday: 'Thursday', predicted_requests: 28 },
            { date: '2026-11-20', weekday: 'Friday', predicted_requests: 24 },
            { date: '2026-11-23', weekday: 'Monday', predicted_requests: 23 },
            { date: '2026-11-24', weekday: 'Tuesday', predicted_requests: 23 },
          ],
        }),
      })
    );
    await page.route('**/api/credentials/forecast/monthly-workload/**', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          workload_classification: 'Moderate',
          total_predicted_requests: 540,
          operating_days_count: 21,
        }),
      })
    );
  }

  test('Fresh Incognito Login -> Staff Dashboard shows all 6 real stat card counts including Completed Today', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Simulate JWT with numeric username only (no name in JWT) and empty localStorage
    const staffUser = sampleUsers[2];
    const token = createMockJwt({ user_id: 20, username: '20230020', role: 'staff' });
    await setupIncognitoRoutes(page, staffUser, token);

    await page.goto('http://localhost:4173/login');
    const storageLen = await page.evaluate(() => localStorage.length);
    expect(storageLen).toBe(0);

    await page.locator('#username').fill('20230020');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /Log In/i }).click();

    await page.waitForURL('**/staff/dashboard', { timeout: 10000 });
    await expect(page.locator('header.hidden.md\\:flex')).toHaveCount(0);

    const metricCards = page.locator('.staff-dash-metric-card');
    await expect(metricCards).toHaveCount(6);
    await expect(metricCards.nth(0).locator('.staff-dash-metric-val')).toHaveText('4'); // All assigned (3 active + 1 released)
    await expect(metricCards.nth(1).locator('.staff-dash-metric-val')).toHaveText('1'); // Pending
    await expect(metricCards.nth(2).locator('.staff-dash-metric-val')).toHaveText('1'); // Processing
    await expect(metricCards.nth(3).locator('.staff-dash-metric-val')).toHaveText('0'); // On Hold
    await expect(metricCards.nth(4).locator('.staff-dash-metric-val')).toHaveText('1'); // For Release
    await expect(metricCards.nth(5).locator('.staff-dash-metric-val')).toHaveText('1'); // Completed Today (from Page 2 RELEASED!)

    expect(errors).toEqual([]);
    await context.close();
  });

  test('Fresh Incognito Login -> Admin Dashboard displays real Status Distribution & Staff Performance numbers', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const adminUser = sampleUsers[0];
    const token = createMockJwt({ user_id: 1, username: 'admin', role: 'admin', first_name: 'System', last_name: 'Admin' });
    await setupIncognitoRoutes(page, adminUser, token);

    await page.goto('http://localhost:4173/login');
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /Log In/i }).click();

    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
    await expect(page.locator('header.hidden.md\\:flex')).toHaveCount(0);
    await expect(page.getByText('5-Day Operating Outlook')).toBeVisible();
    await expect(page.getByText('1 (20%)').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.staff-table').getByText('Maria Santos')).toBeVisible();

    expect(errors).toEqual([]);
    await context.close();
  });

  test('Fresh Incognito Login -> Registrar Dashboard & Credential Types live DB merge', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const regUser = sampleUsers[1];
    const token = createMockJwt({ user_id: 10, username: 'reg_officer', role: 'registrar', first_name: 'Jonalin', last_name: 'Lagrada' });
    await setupIncognitoRoutes(page, regUser, token);

    await page.goto('http://localhost:4173/login');
    await page.locator('#username').fill('reg_officer');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /Log In/i }).click();

    await page.waitForURL('**/registrar/dashboard', { timeout: 10000 });
    await expect(page.locator('header.hidden.md\\:flex')).toHaveCount(0);
    await expect(page.getByText('5-Day Operating Outlook')).toBeVisible();
    await expect(page.getByText('1 (20%)').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('auto-approve-toggle')).toHaveCount(0);

    // Navigate to Credential Types: live edited TOR (₱175.00, code 9) wins AND unseeded standard types still appear
    await page.goto('http://localhost:4173/registrar/credentials');
    await expect(page.getByText('175.00').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Certification - GPA').first()).toBeVisible();

    expect(errors).toEqual([]);
    await context.close();
  });

  test('Fresh Incognito Login -> Student Dashboard renders cleanly with zero console errors', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const studentUser = { id: 99, username: '20231001', full_name: 'Ana Cruz', first_name: 'Ana', last_name: 'Cruz', role: 'student' };
    const token = createMockJwt({ user_id: 99, username: '20231001', role: 'student', first_name: 'Ana', last_name: 'Cruz' });
    await setupIncognitoRoutes(page, studentUser, token);

    await page.goto('http://localhost:4173/login');
    await page.locator('#username').fill('20231001');
    await page.locator('#password').fill('password123');
    await page.getByRole('button', { name: /Log In/i }).click();

    await page.waitForURL('**/student/dashboard', { timeout: 10000 });
    await expect(page.locator('header.hidden.md\\:flex')).toHaveCount(0);
    await expect(page.getByText('Available Credentials')).toBeVisible();
    await expect(page.getByText('Transcript of Records').first()).toBeVisible();

    expect(errors).toEqual([]);
    await context.close();
  });
});

