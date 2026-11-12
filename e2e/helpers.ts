import { Page, expect } from '@playwright/test';

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

/**
 * Performs login using numeric user ID and password.
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

  // Wait for post-login redirect according to role
  const expectedPath = role === 'student' 
    ? '/student' 
    : role === 'admin' 
      ? '/admin' 
      : '/staff';

  await page.waitForURL(new RegExp(expectedPath), { timeout: 30000 });
}

