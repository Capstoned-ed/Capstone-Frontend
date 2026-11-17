import { test, expect } from '@playwright/test';

test.describe('App Smoke & White Screen Verification', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  test('Render Login page without ReferenceError or console page errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Verify page renders cleanly
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('#username')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#password')).toBeVisible({ timeout: 10000 });

    expect(pageErrors).toEqual([]);
  });

  test('Render Staff Requests page and ProcessRequestModal component with zero ReferenceError', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Seed mock auth for staff so staff pages render
    await page.addInitScript(() => {
      const mockStaff = {
        id: '123',
        userId: '123',
        username: 'staff1',
        full_name: 'Test Staff',
        role: 'staff',
        role_type: 'staff',
      };
      localStorage.setItem('access_token', 'mock_token_123');
      localStorage.setItem('user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_user', JSON.stringify(mockStaff));
      localStorage.setItem('regquest_role', 'staff');
    });

    await page.goto('/staff/requests');
    await page.waitForLoadState('domcontentloaded');

    // Page renders without white screen or crashing
    await expect(page.locator('body')).not.toBeEmpty();

    // Verify no ReferenceError occurred
    const refErrors = pageErrors.filter((e) => e.includes('ReferenceError') || e.includes('payments is not defined'));
    expect(refErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Render Admin Requests page with zero ReferenceError', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.addInitScript(() => {
      const mockAdmin = {
        id: '999',
        userId: '999',
        username: 'admin',
        full_name: 'Admin User',
        role: 'admin',
        role_type: 'admin',
      };
      localStorage.setItem('access_token', 'mock_token_admin');
      localStorage.setItem('user', JSON.stringify(mockAdmin));
      localStorage.setItem('regquest_user', JSON.stringify(mockAdmin));
      localStorage.setItem('regquest_role', 'admin');
    });

    await page.goto('/admin/requests');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).not.toBeEmpty();

    const refErrors = pageErrors.filter((e) => e.includes('ReferenceError') || e.includes('payments is not defined'));
    expect(refErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Render Student Track Status page with zero ReferenceError', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.addInitScript(() => {
      const mockStudent = {
        id: '555',
        userId: '555',
        username: 'student1',
        full_name: 'Student User',
        role: 'student',
        role_type: 'student',
      };
      localStorage.setItem('access_token', 'mock_token_student');
      localStorage.setItem('user', JSON.stringify(mockStudent));
      localStorage.setItem('regquest_user', JSON.stringify(mockStudent));
      localStorage.setItem('regquest_role', 'student');
    });

    await page.goto('/student/track');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('body')).not.toBeEmpty();

    const refErrors = pageErrors.filter((e) => e.includes('ReferenceError') || e.includes('payments is not defined'));
    expect(refErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
