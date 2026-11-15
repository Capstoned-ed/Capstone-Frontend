import { Page, APIRequestContext, expect } from '@playwright/test';

export const credentials = {
  admin: {
    id: process.env.E2E_ADMIN_ID || '24689',
    password: process.env.E2E_ADMIN_PASSWORD || '24689',
  },
  staff: {
    id: process.env.E2E_STAFF_ID || '6767',
    password: process.env.E2E_STAFF_PASSWORD || '6767',
  },
  student: {
    id: process.env.E2E_STUDENT_ID || '10101010',
    password: process.env.E2E_STUDENT_PASSWORD || '10101010',
  },
};

export const apiBaseUrl = process.env.E2E_API_URL || 'https://regquest-backend-staging.onrender.com';

/**
 * Performs login using numeric user ID and password in the browser.
 */
export async function loginAs(
  page: Page,
  role: 'admin' | 'staff' | 'student'
): Promise<void> {
  const creds = credentials[role];
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const idInput = page.locator('#username');
  const passwordInput = page.locator('#password');
  const submitButton = page.getByRole('button', { name: /Log In/i });

  await expect(idInput).toBeVisible({ timeout: 15000 });
  await idInput.fill(creds.id);
  await passwordInput.fill(creds.password);
  await submitButton.click();

  // Wait for post-login redirect according to role (60s to accommodate Render cold start latency)
  const expectedPath = role === 'student' 
    ? '/student' 
    : role === 'admin' 
      ? '/admin' 
      : '/staff';

  await page.waitForURL(new RegExp(expectedPath), { timeout: 60000 });
}

/**
 * Obtains JWT access token directly from DRF backend for API-level verification.
 */
export async function getAuthToken(
  request: APIRequestContext,
  role: 'admin' | 'staff' | 'student'
): Promise<string> {
  const creds = credentials[role];
  const response = await request.post(`${apiBaseUrl}/api/auth/login/`, {
    data: {
      username: creds.id,
      password: creds.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to authenticate via API for ${role}: ${response.status()} ${await response.text()}`);
  }

  const data = await response.json();
  return data.access;
}

/**
 * Performs logout in the browser and waits for full page reload back to /login.
 */
export async function performLogout(page: Page): Promise<void> {
  const visibleLogoutBtn = page.locator('button:has-text("Logout"), button[title="Logout"]').filter({ visible: true }).first();

  if (!(await visibleLogoutBtn.isVisible())) {
    // If mobile hamburger menu exists and is visible, ensure drawer is open
    const mobileToggle = page.locator('header button[title="Toggle Navigation Menu"]').filter({ visible: true });
    if (await mobileToggle.isVisible()) {
      const visibleAside = page.locator('aside').filter({ visible: true });
      if (!(await visibleAside.isVisible())) {
        await mobileToggle.click();
        await page.waitForTimeout(300);
      }
    }

    // Now look for the visible profile button in the visible aside
    const profileBtn = page.locator('aside')
      .filter({ visible: true })
      .locator('button')
      .filter({ has: page.locator('svg path[d*="M12 12c2.21"]') })
      .first();

    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      await page.waitForTimeout(300);
    }
  }

  const finalLogoutBtn = page.locator('button:has-text("Logout"), button[title="Logout"]').filter({ visible: true }).first();
  await expect(finalLogoutBtn).toBeVisible({ timeout: 15000 });
  await finalLogoutBtn.click();

  await page.waitForURL(/\/login/, { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
}
