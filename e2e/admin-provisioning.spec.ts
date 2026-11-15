import { test, expect } from '@playwright/test';
import { loginAs } from './helpers';

test.describe('Admin Account Provisioning & Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test('should navigate to user management and view existing accounts table', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    // Heading or title
    await expect(page.locator('body')).toContainText(/User Management|Users|Accounts/i);

    // Verify presence of Add New User and Add New Student triggers (30s timeout for cold start)
    const addUserBtn = page.getByRole('button', { name: /Add New User/i });
    const addStudentBtn = page.getByRole('button', { name: /Add New Student/i });

    await expect(addUserBtn).toBeVisible({ timeout: 30000 });
    await expect(addStudentBtn).toBeVisible({ timeout: 30000 });
  });

  test('should open Add New User form and verify all required provisioning fields', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    const addUserBtn = page.getByRole('button', { name: /Add New User/i });
    await addUserBtn.click();

    // Verify form fields
    const nameInput = page.getByPlaceholder('Full Name').first();
    const idInput = page.getByPlaceholder('ID Number');
    const emailInput = page.getByPlaceholder('Email');
    const submitBtn = page.getByRole('button', { name: /Add User$/i });

    await expect(nameInput).toBeVisible();
    await expect(idInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Cancel form
    const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first();
    await cancelBtn.click();
    await expect(nameInput).not.toBeVisible();
  });

  test('should open Add New Student form and verify student profile fields', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('domcontentloaded');

    const addStudentBtn = page.getByRole('button', { name: /Add New Student/i });
    await addStudentBtn.click();

    // Verify student form inputs
    const fullNameInput = page.getByPlaceholder('Full Name').first();
    const studentIdInput = page.getByPlaceholder(/Student ID/i).first();
    const emailInput = page.getByPlaceholder(/Email/i).first();
    const courseSelector = page.locator(
      'button:has-text("Select Course"), [placeholder*="Course"]'
    ).first();
    const addStudentSubmit = page.getByRole('button', { name: /Add Student$/i });

    await expect(fullNameInput).toBeVisible();
    await expect(studentIdInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(courseSelector).toBeVisible({ timeout: 15000 });
    await expect(addStudentSubmit).toBeVisible();

    // Cancel form
    const cancelBtn = page.getByRole('button', { name: /Cancel/i }).first();
    await cancelBtn.click();
  });
});

