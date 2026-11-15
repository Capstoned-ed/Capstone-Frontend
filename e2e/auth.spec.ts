import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Authentication & Role-Based Route Guards', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies/localStorage to ensure isolated clean state
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display login page elements properly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Log In/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Forgot password\?/i })).toBeVisible();
  });

  test('should reject invalid credentials with an error banner', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#username').fill('99999999');
    await page.locator('#password').fill('wrongpassword123!');
    await page.getByRole('button', { name: /Log In/i }).click();

    // Verify error banner is displayed (30s timeout to tolerate Render cold start)
    const errorBanner = page.locator('.animate-fadeIn, [class*="bg-red-50"]');
    await expect(errorBanner).toBeVisible({ timeout: 30000 });
    await expect(errorBanner).toContainText(
      /No active account found|Invalid credentials|failed|unable/i
    );
  });

  test('should login successfully as Student with numeric ID and redirect to student dashboard', async ({ page }) => {
    await loginAs(page, 'student');
    await expect(page).toHaveURL(/\/student/);
    // Student navigation items or header should be visible
    await expect(page.locator('body')).toContainText(/Student|Dashboard|Request/i);
  });

  test('should login successfully as Staff with numeric ID and redirect to staff dashboard', async ({ page }) => {
    await loginAs(page, 'staff');
    await expect(page).toHaveURL(/\/staff/);
    await expect(page.locator('body')).toContainText(/Staff|Dashboard|Requests/i);
  });

  test('should login successfully as Admin with numeric ID and redirect to admin dashboard', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('body')).toContainText(/Admin|Dashboard|Users/i);
  });

  test('should enforce route guard: unauthenticated access to protected page redirects to /login', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('should enforce role guard: student cannot access admin users management page', async ({ page }) => {
    await loginAs(page, 'student');
    await page.goto('/admin/users');

    // Should redirect to /forbidden or /login
    await page.waitForURL(/\/(forbidden|login)/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/(forbidden|login)/);
  });
});
