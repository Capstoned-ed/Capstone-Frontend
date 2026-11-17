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

test.describe('Notifications Workflow & UI Verification', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  test('Admin desktop portal renders notification bell, badge, and dropdown items', async ({ page }) => {
    const adminToken = createMockJwt({
      user_id: 999,
      username: 'admin_test',
      role: 'admin',
      first_name: 'System',
      last_name: 'Admin',
    });

    // 1. Seed authenticated Admin JWT into localStorage before page scripts execute
    await page.addInitScript(({ token }) => {
      const mockAdmin = {
        id: 999,
        userId: 999,
        username: 'admin_test',
        full_name: 'System Admin',
        role: 'admin',
        role_type: 'admin',
      };
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', 'mock_refresh_token_admin');
      localStorage.setItem('user', JSON.stringify(mockAdmin));
      localStorage.setItem('regquest_user', JSON.stringify(mockAdmin));
      localStorage.setItem('regquest_role', 'admin');
    }, { token: adminToken });

    // 2. Mock users and auth endpoints
    await page.route('**/api/users/me/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 999,
          username: 'admin_test',
          role: 'admin',
          first_name: 'System',
          last_name: 'Admin',
        }),
      });
    });

    await page.route('**/api/users/staff-directory/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/users/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      });
    });

    // 3. Mock notifications API
    let markAllReadCalled = false;
    await page.route('**/api/notifications/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'POST' && url.includes('mark_all_read')) {
        markAllReadCalled = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'success', updated_count: 2 }),
        });
      }

      if (method === 'GET') {
        const notifications = markAllReadCalled
          ? [
              {
                id: 101,
                event_type: 'REQUEST_SUBMITTED',
                message: 'New Credential Request #RQ-2026-001 submitted by Juan Dela Cruz.',
                related_object_type: 'CredentialRequest',
                related_object_id: 1,
                is_read: true,
                created_at: new Date().toISOString(),
              },
              {
                id: 102,
                event_type: 'PAYMENT_SUBMITTED',
                message: 'Payment receipt submitted for Request #RQ-2026-001.',
                related_object_type: 'CredentialRequest',
                related_object_id: 1,
                is_read: true,
                created_at: new Date().toISOString(),
              },
            ]
          : [
              {
                id: 101,
                event_type: 'REQUEST_SUBMITTED',
                message: 'New Credential Request #RQ-2026-001 submitted by Juan Dela Cruz.',
                related_object_type: 'CredentialRequest',
                related_object_id: 1,
                is_read: false,
                created_at: new Date().toISOString(),
              },
              {
                id: 102,
                event_type: 'PAYMENT_SUBMITTED',
                message: 'Payment receipt submitted for Request #RQ-2026-001.',
                related_object_type: 'CredentialRequest',
                related_object_id: 1,
                is_read: false,
                created_at: new Date().toISOString(),
              },
            ];

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: notifications.length,
            results: notifications,
          }),
        });
      }

      return route.continue();
    });

    // Mock credentials endpoints
    await page.route('**/api/credentials/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0, results: [] }),
      });
    });

    // Set desktop viewport and navigate to Admin dashboard
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Verify desktop header bar renders Admin Portal
    const desktopHeader = page.locator('header.hidden.md\\:flex');
    await expect(desktopHeader).toBeVisible({ timeout: 15000 });
    await expect(desktopHeader.getByText(/Admin Portal/i)).toBeVisible();

    // Verify notification bell is visible on desktop header
    const bellBtn = desktopHeader.locator('[data-testid="notification-bell-btn"]');
    await expect(bellBtn).toBeVisible();

    // Verify unread badge shows 2
    const badge = desktopHeader.locator('[data-testid="notification-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('2');

    // Click bell to toggle dropdown
    await bellBtn.click();

    // Verify dropdown is visible with notifications
    const dropdown = page.locator('[aria-label="Notifications Dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(dropdown.getByText(/New Credential Request #RQ-2026-001/i)).toBeVisible();
    await expect(dropdown.getByText(/Payment receipt submitted/i)).toBeVisible();

    // Click "Mark all read"
    const markAllBtn = dropdown.getByRole('button', { name: /Mark all read/i });
    await expect(markAllBtn).toBeVisible();
    await markAllBtn.click();

    // Verify markAllRead endpoint was invoked
    await expect.poll(() => markAllReadCalled).toBe(true);
  });

  test('Staff desktop portal renders assignment notifications', async ({ page }) => {
    const staffToken = createMockJwt({
      user_id: 6767,
      username: 'staff_maria',
      role: 'staff',
      first_name: 'Maria',
      last_name: 'Staff',
    });

    // 1. Seed Staff JWT
    await page.addInitScript(({ token }) => {
      const mockStaff = {
        id: 6767,
        userId: 6767,
        username: 'staff_maria',
        full_name: 'Maria Staff',
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
          id: 6767,
          username: 'staff_maria',
          role: 'staff',
          first_name: 'Maria',
          last_name: 'Staff',
        }),
      });
    });

    // 2. Mock notifications API with assignment event
    await page.route('**/api/notifications/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: 1,
          results: [
            {
              id: 201,
              event_type: 'REQUEST_ASSIGNED',
              message: 'Request #RQ-2026-042 has been assigned to you for processing.',
              related_object_type: 'CredentialRequest',
              related_object_id: 42,
              is_read: false,
              created_at: new Date().toISOString(),
            },
          ],
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

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/staff');
    await page.waitForLoadState('domcontentloaded');

    // Verify Staff Portal desktop header
    const desktopHeader = page.locator('header.hidden.md\\:flex');
    await expect(desktopHeader).toBeVisible({ timeout: 15000 });
    await expect(desktopHeader.getByText(/Staff Portal/i)).toBeVisible();

    // Verify bell & badge
    const bellBtn = desktopHeader.locator('[data-testid="notification-bell-btn"]');
    await expect(bellBtn).toBeVisible();
    const badge = desktopHeader.locator('[data-testid="notification-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');

    // Click bell and inspect dropdown
    await bellBtn.click();
    const dropdown = page.locator('[aria-label="Notifications Dropdown"]');
    await expect(dropdown).toBeVisible();
    await expect(dropdown.getByText(/Request #RQ-2026-042 has been assigned to you/i)).toBeVisible();
  });
});
