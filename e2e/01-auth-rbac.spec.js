import { test, expect } from '@playwright/test';
import {
  apiBaseUrl,
  loginAs,
  performLogout,
  getAuthToken,
  E2ETestTracker,
} from './helpers/authAndSeed.js';

test.describe('Suite 01: Authentication, Session & Role-Based Access Control (RBAC)', () => {
  let tracker;

  test.beforeEach(async ({ request }) => {
    tracker = new E2ETestTracker(request);
  });

  test.afterEach(async () => {
    await tracker.cleanupAll();
  });

  test('TC-AUTH-01 & 02: Login and Logout across roles (Student, Staff, Registrar, Admin)', async ({ page }) => {
    test.setTimeout(180000);
    // 1. Student Login & Logout
    await loginAs(page, 'student');
    await expect(page).toHaveURL(/\/student/);
    await performLogout(page);
    await expect(page).toHaveURL(/\/login/);

    // 2. Staff Login & Logout
    await loginAs(page, 'staff');
    await expect(page).toHaveURL(/\/staff/);
    await performLogout(page);
    await expect(page).toHaveURL(/\/login/);

    // 3. Registrar Login & Logout
    await loginAs(page, 'registrar');
    await expect(page).toHaveURL(/\/registrar/);
    await performLogout(page);
    await expect(page).toHaveURL(/\/login/);

    // 4. Admin Login & Logout
    await loginAs(page, 'admin');
    await expect(page).toHaveURL(/\/admin/);
    await performLogout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-AUTH-03: Deactivated account (is_active=False) blocked from login', async ({ page }) => {
    test.setTimeout(90000);
    // Admin provisions a temporary deactivated user
    const tempUser = await tracker.createTemporaryUser({
      role: 'student',
      is_active: false,
    });

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#username').fill(tempUser.username);
    await page.locator('#password').fill(tempUser.plainPassword);
    await page.getByRole('button', { name: /Log In/i }).click();

    // Verify error notification or inline error is shown and user is not redirected
    const errorNotice = page.locator('text=/Invalid credentials|No active account found|deactivated|Unable to connect/i').first();
    await expect(errorNotice).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('TC-RBAC-01: Admin read-only enforcement on Processing Calendar and ProcessRequestModal', async ({ page, request }) => {
    test.setTimeout(90000);
    await loginAs(page, 'admin');

    // Navigate to Admin Processing Calendar
    await page.goto('/admin/calendar');
    await page.waitForLoadState('domcontentloaded');

    // Click on an active batch card or calendar day cell to open the scheduled docs detail modal
    const batchCard = page.locator('.batch-item-card, .calendar-day-cell').first();
    if (await batchCard.isVisible()) {
      await batchCard.click();
      await page.waitForTimeout(500);
    }

    // Verify Admin View-Only badge or calendar active batch content is rendered
    const viewIndicator = page.locator('[data-testid="admin-view-only-badge"], .scheduled-docs-modal-container')
      .or(page.getByText(/View Only \(Admin\)|All Active Batches/i))
      .first();
    await expect(viewIndicator).toBeVisible({ timeout: 20000 });

    // Verify backend enforces 403 Forbidden if Admin attempts direct processing mutation
    const { access: adminToken } = await getAuthToken(request, 'admin');
    const mutationResponse = await request.post(`${apiBaseUrl}/api/batches/`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        name: 'e2e_unauthorized_admin_batch',
        scheduled_date: new Date().toISOString().split('T')[0],
      },
    });

    // Admin is read-only on processing batches -> 403 Forbidden or method not allowed
    expect([403, 404, 405]).toContain(mutationResponse.status());
  });

  test('TC-RBAC-02: Role change auto-unassignment (STAFF -> STUDENT) using temporary e2e user', async ({ request }) => {
    test.setTimeout(90000);
    const { access: adminToken } = await getAuthToken(request, 'admin');
    const { access: studentToken } = await getAuthToken(request, 'student');

    // 1. Create temporary staff user
    const tempStaff = await tracker.createTemporaryUser({ role: 'staff' });

    // 2. Fetch active credential type with admin token
    const credTypesRes = await request.get(`${apiBaseUrl}/api/credential-types/`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const credTypes = await credTypesRes.json();
    const activeType = (Array.isArray(credTypes) ? credTypes : credTypes.results || []).find(
      (ct) => ct.is_active
    );
    expect(activeType).toBeDefined();

    // 3. Create test request
    const createReqRes = await request.post(`${apiBaseUrl}/api/requests/`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        credential_type: activeType.id,
        purpose: 'E2E Role-Change Test',
        remarks: '[E2E-TEST] Testing role change auto-unassign',
        copies: 1,
      },
    });
    expect(createReqRes.ok()).toBeTruthy();
    const createdReq = await createReqRes.json();

    // 4. Assign request to temporary staff user
    const assignRes = await request.post(`${apiBaseUrl}/api/requests/${createdReq.id}/assign/`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        assigned_staff: tempStaff.username,
      },
    });
    expect(assignRes.ok()).toBeTruthy();

    // 5. Admin changes temporary staff user's role to STUDENT
    const roleChangeRes = await request.patch(`${apiBaseUrl}/api/users/${tempStaff.id}/`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        role: 'student',
      },
    });
    expect(roleChangeRes.ok()).toBeTruthy();

    // 6. Verify request was automatically unassigned
    const verifyReqRes = await request.get(`${apiBaseUrl}/api/requests/${createdReq.id}/`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(verifyReqRes.ok()).toBeTruthy();
    const updatedReq = await verifyReqRes.json();

    expect([null, '', undefined]).toContain(updatedReq.assigned_staff);
    expect(updatedReq.assigned_to).toBeNull();
    expect(updatedReq.in_process_queue).toBeFalsy();
  });

  test('TC-RBAC-03: Route guard protection blocks unauthorized direct navigation', async ({ page }) => {
    test.setTimeout(90000);
    // Student attempting to access Admin User Management
    await loginAs(page, 'student');
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to /forbidden or /student/dashboard
    await expect(page).toHaveURL(/\/(forbidden|student)/);

    // Student attempting to access Registrar dashboard
    await page.goto('/registrar/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/(forbidden|student)/);
  });
});
